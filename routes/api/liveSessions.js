const express = require('express');
const router = express.Router();
const liveSessionController = require('../../controllers/liveSession.controller');

// Cập nhật trạng thái live session
const apiKeyAuth = require('../../middleware/apiKeyAuth');

router.post('/live-state', apiKeyAuth, liveSessionController.updateLiveState);

module.exports = router;