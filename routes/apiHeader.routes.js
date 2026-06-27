const express = require('express');
const router = express.Router();
const controller = require('../controllers/apiHeader.controller');

router.post('/', controller.createApiHeader);
router.get('/:username', controller.getApiHeaderByUsername);
router.put('/:username', controller.updateApiHeaderByUsername);
router.delete('/:username', controller.deleteApiHeaderByUsername);

module.exports = router;
