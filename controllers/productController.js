const mongoose = require('mongoose');
const Product = require('../models/Product');

const allowedProductFields = ['name', 'sku', 'category', 'price', 'quantity', 'reorderLevel', 'supplier'];

function pickProductFields(body = {}) {
  return Object.fromEntries(allowedProductFields
    .filter((field) => Object.prototype.hasOwnProperty.call(body, field))
    .map((field) => [field, body[field]]));
}

function parsePositiveInteger(value, fallback, name, max = 1000) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    const error = new Error(`${name} must be an integer from 1 to ${max}`);
    error.status = 400;
    throw error;
  }
  return parsed;
}

function validId(id) {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Product ID is invalid');
    error.status = 400;
    throw error;
  }
}

async function createProduct(req, res) {
  const product = await Product.create(pickProductFields(req.body));
  res.status(201).json(product);
}

async function getProducts(req, res) {
  const page = parsePositiveInteger(req.query.page, 1, 'page');
  const limit = parsePositiveInteger(req.query.limit, 10, 'limit', 100);
  const filter = {};

  if (req.query.category) filter.category = new RegExp(`^${escapeRegex(req.query.category.trim())}$`, 'i');
  if (req.query.search) {
    const term = escapeRegex(req.query.search.trim());
    filter.$or = [{ name: new RegExp(term, 'i') }, { sku: new RegExp(term, 'i') }, { supplier: new RegExp(term, 'i') }];
  }
  if (req.query.minPrice !== undefined || req.query.maxPrice !== undefined) {
    filter.price = {};
    if (req.query.minPrice !== undefined) filter.price.$gte = parseNonNegativeNumber(req.query.minPrice, 'minPrice');
    if (req.query.maxPrice !== undefined) filter.price.$lte = parseNonNegativeNumber(req.query.maxPrice, 'maxPrice');
    if (filter.price.$gte !== undefined && filter.price.$lte !== undefined && filter.price.$gte > filter.price.$lte) {
      const error = new Error('minPrice cannot be greater than maxPrice');
      error.status = 400;
      throw error;
    }
  }
  if (req.query.lowStock === 'true') filter.$expr = { $lte: ['$quantity', '$reorderLevel'] };
  if (req.query.lowStock !== undefined && !['true', 'false'].includes(req.query.lowStock)) {
    const error = new Error('lowStock must be true or false');
    error.status = 400;
    throw error;
  }

  const sortField = req.query.sortBy || 'createdAt';
  const allowedSortFields = [...allowedProductFields, 'createdAt', 'updatedAt'];
  if (!allowedSortFields.includes(sortField)) {
    const error = new Error(`sortBy must be one of: ${allowedSortFields.join(', ')}`);
    error.status = 400;
    throw error;
  }
  const order = req.query.order || 'asc';
  if (!['asc', 'desc'].includes(order)) {
    const error = new Error('order must be asc or desc');
    error.status = 400;
    throw error;
  }

  const [products, total] = await Promise.all([
    Product.find(filter).sort({ [sortField]: order === 'asc' ? 1 : -1 }).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter),
  ]);
  res.json({ total, page, totalPages: Math.ceil(total / limit), count: products.length, products });
}

async function getProduct(req, res) {
  validId(req.params.id);
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  return res.json(product);
}

async function updateProduct(req, res) {
  validId(req.params.id);
  const updates = pickProductFields(req.body);
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: 'Provide at least one product field to update' });
  }
  const product = await Product.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
    context: 'query',
  });
  if (!product) return res.status(404).json({ message: 'Product not found' });
  return res.json(product);
}

async function adjustStock(req, res) {
  validId(req.params.id);
  const { operation, quantity } = req.body || {};
  if (!['restock', 'sale'].includes(operation)) {
    return res.status(400).json({ message: 'operation must be restock or sale' });
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ message: 'quantity must be a positive whole number' });
  }

  const delta = operation === 'restock' ? quantity : -quantity;
  const conditions = { _id: req.params.id };
  if (delta < 0) conditions.quantity = { $gte: quantity };
  const product = await Product.findOneAndUpdate(
    conditions,
    { $inc: { quantity: delta } },
    { new: true, runValidators: true },
  );
  if (product) return res.json(product);

  const exists = await Product.exists({ _id: req.params.id });
  if (!exists) return res.status(404).json({ message: 'Product not found' });
  return res.status(409).json({ message: 'Sale quantity exceeds available stock' });
}

async function deleteProduct(req, res) {
  validId(req.params.id);
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  return res.json({ message: 'Product deleted', id: product._id });
}

async function getLowStock(req, res) {
  const lowStockItems = await Product.find({ $expr: { $lte: ['$quantity', '$reorderLevel'] } }).sort({ quantity: 1, name: 1 });
  res.json({ count: lowStockItems.length, lowStockItems });
}

async function getCategorySummary(req, res) {
  const categories = await Product.aggregate([
    {
      $group: {
        _id: '$category',
        productCount: { $sum: 1 },
        totalUnits: { $sum: '$quantity' },
        inventoryValue: { $sum: { $multiply: ['$price', '$quantity'] } },
        averagePrice: { $avg: '$price' },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        category: '$_id',
        productCount: 1,
        totalUnits: 1,
        inventoryValue: { $round: ['$inventoryValue', 2] },
        averagePrice: { $round: ['$averagePrice', 2] },
      },
    },
  ]);
  res.json({ count: categories.length, categories });
}

function parseNonNegativeNumber(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    const error = new Error(`${name} must be a non-negative number`);
    error.status = 400;
    throw error;
  }
  return parsed;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  adjustStock,
  deleteProduct,
  getLowStock,
  getCategorySummary,
};
