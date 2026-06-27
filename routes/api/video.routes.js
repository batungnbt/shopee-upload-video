const express = require('express');
const router = express.Router();
const videoController = require('../../controllers/video.controller');

// Create a new video
router.post('/create', videoController.createVideo);

// Get all videos
router.get('/', videoController.getAllVideos);

// Get a video by ID
router.get('/created', videoController.getVideoCreated);

// Update a video
router.put('/:id', videoController.updateVideo);

// Delete a video
router.delete('/:id', videoController.deleteVideo);

module.exports = router;