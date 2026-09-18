const express = require('express');
const router = express.Router();
const { register, login, logout, getMe } = require('../controllers/authController');
const authGuard = require('../middleware/authGuard');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// Protected profile route
router.get('/me', authGuard, getMe);

module.exports = router;
