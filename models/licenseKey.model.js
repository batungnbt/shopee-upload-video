const mongoose = require('mongoose');

const scopesSchema = new mongoose.Schema({
  check_product: { type: Boolean, default: false },
  create_video: { type: Boolean, default: false },
  upload_video: { type: Boolean, default: false },
}, { _id: false });

const licenseKeySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true },
  public_key: { type: String, required: true },
  private_key: { type: String, required: true },
  scopes: { type: scopesSchema, default: {} },
  roles: { type: [String], default: [] },
  note: { type: String, default: '' },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

module.exports = mongoose.model('LicenseKey', licenseKeySchema);
