process.env.NODE_ENV = 'test';
const http = require('http');
const app = require('./server');

const PORT = 3456;
let server;
let sessionCookie = '';

// Helper for HTTP requests
const request = (options, postData = null) => {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: '127.0.0.1',
      port: PORT,
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(sessionCookie ? { Cookie: sessionCookie } : {}),
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      // Capture set-cookie
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        sessionCookie = setCookie[0].split(';')[0];
      }

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
};

const runTests = async () => {
  console.log('\n======================================================');
  console.log('🧪 RUNNING COMPREHENSIVE AUTOMATED E-COMMERCE API TESTS');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (description, condition, details = '') => {
    if (condition) {
      console.log(`✅ PASS: ${description}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${description} ${details ? `(${details})` : ''}`);
      failed++;
    }
  };

  try {
    // 1. Root Health Check
    const rootRes = await request({ path: '/', method: 'GET' });
    assert('GET / returns API info and 200 OK', rootRes.status === 200 && rootRes.body.status === 'Running');

    // 2. Product Catalog Tests
    const allProducts = await request({ path: '/api/products', method: 'GET' });
    assert('GET /api/products returns product list', allProducts.status === 200 && Array.isArray(allProducts.body.data) && allProducts.body.data.length >= 5);

    // 3. Category Filter
    const electronics = await request({ path: '/api/products?category=Electronics', method: 'GET' });
    const allAreElectronics = electronics.body.data.every((p) => p.category.toLowerCase() === 'electronics');
    assert('GET /api/products?category=Electronics filters correctly', electronics.status === 200 && allAreElectronics && electronics.body.data.length > 0);

    // 4. Price Filter & Sorting
    const priceFilter = await request({ path: '/api/products?minPrice=1000&maxPrice=3000&sort=price_asc', method: 'GET' });
    const inRange = priceFilter.body.data.every((p) => p.price >= 1000 && p.price <= 3000);
    const isSortedAsc = priceFilter.body.data.every((p, i, arr) => i === 0 || arr[i - 1].price <= p.price);
    assert('GET /api/products?minPrice=1000&maxPrice=3000&sort=price_asc filters and sorts correctly', priceFilter.status === 200 && inRange && isSortedAsc);

    // 5. Get Single Product
    const firstProduct = allProducts.body.data[0];
    const singleProd = await request({ path: `/api/products/${firstProduct.id}`, method: 'GET' });
    assert('GET /api/products/:id returns single product', singleProd.status === 200 && singleProd.body.data.id === firstProduct.id);

    // 6. Create Product with Validation
    const invalidProd = await request({ path: '/api/products', method: 'POST' }, { name: 'Invalid', price: -50, stock: -2 });
    assert('POST /api/products rejects negative price/stock with 400 Bad Request', invalidProd.status === 400);

    const validNewProd = await request(
      { path: '/api/products', method: 'POST' },
      { name: '4K Ultra HD Monitor 27"', category: 'Electronics', price: 18999, stock: 10, rating: 4.9 }
    );
    assert('POST /api/products creates product and returns 201 Created', validNewProd.status === 201 && validNewProd.body.data.name === '4K Ultra HD Monitor 27"');
    const createdProdId = validNewProd.body.data ? validNewProd.body.data.id : null;

    // 7. Update Product
    if (createdProdId) {
      const updateRes = await request(
        { path: `/api/products/${createdProdId}`, method: 'PUT' },
        { price: 17999, stock: 15 }
      );
      assert('PUT /api/products/:id updates price and stock count', updateRes.status === 200 && updateRes.body.data.price === 17999 && updateRes.body.data.stock === 15);

      // Clean up test product
      await request({ path: `/api/products/${createdProdId}`, method: 'DELETE' });
    }

    // 8. Auth Guard Check on Cart (Unauthenticated)
    sessionCookie = ''; // Reset cookie
    const unauthCart = await request({ path: '/api/cart', method: 'GET' });
    assert('GET /api/cart blocks unauthenticated request with 401 Unauthorized', unauthCart.status === 401);

    // 9. User Registration & Login
    const testUser = {
      username: `alex_${Date.now()}`,
      email: `alex_${Date.now()}@shop.com`,
      password: 'password123'
    };

    const regRes = await request({ path: '/api/auth/register', method: 'POST' }, testUser);
    assert('POST /api/auth/register creates new customer with 201 Created', regRes.status === 201 && regRes.body.user.email === testUser.email);

    // Duplicate registration rejection
    const dupRes = await request({ path: '/api/auth/register', method: 'POST' }, testUser);
    assert('POST /api/auth/register rejects duplicate email/username with 400', dupRes.status === 400);

    // Login with invalid password
    const badLogin = await request({ path: '/api/auth/login', method: 'POST' }, { email: testUser.email, password: 'wrongpassword' });
    assert('POST /api/auth/login rejects incorrect password with 401', badLogin.status === 401);

    // Login with valid credentials
    const loginRes = await request({ path: '/api/auth/login', method: 'POST' }, { email: testUser.email, password: testUser.password });
    assert('POST /api/auth/login succeeds and sets session with 200 OK', loginRes.status === 200 && Boolean(sessionCookie));

    // Profile check
    const meRes = await request({ path: '/api/auth/me', method: 'GET' });
    assert('GET /api/auth/me returns current session user', meRes.status === 200 && meRes.body.user.email === testUser.email);

    // 10. Shopping Cart Tests
    const userCartRes = await request({ path: '/api/cart', method: 'GET' });
    assert('GET /api/cart returns user cart', userCartRes.status === 200 && Array.isArray(userCartRes.body.data.items));

    // Stock validation test: try to add more items than available stock
    const targetProduct = (await request({ path: '/api/products', method: 'GET' })).body.data[0];
    const initialStock = targetProduct.stock;

    const excessRes = await request(
      { path: '/api/cart/items', method: 'POST' },
      { productId: targetProduct.id, quantity: initialStock + 50 }
    );
    assert('POST /api/cart/items rejects item exceeding stock with 400 Bad Request', excessRes.status === 400);

    // Add valid quantity to cart
    const addQty = 2;
    const addRes = await request(
      { path: '/api/cart/items', method: 'POST' },
      { productId: targetProduct.id, quantity: addQty }
    );
    assert(
      'POST /api/cart/items successfully adds item and calculates total',
      addRes.status === 200 &&
      addRes.body.data.items.length === 1 &&
      addRes.body.data.cartTotal === targetProduct.price * addQty
    );

    // Add second item
    const secondProduct = (await request({ path: '/api/products', method: 'GET' })).body.data[1];
    await request(
      { path: '/api/cart/items', method: 'POST' },
      { productId: secondProduct.id, quantity: 1 }
    );

    // Delete second item from cart
    const deleteCartItemRes = await request(
      { path: `/api/cart/items/${secondProduct.id}`, method: 'DELETE' }
    );
    assert('DELETE /api/cart/items/:productId removes item from cart', deleteCartItemRes.status === 200 && deleteCartItemRes.body.data.items.length === 1);

    // 11. Checkout & Inventory Decrement Verification
    const checkoutRes = await request({ path: '/api/cart/checkout', method: 'POST' });
    assert('POST /api/cart/checkout processes order and returns 200 OK', checkoutRes.status === 200 && checkoutRes.body.order.status === 'Placed');

    // Verify cart is now empty
    const postCheckoutCart = await request({ path: '/api/cart', method: 'GET' });
    assert('Cart is emptied after checkout', postCheckoutCart.body.data.items.length === 0 && postCheckoutCart.body.data.cartTotal === 0);

    // Verify stock decremented in products
    const productAfterCheckout = (await request({ path: `/api/products/${targetProduct.id}`, method: 'GET' })).body.data;
    assert(
      'Product stock in products.json automatically decremented after checkout',
      productAfterCheckout.stock === initialStock - addQty,
      `Expected ${initialStock - addQty}, Got ${productAfterCheckout.stock}`
    );

    // 12. Logout
    const logoutRes = await request({ path: '/api/auth/logout', method: 'POST' });
    assert('POST /api/auth/logout terminates session with 200 OK', logoutRes.status === 200);

    // Try accessing cart after logout
    const postLogoutCart = await request({ path: '/api/cart', method: 'GET' });
    assert('Cart access rejected with 401 after logout', postLogoutCart.status === 401);

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    console.log('\n======================================================');
    console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
};

server = app.listen(PORT, () => {
  runTests();
});
