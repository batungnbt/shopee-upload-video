const express = require('express');
const router = express.Router();
const shopeeAccountController = require('../controllers/shopeeAccount.controller');
const liveSessionController = require('../controllers/liveSession.controller');
const apiHeaderRouter = require('./apiHeader.routes');
const productRouter = require('./product.routes');
const commissionController = require('../controllers/commissionController');
const liveSessionsRouter = require('./api/liveSessions');
const xStatsigIdRouter = require('./api/xStatsigId.routes');
const proxyRouter = require('./api/proxy.routes');
const licenseKeyController = require('../controllers/licenseKey.controller');
const ApishopeeAccountController = require('../controllers/api.shopeeAccount');
const videoRouter = require('./api/video.routes');

// API key middleware
const API_KEY = "Baole28372hd";
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.query.apiKey;
  if (!apiKey || apiKey !== API_KEY) {
    return res.status(401).json({ success: false, message: "Invalid API key" });
  }
  next();
};

router.post('/shopee-accounts/update-cookie-live', apiKeyAuth, ApishopeeAccountController.updateCookieLive);
router.post('/shopee-accounts/upload_video_status', apiKeyAuth, ApishopeeAccountController.uploadVideoStatus);
router.get('/shopee-accounts/upload_videos', apiKeyAuth, ApishopeeAccountController.getShopeeAccountsUpload);
router.post('/shopee-accounts/upload_videos', apiKeyAuth, ApishopeeAccountController.postShopeeAccountsUpload);
router.post('/log', apiKeyAuth, ApishopeeAccountController.logApiCall);
// API route to insert Shopee account
router.post('/shopee-accounts', apiKeyAuth, shopeeAccountController.insertShopeeAccount);
router.put('/shopee-accounts/update-is-upload-api', apiKeyAuth, shopeeAccountController.updateIsUploadApiShopeeAccount);

router.get('/shopee-accounts', apiKeyAuth, ApishopeeAccountController.getShopeeAccounts);




// Live session routes
router.post('/live-sessions/start-live', apiKeyAuth, liveSessionController.startLive);
router.get('/live-sessions', apiKeyAuth, liveSessionController.getLiveSessions);
router.use('/api-headers', apiKeyAuth, apiHeaderRouter);
router.use('/products', apiKeyAuth, productRouter);
router.get('/licenses/check', apiKeyAuth, licenseKeyController.checkLicenseKey);
router.use('/x-statsig-ids', apiKeyAuth, xStatsigIdRouter);
router.use('/proxies', apiKeyAuth, proxyRouter);



// Add these routes to your existing api.js file
router.get('/commission/fetch-all', commissionController.fetchAllAccountsCommissionData);
router.get('/commission/stats', commissionController.getCommissionStats);
router.get('/commission/run-collection', commissionController.manualRunCollection);
router.post('/commission/run-collection-by-date', commissionController.manualRunCollectionByDate);

// Live state routes
router.use('/live-sessions', apiKeyAuth, liveSessionsRouter);


router.use('/videos', apiKeyAuth, videoRouter);

module.exports = router;
