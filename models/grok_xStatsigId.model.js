const mongoose = require('mongoose');

const xStatsigIdSchema = new mongoose.Schema({
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Index to optimize queries
xStatsigIdSchema.index({ createdAt: -1 });

// Pre-save hook to maintain only 100 latest records
xStatsigIdSchema.pre('save', async function(next) {
  try {
    // Count total documents
    const totalCount = await this.constructor.countDocuments();
    
    // If we have more than 100 records, delete the oldest ones
    if (totalCount >= 100) {
      // Find the 100th newest record's createdAt
      const recordsToKeep = await this.constructor
        .find()
        .sort({ createdAt: -1 })
        .skip(99)
        .limit(1)
        .select('createdAt');
      
      if (recordsToKeep.length > 0) {
        const cutoffDate = recordsToKeep[0].createdAt;
        
        // Delete records older than or equal to the cutoff date
        await this.constructor.deleteMany({
          createdAt: { $lte: cutoffDate }
        });
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Static method to cleanup old records
xStatsigIdSchema.statics.cleanupOldRecords = async function() {
  try {
    // Keep only the 100 most recent records
    const recordsToKeep = await this
      .find()
      .sort({ createdAt: -1 })
      .skip(99)
      .limit(1)
      .select('createdAt');
    
    if (recordsToKeep.length > 0) {
      const cutoffDate = recordsToKeep[0].createdAt;
      
      const result = await this.deleteMany({
        createdAt: { $lte: cutoffDate }
      });
      
      console.log(`Cleaned up ${result.deletedCount} old xStatsigId records`);
      return result.deletedCount;
    }
    
    return 0;
  } catch (error) {
    console.error('Error cleaning up xStatsigId records:', error);
    throw error;
  }
};

module.exports = mongoose.model('XStatsigId', xStatsigIdSchema);
