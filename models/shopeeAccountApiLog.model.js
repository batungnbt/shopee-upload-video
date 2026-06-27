const mongoose = require('mongoose');

const shopeeAccountApiLogSchema = new mongoose.Schema({
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'ShopeeAccount', required: true },
  status: { type: String, default: '' },
  message: { type: String, default: '' },
  job_id: { type: String, default: '' },
  source: { type: String, default: 'upload_api' },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  post_link: { type: String, default: '' },
  ip: { type: String, null: true, default: null },
}, { timestamps: true });

shopeeAccountApiLogSchema.index({ createdAt: -1 });
shopeeAccountApiLogSchema.index({ account: 1, createdAt: -1 });

shopeeAccountApiLogSchema.post('save', async function () {
  const Model = this.constructor;
  const logs = await Model.find({ account: this.account })
    .sort({ createdAt: -1, _id: -1 })
    .skip(200)
    .select('_id')
    .lean();

  if (logs.length > 0) {
    await Model.deleteMany({ _id: { $in: logs.map(log => log._id) } });
  }
});

module.exports = mongoose.model('ShopeeAccountApiLog', shopeeAccountApiLogSchema);
