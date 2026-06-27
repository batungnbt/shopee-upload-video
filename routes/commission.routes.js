const express = require('express');
const router = express.Router();
const commissionController = require('../controllers/commissionController');

router.get('/:username', commissionController.getComissionByUserName);

module.exports = router;
