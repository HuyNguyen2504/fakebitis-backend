const Order = require('../models/Order');
const Product = require('../models/Product');
const Category = require('../models/Category');
const SaleCampaign = require('../models/SaleCampaign');
const moment = require('moment');

// GET /api/admin/stats
exports.getAdminStats = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments({ status: 'Paid' });
    const totalRevenueResult = await Order.aggregate([
      { $match: { status: 'Paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalRevenue = totalRevenueResult.length > 0 ? totalRevenueResult[0].total : 0;
    
    // Normalize totalRevenue if it looks like it was divided by 100 (e.g., < 1,000,000 for total)
    // Actually, it's better to check individual orders or just trust new data. 
    // But for a quick fix on existing divided data:
    const finalTotalRevenue = totalRevenue;

    const totalSoldResult = await Product.aggregate([
      { $group: { _id: null, total: { $sum: '$sold' } } }
    ]);
    const totalSold = totalSoldResult.length > 0 ? totalSoldResult[0].total : 0;

    // Revenue chart data (last 7 days)
    const sevenDaysAgo = moment().subtract(7, 'days').toDate();
    const chartData = await Order.aggregate([
      { $match: { status: 'Paid', createdAt: { $gte: sevenDaysAgo } } },
      { 
        $group: { 
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, 
          revenue: { $sum: '$totalAmount' } 
        } 
      },
      { $sort: { _id: 1 } }
    ]);

    const formattedChartData = chartData.map(item => ({
      date: item._id,
      revenue: item.revenue
    }));

    // Order History for all customers
    const rawOrderHistory = await Order.find({ status: 'Paid' }).populate('user', 'name email').sort({ createdAt: -1 });
    const orderHistory = rawOrderHistory;

    // Top Users Chart Data (by number of orders)
    const topUsersResult = await Order.aggregate([
      { $match: { status: 'Paid' } },
      { $group: { _id: '$user', orderCount: { $sum: 1 } } },
      { $sort: { orderCount: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userInfo' } },
      { $unwind: '$userInfo' },
      { $project: { name: '$userInfo.name', orderCount: 1, _id: 0 } }
    ]);

    // Shoes Sold By Product
    const shoesSoldData = await Product.find({}, 'name images sold').sort({ sold: -1 });

    // Shoes Sold By Category
    const shoesSoldByCategory = await Product.aggregate([
      { $unwind: '$categories' },
      { $group: { _id: '$categories', soldCount: { $sum: '$sold' } } },
      { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'catInfo' } },
      { $unwind: '$catInfo' },
      { $sort: { soldCount: -1 } },
      { $project: { name: '$catInfo.name', soldCount: 1, _id: 0 } }
    ]);

    // Global Categories list for admin
    const categories = await Category.find().sort({ name: 1 });

    res.json({
      totalOrders,
      totalRevenue: finalTotalRevenue,
      totalSold,
      chartData: formattedChartData,
      orderHistory,
      topUsers: topUsersResult,
      shoesSoldData,
      shoesSoldByCategory,
      categories
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Products CRUD
exports.createProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Sale Campaign CRUD
exports.getCampaigns = async (req, res) => {
  try {
    const campaigns = await SaleCampaign.find().populate('products', 'name price');
    res.json(campaigns);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

exports.createCampaign = async (req, res) => {
  try {
    const campaign = await SaleCampaign.create(req.body);
    
    // Apply discount to products
    const productsToUpdate = await Product.find({ _id: { $in: campaign.products } });
    for (const prod of productsToUpdate) {
      const discountPrice = Math.round(prod.price * (1 - campaign.discountPercentage / 100));
      await Product.findByIdAndUpdate(prod._id, { discount_price: discountPrice });
    }

    res.status(201).json(campaign);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

exports.updateCampaign = async (req, res) => {
  try {
    const oldCampaign = await SaleCampaign.findById(req.params.id);
    if (!oldCampaign) return res.status(404).json({ message: 'Not found' });

    // Revert old products
    await Product.updateMany(
      { _id: { $in: oldCampaign.products } },
      { $unset: { discount_price: 1 } }
    );

    const campaign = await SaleCampaign.findByIdAndUpdate(req.params.id, req.body, { new: true });

    // Apply discount to new products
    const productsToUpdate = await Product.find({ _id: { $in: campaign.products } });
    for (const prod of productsToUpdate) {
      const discountPrice = Math.round(prod.price * (1 - campaign.discountPercentage / 100));
      await Product.findByIdAndUpdate(prod._id, { discount_price: discountPrice });
    }

    res.json(campaign);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

exports.deleteCampaign = async (req, res) => {
  try {
    const campaign = await SaleCampaign.findById(req.params.id);
    if (campaign) {
      // Revert products
      await Product.updateMany(
        { _id: { $in: campaign.products } },
        { $unset: { discount_price: 1 } }
      );
      await SaleCampaign.findByIdAndDelete(req.params.id);
    }
    res.json({ message: 'Campaign deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Category CRUD
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const category = await Category.create(req.body);
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    
    // Check for products where this is the ONLY category
    const linkedProducts = await Product.find({ categories: categoryId });
    
    const blockList = linkedProducts.filter(p => p.categories.length === 1);
    
    if (blockList.length > 0) {
      const names = blockList.map(p => p.name).join(', ');
      return res.status(400).json({ 
        message: `Cần thêm hoặc thay đổi catagory trước khi xóa sản phẩm: { ${names} } này` 
      });
    }
    
    // If not blocked, we can safely remove the category from all products that have it along with others
    await Product.updateMany(
      { categories: categoryId },
      { $pull: { categories: categoryId } }
    );
    
    await Category.findByIdAndDelete(categoryId);
    res.json({ message: 'Category deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};
