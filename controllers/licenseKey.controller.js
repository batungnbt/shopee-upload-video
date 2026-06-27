const LicenseKey = require('../models/licenseKey.model');
const { nowDate, parseDateInAppTimezone } = require('../utils/datetime');

exports.getLicenseKeys = async (req, res) => {
  try {
    const licenses = await LicenseKey.find().sort({ createdAt: -1 });
    res.render('admin/license-keys', {
      title: 'Quản lý License Keys',
      activePage: 'admin-license-keys',
      licenses
    });
  } catch (error) {
    console.error('Error fetching license keys:', error);
    req.flash('error', 'Không thể tải danh sách license keys');
    res.status(500).send('Server error');
  }
};

exports.getLicenseForm = async (req, res) => {
  try {
    let license = {};
    if (req.params.id) {
      license = await LicenseKey.findById(req.params.id);
      if (!license) {
        req.flash('error', 'Không tìm thấy license');
        return res.redirect('/admin/license-keys');
      }
    }
    res.render('admin/license-key-form', {
      title: req.params.id ? 'Chỉnh sửa License Key' : 'Tạo License Key',
      activePage: 'admin-license-keys',
      license
    });
  } catch (error) {
    console.error('Error loading license form:', error);
    req.flash('error', 'Không thể tải form license');
    res.status(500).send('Server error');
  }
};

const crypto = require('crypto');

exports.createLicenseKey = async (req, res) => {
  try {
    const { key, expiresAt, note, roles, check_product, create_video, upload_video } = req.body;
    
    if (!key) {
      return res.status(400).json({ success: false, message: 'Key is required' });
    }

    // Split keys by newline and filter empty ones
    const keys = key.split('\n').map(k => k.trim()).filter(k => k.length > 0);
    
    if (keys.length === 0) {
       return res.status(400).json({ success: false, message: 'Vui lòng nhập ít nhất 1 key' });
    }

    let createdCount = 0;
    let skippedCount = 0;
    let errors = [];

    const scopeSettings = {
        check_product: !!check_product,
        create_video: !!create_video,
        upload_video: !!upload_video,
    };
    
    const roleList = Array.isArray(roles) ? roles : (roles ? roles.split(',').map(r => r.trim()).filter(Boolean) : []);

    for (const singleKey of keys) {
        try {
            const existing = await LicenseKey.findOne({ key: singleKey });
            if (existing) {
                skippedCount++;
                continue;
            }

            const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
              modulusLength: 2048,
              publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
              privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
            });

            const license = new LicenseKey({
              key: singleKey,
              public_key: publicKey,
              private_key: privateKey,
              expiresAt: parseDateInAppTimezone(expiresAt),
              note: note || '',
              roles: roleList,
              scopes: scopeSettings
            });

            await license.save();
            createdCount++;
        } catch (err) {
            console.error(`Error creating key ${singleKey}:`, err);
            errors.push(singleKey);
        }
    }

    let message = `Đã tạo ${createdCount} license thành công.`;
    if (skippedCount > 0) message += ` Bỏ qua ${skippedCount} key trùng.`;
    if (errors.length > 0) message += ` Lỗi ${errors.length} key.`;

    res.status(201).json({ success: true, message, data: { created: createdCount, skipped: skippedCount } });
  } catch (error) {
    console.error('Error creating license key:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tạo license', error: error.message });
  }
};

exports.updateLicenseKey = async (req, res) => {
  try {
    const { key, expiresAt, note, roles, check_product, create_video, upload_video } = req.body;
    const license = await LicenseKey.findById(req.params.id);
    if (!license) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy license' });
    }
    // If changing key, ensure uniqueness
    if (key && key !== license.key) {
      const dup = await LicenseKey.findOne({ key });
      if (dup) {
        return res.status(400).json({ success: false, message: 'Key đã tồn tại' });
      }
      license.key = key;
    }
    if (expiresAt) license.expiresAt = parseDateInAppTimezone(expiresAt);
    license.note = note || '';
    license.roles = Array.isArray(roles) ? roles : (roles ? roles.split(',').map(r => r.trim()).filter(Boolean) : []);
    license.scopes = {
      check_product: !!check_product,
      create_video: !!create_video,
      upload_video: !!upload_video,
    };
    await license.save();
    res.json({ success: true, message: 'Cập nhật license thành công', data: license });
  } catch (error) {
    console.error('Error updating license key:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật license', error: error.message });
  }
};

exports.deleteLicenseKey = async (req, res) => {
  try {
    const license = await LicenseKey.findByIdAndDelete(req.params.id);
    if (!license) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy license' });
    }
    res.json({ success: true, message: 'Xóa license thành công' });
  } catch (error) {
    console.error('Error deleting license key:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xóa license', error: error.message });
  }
};

exports.checkLicenseKey = async (req, res) => {
  try {
    const { license_key, scope } = req.query;
    if (!license_key) {
      return res.status(400).json({ success: false, message: 'license_key is required' });
    }
    const license = await LicenseKey.findOne({ key: license_key }).select('key scopes roles note expiresAt public_key createdAt');
    if (!license) {
      return res.status(404).json({ success: false, message: 'license_key not found' });
    }
    const now = nowDate();
    const expired = license.expiresAt && parseDateInAppTimezone(license.expiresAt) < now;
    const result = {
      success: true,
      key: license.key,
      valid: !expired,
      expiresAt: license.expiresAt,
      scopes: license.scopes,
      roles: license.roles,
      public_key: license.public_key,
      note: license.note,
      createdAt: license.createdAt,
    };
    if (scope) {
      result.scope = scope;
      result.allowed = !!(license.scopes && license.scopes[scope]);
    }
    return res.json(result);
  } catch (error) {
    console.error('Error checking license key:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi kiểm tra license', error: error.message });
  }
};
