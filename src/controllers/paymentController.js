const { VNPay, ignoreLogger, ProductCode, VnpLocale, dateFormat } = require('vnpay');
const Order = require('../models/Order');
const Product = require('../models/Product');

const vnpay = new VNPay({
  tmnCode: process.env.VNP_TMN_CODE,
  secureSecret: process.env.VNP_HASH_SECRET,
  vnpayHost: 'https://sandbox.vnpayment.vn',
  paymentEndpoint: 'paymentv2/vpcpay.html', // Explicitly set endpoint
  hashAlgorithm: 'SHA512',
});

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

exports.createPaymentUrl = async (req, res) => {
  try {
    console.log('--- VNPAY: START CREATING PAYMENT URL ---');
    const { amount, items, address, bankCode } = req.body;

    const order = await Order.create({
      user: req.user._id,
      items,
      totalAmount: amount,
      shippingAddress: address,
      status: 'Pending',
      paymentMethod: 'VNPAY'
    });

    const vnp_Params = {
      vnp_Amount: Math.round(Number(amount) * 100),
      vnp_TxnRef: order._id.toString(),
      vnp_OrderInfo: `THANH TOAN DON HANG ${order._id.toString().toUpperCase().slice(-6)}`,
      vnp_OrderType: 'other',
      vnp_ReturnUrl: process.env.VNP_RETURN_URL,
      vnp_Locale: VnpLocale.VN,
      vnp_IpAddr: '13.160.92.202', // Use fixed test IP
    };

    if (bankCode && bankCode !== '') {
      vnp_Params['vnp_BankCode'] = bankCode;
    }

    console.log('VNPAY Params:', vnp_Params);
    const paymentUrl = vnpay.buildPaymentUrl(vnp_Params);
    console.log('Generated URL:', paymentUrl);

    res.json({ url: paymentUrl });
  } catch (error) {
    console.error('VNPAY ERROR:', error);
    res.status(500).json({ message: error.message || 'Server Error' });
  }
};

exports.vnpayReturn = async (req, res) => {
  try {
    const verify = vnpay.verifyReturnUrl(req.query);
    const orderId = req.query.vnp_TxnRef;

    if (verify.isSuccess) {
      return res.redirect(`${FRONTEND_URL}/history?status=success`);
    } else {
      return res.redirect(`${FRONTEND_URL}/history?status=failed&code=${req.query.vnp_ResponseCode}`);
    }
  } catch (error) {
    console.error(error);
    res.redirect(`${FRONTEND_URL}/history?status=error`);
  }
};

exports.vnpayIpn = async (req, res) => {
  try {
    const verify = vnpay.verifyIpnCall(req.query);
    if (!verify.isSuccess) {
      return res.status(200).json({ RspCode: '97', Message: 'Checksum failed' });
    }

    const orderId = req.query.vnp_TxnRef;
    const order = await Order.findById(orderId).populate('user');

    if (!order) {
      return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
    }

    if (order.totalAmount * 100 !== Number(req.query.vnp_Amount)) {
      return res.status(200).json({ RspCode: '04', Message: 'Invalid amount' });
    }

    if (order.status !== 'Pending') {
      return res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' });
    }

    if (req.query.vnp_ResponseCode === '00') {
      order.status = 'Paid';
      order.transactionId = req.query.vnp_TransactionNo;
      await order.save();

      // Update product sold counts
      for (const item of order.items) {
        await Product.updateOne(
          { _id: item.product, 'variants.color': item.color, 'variants.size': item.size },
          { $inc: { sold: item.quantity, 'variants.$.stock': -item.quantity } }
        );
      }
    } else {
      order.status = 'Failed';
      await order.save();
    }

    return res.status(200).json({ RspCode: '00', Message: 'Success' });
  } catch (error) {
    console.error('IPN Error:', error);
    return res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
  }
};
