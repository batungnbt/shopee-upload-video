const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  item_id: { type: String, required: true},
  shop_id: { type: String, required: true },
  name: { type: String, required: true },
  rating_star: { type: Number, default: null },
  shop_rating: { type: Number, default: null },
  price: { type: Number, required: true },
  sold: { type: Number, default: 0 },
  liked_count: { type: Number, default: 0 },
  default_commission_rate: { type: Number, default: null },
  seller_commission_rate: { type: Number, default: null },
  product_link: { type: String },
  shopee_account: { type: mongoose.Schema.Types.ObjectId, ref: 'ShopeeAccount', default: null },
  for_admin: { type: Boolean, default: false },
  // Thông số từ API Shopee
  clicks: { type: Number, default: 0 },
  atc: { type: Number, default: 0 },  // Add to cart
  placed_orders: { type: Number, default: 0 },
  cover_image: { type: String, default: "" },
  placed_items_sold: { type: Number, default: 0 },
  placed_sales: { type: Number, default: 0 },
  confirmed_orders: { type: Number, default: 0 },
  confirmed_items_sold: { type: Number, default: 0 },
  confirmed_sales: { type: Number, default: 0 },
  isVip: {  type: Boolean, default: false },
  custom_number: {  type: Number, default: 0 },
  times_used: { type: Number, default: 0 }, // Number of times this product has been retrieved
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  account_uploaded_video: { type: mongoose.Schema.Types.ObjectId, ref: 'ShopeeAccount', default: null },
  isCreatedVideo: { type: Boolean, default: false },
  statusUpVideo: { type: String, default: "No_Info" },
  isChecked: {type: Boolean, default: false},
  descriptions: {type: String, default: ""},
  bestImageUrl: {type: String, default: ""},
  bestImageScore: {type: Number, default: 0},
  commission_rate: {type: Number, default: 0},
  stock: {type: Number, default: 0},
  images: {type: Array, default: []}
}, { timestamps: true });

productSchema.index({ shopee_account: 1 });
module.exports = mongoose.model('Product', productSchema);
