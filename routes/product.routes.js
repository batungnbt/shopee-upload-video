const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');

router.get('/add', productController.addForAdmin);
router.get('/check', productController.getForCheckInfo);
router.put('/info', productController.updateInfoProduct);

router.get('/create-video', productController.getForCreateVideo);
router.post('/create-video', productController.updateCreateVideo);

router.get('/upload-video', productController.getForUploadVideo);
router.post('/upload-video', productController.updateUploadVideo);

// New import routes
router.get('/analytics', productController.getAnalytics);
router.post('/analytics', productController.postAnalytics);
router.post('/import', productController.importProducts);
router.post('/import-multi', productController.importMultiProducts);
 
router.post('/', productController.createProduct);
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

module.exports = router;
