const express = require('express');
const router = express.Router();
const {
  getCart,
  addItemToCart,
  removeItemFromCart,
  checkout
} = require('../controllers/cartController');
const authGuard = require('../middleware/authGuard');

// All cart endpoints require an active authenticated session
router.use(authGuard);

router.get('/', getCart);
router.post('/items', addItemToCart);
router.delete('/items/:productId', removeItemFromCart);
router.post('/checkout', checkout);

module.exports = router;
