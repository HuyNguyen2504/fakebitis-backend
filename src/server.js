require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
// Fix Sold Counts Route (Secret tool to sync data)
app.get('/api/admin/fix-sold', async (req, res) => {
  try {
    const Product = require('./models/Product');
    const Order = require('./models/Order');
    
    // Reset all sold counts to 0 first
    await Product.updateMany({}, { sold: 0 });
    
    // Get all successful orders
    const paidOrders = await Order.find({ status: 'Paid' });
    
    for (const order of paidOrders) {
      for (const item of order.items) {
        await Product.updateOne(
          { _id: item.product },
          { $inc: { sold: item.quantity } }
        );
      }
    }
    
    res.json({ message: "Sold counts recalculated and synced successfully!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Connect Database
connectDB();

// Static folder for uploads
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Routes
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/user', userRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Force Seed Route (Secret tool for production sync)
app.get('/api/admin/force-seed', async (req, res) => {
  try {
    const Product = require('./models/Product');
    const Category = require('./models/Category');
    const productsData = require('./data/products');
    
    // 1. Clear everything
    await Product.deleteMany();
    await Category.deleteMany();

    // 2. Seed Categories
    const catNames = ['Sneaker', 'Running', 'Sandal', 'Slip-on', 'Apparel', 'Accessories'];
    const categories = await Category.insertMany(catNames.map(name => ({ name })));
    const catMap = categories.reduce((map, cat) => ({ ...map, [cat.name]: cat._id }), {});

    // 3. Seed Products with Category IDs
    const formattedProducts = productsData.map(({ id, category, ...rest }) => {
      // Find matching category ID or fallback to the first one
      const catId = catMap[category] || categories[0]._id;
      return { ...rest, categories: [catId] };
    });
    
    await Product.insertMany(formattedProducts);
    res.json({ message: "Database reset and seeded successfully with categories and products!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
