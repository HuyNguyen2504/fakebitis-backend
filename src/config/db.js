const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Sử dụng biến môi trường MONGO_URI, hoặc chuỗi kết nối mặc định của bạn
    const mongoURI = process.env.MONGO_URI || 'mongodb+srv://huynguyen2542004:nguyenvanhuy03@cluster0.cxqqvfo.mongodb.net/bitis_ecommerce?retryWrites=true&w=majority';
    
    await mongoose.connect(mongoURI);
    console.log(`MongoDB Connected: ${mongoose.connection.host}`);

    // --- SEEDING LOGIC ---
    const Category = require('../models/Category');
    const Product = require('../models/Product');
    const productsData = require('../data/products');

    const catCount = await Category.countDocuments();
    let categories = [];
    
    if (catCount === 0) {
      const catNames = ['Sneaker', 'Running', 'Sandal', 'Slip-on', 'Apparel', 'Accessories'];
      categories = await Category.insertMany(catNames.map(name => ({ name })));
      console.log('Default categories seeded!');
    } else {
      categories = await Category.find();
    }

    const prodCount = await Product.countDocuments();
    if (prodCount === 0) {
      const catMap = categories.reduce((map, cat) => ({ ...map, [cat.name]: cat._id }), {});
      const seedData = productsData.map(({ id, category, ...rest }) => ({
        ...rest,
        categories: [catMap[category] || categories[0]._id],
        sold: 0
      }));
      await Product.insertMany(seedData);
      console.log('Database seeded with initial products and category links.');
    }
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
