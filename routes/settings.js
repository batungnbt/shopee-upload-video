const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');

// Get settings page
router.get('/', settingsController.getSettingsPage);

// Update settings
router.post('/update', settingsController.updateSettings);

module.exports = router;