const express = require('express');
const productRoutes = require('./routes/productRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/products', productRoutes);
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
app.use(errorHandler);

module.exports = app;
