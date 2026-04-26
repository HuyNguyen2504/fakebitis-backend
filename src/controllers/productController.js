const Product = require('../models/Product');
const Category = require('../models/Category');
const SaleCampaign = require('../models/SaleCampaign');

const applyCampaigns = (productObj, campaigns) => {
  const activeCampaign = campaigns.find(c => 
    c.products.some(pId => pId.toString() === productObj.id)
  );

  if (activeCampaign) {
    const discount = activeCampaign.discountPercentage / 100;
    productObj.discount_price = Math.round(productObj.price * (1 - discount));
  }
  return productObj;
};

const processImages = (productObj, req) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  if (productObj.images) {
    productObj.images = productObj.images.map(img => {
      if (img.startsWith('/uploads')) {
        return `${baseUrl}${img}`;
      }
      return img;
    });
  }
  return productObj;
};

// GET /api/products
const getProducts = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 12, 
      category, 
      color, 
      minPrice, 
      maxPrice, 
      sizes,
      sort,
      search 
    } = req.query;

    let query = {};

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    if (category) {
      const categoryNames = category.split(',');
      const foundCategories = await Category.find({ name: { $in: categoryNames.map(c => new RegExp(`^${c}$`, 'i')) } });
      const categoryIds = foundCategories.map(c => c._id);
      query.categories = { $in: categoryIds };
    }

    if (color) {
      const colors = color.split(',');
      query['variants.color'] = { $in: colors.map(c => new RegExp(`^${c}$`, 'i')) };
    }

    if (minPrice || maxPrice) {
      query.$or = [
        { discount_price: { $exists: true, $ne: null, $gte: minPrice ? parseInt(minPrice) : 0, $lte: maxPrice ? parseInt(maxPrice) : 999999999 } },
        { discount_price: { $exists: false }, price: { $gte: minPrice ? parseInt(minPrice) : 0, $lte: maxPrice ? parseInt(maxPrice) : 999999999 } },
        { discount_price: null, price: { $gte: minPrice ? parseInt(minPrice) : 0, $lte: maxPrice ? parseInt(maxPrice) : 999999999 } }
      ];
    }

    if (sizes) {
      const sizesArr = sizes.split(',');
      query.variants = { $elemMatch: { size: { $in: sizesArr }, stock: { $gt: 0 } } };
    }

    let sortObj = {};
    if (sort === 'price_asc') {
      sortObj = { price: 1 };
    } else if (sort === 'price_desc') {
      sortObj = { price: -1 };
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const total = await Product.countDocuments(query);
    let products = await Product.find(query).populate('categories').sort(sortObj).skip(skip).limit(limitNum);

    // Fetch active campaigns
    const now = new Date();
    const activeCampaigns = await SaleCampaign.find({
      startDate: { $lte: now },
      endDate: { $gte: now }
    });

    // Map `_id` to `id` and apply active campaigns
    const data = products.map(p => {
      const pObj = p.toObject();
      pObj.id = pObj._id.toString();
      delete pObj._id;
      const campaignApplied = applyCampaigns(pObj, activeCampaigns);
      return processImages(campaignApplied, req);
    });

    res.json({
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/products/:id
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id).populate('categories');

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const now = new Date();
    const activeCampaigns = await SaleCampaign.find({
      startDate: { $lte: now },
      endDate: { $gte: now }
    });

    const pObj = product.toObject();
    pObj.id = pObj._id.toString();
    
    const finalProduct = applyCampaigns(pObj, activeCampaigns);
    const processedProduct = processImages(finalProduct, req);
    res.json(processedProduct);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/products/categories
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories.map(c => c.name)); 
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/products/colors
const getColors = async (req, res) => {
  try {
    const products = await Product.find({}, 'variants.color');
    const colors = new Set();
    products.forEach(p => {
      p.variants.forEach(v => {
        if (v.color) colors.add(v.color.toUpperCase());
      });
    });
    res.json(Array.from(colors).sort());
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getProducts,
  getProductById,
  getCategories,
  getColors
};
