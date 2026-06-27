const mongoose = require('mongoose');

const cronApiJobLogSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'CronApiJob', required: true },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date, required: true },
  durationMs: { type: Number, default: 0 },
  success: { type: Boolean, default: false },
  httpStatus: { type: Number, default: 0 },
  responsePreview: { type: String, default: '' },
  error: { type: String, default: '' }
}, { timestamps: true });

cronApiJobLogSchema.index({ createdAt: -1 });
cronApiJobLogSchema.index({ job: 1, createdAt: -1 });

module.exports = mongoose.model('CronApiJobLog', cronApiJobLogSchema);
