const express = require('express');
const { createPaymentUrl, vnpayReturn } = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/create_payment_url', protect, createPaymentUrl);
router.get('/vnpay_return', vnpayReturn);

module.exports = router;
