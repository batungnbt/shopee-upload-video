const User = require('../models/user.model');
const ShopeeAccount = require('../models/shopeeAccount.model');
const bcrypt = require('bcryptjs');
const Team = require('../models/team.model');
const {
  nowDate,
  parseDateInAppTimezone,
  startOfTodayInAppTimezone,
  startOfYesterdayInAppTimezone,
  addDaysInAppTimezone
} = require('../utils/datetime');

const parseExpiredAt = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const date = parseDateInAppTimezone(value);
  return !date || Number.isNaN(date.getTime()) ? null : date;
};

const getNormalizedText = (value) => {
  return String(value || '').trim();
};

const findOrCreateTeamByName = async (teamName) => {
  const normalizedName = getNormalizedText(teamName);
  if (!normalizedName) return null;

  const existingTeam = await Team.findOne({ name: normalizedName });
  if (existingTeam) return existingTeam._id;

  try {
    const createdTeam = await Team.create({
      name: normalizedName,
      description: `Auto-created for username: ${normalizedName}`,
      active: true
    });
    return createdTeam._id;
  } catch (error) {
    if (error && error.code === 11000) {
      const duplicatedTeam = await Team.findOne({ name: normalizedName });
      if (duplicatedTeam) return duplicatedTeam._id;
    }
    throw error;
  }
};

const resolveTeamId = async ({ teamMode, team, teamName, usernameFallback }) => {
  const mode = getNormalizedText(teamMode);

  if (mode === 'none') {
    return null;
  }

  if (mode === 'create_by_username') {
    const teamNameFromInput = getNormalizedText(teamName);
    const finalTeamName = teamNameFromInput || getNormalizedText(usernameFallback);
    return findOrCreateTeamByName(finalTeamName);
  }

  if (mode === 'select_existing') {
    return getNormalizedText(team) || null;
  }

  return team !== undefined ? (getNormalizedText(team) || null) : undefined;
};

// Get all users
exports.getUsers = async (req, res) => {
  try {
    // Sync status for expired users before rendering list
    await User.updateMany(
      {
        expiredAt: { $ne: null, $lte: nowDate() },
        active: true
      },
      { $set: { active: false } }
    );

    const users = await User.find()
      .populate('team', 'name')  // Populate team with name field
      .sort({ createdAt: -1 });

    const startOfToday = startOfTodayInAppTimezone();
    const startOfYesterday = startOfYesterdayInAppTimezone();

    const shopeeAccountStats = await ShopeeAccount.aggregate([
      { $match: { team: { $ne: null } } },
      {
        $group: {
          _id: '$team',
          count: { $sum: 1 },
          totalVideosUploaded: { $sum: { $ifNull: ['$totalVideosUploaded', 0] } },
          yesterdayVideosUploaded: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ['$last_upload_time', startOfYesterday] },
                    { $lt: ['$last_upload_time', startOfToday] }
                  ]
                },
                { $ifNull: ['$dalyVideosUploaded', 0] },
                0
              ]
            }
          }
        }
      }
    ]);

    const shopeeAccountCountByTeam = shopeeAccountStats.reduce((acc, item) => {
      const teamKey = String(item._id);
      acc[teamKey] = {
        count: item.count || 0,
        totalVideosUploaded: item.totalVideosUploaded || 0,
        yesterdayVideosUploaded: item.yesterdayVideosUploaded || 0
      };
      return acc;
    }, {});
    
    res.render('admin/accounts', {
      users,
      shopeeAccountCountByTeam,
      title: 'User Management',
      activePage: 'admin-accounts'
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    req.flash('error', 'Failed to fetch users');
    res.redirect('/admin');
  }
};

// Get user creation form
exports.getUserForm = async (req, res) => {
  try {
    // Get all teams for the dropdown
    const teams = await Team.find({ active: true }).sort({ name: 1 });
    
    res.render('admin/account-form', {
      title: 'Tạo tài khoản mới',
      activePage: 'admin-accounts',
      user: {},
      teams
    });
  } catch (error) {
    console.error('Error loading user form:', error);
    req.flash('error', 'Không thể tải form tạo tài khoản');
    res.status(500).send('Server error');
  }
};

// Get user edit form
exports.getEditUserForm = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('team');
    if (!user) {
      req.flash('error', 'Không tìm thấy tài khoản');
      return res.redirect('/admin/accounts');
    }
    
    // Get all teams for the dropdown
    const teams = await Team.find({ active: true }).sort({ name: 1 });
    
    res.render('admin/account-form', {
      title: 'Chỉnh sửa tài khoản',
      activePage: 'admin-accounts',
      user,
      teams
    });
  } catch (error) {
    console.error('Error loading edit user form:', error);
    req.flash('error', 'Không thể tải form chỉnh sửa tài khoản');
    res.status(500).send('Server error');
  }
};

// Create new user
exports.createUser = async (req, res) => {
  try {
    const { username, password, role, team, teamMode, teamName, expiredAt } = req.body;
    
    // Check if username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username đã tồn tại'
      });
    }
    
    // Create new user
    const parsedExpiredAt = parseExpiredAt(expiredAt);
    const isExpiredAtCreate = parsedExpiredAt && parsedExpiredAt.getTime() <= nowDate().getTime();
    const resolvedTeamId = await resolveTeamId({
      teamMode,
      team,
      teamName,
      usernameFallback: username
    });
    const user = new User({
      username,
      password,
      role,
      team: resolvedTeamId || null,
      expiredAt: parsedExpiredAt,
      active: !isExpiredAtCreate
    });
    
    await user.save();
    
    res.status(201).json({
      success: true,
      message: 'Tạo tài khoản thành công',
      data: user
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo tài khoản',
      error: error.message
    });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const { role, team, teamMode, teamName, password, active, expiredAt, extendDays } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản'
      });
    }
    
    // Update user fields only when provided
    if (role !== undefined) {
      user.role = role;
    }

    const resolvedTeamId = await resolveTeamId({
      teamMode,
      team,
      teamName,
      usernameFallback: user.username
    });
    if (resolvedTeamId !== undefined) {
      user.team = resolvedTeamId;
    }

    if (active !== undefined) {
      user.active = active === true || active === 'true';
    }

    if (expiredAt !== undefined) {
      user.expiredAt = parseExpiredAt(expiredAt);
    }

    if (extendDays !== undefined && extendDays !== null && extendDays !== '') {
      const days = Number(extendDays);
      if (Number.isNaN(days) || days <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Số ngày gia hạn không hợp lệ'
        });
      }

      const now = nowDate().getTime();
      const baseTime = user.expiredAt && user.expiredAt.getTime() > now
        ? user.expiredAt.getTime()
        : now;
      user.expiredAt = addDaysInAppTimezone(baseTime, days);
      user.active = true;
    }
    
    // Update password if provided
    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    if (user.expiredAt && user.expiredAt.getTime() <= nowDate().getTime()) {
      user.active = false;
    }
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Cập nhật tài khoản thành công',
      data: user
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật tài khoản',
      error: error.message
    });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản'
      });
    }
    
    // Prevent deleting admin users
    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa tài khoản admin'
      });
    }
    
    await user.deleteOne();
    
    res.json({
      success: true,
      message: 'Xóa tài khoản thành công'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa tài khoản',
      error: error.message
    });
  }
};
