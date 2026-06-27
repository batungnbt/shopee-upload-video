const express = require('express');
const router = express.Router();
const productController = require('../../controllers/product.controller');

// Existing routes
router.post('/', productController.createProduct);
router.get('/', productController.getAllProducts);
router.post('/admin', productController.addForAdmin);

// Product info management routes
router.get('/check', productController.getForCheckInfo);

router.put('/info', productController.updateInfoProduct);
router.get('/create-video', productController.getForCreateVideo);
router.post('/create-video', productController.updateCreateVideo);
router.get('/upload-video', productController.getForUploadVideo);
router.post('/upload-video', productController.updateUploadVideo);



// Routes with ID parameter should be last to avoid conflicts
router.get('/:id', productController.getProductById);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);



module.exports = router;