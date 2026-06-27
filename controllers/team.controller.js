const Team = require('../models/team.model');
const User = require('../models/user.model');
const Product = require('../models/product.model');
const mongoose = require('mongoose');

// Get all teams
exports.getTeams = async (req, res) => {
  try {
    const teams = await Team.find().sort({ name: 1 });
    res.render('admin/teams', {
      title: 'Quản lý Team',
      activePage: 'admin-teams',
      teams
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    req.flash('error', 'Không thể tải danh sách team');
    res.status(500).send('Server error');
  }
};

// Get team creation form
exports.getTeamForm = async (req, res) => {
  res.render('admin/team-form', {
    title: 'Tạo Team mới',
    activePage: 'admin-teams',
    team: {}
  });
};

// Get team edit form
exports.getEditTeamForm = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      req.flash('error', 'Không tìm thấy team');
      return res.redirect('/admin/teams');
    }
    
    res.render('admin/team-form', {
      title: 'Chỉnh sửa Team',
      activePage: 'admin-teams',
      team
    });
  } catch (error) {
    console.error('Error loading edit team form:', error);
    req.flash('error', 'Không thể tải form chỉnh sửa team');
    res.status(500).send('Server error');
  }
};

// Create new team
exports.createTeam = async (req, res) => {
  try {
    const { name, description } = req.body;
    
    // Check if team name already exists
    const existingTeam = await Team.findOne({ name });
    if (existingTeam) {
      return res.status(400).json({
        success: false,
        message: 'Tên team đã tồn tại'
      });
    }
    
    // Create new team
    const team = new Team({
      name,
      description
    });
    
    await team.save();
    
    res.status(201).json({
      success: true,
      message: 'Tạo team thành công',
      data: team
    });
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo team',
      error: error.message
    });
  }
};

// Update team
exports.updateTeam = async (req, res) => {
  try {
    const { name, description, active } = req.body;
    
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy team'
      });
    }
    
    // Check if new name already exists (if name is changed)
    if (name !== team.name) {
      const existingTeam = await Team.findOne({ name });
      if (existingTeam) {
        return res.status(400).json({
          success: false,
          message: 'Tên team đã tồn tại'
        });
      }
    }
    
    // Update team fields
    team.name = name;
    team.description = description;
    if (active !== undefined) {
      team.active = active;
    }
    
    await team.save();
    
    res.json({
      success: true,
      message: 'Cập nhật team thành công',
      data: team
    });
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật team',
      error: error.message
    });
  }
};

// Delete team
exports.deleteTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy team'
      });
    }
    
    // Check if team is assigned to any users
    const usersWithTeam = await User.countDocuments({ team: team._id });
    if (usersWithTeam > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa team vì đang được gán cho ${usersWithTeam} người dùng`
      });
    }
    
    await team.deleteOne();
    
    res.json({
      success: true,
      message: 'Xóa team thành công'
    });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa team',
      error: error.message
    });
  }
};

exports.getTeamLinkCounts = async (req, res) => {
  try {
    const teamIdsRaw = (req.query.teamIds || '')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean);

    const validTeamIds = teamIdsRaw
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(id => id);

    const matchConditions = {
      team: { $ne: null },
      product_link: { $exists: true, $ne: '' }
    };

    if (validTeamIds.length > 0) {
      matchConditions.team.$in = validTeamIds;
    }

    const counts = await Product.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: '$team',
          totalLinks: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: counts
    });
  } catch (error) {
    console.error('Error fetching team link counts:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tải thống kê link theo team',
      error: error.message
    });
  }
};
