/**
 * Product validation middleware
 * Validates request payload when creating or updating products.
 */
const validateProduct = (req, res, next) => {
  const isPost = req.method === 'POST';
  const { name, category, price, stock, rating } = req.body;

  const errors = [];

  if (isPost) {
    if (!name || typeof name !== 'string' || name.trim() === '') {
      errors.push('Product name is required and must be a non-empty string');
    }
    if (!category || typeof category !== 'string' || category.trim() === '') {
      errors.push('Product category is required and must be a non-empty string');
    }
    if (price === undefined || typeof price !== 'number' || price <= 0) {
      errors.push('Product price is required and must be a positive number greater than 0');
    }
    if (stock === undefined || typeof stock !== 'number' || stock < 0 || !Number.isInteger(stock)) {
      errors.push('Product stock is required and must be an integer greater than or equal to 0');
    }
    if (rating !== undefined && (typeof rating !== 'number' || rating < 0 || rating > 5)) {
      errors.push('Product rating must be a number between 0 and 5');
    }
  } else {
    // PUT / PATCH validation
    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      errors.push('Product name must be a non-empty string');
    }
    if (category !== undefined && (typeof category !== 'string' || category.trim() === '')) {
      errors.push('Product category must be a non-empty string');
    }
    if (price !== undefined && (typeof price !== 'number' || price <= 0)) {
      errors.push('Product price must be a positive number greater than 0');
    }
    if (stock !== undefined && (typeof stock !== 'number' || stock < 0 || !Number.isInteger(stock))) {
      errors.push('Product stock must be an integer greater than or equal to 0');
    }
    if (rating !== undefined && (typeof rating !== 'number' || rating < 0 || rating > 5)) {
      errors.push('Product rating must be a number between 0 and 5');
    }
    if (
      name === undefined &&
      category === undefined &&
      price === undefined &&
      stock === undefined &&
      rating === undefined
    ) {
      errors.push('At least one field to update must be provided');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

module.exports = validateProduct;
