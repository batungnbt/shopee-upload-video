const express = require('express');
const router = express.Router();
const shopeeAccountController = require('../controllers/shopeeAccount.controller');

// Setup Live routes
// Add or update this route definition
router.get('/setup-live/:id', shopeeAccountController.getSetupLivePage);
router.post('/setup-live/:id', shopeeAccountController.uploadMiddleware, shopeeAccountController.processSetupLive);

module.exports = router;