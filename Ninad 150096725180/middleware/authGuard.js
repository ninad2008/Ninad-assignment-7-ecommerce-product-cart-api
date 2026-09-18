/**
 * Authentication Guard Middleware
 * Protects routes by ensuring a valid active session exists.
 */
const authGuard = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Please log in to access this resource'
    });
  }
  next();
};

module.exports = authGuard;
