const express = require('express');
const router = express.Router();
const ShopeeAccount = require('../models/shopeeAccount.model');
const Team = require('../models/team.model');
const Product = require('../models/product.model');
const ShopeeAccountApiLog = require('../models/shopeeAccountApiLog.model');
const shopeeAccountController = require('../controllers/shopeeAccount.controller');
const fs = require('fs');
const path = require('path');
const deviceGenerators = require('../utils/device-generators');
const crypto = require('crypto');
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;        // 128 bit = 16 bytes
const Account = require('../models/shopeeAccount.model');
const User = require('../models/user.model');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
function deriveKey(passphrase) {
  // Trả về Buffer 32-byte
  return crypto.createHash('sha256')
    .update(passphrase, 'utf8')
    .digest();
}
function encrypt(plaintext, passphrase) {
  const key = deriveKey(passphrase);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  // iv cũng encode base64 để giải mã sau này
  return iv.toString('base64') + ':' + encrypted;
}

function normalizeProxyValue(value) {
  let normalized = String(value || '').replace(/\r/g, '').trim();
  normalized = normalized.replace(/^`+|`+$/g, '').trim();
  normalized = normalized.replace(/^"+|"+$/g, '').trim();
  normalized = normalized.replace(/^'+|'+$/g, '').trim();
  return normalized;
}

function normalizeProxyInput(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = normalizeProxyValue(value);
  if (!normalized) {
    return null;
  }

  const proxyWithSchemeMatch = normalized.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(.+)$/);
  if (proxyWithSchemeMatch) {
    const scheme = proxyWithSchemeMatch[1].toLowerCase();
    const rest = normalizeProxyValue(proxyWithSchemeMatch[2]);

    if (!rest) {
      return null;
    }
    if (rest.includes('@')) {
      return `${scheme}://${rest}`;
    }

    const hostPortUserPassMatch = rest.match(/^([^:@/\s]+):(\d+):([^:\s]+):(.+)$/);
    if (hostPortUserPassMatch) {
      const [, host, port, username, password] = hostPortUserPassMatch;
      return `${scheme}://${username}:${password}@${host}:${port}`;
    }

    const hostPortMatch = rest.match(/^([^:@/\s]+):(\d+)$/);
    if (hostPortMatch) {
      const [, host, port] = hostPortMatch;
      return `${scheme}://${host}:${port}`;
    }

    return `${scheme}://${rest}`;
  }

  const hostPortUserPassMatch = normalized.match(/^([^:@/\s]+):(\d+):([^:\s]+):(.+)$/);
  if (hostPortUserPassMatch) {
    const [, host, port, username, password] = hostPortUserPassMatch;
    return `http://${username}:${password}@${host}:${port}`;
  }

  const hostPortMatch = normalized.match(/^([^:@/\s]+):(\d+)$/);
  if (hostPortMatch) {
    const [, host, port] = hostPortMatch;
    return `http://${host}:${port}`;
  }

  return normalized;
}
// Get all accounts
// router.get('/', async (req, res) => {
//   try {
//     // Build query based on user role and team
//     const query = {};

//     // If user is not admin, restrict to their team
//     if (req.user && req.user.role !== 'admin' && req.user.team) {
//       query.team = req.user.team;
//     }

//     // Apply search filter if provided
//     if (req.query.search) {
//       query.username = { $regex: req.query.search, $options: 'i' };
//     }

//     // Apply team filter if provided (for admins only)
//     if (req.query.team && req.user && req.user.role === 'admin') {
//       query.team = req.query.team;
//     }

//     // Sử dụng Promise.all để thực hiện các truy vấn song song
//     const [teams, accounts, productCounts] = await Promise.all([
//       // Get all teams for the dropdown (admin only)
//       (req.user && req.user.role === 'admin')
//         ? Team.find({ active: true }).sort({ name: 1 }).lean()
//         : [],
//       // Get accounts with team info
//       ShopeeAccount.find(query)
//         .populate('team', 'name')
//         .sort({ createdAt: -1 })
//         .lean(),
        
//       // Đếm số lượng sản phẩm cho mỗi tài khoản
//       productModel.aggregate([
//         { $match: { shopee_account: { $ne: null } } },
//         { $group: { _id: "$shopee_account", count: { $sum: 1 } } }
//       ])
//     ]);
    
//     // Tạo map để tra cứu nhanh số lượng sản phẩm cho mỗi tài khoản
//     const productCountMap = {};
//     productCounts.forEach(item => {
//       productCountMap[item._id.toString()] = item.count;
//     });
    
//     // Thêm số lượng sản phẩm vào mỗi tài khoản
//     const accountsWithProductCount = accounts.map(account => {
//       return {
//         ...account,
//         productCount: productCountMap[account._id.toString()] || 0
//       };
//     });

