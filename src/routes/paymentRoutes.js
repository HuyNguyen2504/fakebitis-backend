const express = require('express');
const { createPaymentUrl, vnpayReturn, vnpayIpn, deleteOrder } = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/create_payment_url', protect, createPaymentUrl);
router.get('/vnpay_return', vnpayReturn);
router.get('/vnpay_ipn', vnpayIpn);
router.delete('/:id', protect, deleteOrder);

module.exports = router;
