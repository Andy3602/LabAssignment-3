const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/productController');

const router = express.Router();

router.post('/', asyncHandler(controller.createProduct));
router.get('/', asyncHandler(controller.getProducts));
router.get('/low-stock', asyncHandler(controller.getLowStock));
router.get('/summary/categories', asyncHandler(controller.getCategorySummary));
router.get('/:id', asyncHandler(controller.getProduct));
router.put('/:id', asyncHandler(controller.updateProduct));
router.patch('/:id/stock', asyncHandler(controller.adjustStock));
router.delete('/:id', asyncHandler(controller.deleteProduct));

module.exports = router;
