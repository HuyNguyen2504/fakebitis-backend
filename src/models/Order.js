const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      name: String,
      color: String,
      size: String,
      quantity: Number,
      price: Number,
      image: String
    }
  ],
  totalAmount: { type: Number, required: true },
  shippingAddress: {
    name: String,
    phone: String,
    addressLine: String,
    ward: String,
    city: String,
    province: String
  },
  status: { type: String, enum: ['Pending', 'Paid', 'Failed'], default: 'Pending' },
  paymentMethod: { type: String, default: 'VNPAY' },
  transactionId: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
