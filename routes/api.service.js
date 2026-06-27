const express = require('express');
const router = express.Router();
const ApiServicesController = require('../controllers/api.services');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { nowDate, parseDateInAppTimezone } = require('../utils/datetime');

const middleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ')
            ? authHeader.slice(7).trim()
            : '';
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'access_token is required'
            });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        if (!decoded || decoded.type !== 'video_upload_access') {
            return res.status(401).json({
                success: false,
                message: 'Invalid access_token type'
            });
        }

        const accessUsername = String(decoded.username || '').trim();
        if (!accessUsername) {
            return res.status(401).json({
                success: false,
                message: 'Invalid access_token payload'
            });
        }

        const user = await User.findOne({ username: accessUsername }).select('username role team active expiredAt');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        const now = nowDate().getTime();
        const expiredAt = parseDateInAppTimezone(user.expiredAt);
        const isExpired = !!(expiredAt && expiredAt.getTime() <= now);
        if (isExpired) {
            if (user.active) {
                user.active = false;
                await user.save();
            }
            return res.status(401).json({
                success: false,
                message: 'Account expired'
            });
        }

        if (!user.active) {
            return res.status(401).json({
                success: false,
                message: 'Account is inactive'
            });
        }

        req.tokenPayload = decoded;
        req.accessUsername = user.username || '';
        req.accessTeam = user.team || '';
        req.accessRole = user.role || '';

        return next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired access_token'
        });
    }
};

router.get('/upload-video/get-accounts', middleware, ApiServicesController.getShopeeAccountsUpload);
router.get('/upload-video/get-account', middleware, ApiServicesController.getShopeeAccountUpload);
router.post('/upload-video/update-status', middleware, ApiServicesController.postShopeeAccountsUpload);

module.exports = router;
