const mongoose = require('mongoose');
const Video = require('../models/video.model');



exports.createVideo = async (req, res) => {
  try {
   const  { title, links, url_video, id_item } = req.body
    if (!url_video || !id_item) {
      return res.status(400).json({ success: false, message: 'URL video and ID item is required' });
    }

    const video = await Video.create({ title, links, url_video, id_item });
        
    return res.status(201).json({
      success: true,
      message: 'Video created successfully',
      data: video
    });
  } catch (error) {
    console.error('Error creating video:', error);
    if (error && error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getAllVideos = async (req, res) => {
  try {
    const query = {};

    const videos = await Video.find(query).sort({ createdAt: -1 }).lean();

    return res.json({
      success: true,
      count: videos.length,
      data: videos
    });
  } catch (error) {
    console.error('Error fetching videos:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getVideoCreated = async (req, res) => {
  try {
    const video = await Video.findOneAndUpdate(
      { status: 'created' },
      { $set: { status: 'checked' } },
      { new: true, sort: { createdAt: 1 } }
    ).lean();
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    return res.json({
      success: true,
      message: 'Video created successfully',
      data: video
    });
  } catch (error) {
    console.error('Error fetching video by ID:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateVideo = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid video ID' });
    }
    const payload = req.body;

    const video = await Video.findByIdAndUpdate(
      id,
      payload,
      { new: true, runValidators: true }
    );

    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    return res.json({
      success: true,
      message: 'Video updated successfully',
      data: video
    });
  } catch (error) {
    console.error('Error updating video:', error);
    if (error && error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteVideo = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid video ID' });
    }

    const video = await Video.findByIdAndDelete(id);
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    return res.json({
      success: true,
      message: 'Video deleted successfully',
      data: video
    });
  } catch (error) {
    console.error('Error deleting video:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

