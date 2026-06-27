// Authentication middleware
const User = require('../models/user.model');

// Check if user is authenticated
exports.isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  
  // Redirect to login page if not authenticated
  req.flash('error', 'Please log in to access this page');
  res.redirect('/login');
};

// Check if user is admin
exports.isAdmin = async (req, res, next) => {
  if (!req.session || !req.session.userId) {
    req.flash('error', 'Please log in to access this page');
    return res.redirect('/login');
  }
  
  try {
    const user = await User.findById(req.session.userId);
    
    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/login');
    }
    
    if (user.role !== 'admin') {
      req.flash('error', 'You do not have permission to access this page');
      return res.redirect('/');
    }
    
    next();
  } catch (error) {
    console.error('Error checking admin status:', error);
    req.flash('error', 'Server error');
    res.redirect('/login');
  }
};

// Middleware to load user data
exports.loadUser = async (req, res, next) => {
  if (req.session && req.session.userId) {
    try {
      const user = await User.findById(req.session.userId).populate('team');
      
      if (user) {
        req.user = user;
        res.locals.user = user;
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  }
  
  next();
};