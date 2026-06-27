const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const WEB_PRO = Number(process.env.WEB_PRO ?? 1);

function getDefaultShopeePage() {
  return WEB_PRO === 0
    ? '/shopee-accounts/upload-video'
    : '/shopee-accounts/video-upload-manager';
}

// Login page
router.get('/login', (req, res) => {
  // If user is already logged in, redirect to dashboard
  if (req.cookies.token) {
    return res.redirect(getDefaultShopeePage());
  }
  
  // Get error and success messages from session
  const error = req.session.loginError;
  const success = req.session.loginSuccess;
  
  // Clear messages after retrieving them
  req.session.loginError = null;
  req.session.loginSuccess = null;
  
  console.log('Login page rendered with error:', error);
  
  // Render login page without layout
  res.render('auth/login', { 
    title: 'Login',
    error: error || '',
    success: success || '',
    layout: false
  });
});

// Login form submission
router.post('/login', userController.login);

// Logout
router.get('/logout', (req, res) => {
  res.clearCookie('token');
  req.flash('success', 'Đăng xuất thành công');
  res.redirect('/login');
});

module.exports = router;
