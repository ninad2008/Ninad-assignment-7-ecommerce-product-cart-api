require('dotenv').config();
const express = require('express');
const session = require('express-session');
const logger = require('./middleware/logger');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'ecommerce_dev_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true if running with HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);

// Logging middleware
app.use(logger);

// Welcome / Health check route
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'E-Commerce Product Catalog & Shopping Cart REST API',
    version: '1.0.0',
    status: 'Running',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        me: 'GET /api/auth/me'
      },
      products: {
        getAll: 'GET /api/products (?category, ?minPrice, ?maxPrice, ?inStock, ?search, ?sort)',
        getById: 'GET /api/products/:id',
        create: 'POST /api/products',
        update: 'PUT /api/products/:id',
        delete: 'DELETE /api/products/:id'
      },
      cart: {
        viewCart: 'GET /api/cart',
        addItem: 'POST /api/cart/items',
        removeItem: 'DELETE /api/cart/items/:productId',
        checkout: 'POST /api/cart/checkout'
      }
    }
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl} - Route not found`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start Server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 E-Commerce API Server running on port ${PORT}`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`=========================================`);
  });
}

module.exports = app;
