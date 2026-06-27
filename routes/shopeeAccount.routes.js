const express = require('express');
const router = express.Router();
const controller = require('../controllers/shopeeAccount.controller');

router.post('/', controller.createShopeeAccount);
router.post('/:username/sync-products', controller.syncProducts);
router.get('/', controller.getAllShopeeAccounts);
router.get('/:id', controller.getShopeeAccountById);
router.put('/:id', controller.updateShopeeAccount);
router.delete('/:id', controller.deleteShopeeAccount);
router.post('/assign-products', controller.assignProductsToShopeeAccount);
router.post('/unassign-products', controller.unassignProductsFromShopeeAccount);
router.get('/:id/products', controller.getProductsByShopeeAccountId);

module.exports = router;
