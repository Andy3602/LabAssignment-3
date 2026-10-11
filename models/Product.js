const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [2, 'Product name must be at least 2 characters'],
      maxlength: [120, 'Product name cannot exceed 120 characters'],
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      trim: true,
      uppercase: true,
      match: [/^[A-Z0-9][A-Z0-9._-]{1,39}$/, 'SKU must be 2-40 letters, numbers, dots, underscores, or hyphens'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      minlength: [2, 'Category must be at least 2 characters'],
      maxlength: [60, 'Category cannot exceed 60 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative'],
      validate: { validator: Number.isInteger, message: 'Quantity must be a whole number' },
    },
    reorderLevel: {
      type: Number,
      required: [true, 'Reorder level is required'],
      min: [0, 'Reorder level cannot be negative'],
      validate: { validator: Number.isInteger, message: 'Reorder level must be a whole number' },
    },
    supplier: {
      type: String,
      required: [true, 'Supplier is required'],
      trim: true,
      minlength: [2, 'Supplier must be at least 2 characters'],
      maxlength: [100, 'Supplier cannot exceed 100 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

productSchema.virtual('stockValue').get(function stockValue() {
  return this.price * this.quantity;
});

module.exports = mongoose.model('Product', productSchema);
