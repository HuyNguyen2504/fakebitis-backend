const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Sử dụng biến môi trường MONGO_URI, hoặc chuỗi kết nối mặc định của bạn
    const mongoURI = process.env.MONGO_URI || 'mongodb+srv://huynguyen2542004:nguyenvanhuy03@cluster0.cxqqvfo.mongodb.net/bitis_ecommerce?retryWrites=true&w=majority';
    
    await mongoose.connect(mongoURI);
    console.log(`MongoDB Connected: ${mongoose.connection.host}`);

    // Seed data automatically if database is empty
    const Product = require('../models/Product');
    const mockProducts = require('../data/products');
    const count = await Product.countDocuments();
    
    if (count === 0) {
      const seedData = mockProducts.map(({ id, ...rest }) => ({
        ...rest,
        sold: 0
      }));
      await Product.insertMany(seedData);
      console.log('Database seeded with initial products.');
    }
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
