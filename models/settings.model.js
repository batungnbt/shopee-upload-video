const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  min_sold: { type: Number, default: 0 },
  min_default_commission_rate: { type: Number, default: 0 },
  min_rating_star: { type: Number, default: 0 },
  min_shop_rating: { type: Number, default: 0 },
  min_price: { type: Number, default: 0 },
  max_price: { type: Number, default: 0 },
  min_liked_count: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);