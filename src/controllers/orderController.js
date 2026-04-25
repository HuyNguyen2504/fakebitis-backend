const Order = require('../models/Order');

// GET /api/orders/history
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ 
      user: req.user._id,
      hiddenByUser: { $ne: true } // Only show orders NOT hidden by user
    }).sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};