//     res.render('accounts', {
//       accounts: accountsWithProductCount,
//       teams,
//       activePage: 'shopee-accounts',
//       title: 'Accounts Management',
//       search: req.query.search || '',
//       selectedTeam: req.query.team || '',
//       isAdmin: req.user && req.user.role === 'admin'
//     });
//   } catch (error) {
//     console.error('Error fetching accounts:', error);
//     res.status(500).send('Server error');
//   }
// });
router.get('/api-upload-video/get-account', async (req, res) => {
  try {
    const isPrivilegedUser = req.user && ['admin', 'super_admin'].includes(req.user.role);
    const query = {};
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 40), 1), 200);
    const skip = (page - 1) * limit;

    if (!isPrivilegedUser && req.user && req.user.team) {
      query.team = req.user.team;
    }

    if (req.query.search) {
      query.username = { $regex: req.query.search, $options: 'i' };
    }

    const [accounts, total] = await Promise.all([
      ShopeeAccount.find(query)
        .select('username user_id shop_id cookie_live time_update_cookie proxy is_upload_api videosUploaded dalyVideosUploaded maxDalyVideosUploaded totalVideosUploaded last_status_upload number_error_upload team last_upload_time')
        .populate('team', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ShopeeAccount.countDocuments(query)
    ]);
    const totalPages = Math.max(Math.ceil(total / limit), 1);

    res.json({
      success: true,
      accounts,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching accounts upload video page:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

router.get('/upload-video', async (req, res) => {
  try {
    const isPrivilegedUser = req.user && ['admin', 'super_admin'].includes(req.user.role);
    const query = {};

    if (!isPrivilegedUser && req.user && req.user.team) {
      query.team = req.user.team;
    }

    if (req.query.search) {
      query.username = { $regex: req.query.search, $options: 'i' };
    }
    
    const accounts = await ShopeeAccount.find(query)
      .select('username user_id shop_id cookie_live time_update_cookie is_upload_api videosUploaded dalyVideosUploaded maxDalyVideosUploaded totalVideosUploaded last_status_upload number_error_upload team last_upload_time')
      .populate('team', 'name')
      .sort({ createdAt: -1 })
      .lean();

    res.render('accounts_upload_video', {
      accounts,
      activePage: 'shopee-accounts-upload-video',
      title: 'Accounts Upload Video',
      search: req.query.search || ''
    });
  } catch (error) {
    console.error('Error fetching accounts upload video page:', error);
    res.status(500).send('Server error');
  }
});

router.get('/video-upload-manager', (req, res) => {
  res.render('video_upload_manager', {
    activePage: 'video-upload-manager',
    title: 'Video Upload Manager'
  });
});

router.post('/video-upload-manager/generate-token', async (req, res) => {
  try {
    const username = String(
      (req.body && (req.body.username || req.body.account_username))
      || req.query.username
      || (req.user && req.user.username)
      || ''
    ).trim();

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu username account để tạo access_token'
      });
    }
    let user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found'
      });
    }

    const token = jwt.sign(
      {
        username,
        team: user.team,
        role: user.role,
        type: 'video_upload_access'
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '300d' }
    );

    return res.json({
      success: true,
      token,
      username
    });
  } catch (error) {
    console.error('Error generating local upload token:', error);
    return res.status(500).json({
      success: false,
      message: 'Không tạo được token'
    });
  }
});

