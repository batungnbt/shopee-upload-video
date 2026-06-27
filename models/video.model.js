const mongoose = require('mongoose');
const videoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  links: {
    type: Array,
    default: []
  },
  status: {
    type: String,
    default: 'created',
    enum: ['created', 'checked', 'uploaded']
  },
  uploadedAt: {
    type: Date,
    default: null
  },
  url_video: {
    type: String,
    trim: true
  },
  id_item: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Video', videoSchema);
