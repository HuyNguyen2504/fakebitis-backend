require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Product = require('../models/Product');
const products = require('../data/products');

const seedData = async () => {
  try {
    await connectDB();
    
    // Xóa dữ liệu cũ
    await Product.deleteMany();
    console.log('Old products deleted');

    // Chuyển đổi dữ liệu từ products.js sang định dạng Mongoose (bỏ id vì MongoDB tự tạo _id)
    const formattedProducts = products.map(({ id, ...rest }) => rest);

    // Chèn dữ liệu mới
    await Product.insertMany(formattedProducts);
    console.log('New products seeded successfully!');
    
    process.exit();
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedData();
