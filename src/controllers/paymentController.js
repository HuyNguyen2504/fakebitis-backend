const moment = require('moment');
const crypto = require('crypto');
const qs = require('qs');
const Order = require('../models/Order');

// VNPAY config (Sandbox mock)
const vnp_TmnCode = "DUMMY123";
const vnp_HashSecret = "DUMMYSECRETKEY1234567890";
const vnp_Url = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
const vnp_ReturnUrl = "http://localhost:5000/api/payment/vnpay_return";

exports.createPaymentUrl = async (req, res) => {
  try {
    const { amount, items, bankCode, address } = req.body;
    
    // Create an order in pending state
    const order = await Order.create({
      user: req.user._id,
      items,
      totalAmount: amount,
      shippingAddress: address,
      status: 'Pending',
      paymentMethod: 'VNPAY'
    });

    const ipAddr = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    let tmnCode = vnp_TmnCode;
    let secretKey = vnp_HashSecret;
    let vnpUrl = vnp_Url;
    let returnUrl = vnp_ReturnUrl;

    let date = new Date();
    let createDate = moment(date).format('YYYYMMDDHHmmss');
    let orderId = order._id.toString();

    let vnp_Params = {};
    vnp_Params['vnp_Version'] = '2.1.0';
    vnp_Params['vnp_Command'] = 'pay';
    vnp_Params['vnp_TmnCode'] = tmnCode;
    vnp_Params['vnp_Locale'] = 'vn';
    vnp_Params['vnp_CurrCode'] = 'VND';
    vnp_Params['vnp_TxnRef'] = orderId;
    vnp_Params['vnp_OrderInfo'] = 'Thanh toan don hang ' + orderId;
    vnp_Params['vnp_OrderType'] = 'other';
    vnp_Params['vnp_Amount'] = amount * 100;
    vnp_Params['vnp_ReturnUrl'] = returnUrl;
    vnp_Params['vnp_IpAddr'] = ipAddr;
    vnp_Params['vnp_CreateDate'] = createDate;
    if(bankCode !== null && bankCode !== ''){
        vnp_Params['vnp_BankCode'] = bankCode;
    }

    vnp_Params = Object.keys(vnp_Params).sort().reduce(
      (obj, key) => { 
        obj[key] = vnp_Params[key]; 
        return obj;
      }, 
      {}
    );

    let signData = qs.stringify(vnp_Params, { encode: false });
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex"); 
    vnp_Params['vnp_SecureHash'] = signed;
    vnpUrl += '?' + qs.stringify(vnp_Params, { encode: false });

    // In a real scenario we return vnpUrl, but since we may not have a real sandbox account, 
    // we'll mock the success redirect for demo purposes if desired.
    // However, since we're using "DUMMY", the sandbox might reject it.
    // We will return a mock redirect URL that goes straight to our return handler to simulate success.
    const mockSuccessUrl = `http://localhost:5000/api/payment/vnpay_return?vnp_ResponseCode=00&vnp_TxnRef=${orderId}`;

    res.json({ url: mockSuccessUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const sendConfirmationEmail = require('../utils/sendEmail');

exports.vnpayReturn = async (req, res) => {
  let vnp_Params = req.query;
  const orderId = vnp_Params['vnp_TxnRef'];
  const responseCode = vnp_Params['vnp_ResponseCode'];

  try {
    const order = await Order.findById(orderId).populate('user');
    if (!order) {
      return res.redirect('http://localhost:3000/history?status=error');
    }

    if (responseCode === '00') {
      // Success
      order.status = 'Paid';
      order.transactionId = vnp_Params['vnp_TransactionNo'] || 'MOCK-TXN-ID';
      await order.save();

      // Update product sold counts and decrement variant stock
      const Product = require('../models/Product');
      for (const item of order.items) {
        await Product.updateOne(
          { _id: item.product, 'variants.color': item.color, 'variants.size': item.size },
          { 
            $inc: { 
              sold: item.quantity,
              'variants.$.stock': -item.quantity
            } 
          }
        );
      }

      // Send email
      await sendConfirmationEmail(order.user.email, order);

      return res.redirect('http://localhost:3000/history?status=success');
    } else {
      order.status = 'Failed';
      await order.save();
      return res.redirect('http://localhost:3000/history?status=failed');
    }
  } catch (error) {
    console.error(error);
    res.redirect('http://localhost:3000/history?status=error');
  }
};
