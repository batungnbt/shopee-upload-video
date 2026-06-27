
const Account = require('../models/shopeeAccount.model');
const User = require('../models/user.model');
const ShopeeAccountApiLog = require('../models/shopeeAccountApiLog.model');
const mongoose = require('mongoose');
const { emitUploadLog, emitUploadAccountUpdate } = require('../services/uploadLogSocket.service');
const {
  nowDate,
  startOfTodayInAppTimezone,
  isSameDayInAppTimezone,
  parseDateInAppTimezone
} = require('../utils/datetime');

module.exports.uploadVideoStatus = async (req, res) => {
  try {
    const { user_id, video_status } = req.body;
    let account = await Account.findOne({ user_id });
    if (!account) {
      return res.status(400).json({
        success: false,
        message: 'Account not found'
      });
    }

    if (video_status == "DONE") {
      account.totalVideosUploaded++;
      if (!isSameDayInAppTimezone(account.last_upload_time, nowDate())) {
        account.dalyVideosUploaded = 1;
        account.last_upload_time = nowDate();
      } else {
        account.dalyVideosUploaded++;
      }
      account.last_status_upload = "Đăng video thành công";
    } else if (video_status == "COOKIE_EXPIRED") {
      account.is_upload_api = false;
      account.last_status_upload = "Cookie hết hạn!";
    } else if (video_status == "ACCOUNT_BANNED"){
      account.last_status_upload = "Tài khoản bị ban";
      account.is_upload_api = false;
    } else if (video_status == "UPLOAD_RATE_LIMIT") {
      account.last_status_upload = "Đăng video bị giới hạn";
      account.is_upload_api = false;
    } else {
      account.last_status_upload = video_status;
    }
    await account.save();
    res.json({
      success: true,
      message: 'Video status updated successfully'
    });
  } catch (error) {
    console.error('Error updating video status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}

module.exports.updateCookieLive = async (req, res) => {
  try {
    const { user_id, cookie_live, username, shop_id } = req.body;
    let account = await Account.findOne({ user_id });
    if (!account) {
      // tạo mới account
      if (!username) {
        return res.status(400).json({
          success: false,
          message: 'Username and Shop ID are required'
        });
      }
      account = new Account({
        user_id,
        cookie_live: cookie_live,
        time_update_cookie: Date.now(),
        username,
        shop_id
      });
      await account.save();
      return res.json({
        success: true,
        message: 'Account created successfully',
        account
      });
    }
    if (!cookie_live) {
      return res.status(400).json({
        success: false,
        message: 'Cookie live is required'
      });
    }
    account.cookie_live = cookie_live;
    account.time_update_cookie = Date.now();
    await account.save();
    res.json({
      success: true,
      message: 'Cookie live updated successfully',
      account
    });
  } catch (error) {
    console.error('Error updating cookie live:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}

module.exports.logApiCall = async (req, res) => {
  try {
    const { user_id, status, message, job_id, source, payload, ip } = req.body || {};

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id is required'
      });
    }
    let account = await Account.findOne({ user_id });
    if (!account) {
      return res.status(400).json({
        success: false,
        message: 'Account not found'
      });
    }
    const created = await ShopeeAccountApiLog.create({
      account: account._id,
      status: status || '',
      message: message || '',
      job_id: job_id || '',
      source: source || 'upload_api',
      payload: payload || {},
      ip: ip || req.ip || null
    });

    emitUploadLog({
      id: created._id,
      time: created.createdAt,
      username: account.username || '',
      user_id: account.user_id || '',
      status: created.status || '',
      message: created.message || ''
    });

    return res.json({
      success: true,
      message: 'Log saved',
      id: created._id
    });
  } catch (error) {
    console.error('Error saving api log:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}
// API route to upload cronner
module.exports.getShopeeAccountsUpload = async (req, res) => {
  try {
    // lấy tất cả account có cookie_live, is_upload_api = true
    let query = {
      cookie_live: { $ne: null },
      is_upload_api: true
    };
    if(req.accessRole !== 'admin' && req.accessRole !== 'super_admin'){
      query = { ...query, team: req.accessTeam };
    }

    const accounts = await Account.find(query).sort({ username: 1 }).select('user_id username shop_id dalyVideosUploaded maxDalyVideosUploaded last_upload_time last_status_upload is_upload_api team');
    // lọc account: còn quota trong ngày hoặc đã sang ngày mới so với last_upload_time
    const startOfToday = startOfTodayInAppTimezone();
    const accountsUpload = accounts.filter((account) => {
      const lastUploadTime = parseDateInAppTimezone(account.last_upload_time);
      const isNewDay = !lastUploadTime || lastUploadTime < startOfToday;
      return account.dalyVideosUploaded < account.maxDalyVideosUploaded || isNewDay;
    });

    res.json({
      success: true,
      accounts: accountsUpload
    });
  } catch (error) {
    console.error('Error fetching shopee accounts:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}

module.exports.postShopeeAccountsUpload = async (req, res) => {
  try {
    const { user_id, cookie_live_new, status_upload, post_link , job_id, job_name, ip } = req.body;
   
    let account = await Account.findOne({ user_id });
    if (!account) {
      return res.status(400).json({
        success: false,
        message: 'Account not found'
      });
    }
    let level = "info";
    if(status_upload == "COOKIE_EXPIRED"){
      account.is_upload_api = false;
      account.last_status_upload = "Cookie hết hạn!";
      level = "error";
    } else if(status_upload == "UPLOAD_RATE_LIMIT"){
      account.last_status_upload = "Đăng video bị giới hạn";
      account.is_upload_api = false;
      level = "error";
    } else if(status_upload == "ACCOUNT_BANNED"){
      account.last_status_upload = "Tài khoản bị ban";
      account.is_upload_api = false;
      level = "error";
    }
    else if(status_upload == "VIDEO_UPLOADED"){
      level = "success";
      account.totalVideosUploaded++;
      if (!isSameDayInAppTimezone(account.last_upload_time, nowDate())) {
        account.dalyVideosUploaded = 1;
        account.last_upload_time = nowDate();
      } else {
        account.dalyVideosUploaded++;
      }
      account.is_upload_api = true;
    
      if (cookie_live_new) {
        account.cookie_live = cookie_live_new;
      }
      account.number_error_upload = 0;
      account.last_status_upload = "Đăng video thành công.";
    } else {
      account.number_error_upload++;
      if(account.number_error_upload >= 10){
        account.is_upload_api = false;
      } else {
        account.is_upload_api = true;
      }
      account.last_status_upload = status_upload || account.last_status_upload;
    }

    
    await account.save();
    await ShopeeAccountApiLog.create({
      account: account._id,
      status: level || '',
      message: account.last_status_upload,
      job_id,
      source: job_name,
      payload: {},
      post_link: post_link || '',
      ip: ip || null
    });

    emitUploadAccountUpdate({
      account_id: String(account._id),
      user_id: account.user_id || '',
      username: account.username || '',
      totalVideosUploaded: Number(account.totalVideosUploaded || 0),
      dalyVideosUploaded: Number(account.dalyVideosUploaded || 0),
      maxDalyVideosUploaded: Number(account.maxDalyVideosUploaded || 0),
      last_upload_time: account.last_upload_time || null,
      number_error_upload: Number(account.number_error_upload || 0),
      last_status_upload: account.last_status_upload || '',
      is_upload_api: account.is_upload_api || false
    });

    res.json({
      success: true,
      message: 'Account status updated successfully'
    });
  } catch (error) {
    console.error('Error posting shopee accounts:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}
module.exports.getShopeeAccountUpload = async (req, res)=>{
  try {
      const { user_id } = req.query;
      if (!user_id) {
        return res.status(400).json({
          success: false,
          message: 'user_id is required'
        });
      }
      let query = {};
      if(req.accessRole == 'admin' || req.accessRole == 'super_admin'){
        query = { user_id: user_id };
      } else {
        query = { user_id: user_id, team: req.accessTeam };
      }
      let account = await Account.findOne(query);
      if (!account) {
        return res.status(400).json({
          success: false,
          message: 'Account not found',
          account: null
        });
      }
      if(!account.is_upload_api){
        return res.json({
          success: false,
          message: "Account đã tắt đăng video.",
          account: null
        });
      }
      const startOfToday = startOfTodayInAppTimezone();
      const lastUploadTime = parseDateInAppTimezone(account.last_upload_time);
      const isNewDay = !lastUploadTime || lastUploadTime < startOfToday;

      if(account.dalyVideosUploaded >= account.maxDalyVideosUploaded && !isNewDay){
        return res.json({
          success: false,
          message: "Account đã đăng video tối đa.",
          account: null
        });
      }
      if(!account.cookie_live){
        return res.json({
          success: false,
          message: "Account chưa đăng nhập."
        });
      }
      return res.json({
        success: true,
        account,
        message: "Account có thể đăng video."
      });
    } catch (error) {
      console.error('Error fetching shopee account:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
}

module.exports.logApiCall = async (req, res) => {
  try {
    const { user_id, status, message, job_id, source, payload, ip } = req.body || {};

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id is required'
      });
    }
    let account = await Account.findOne({ user_id });
    if (!account) {
      return res.status(400).json({
        success: false,
        message: 'Account not found'
      });
    }
    const created = await ShopeeAccountApiLog.create({
      account: account._id,
      status: status || '',
      message: message || '',
      job_id: job_id || '',
      source: source || 'upload_api',
      payload: payload || {},
      ip: ip || req.ip || null
    });

    emitUploadLog({
      id: created._id,
      time: created.createdAt,
      username: account.username || '',
      user_id: account.user_id || '',
      status: created.status || '',
      message: created.message || ''
    });

    return res.json({
      success: true,
      message: 'Log saved',
      id: created._id
    });
  } catch (error) {
    console.error('Error saving api log:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}
