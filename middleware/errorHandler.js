module.exports = function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = err.status || 500;
  let message = err.message || 'Internal server error';
  let details;

  if (err.name === 'ValidationError') {
    status = 400;
    details = Object.values(err.errors).map((item) => ({ field: item.path, message: item.message }));
    message = 'Product validation failed';
  } else if (err.code === 11000) {
    status = 409;
    message = 'A product with this SKU already exists';
    details = err.keyValue;
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid value for a product field';
  }

  if (status >= 500) console.error(err);
  return res.status(status).json({ message, ...(details ? { details } : {}) });
};
