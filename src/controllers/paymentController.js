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
    const { amount, items, address, bankCode } = req.body;

    const order = await Order.create({
      user: req.user._id,
      items,
      totalAmount: amount,
      shippingAddress: address,
      status: 'Pending',
      paymentMethod: 'VNPAY'
    });

    // Dynamic Return URL for production
    const host = req.get('host');
    const protocol = req.protocol;
    // Hardcode or use env to avoid dynamic path issues
    let returnUrl = process.env.VNP_RETURN_URL;
    if (!host.includes('localhost') || !returnUrl) {
      returnUrl = `${protocol}://${host}/api/payment/vnpay_return`;
    }

    const vnp_Params = {
      vnp_Amount: Math.round(Number(amount)), 
      vnp_TxnRef: order._id.toString(),
      vnp_OrderInfo: `THANH TOAN DON HANG ${order._id.toString().toUpperCase().slice(-6)}`,
      vnp_OrderType: 'other',
      vnp_ReturnUrl: returnUrl,
      vnp_Locale: VnpLocale.VN,
      vnp_IpAddr: '13.160.92.202',
    };

    if (bankCode && bankCode !== '') {
      vnp_Params['vnp_BankCode'] = bankCode;
    }

    console.log('VNPAY Params:', vnp_Params);
    const paymentUrl = vnpay.buildPaymentUrl(vnp_Params);
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
      // Use Atomic update to prevent race conditions
      const order = await Order.findOneAndUpdate(
        { _id: orderId, status: 'Pending' },
        { 
          status: 'Paid',
          transactionId: req.query.vnp_TransactionNo
        },
        { new: true }
      );

      // If order was found and updated, increment sold counts and decrement stock
      if (order) {
        for (const item of order.items) {
          // Update total sold for product
          await Product.updateOne({ _id: item.product }, { $inc: { sold: item.quantity } });
          
          // Update specific variant stock using $elemMatch to be safe
          await Product.updateOne(
            { 
              _id: item.product, 
              variants: { $elemMatch: { color: item.color, size: item.size } } 
            },
            { $inc: { 'variants.$.stock': -item.quantity } }
          );
        }
      }
      return res.redirect(`${FRONTEND_URL}/history?status=success&orderId=${orderId}`);
    } else {
      await Order.updateOne({ _id: orderId, status: 'Pending' }, { status: 'Failed' });
      return res.redirect(`${FRONTEND_URL}/history?status=failed&code=${req.query.vnp_ResponseCode}`);
    }
  } catch (error) {
    console.error(error);
    res.redirect(`${FRONTEND_URL}/history?status=error`);
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Only allow users to hide their own orders
    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // If it's a normal user, just hide it
    if (req.user.role !== 'admin') {
      order.hiddenByUser = true;
      await order.save();
      return res.json({ message: 'Order hidden from history' });
    }

    // If it's an admin, they can still delete it permanently if they want
    // But per your request, let's just allow them to manage it.
    // For now, let's make it so ADMIN delete = permanent, USER delete = hide.
    await order.deleteOne();
    res.json({ message: 'Order permanently removed by admin' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.vnpayIpn = async (req, res) => {
  try {
    const verify = vnpay.verifyIpnCall(req.query);
    if (!verify.isSuccess) {
      return res.status(200).json({ RspCode: '97', Message: 'Checksum failed' });
    }

    const orderId = req.query.vnp_TxnRef;
    const vnpAmount = Number(req.query.vnp_Amount) / 100; // VNPAY amount is multiplied by 100
    
    if (req.query.vnp_ResponseCode === '00') {
      // Validate amount before updating
      const checkOrder = await Order.findById(orderId);
      if (!checkOrder || Math.round(checkOrder.totalAmount) !== Math.round(vnpAmount)) {
          return res.status(200).json({ RspCode: '04', Message: 'Invalid amount' });
      }

      // Use Atomic update here too
      const order = await Order.findOneAndUpdate(
        { _id: orderId, status: 'Pending' },
        { 
          status: 'Paid',
          transactionId: req.query.vnp_TransactionNo
        },
        { new: true }
      );

      if (order) {
        // Only update if this process was the one to change status to Paid
        for (const item of order.items) {
          await Product.updateOne({ _id: item.product }, { $inc: { sold: item.quantity } });
          await Product.updateOne(
            { 
              _id: item.product, 
              variants: { $elemMatch: { color: item.color, size: item.size } } 
            },
            { $inc: { 'variants.$.stock': -item.quantity } }
          );
        }
      }
    } else {
      await Order.updateOne({ _id: orderId, status: 'Pending' }, { status: 'Failed' });
    }

    return res.status(200).json({ RspCode: '00', Message: 'Success' });
  } catch (error) {
    console.error('IPN Error:', error);
    return res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
  }
};
