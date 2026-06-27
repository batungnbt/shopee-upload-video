const mongoose = require('mongoose');

const cronApiJobSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  apiUrl: { type: String, required: true, trim: true },
  method: { type: String, enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'GET' },
  headers: { type: String, default: '' },
  body: { type: String, default: '' },
  intervalSeconds: { type: Number, default: 60, min: 5, max: 86400 },
  timeoutMs: { type: Number, default: 15000, min: 1000, max: 120000 },
  active: { type: Boolean, default: true },
  running: { type: Boolean, default: false },
  lastRunAt: { type: Date, default: null },
  lastStatus: { type: String, default: '' },
  lastDurationMs: { type: Number, default: 0 },
  lastHttpStatus: { type: Number, default: 0 },
  lastError: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('CronApiJob', cronApiJobSchema);