router.get('/upload-video/logs', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 200), 500);
    const filter = {};

    if (req.query.username) {
      let account = await Account.findOne({ username: req.query.username });
      if (!account) {
        return res.status(400).json({
          success: false,
          message: 'Account not found'
        });
      }
      filter.account = account._id;
    
    }
     

    const logs = await ShopeeAccountApiLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('account', 'username user_id')
      .lean();
 

    return res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Error loading upload-video logs:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/upload-video/:id/toggle-upload-api', async (req, res) => {
  try {
    const isPrivilegedUser = req.user && ['admin', 'super_admin'].includes(req.user.role);
    const { enabled } = req.body;
    const filter = { _id: req.params.id };

    if (!isPrivilegedUser) {
      if (!req.user || !req.user.team) {
        return res.status(403).json({ success: false, message: 'Permission denied' });
      }
      filter.team = req.user.team;
    }

    const nextValue = !!enabled;
    const updated = await ShopeeAccount.findOneAndUpdate(
      filter,
      { is_upload_api: nextValue },
      { new: true, select: 'is_upload_api' }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    return res.json({
      success: true,
      is_upload_api: updated.is_upload_api
    });
  } catch (error) {
    console.error('Error toggling is_upload_api:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/upload-video/:id/update-cookie-live', async (req, res) => {
  try {
    const isPrivilegedUser = req.user && ['admin', 'super_admin'].includes(req.user.role);
    const { cookie_live } = req.body;
    const filter = { _id: req.params.id };

    if (!isPrivilegedUser) {
      if (!req.user || !req.user.team) {
        return res.status(403).json({ success: false, message: 'Permission denied' });
      }
      filter.team = req.user.team;
    }

    if (!cookie_live || !String(cookie_live).trim()) {
      return res.status(400).json({ success: false, message: 'cookie_live is required' });
    }

    const updated = await ShopeeAccount.findOneAndUpdate(
      filter,
      {
        cookie_live: String(cookie_live).trim(),
        time_update_cookie: String(Date.now())
      },
      { new: true, select: 'cookie_live time_update_cookie' }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    return res.json({
      success: true,
      cookie_live: updated.cookie_live,
      time_update_cookie: updated.time_update_cookie
    });
  } catch (error) {
    console.error('Error updating cookie_live:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/upload-video/:id/update-proxy', async (req, res) => {
  try {
    const isPrivilegedUser = req.user && ['admin', 'super_admin'].includes(req.user.role);
    const filter = { _id: req.params.id };

    if (!isPrivilegedUser) {
      if (!req.user || !req.user.team) {
        return res.status(403).json({ success: false, message: 'Permission denied' });
      }
      filter.team = req.user.team;
    }

    const normalizedProxy = normalizeProxyInput(req.body ? req.body.proxy : null);
    const updated = await ShopeeAccount.findOneAndUpdate(
      filter,
      { proxy: normalizedProxy },
      { new: true, select: 'proxy username user_id' }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    return res.json({
      success: true,
      proxy: updated.proxy,
      account: {
        _id: updated._id,
        username: updated.username,
        user_id: updated.user_id
      }
    });
  } catch (error) {
    console.error('Error updating proxy:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/upload-video/update-cookie-live-by-user-id', async (req, res) => {
  try {
    const isPrivilegedUser = req.user && ['admin', 'super_admin'].includes(req.user.role);
    const { user_id, cookie_live } = req.body;

    if (!user_id || !String(user_id).trim()) {
      return res.status(400).json({ success: false, message: 'user_id is required' });
    }
    if (!cookie_live || !String(cookie_live).trim()) {
      return res.status(400).json({ success: false, message: 'cookie_live is required' });
    }

    const filter = { user_id: String(user_id).trim() };
    if (!isPrivilegedUser) {
      if (!req.user || !req.user.team) {
        return res.status(403).json({ success: false, message: 'Permission denied' });
      }
      filter.team = req.user.team;
    }

    const updated = await ShopeeAccount.findOneAndUpdate(
      filter,
      {
        cookie_live: String(cookie_live).trim(),
        time_update_cookie: String(Date.now())
      },
      { new: true, select: 'user_id username cookie_live time_update_cookie' }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Account not found by user_id' });
    }

    return res.json({
      success: true,
      account: {
        user_id: updated.user_id,
        username: updated.username || '',
        time_update_cookie: updated.time_update_cookie
      }
    });
  } catch (error) {
    console.error('Error updating cookie_live by user_id:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/upload-video/create-account-by-cookie', async (req, res) => {
  try {
    const isPrivilegedUser = req.user && ['admin', 'super_admin'].includes(req.user.role);
    const { username, user_id, cookie_live } = req.body;

    if (!username || !String(username).trim()) {
      return res.status(400).json({ success: false, message: 'username is required' });
    }
    if (!user_id || !String(user_id).trim()) {
      return res.status(400).json({ success: false, message: 'user_id is required' });
    }
    if (!cookie_live || !String(cookie_live).trim()) {
      return res.status(400).json({ success: false, message: 'cookie_live is required' });
    }

    const normalizedUsername = String(username).trim();
    const normalizedUserId = String(user_id).trim();
    const normalizedCookie = String(cookie_live).trim();
    const updateData = {
      username: normalizedUsername,
      cookie_live: normalizedCookie,
      time_update_cookie: String(Date.now())
    };

    if (!isPrivilegedUser) {
      if (!req.user || !req.user.team) {
        return res.status(403).json({ success: false, message: 'Permission denied' });
      }
      updateData.team = req.user.team;
    }

    const account = await ShopeeAccount.findOneAndUpdate(
      { user_id: normalizedUserId },
      { $set: updateData, $setOnInsert: { user_id: normalizedUserId, is_upload_api: true, maxDalyVideosUploaded: 90 } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    return res.json({
      success: true,
      account: {
        _id: account._id,
        username: account.username,
        user_id: account.user_id
      }
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ success: false, message: 'username hoặc user_id đã tồn tại' });
    }
    console.error('Error creating account by cookie:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/upload-video/batch-toggle-upload-api', async (req, res) => {
  try {
    const isPrivilegedUser = req.user && ['admin', 'super_admin'].includes(req.user.role);
    const { accountIds, enabled } = req.body;

    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return res.status(400).json({ success: false, message: 'accountIds is required' });
    }

    const validObjectIds = accountIds.filter(id => id && /^[0-9a-fA-F]{24}$/.test(id));
    if (!validObjectIds.length) {
      return res.status(400).json({ success: false, message: 'No valid account IDs provided' });
    }

    const filter = { _id: { $in: validObjectIds } };
    if (!isPrivilegedUser) {
      if (!req.user || !req.user.team) {
        return res.status(403).json({ success: false, message: 'Permission denied' });
      }
      filter.team = req.user.team;
    }

    const updateResult = await ShopeeAccount.updateMany(
      filter,
      { $set: { is_upload_api: !!enabled } }
    );

    return res.json({
      success: true,
      modifiedCount: updateResult.modifiedCount || 0,
      enabled: !!enabled
    });
  } catch (error) {
    console.error('Error batch toggling is_upload_api:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/upload-video/batch-set-max-daily-videos', async (req, res) => {
  try {
    const isPrivilegedUser = req.user && ['admin', 'super_admin'].includes(req.user.role);
    const { accountIds, maxDalyVideosUploaded } = req.body;

    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return res.status(400).json({ success: false, message: 'accountIds is required' });
    }

    const parsedValue = Number(maxDalyVideosUploaded);
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      return res.status(400).json({ success: false, message: 'maxDalyVideosUploaded must be a non-negative number' });
    }

    const validObjectIds = accountIds.filter(id => id && /^[0-9a-fA-F]{24}$/.test(id));
    if (!validObjectIds.length) {
      return res.status(400).json({ success: false, message: 'No valid account IDs provided' });
    }

    const filter = { _id: { $in: validObjectIds } };
    if (!isPrivilegedUser) {
      if (!req.user || !req.user.team) {
        return res.status(403).json({ success: false, message: 'Permission denied' });
      }
      filter.team = req.user.team;
    }

    const updateResult = await ShopeeAccount.updateMany(
      filter,
      { $set: { maxDalyVideosUploaded: parsedValue } }
    );

    return res.json({
      success: true,
      modifiedCount: updateResult.modifiedCount || 0,
      maxDalyVideosUploaded: parsedValue
    });
  } catch (error) {
    console.error('Error batch setting maxDalyVideosUploaded:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/upload-video/batch-update-proxy', async (req, res) => {
  try {
    const isPrivilegedUser = req.user && ['admin', 'super_admin'].includes(req.user.role);
    const { accountIds, proxies } = req.body;

    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return res.status(400).json({ success: false, message: 'accountIds is required' });
    }
    if (!Array.isArray(proxies) || proxies.length === 0) {
      return res.status(400).json({ success: false, message: 'proxies is required' });
    }

    const validObjectIds = accountIds.filter(id => id && /^[0-9a-fA-F]{24}$/.test(id));
    if (!validObjectIds.length) {
      return res.status(400).json({ success: false, message: 'No valid account IDs provided' });
    }

    const normalizedProxies = proxies
      .map(proxy => normalizeProxyInput(proxy))
      .filter(proxy => proxy !== null);

    if (!normalizedProxies.length) {
      return res.status(400).json({ success: false, message: 'No valid proxies provided' });
    }

    if (normalizedProxies.length !== 1 && normalizedProxies.length !== validObjectIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Số proxy phải là 1 hoặc bằng số tài khoản đã chọn'
      });
    }

    const filter = { _id: { $in: validObjectIds } };
    if (!isPrivilegedUser) {
      if (!req.user || !req.user.team) {
        return res.status(403).json({ success: false, message: 'Permission denied' });
      }
      filter.team = req.user.team;
    }

    const accounts = await ShopeeAccount.find(filter)
      .select('_id')
      .sort({ createdAt: -1 })
      .lean();

    if (!accounts.length) {
      return res.status(404).json({ success: false, message: 'No accounts found to update' });
    }

    if (normalizedProxies.length !== 1 && normalizedProxies.length !== accounts.length) {
      return res.status(400).json({
        success: false,
        message: `Số proxy hợp lệ (${normalizedProxies.length}) không khớp số tài khoản tìm thấy (${accounts.length})`
      });
    }

    const bulkOps = accounts.map((account, index) => ({
      updateOne: {
        filter: { _id: account._id },
        update: {
          $set: {
            proxy: normalizedProxies.length === 1
              ? normalizedProxies[0]
              : normalizedProxies[index]
          }
        }
      }
    }));

    const updateResult = await ShopeeAccount.bulkWrite(bulkOps);

    return res.json({
      success: true,
      modifiedCount: updateResult.modifiedCount || 0,
      matchedCount: updateResult.matchedCount || accounts.length,
      appliedProxyCount: normalizedProxies.length
    });
  } catch (error) {
    console.error('Error batch updating proxies:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/upload-video/bulk-delete', async (req, res) => {
  try {
    const isPrivilegedUser = req.user && ['admin', 'super_admin'].includes(req.user.role);
    const { accountIds } = req.body;

    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return res.status(400).json({ success: false, message: 'accountIds is required' });
    }

    const validObjectIds = accountIds.filter(id => id && /^[0-9a-fA-F]{24}$/.test(id));
    if (!validObjectIds.length) {
      return res.status(400).json({ success: false, message: 'No valid account IDs provided' });
    }

    const filter = { _id: { $in: validObjectIds } };
    if (!isPrivilegedUser) {
      if (!req.user || !req.user.team) {
        return res.status(403).json({ success: false, message: 'Permission denied' });
      }
      filter.team = req.user.team;
    }

    const accountsToDelete = await ShopeeAccount.find(filter).select('_id');
    const deletableIds = accountsToDelete.map(a => a._id);
    if (!deletableIds.length) {
      return res.status(404).json({ success: false, message: 'No accounts found to delete' });
    }

    const deleteResult = await ShopeeAccount.deleteMany({ _id: { $in: deletableIds } });
    await Product.deleteMany({ shopee_account: { $in: deletableIds } });

    return res.json({
      success: true,
      deletedCount: deleteResult.deletedCount || 0
    });
  } catch (error) {
    console.error('Error bulk deleting upload-video accounts:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add new account
router.post('/add', async (req, res) => {
  try {
    const { username, email, phone, shop_id, team, is_active } = req.body;

    const newAccount = new ShopeeAccount({
      username,
      email,
      phone,
      shop_id,
      team: team || null,
      is_active: is_active === 'on' || is_active === true
    });

    await newAccount.save();
    req.flash('success', 'Account added successfully');
    res.redirect('/accounts');
  } catch (error) {
    console.error('Error adding account:', error);
    req.flash('error', 'Failed to add account');
    res.redirect('/accounts');
  }
});

// Update account
router.post('/update/:id', async (req, res) => {
  try {
    const { username, email, phone, shop_id, team, is_active, isMcn } = req.body;
    console.log({ username, email, phone, shop_id, team, is_active, isMcn })
    // Build update object
    const updateData = {
      username,
      email,
      phone,
      shop_id,
      is_active: is_active === 'on' || is_active === true,
      isMcn: isMcn === 'on' || isMcn === true
    };

    // Only update team if provided
    if (team) {
      updateData.team = team;
    } else if (team === '') {
      // If team is explicitly set to empty, set to null
      updateData.team = null;
    }

    const updatedAccount = await ShopeeAccount.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!updatedAccount) {
      req.flash('error', 'Account not found');
      return res.redirect('/shopee-accounts');
    }

    req.flash('success', 'Account updated successfully');
    res.redirect('/shopee-accounts');
  } catch (error) {
    console.error('Error updating account:', error);
    req.flash('error', 'Failed to update account');
    res.redirect('/shopee-accounts');
  }
});

// Delete account
router.delete('/delete/:id', async (req, res) => {
  try {
    const deletedAccount = await ShopeeAccount.findByIdAndDelete(req.params.id);
    // xóa log
    await ShopeeAccountApiLog.deleteMany({ account: req.params.id });

    if (!deletedAccount) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    return res.json({ success: true, message: 'Account deleted successfully', accountId: req.params.id });
  } catch (error) {
    console.error('Error deleting account:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Bulk delete accounts
router.post('/bulk-delete', async (req, res) => {
  try {
    const { accountIds } = req.body;

    // Validate input
    if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid input: accountIds must be a non-empty array' 
      });
    }

    // Validate that all IDs are valid MongoDB ObjectIds
    const validObjectIds = accountIds.filter(id => {
      return id.match(/^[0-9a-fA-F]{24}$/);
    });

    if (validObjectIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No valid account IDs provided' 
      });
    }

    // Delete accounts and their associated products
    const deleteResult = await ShopeeAccount.deleteMany({ 
      _id: { $in: validObjectIds } 
    });

    // Also delete associated products for these accounts
    await Product.deleteMany({ 
      shopee_account: { $in: validObjectIds } 
    });

    return res.json({ 
      success: true, 
      message: `Successfully deleted ${deleteResult.deletedCount} accounts and their associated products`,
      deletedCount: deleteResult.deletedCount
    });

  } catch (error) {
    console.error('Error bulk deleting accounts:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error while bulk deleting accounts' 
    });
  }
});

// Update live config
router.post('/update-live-config', async (req, res) => {
  try {
    const { accountId, avatar_path, shopee_category_ids, product_quantity, live_mode } = req.body;

    // Process category IDs from comma-separated string to array
    const categoryIds = shopee_category_ids.split(',')
      .map(id => id.trim())
      .filter(id => id !== '');

    const updatedAccount = await ShopeeAccount.findByIdAndUpdate(
      accountId,
      {
        'live_config.avatar_path': avatar_path,
        'live_config.shopee_category_ids': categoryIds,
        'live_config.product_quantity': product_quantity,
        'live_config.live_mode': live_mode
      },
      { new: true }
    );

    if (!updatedAccount) {
      return res.status(404).send('Account not found');
    }

    res.redirect('/accounts');
  } catch (error) {
    console.error('Error updating live config:', error);
    res.status(500).send('Server error');
  }
});


// Setup Live routes
// Add or update this route definition
router.get('/setup-live/:id', shopeeAccountController.getSetupLivePage);
router.post('/setup-live/:id', shopeeAccountController.uploadMiddleware, shopeeAccountController.processSetupLive);

// Toggle live mode (Test/Real)
router.post('/toggle-live-mode/:id', shopeeAccountController.toggleLiveMode);

// Filter and clean up products for a Shopee account
router.get('/filter-products/:username', shopeeAccountController.filterAccountProducts);

// Batch update MCN status for multiple accounts
router.post('/batch-update-mcn', async (req, res) => {
  try {
    const { usernames, isMcn } = req.body;

    // Validate input
    if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input: usernames must be a non-empty array'
      });
    }

    // Find all accounts matching the usernames
    const accounts = await ShopeeAccount.find({
      username: { $in: usernames }
    });

    // Get list of usernames that were found
    const foundUsernames = accounts.map(account => account.username);

    // Get list of usernames that were not found
    const notFoundUsernames = usernames.filter(username =>
      !foundUsernames.includes(username)
    );

    // Update MCN status for all found accounts
    if (accounts.length > 0) {
      await ShopeeAccount.updateMany(
        { username: { $in: foundUsernames } },
        { $set: { isMcn: isMcn === true } }
      );
    }

    return res.json({
      success: true,
      message: `Successfully updated MCN status for ${accounts.length} accounts`,
      updatedCount: accounts.length,
      notFound: notFoundUsernames
    });
  } catch (error) {
    console.error('Error batch updating MCN status:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating MCN status'
    });
  }
});

const productModel = require('../models/product.model');
router.get('/filter-products/:username', shopeeAccountController.filterAccountProducts);


router.get('/filter-custom-products/:username', shopeeAccountController.filterCustomAccountProducts);

// Batch update MCN status for multiple accounts
router.post('/update-cart-custom', async (req, res) => {
  try {
    const { username, isCustomCart } = req.body;

    // Find all accounts matching the usernames
    let account = await ShopeeAccount.findOne({
      username: username
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }
    account.isCustomCart = isCustomCart === "1";
    if (isCustomCart == "1") {
      const products = await productModel.find({ isVip : true, sold: {$gt: 10000} }).sort({ custom_number: 1 }).limit(100);
      const ids = products.map(p => p._id);
      await productModel.updateMany(
        { _id: { $in: ids } },
        { $inc: { custom_number: 1 } }
      );
      account.products = ids;
    }


    await account.save();

    return res.json({
      success: true,
      message: `Successfully updated cart custom for ${account.username}`,
    });
  } catch (error) {
    console.error('Error batch updating MCN status:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating MCN status'
    });
  }
});


const { randomLocation, getBrandList, countriesList } = require('../utils/device-generators');

router.get('/list_info', async (req, res) => {
  try {
    return res.json({
      success: true,
      message: 'Successfully get list info',
      brands: getBrandList(),
      countries: countriesList()
    });
  }
  catch (error) {
    console.error('Error get list info:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while get list info'
    });
  }
})

// Get random device info
router.get('/random-device', async (req, res) => {
  try {
    let { username, is_new, brand_device, country } = req.query;
    console.log({ username, is_new, brand_device, country })
    let shopeeAccount = await ShopeeAccount.findOne({ username: username });
    if (!shopeeAccount) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    if (is_new != '1') {
      if (shopeeAccount.deviceInfo != null && shopeeAccount.deviceInfo != "") {
        return res.status(200).json({
          success: true,
          message: 'Device info found',
          deviceInfo: shopeeAccount.deviceInfo
        });
      } else
        return res.status(200).json({
          success: true,
          message: 'Device info not found',
          deviceInfo: ""
        });
    }
    let location = randomLocation(country);

    // Đọc file devices.json
    const devicesPath = path.join(__dirname, '../devices.json');
    const devicesData = JSON.parse(fs.readFileSync(devicesPath, 'utf8'));

    // Get all device IDs from devices.json
    const deviceIds = Object.keys(devicesData);

    // Filter devices by brand and Android version > 9 if specified
    const filteredDeviceIds = deviceIds.filter(id => {
      const device = devicesData[id];
      const meetsVersionReq = device.release && parseFloat(device.release) > 9;
      if (!meetsVersionReq) return false;

      return brand_device
        ? device.brand?.toLowerCase() === brand_device.toLowerCase()
        : true;
    });

    // Select a random device from filtered list
    const randomDeviceId = deviceGenerators.getRandomItem(filteredDeviceIds);
    const randomDevice = devicesData[randomDeviceId];

    // Tạo thông tin thiết bị mới với dữ liệu ngẫu nhiên
    const deviceInfo = {
      manufacturer: randomDevice.manufacturer || "samsung",
      model: randomDevice.model || "SM-G990E",
      device: randomDevice.device || "r9s",
      board: randomDevice.board || "exynos2100",
      iso: country || "USA",
      build_id: randomDevice.build_id || "SP1A.210812.016",
      build_display: randomDevice.build_display || "SP1A.210812.016.G990EXXU1CVC5",
      fingerprint: randomDevice.fingerprint || "samsung/r9sxxx/r9s:12/SP1A.210812.016/G990EXXU1CVC5:user/release-keys",
      incremental: randomDevice.incremental || "G990EXXU1CVC5",
      host: randomDevice.host || "21DJGC09",
      imei1: deviceGenerators.randomIMEI("35520909527345"),
      imei2: deviceGenerators.randomIMEI("35520909527345"),
      imei: deviceGenerators.randomIMEI("35520909527345"),
      imsi: deviceGenerators.randomIMSI("452", "01"),
      simserial: deviceGenerators.randomSimSerial().substring(0, 8),
      androidid: deviceGenerators.randomAndroidID(),
      pnumber: shopeeAccount.phone || "",
      FakeGPU: deviceGenerators.getRandomItem([
        "Mali-G78 MP14",
        "Adreno 660",
        "PowerVR GE8320",
        "Mali-G52 MC2",
        "Adreno 650",
        "Mali-G77 MP11",
        "PowerVR GM9446",
        "Mali-G76 MP12",
        "Adreno 640",
        "Mali-G72 MP18"
      ]),
      build_time: randomDevice.build_time || "1647344110000",
      timestamp: randomDevice.build_time || "1647344110000",
      serial: deviceGenerators.randomSerial(),
      network: "WIFI",
      mac: deviceGenerators.randomWifiMac(),
      cpu_abilist: randomDevice.cpu_abilist || "arm64-v8a,armeabi-v7a,armeabi",
      release: "9",
      bootloader: randomDevice.bootloader || "G990EXXU1CVC5",
      product: randomDevice.product || "r9sxxx",
      http_agent: deviceGenerators.randomUserAgent({
        release: randomDevice.release || "12",
        model: randomDevice.model || "SM-G990E",
        build_id: randomDevice.build_id || "SP1A.210812.016"
      }),
      deviceName: randomDevice.deviceName || "SAMSUNG_SM-G990E",
      brand: randomDevice.brand || "samsung",
      timeZone: deviceGenerators.randomTimeZone(country),
      GLVendor: deviceGenerators.getRandomItem([
        "ARM",
        "Qualcomm",
        "NVIDIA",
        "Imagination Technologies",
        "Intel",
        "AMD",
        "PowerVR",
        "Mali",
        "Adreno",
        "Vivante"
      ]),
      hardware: randomDevice.hardware || "samsungexynos8895",
      BluetoothMac: deviceGenerators.randomBluetoothMac(),
      GLRenderer: deviceGenerators.getRandomItem([
        "Mali-G78 MP14",
        "Adreno 660",
        "PowerVR GE8320",
        "Mali-G52 MC2",
        "Adreno 650",
        "Mali-G77 MP11",
        "PowerVR GM9446",
        "Mali-G76 MP12",
        "Adreno 640",
        "Mali-G72 MP18"
      ]),
      AdsID: deviceGenerators.randomAdsID(),
      radio_version: randomDevice.radio_version || "G990EXXU1CVC5,G990EXXU1CVC5",
      DPI: "420",
      BSSID: deviceGenerators.randomMac(),
      Wifi_SSID: deviceGenerators.getRandomWifiName(),
      mnc: "01",
      mcc: "452",
      //API: randomDevice.release ? String(parseInt(randomDevice.release) + 19) : "31",
      API: "31",
      email: "",
      Language: "en",
      Country: country ?? "VN",
      operator_sim: deviceGenerators.randomOperatorSim(country),
      Battery: Math.floor(Math.random() * (100 - 5 + 1)) + 5,
      Long: location != null ? location.lon : "106.660172",
      Lat: location != null ? location.lat : "10.762622",
      gsfid: crypto.randomUUID(),
      SenSor: deviceGenerators.getRandomSensor(),
      SenSorVender: deviceGenerators.getRandomSensorVendor(),
      key_app: "",
      HideSim: false,
      isFakeWifi: false,
      isFakeGoogle: false,
      isFakeCPU: false,
      AndroidVesion: "9",
      Abi: "armeabi-v7a",

    };
    // Mã hóa thông tin thiết bị thành chuỗi Base64
    const encodedDeviceInfo = Buffer.from(JSON.stringify(deviceInfo)).toString('base64');

    // Lưu thông tin thiết bị đã mã hóa vào tài khoản
    shopeeAccount.deviceInfo = encrypt(encodedDeviceInfo, "SHOPEE_SBAOLE!#");
    await shopeeAccount.save();
    res.status(200).json({
      success: true,
      message: 'Random device info generated',
      deviceInfo: shopeeAccount.deviceInfo,
      device: randomDevice
    });
  } catch (error) {
    console.error('Error generating random device info:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
router.get('/:id/products', shopeeAccountController.getProductsByShopeeAccountId);

router.post('/add-products', shopeeAccountController.addProducts);


router.delete('/:id/no-interaction', shopeeAccountController.deleteNoInteraction);

// Chuyển sản phẩm từ tài khoản này sang tài khoản khác
router.post('/transfer-products', async (req, res) => {
  try {
    const { sourceAccountId, targetAccountId } = req.body;
    
    // Kiểm tra dữ liệu đầu vào
    if (!sourceAccountId || !targetAccountId) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ. Cần sourceAccountId, targetAccountId và mảng productIds'
      });
    }
    
    // Kiểm tra tài khoản nguồn và đích
    const sourceAccount = await ShopeeAccount.findById(sourceAccountId);
    const targetAccount = await ShopeeAccount.findOne({username: targetAccountId});
    
    if (!sourceAccount || !targetAccount) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản nguồn hoặc tài khoản đích'
      });
    }
    
    // Cập nhật sản phẩm - chuyển từ tài khoản nguồn sang tài khoản đích
    const updateResult = await productModel.updateMany(
      { 
        shopee_account: sourceAccountId // Đảm bảo sản phẩm thuộc tài khoản nguồn
      },
      { 
        $set: { shopee_account: targetAccount._id },
        $inc: { times_used: 1 } // Tăng số lần sử dụng
      }
    );
    
    // Kiểm tra kết quả cập nhật
    if (updateResult.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Không có sản phẩm nào được chuyển. Kiểm tra lại ID sản phẩm và tài khoản nguồn.'
      });
    }

    return res.json({
      success: true,
      message: `Đã chuyển ${updateResult.modifiedCount} sản phẩm từ tài khoản ${sourceAccount.username} sang tài khoản ${targetAccount.username}`,
      modifiedCount: updateResult.modifiedCount
    });
    
  } catch (error) {
    console.error('Lỗi khi chuyển sản phẩm:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi chuyển sản phẩm',
      error: error.message
    });
  }
});



// Get list of MP4 videos in videos folder
router.get('/videos', async (req, res) => {
  try {
    const videosDir = path.join(__dirname, '../videos');
    
    // Check if videos directory exists
    if (!fs.existsSync(videosDir)) {
      return res.json({
        success: true,
        data: [],
        message: 'Videos folder not found'
      });
    }

    // Read all files in videos directory
    const files = fs.readdirSync(videosDir);
    
    // Filter MP4 files
    const mp4Files = files
      .filter(file => file.toLowerCase().endsWith('.mp4'))
      .map(file => ({
        filename: file,
        path: `/videos/${file}`,
        size: fs.statSync(path.join(videosDir, file)).size
      }))
      .sort((a, b) => a.filename.localeCompare(b.filename));

    res.json({
      success: true,
      data: mp4Files,
      count: mp4Files.length
    });

  } catch (error) {
    console.error('Error reading videos folder:', error);
    res.status(500).json({
      success: false,
      message: 'Error reading videos folder',
      error: error.message
    });
  }
});

// Update account video file
router.post('/:id/video', async (req, res) => {
  try {
    const { id } = req.params;
    const { videoFile } = req.body;

    if (!videoFile) {
      return res.status(400).json({
        success: false,
        message: 'Video file is required'
      });
    }

    // Validate video file exists
    const videoPath = path.join(__dirname, '../videos', videoFile);
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({
        success: false,
        message: 'Video file not found'
      });
    }

    // Update account with selected video
    const updatedAccount = await ShopeeAccount.findByIdAndUpdate(
      id,
      { videoFile: videoFile },
      { new: true }
    );

    if (!updatedAccount) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    res.json({
      success: true,
      message: 'Video file updated successfully',
      data: {
        id: updatedAccount._id,
        username: updatedAccount.username,
        videoFile: updatedAccount.videoFile
      }
    });

  } catch (error) {
    console.error('Error updating account video:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating account video',
      error: error.message
    });
  }
});

// This route should be before module.exports
router.delete('/:id/cart-products', shopeeAccountController.deleteCartProducts);

module.exports = router;
