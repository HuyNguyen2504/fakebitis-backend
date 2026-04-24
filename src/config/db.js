const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb+srv://huynguyen2542004:<db_password>@cluster0.cxqqvfo.mongodb.net/?appName=Cluster0');

let mongod = null;

const connectDB = async () => {
  try {
    // Try to connect to local mongodb first
    await mongoose.connect('mongodb://127.0.0.1:27017/bitis_ecommerce', { serverSelectionTimeoutMS: 2000 });
    console.log('MongoDB Connected to local instance');
  } catch (error) {
    console.log('Local MongoDB not running. Starting in-memory MongoDB...');
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log(`MongoDB Connected to in-memory server: ${uri}`);

    // Seed data automatically if using memory server
    const Product = require('../models/Product');
    const mockProducts = require('../data/products');
    const count = await Product.countDocuments();
    if (count === 0) {
      const seedData = mockProducts.map(({ id, ...rest }) => ({
        ...rest,
        sold: 0
      }));
      await Product.insertMany(seedData);
      console.log('In-memory Database seeded with initial products.');
    }
  }
};

module.exports = connectDB;
