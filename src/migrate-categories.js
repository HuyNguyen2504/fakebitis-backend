const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Category = require('./models/Category');
const Product = require('./models/Product');

const migrate = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected for migration...');

    const rawProducts = await mongoose.connection.db.collection('products').find({}).toArray();
    console.log(`Found ${rawProducts.length} products to check.`);

    for (const rawProd of rawProducts) {
      // If product has old 'category' string but no 'categories' array or empty array
      if (rawProd.category && (!rawProd.categories || rawProd.categories.length === 0)) {
        console.log(`Migrating product: ${rawProd.name} (Category: ${rawProd.category})`);

        // 1. Find or create the category
        let category = await Category.findOne({ name: { $regex: new RegExp(`^${rawProd.category}$`, 'i') } });
        if (!category) {
          category = await Category.create({ name: rawProd.category.trim() });
          console.log(`Created new category: ${category.name}`);
        }

        // 2. Update the product using raw update to avoid schema validation issues if any
        await mongoose.connection.db.collection('products').updateOne(
          { _id: rawProd._id },
          { 
            $set: { categories: [category._id] },
            // Optional: comment out the next line if you want to keep the old field for safety
            // $unset: { category: "" } 
          }
        );
      }
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrate();
