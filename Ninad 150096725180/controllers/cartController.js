const { readData, writeData } = require('../utils/fileHelper');
const { v4: uuidv4 } = require('uuid');

/**
 * Helper to retrieve or create a cart for the logged-in user
 * @param {string} userId
 * @param {Array} carts
 * @returns {object} userCart
 */
const getOrCreateUserCart = (userId, carts) => {
  let cart = carts.find((c) => c.userId === userId);
  if (!cart) {
    cart = {
      userId,
      items: [],
      cartTotal: 0,
      updatedAt: new Date().toISOString()
    };
    carts.push(cart);
  }
  return cart;
};

/**
 * Helper to recalculate item totals and overall cart total
 * @param {object} cart
 */
const recalculateCartTotals = (cart) => {
  let total = 0;
  cart.items.forEach((item) => {
    item.itemTotal = item.unitPrice * item.quantity;
    total += item.itemTotal;
  });
  cart.cartTotal = total;
  cart.updatedAt = new Date().toISOString();
};

/**
 * View current user's shopping cart
 * GET /api/cart
 */
const getCart = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const carts = await readData('carts.json');
    const cart = getOrCreateUserCart(userId, carts);

    return res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Error fetching cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving shopping cart',
      error: error.message
    });
  }
};

/**
 * Add a product to the user's shopping cart with inventory reservation checks
 * POST /api/cart/items
 * Request Body: { productId, quantity }
 */
const addItemToCart = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { productId, quantity = 1 } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive integer greater than 0'
      });
    }

    // Read products and verify stock availability
    const products = await readData('products.json');
    const product = products.find((p) => p.id === productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with ID '${productId}' not found`
      });
    }

    // Read carts
    const carts = await readData('carts.json');
    const userCart = getOrCreateUserCart(userId, carts);

    // Check existing quantity in user's cart
    const existingItem = userCart.items.find((item) => item.productId === productId);
    const currentCartQty = existingItem ? existingItem.quantity : 0;
    const targetQty = currentCartQty + parsedQty;

    // Inventory reservation check: cannot add more than available stock
    if (targetQty > product.stock) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Requested: ${targetQty} (including ${currentCartQty} in cart), Available: ${product.stock}`,
        availableStock: product.stock,
        currentInCart: currentCartQty,
        requestedQuantity: parsedQty
      });
    }

    if (existingItem) {
      existingItem.quantity = targetQty;
      existingItem.unitPrice = product.price; // Keep price synced
      existingItem.name = product.name;
    } else {
      userCart.items.push({
        productId: product.id,
        name: product.name,
        unitPrice: product.price,
        quantity: parsedQty,
        itemTotal: product.price * parsedQty
      });
    }

    recalculateCartTotals(userCart);
    await writeData('carts.json', carts);

    return res.status(200).json({
      success: true,
      message: 'Item added to cart successfully',
      data: userCart
    });
  } catch (error) {
    console.error('Error adding item to cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error adding item to cart',
      error: error.message
    });
  }
};

/**
 * Remove a specific product from cart
 * DELETE /api/cart/items/:productId
 */
const removeItemFromCart = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { productId } = req.params;

    const carts = await readData('carts.json');
    const userCart = getOrCreateUserCart(userId, carts);

    const itemIndex = userCart.items.findIndex((item) => item.productId === productId);
    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `Product '${productId}' is not in the cart`
      });
    }

    const removedItem = userCart.items.splice(itemIndex, 1)[0];
    recalculateCartTotals(userCart);
    await writeData('carts.json', carts);

    return res.status(200).json({
      success: true,
      message: `Product '${removedItem.name}' removed from cart successfully`,
      data: userCart
    });
  } catch (error) {
    console.error('Error removing item from cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error removing item from cart',
      error: error.message
    });
  }
};

/**
 * Simulate checkout: validates stock for all items, decrements inventory, and empties cart
 * POST /api/cart/checkout
 */
const checkout = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const carts = await readData('carts.json');
    const userCart = getOrCreateUserCart(userId, carts);

    if (!userCart.items || userCart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot checkout: Cart is empty'
      });
    }

    const products = await readData('products.json');

    // 1. Validate stock for all items first
    const stockErrors = [];
    for (const item of userCart.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        stockErrors.push(`Product '${item.name}' (ID: ${item.productId}) no longer exists`);
      } else if (product.stock < item.quantity) {
        stockErrors.push(
          `Insufficient stock for '${product.name}'. Required: ${item.quantity}, Available: ${product.stock}`
        );
      }
    }

    if (stockErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Checkout failed due to stock availability issues',
        errors: stockErrors
      });
    }

    // 2. Decrement stock in products.json
    for (const item of userCart.items) {
      const productIndex = products.findIndex((p) => p.id === item.productId);
      if (productIndex !== -1) {
        products[productIndex].stock -= item.quantity;
      }
    }
    await writeData('products.json', products);

    // 3. Create order snapshot
    const orderId = `ord_${Date.now()}_${uuidv4().substring(0, 6)}`;
    const orderSummary = {
      orderId,
      customer: {
        userId: req.session.user.id,
        username: req.session.user.username,
        email: req.session.user.email
      },
      items: [...userCart.items],
      totalAmount: userCart.cartTotal,
      orderDate: new Date().toISOString(),
      status: 'Placed'
    };

    // 4. Empty user's cart
    userCart.items = [];
    userCart.cartTotal = 0;
    userCart.updatedAt = new Date().toISOString();
    await writeData('carts.json', carts);

    return res.status(200).json({
      success: true,
      message: 'Order placed successfully! Product stock updated.',
      order: orderSummary
    });
  } catch (error) {
    console.error('Error during checkout:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error processing checkout',
      error: error.message
    });
  }
};

module.exports = {
  getCart,
  addItemToCart,
  removeItemFromCart,
  checkout
};
