const moment = require('moment');
const crypto = require('crypto');
const qs = require('qs');
const Order = require('../models/Order');

// VNPAY config from environment variables
const vnp_TmnCode = process.env.VNP_TMN_CODE || "Z4S5LMFE";
const vnp_HashSecret = process.env.VNP_HASH_SECRET || "6DZUMTDB5RLQ4S1WOML9D2Q06SRL1XI7";
const vnp_Url = process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
const vnp_ReturnUrl = process.env.VNP_RETURN_URL || "http://localhost:5000/api/payment/vnpay_return";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

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
    
    let date = new Date();
    let createDate = moment(date).format('YYYYMMDDHHmmss');
    let orderId = order._id.toString();

    let vnp_Params = {};
    vnp_Params['vnp_Version'] = '2.1.0';
    vnp_Params['vnp_Command'] = 'pay';
    vnp_Params['vnp_TmnCode'] = vnp_TmnCode;
    vnp_Params['vnp_Locale'] = 'vn';
    vnp_Params['vnp_CurrCode'] = 'VND';
    vnp_Params['vnp_TxnRef'] = orderId;
    vnp_Params['vnp_OrderInfo'] = 'Thanh toan don hang ' + orderId;
    vnp_Params['vnp_OrderType'] = 'other';
    vnp_Params['vnp_Amount'] = amount * 100;
    vnp_Params['vnp_ReturnUrl'] = vnp_ReturnUrl;
    vnp_Params['vnp_IpAddr'] = ipAddr;
    vnp_Params['vnp_CreateDate'] = createDate;
    
    if(bankCode !== null && bankCode !== '' && bankCode !== 'VNPAY'){
        vnp_Params['vnp_BankCode'] = bankCode;
    }

    // Sort parameters alphabetically
    vnp_Params = Object.keys(vnp_Params).sort().reduce(
      (obj, key) => { 
        obj[key] = vnp_Params[key]; 
        return obj;
      }, 
      {}
    );

    let signData = qs.stringify(vnp_Params, { encode: false });
    let hmac = crypto.createHmac("sha512", vnp_HashSecret);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex"); 
    vnp_Params['vnp_SecureHash'] = signed;
    
    const finalUrl = vnp_Url + '?' + qs.stringify(vnp_Params, { encode: false });

    res.json({ url: finalUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const sendConfirmationEmail = require('../utils/sendEmail');

exports.vnpayReturn = async (req, res) => {
  let vnp_Params = req.query;
  const secureHash = vnp_Params['vnp_SecureHash'];
  
  delete vnp_Params['vnp_SecureHash'];
  delete vnp_Params['vnp_SecureHashType'];

  // Sort and verify hash
  vnp_Params = Object.keys(vnp_Params).sort().reduce(
    (obj, key) => { 
      obj[key] = vnp_Params[key]; 
      return obj;
    }, 
    {}
  );

  const signData = qs.stringify(vnp_Params, { encode: false });
  const hmac = crypto.createHmac("sha512", vnp_HashSecret);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

  const orderId = vnp_Params['vnp_TxnRef'];
  const responseCode = vnp_Params['vnp_ResponseCode'];

  try {
    if (secureHash !== signed) {
      console.error('VNPAY Hash verification failed');
      return res.redirect(`${FRONTEND_URL}/history?status=error&message=hash_failed`);
    }

    const order = await Order.findById(orderId).populate('user');
    if (!order) {
      return res.redirect(`${FRONTEND_URL}/history?status=error&message=order_not_found`);
    }

    if (responseCode === '00') {
      // Success
      order.status = 'Paid';
      order.transactionId = vnp_Params['vnp_TransactionNo'];
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

      return res.redirect(`${FRONTEND_URL}/history?status=success`);
    } else {
      order.status = 'Failed';
      await order.save();
      return res.redirect(`${FRONTEND_URL}/history?status=failed&code=${responseCode}`);
    }
  } catch (error) {
    console.error(error);
    res.redirect(`${FRONTEND_URL}/history?status=error`);
  }
};
