const express = require('express');
const { getMyOrders } = require('../controllers/orderController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/history', protect, getMyOrders);

module.exports = router;
