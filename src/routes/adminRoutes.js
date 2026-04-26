const express = require('express');
const { 
  getAdminStats, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  getCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controllers/adminController');
const { protect, admin } = require('../middleware/auth');

const router = express.Router();

router.get('/stats', protect, admin, getAdminStats);
router.post('/products', protect, admin, createProduct);
router.put('/products/:id', protect, admin, updateProduct);
router.delete('/products/:id', protect, admin, deleteProduct);

router.get('/campaigns', protect, admin, getCampaigns);
router.post('/campaigns', protect, admin, createCampaign);
router.put('/campaigns/:id', protect, admin, updateCampaign);
router.delete('/campaigns/:id', protect, admin, deleteCampaign);

router.get('/categories', protect, admin, getCategories);
router.post('/categories', protect, admin, createCategory);
router.put('/categories/:id', protect, admin, updateCategory);
router.delete('/categories/:id', protect, admin, deleteCategory);

module.exports = router;
