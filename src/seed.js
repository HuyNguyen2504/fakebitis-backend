const mongoose = require('mongoose');
const Product = require('./models/Product');
const connectDB = require('./config/db');
const mockProducts = require('./data/products');

const seedDB = async () => {
  await connectDB();
  
  try {
    // Clear existing products
    await Product.deleteMany();
    console.log('Products cleared');

    // Remove `id` from mock data to let Mongo generate `_id`
    const seedData = mockProducts.map(({ id, ...rest }) => ({
      ...rest,
      sold: Math.floor(Math.random() * 50) // Random sold count for demo
    }));

    await Product.insertMany(seedData);
    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedDB();
