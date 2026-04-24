const mongoose = require('mongoose');
const Product = require('./src/models/Product');
const mockProducts = require('./src/data/products');

const connectDB = async () => {
  try {
    const mongoURI = 'mongodb+srv://huynguyen2542004:nguyenvanhuy03@cluster0.cxqqvfo.mongodb.net/bitis_ecommerce?retryWrites=true&w=majority';
    await mongoose.connect(mongoURI);
    await Product.deleteMany({});
    const seedData = mockProducts.map(({ id, ...rest }) => ({
      ...rest,
      sold: 0
    }));
    await Product.insertMany(seedData);
    console.log('Forced seed success. Added ' + seedData.length + ' products.');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

connectDB();
