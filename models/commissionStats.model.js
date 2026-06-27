const mongoose = require('mongoose');

const commissionStatsSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    index: true
  },
  shopee_account_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShopeeAccount',
    required: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  stats: {
    totalGMV: {
      type: Number,
      default: 0
    },
    totalCommission: {
      type: Number,
      default: 0
    },
    xtraCommission: {
      type: Number,
      default: 0
    },
    shopeeCommission: {
      type: Number,
      default: 0
    },
    totalClicks: {
      type: Number,
      default: 0
    },
    averageEpc: {
      type: Number,
      default: 0
    },
    averageCvr: {
      type: Number,
      default: 0
    },
    totalCheckouts: {
      type: Number,
      default: 0
    },
    totalOrders: {
      type: Number,
      default: 0
    },
    totalItemsSold: {
      type: Number,
      default: 0
    },
    uniqueClicks: {
      type: Number,
      default: 0
    },
    uniqueClickConversions: {
      type: Number,
      default: 0
    }
  },
  is_mcn_data: {
    type: Boolean,
    default: false
  },
  raw_data: {
    type: Object
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for faster queries
commissionStatsSchema.index({ username: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('CommissionStats', commissionStatsSchema);
