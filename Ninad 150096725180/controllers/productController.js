const { v4: uuidv4 } = require('uuid');
const { readData, writeData } = require('../utils/fileHelper');

/**
 * Get all products with multi-criteria filtering, search, and sorting
 * GET /api/products
 * Query Params: category, minPrice, maxPrice, inStock, search, sort
 */
const getAllProducts = async (req, res) => {
  try {
    const { category, minPrice, maxPrice, inStock, search, sort } = req.query;
    let products = await readData('products.json');

    // Filter by Category
    if (category) {
      products = products.filter(
        (p) => p.category && p.category.toLowerCase() === category.toLowerCase().trim()
      );
    }

    // Filter by minPrice
    if (minPrice !== undefined && !isNaN(Number(minPrice))) {
      const min = Number(minPrice);
      products = products.filter((p) => p.price >= min);
    }

    // Filter by maxPrice
    if (maxPrice !== undefined && !isNaN(Number(maxPrice))) {
      const max = Number(maxPrice);
      products = products.filter((p) => p.price <= max);
    }

    // Filter by inStock (e.g. inStock=true or inStock=false)
    if (inStock !== undefined) {
      const isStockOnly = inStock === 'true' || inStock === true || inStock === '1';
      if (isStockOnly) {
        products = products.filter((p) => p.stock > 0);
      } else if (inStock === 'false' || inStock === false || inStock === '0') {
        products = products.filter((p) => p.stock === 0);
      }
    }

    // Search by product name or category
    if (search) {
      const searchTerm = search.toLowerCase().trim();
      products = products.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(searchTerm)) ||
          (p.category && p.category.toLowerCase().includes(searchTerm))
      );
    }

    // Sorting
    if (sort) {
      switch (sort) {
        case 'price_asc':
          products.sort((a, b) => a.price - b.price);
          break;
        case 'price_desc':
          products.sort((a, b) => b.price - a.price);
          break;
        case 'rating_desc':
          products.sort((a, b) => (b.rating || 0) - (a.rating || 0));
          break;
        case 'rating_asc':
          products.sort((a, b) => (a.rating || 0) - (b.rating || 0));
          break;
        case 'name_asc':
          products.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case 'name_desc':
          products.sort((a, b) => b.name.localeCompare(a.name));
          break;
        case 'newest':
          products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          break;
        case 'oldest':
          products.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          break;
        default:
          break;
      }
    }

    return res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving products',
      error: error.message
    });
  }
};

/**
 * Get single product by ID
 * GET /api/products/:id
 */
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const products = await readData('products.json');
    const product = products.find((p) => p.id === id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with ID '${id}' not found`
      });
    }

    return res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error fetching product by ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving product',
      error: error.message
    });
  }
};

/**
 * Add a new product
 * POST /api/products
 */
const createProduct = async (req, res) => {
  try {
    const { name, category, price, stock, rating } = req.body;
    const products = await readData('products.json');

    // Generate product ID
    const newId = `prod_${Date.now()}_${uuidv4().substring(0, 4)}`;

    const newProduct = {
      id: newId,
      name: name.trim(),
      category: category.trim(),
      price: Number(price),
      stock: Number(stock),
      rating: rating !== undefined ? Number(rating) : 0,
      createdAt: new Date().toISOString()
    };

    products.push(newProduct);
    await writeData('products.json', products);

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: newProduct
    });
  } catch (error) {
    console.error('Error creating product:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error creating product',
      error: error.message
    });
  }
};

/**
 * Update an existing product
 * PUT /api/products/:id
 */
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, price, stock, rating } = req.body;
    const products = await readData('products.json');

    const productIndex = products.findIndex((p) => p.id === id);
    if (productIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `Product with ID '${id}' not found`
      });
    }

    const currentProduct = products[productIndex];

    const updatedProduct = {
      ...currentProduct,
      ...(name !== undefined && { name: name.trim() }),
      ...(category !== undefined && { category: category.trim() }),
      ...(price !== undefined && { price: Number(price) }),
      ...(stock !== undefined && { stock: Number(stock) }),
      ...(rating !== undefined && { rating: Number(rating) }),
      updatedAt: new Date().toISOString()
    };

    products[productIndex] = updatedProduct;
    await writeData('products.json', products);

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct
    });
  } catch (error) {
    console.error('Error updating product:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error updating product',
      error: error.message
    });
  }
};

/**
 * Delete a product
 * DELETE /api/products/:id
 */
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const products = await readData('products.json');

    const productIndex = products.findIndex((p) => p.id === id);
    if (productIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `Product with ID '${id}' not found`
      });
    }

    const deletedProduct = products.splice(productIndex, 1)[0];
    await writeData('products.json', products);

    return res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      data: deletedProduct
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error deleting product',
      error: error.message
    });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};
