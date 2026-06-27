const mongoose = require('mongoose');

const apiHeaderSchema = new mongoose.Schema({
  content: { type: String, required: true },
  user_id: { type: String, null: true },
  shop_id: { type: String, null: true },
  shopee_account_username: { type: String, null: true },
}, { timestamps: true });

module.exports = mongoose.model('ApiHeaderSchema', apiHeaderSchema);
