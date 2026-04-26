const express = require('express');
const { getProducts, getProductById, getCategories, getColors } = require('../controllers/productController');

const router = express.Router();

router.get('/', getProducts);
router.get('/categories', getCategories);
router.get('/colors', getColors);
router.get('/:id', getProductById);

module.exports = router;
