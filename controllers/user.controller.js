const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const { nowDate, parseDateInAppTimezone } = require('../utils/datetime');

const WEB_PRO = Number(process.env.WEB_PRO ?? 1);

function getDefaultShopeePage() {
  return WEB_PRO === 0
    ? '/shopee-accounts/upload-video'
    : '/shopee-accounts/video-upload-manager';
}

const isUserExpired = (user) => {
  const expiredAt = parseDateInAppTimezone(user && user.expiredAt);
  return Boolean(expiredAt && expiredAt.getTime() <= nowDate().getTime());
};

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create user
exports.createUser = async (req, res) => {
  try {
    const newUser = new User(req.body);
    await newUser.save();
    
    // Don't return the password
    const userResponse = newUser.toObject();
    delete userResponse.password;
    
    res.status(201).json(userResponse);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    // Don't allow role updates through this endpoint
    if (req.body.role && req.user.role !== 'admin') {
      delete req.body.role;
    }
    
    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    }).select('-password');
    
    if (!updatedUser) return res.status(404).json({ message: 'User not found' });
    res.json(updatedUser);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// User login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Username:', username);
    console.log('Password:', password);
    
    // Find user by username or email
    const user = await User.findOne({ 
      $or: [{ username }, { email: username }]
    });
    console.log('User:', user);
    
    if (!user) {
      // Store error in session directly if flash isn't working
      if (req.session) {
        req.session.loginError = 'Tài khoản không tồn tại';
      }
      console.log('User not found error set');
      return res.redirect('/login');
    }

    if (isUserExpired(user)) {
      if (user.active) {
        user.active = false;
        await user.save();
      }
      if (req.session) {
        req.session.loginError = 'Tài khoản đã hết hạn sử dụng, vui lòng liên hệ admin để gia hạn';
      }
      return res.redirect('/login');
    }

    if (!user.active) {
      if (req.session) {
        req.session.loginError = 'Tài khoản đã bị khóa';
      }
      return res.redirect('/login');
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      if (req.session) {
        req.session.loginError = 'Mật khẩu không chính xác';
      }
      console.log('Password incorrect error set');
      return res.redirect('/login');
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1d' }
    );
    
    // Set token in cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    
    // Clear any previous errors
    if (req.session) {
      req.session.loginError = null;
      req.session.loginSuccess = 'Đăng nhập thành công';
    }
    
    // Redirect to dashboard
    res.redirect(getDefaultShopeePage());
  } catch (err) {
    console.error('Login error:', err);
    if (req.session) {
      req.session.loginError = 'Đã xảy ra lỗi trong quá trình đăng nhập: ' + err.message;
    }
    res.redirect('/login');
  }
};

// User logout
exports.logout = (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logout successful' });
};

// Create admin user
exports.createAdminUser = async () => {
  try {
    // Check if admin already exists
    const adminExists = await User.findOne({ email: 'admin2@gmail.com' });
    
    if (!adminExists) {
      await User.create({
        name: 'admin',
        username: 'baole',
        email: 'admin2@gmail.com',
        password: '12qwaszxCV@',
        role: 'admin'
      });
    
      console.log('Admin user created successfully');
    } else {
      console.log('Admin user already exists');
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
};

// Authentication middleware
exports.authenticate = async (req, res, next) => {
  try {
    // Get token from cookie or authorization header
    const token = req.cookies.token || 
                 (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Find user
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (isUserExpired(user)) {
      if (user.active) {
        user.active = false;
        await user.save();
      }
      return res.status(401).json({ message: 'Account expired' });
    }

    if (!user.active) {
      return res.status(401).json({ message: 'Account is inactive' });
    }
    
    // Add user to request
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Admin authorization middleware
exports.authorizeAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Admin access required' });
  }
};
