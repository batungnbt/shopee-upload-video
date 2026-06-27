const express = require('express');
const router = express.Router();
const revenueStatsController = require('../controllers/revenueStats.controller');

// Get revenue statistics page
router.get('/', revenueStatsController.getRevenueStatsPage);

module.exports = router;