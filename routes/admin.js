const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const teamController = require('../controllers/team.controller');
const licenseKeyController = require('../controllers/licenseKey.controller');
const cronManagerController = require('../controllers/cronManager.controller');

// User management routes
router.get('/accounts', adminController.getUsers);
router.get('/accounts/new', adminController.getUserForm);
router.get('/accounts/:id/edit', adminController.getEditUserForm);
router.post('/accounts', adminController.createUser);
router.put('/accounts/:id', adminController.updateUser);
router.delete('/accounts/:id', adminController.deleteUser);

// Team management routes
router.get('/teams', teamController.getTeams);
router.get('/teams/link-counts', teamController.getTeamLinkCounts);
router.get('/teams/new', teamController.getTeamForm);
router.get('/teams/:id/edit', teamController.getEditTeamForm);
router.post('/teams', teamController.createTeam);
router.put('/teams/:id', teamController.updateTeam);
router.delete('/teams/:id', teamController.deleteTeam);

router.get('/cron-jobs', cronManagerController.getCronJobsPage);
router.post('/cron-jobs', cronManagerController.createCronJob);
router.post('/cron-jobs/:id/update', cronManagerController.updateCronJob);
router.post('/cron-jobs/:id/toggle', cronManagerController.toggleCronJob);
router.post('/cron-jobs/:id/run', cronManagerController.runCronJobNow);
router.delete('/cron-jobs/:id', cronManagerController.deleteCronJob);
router.get('/cron-jobs/logs', cronManagerController.getCronLogs);



// Team access middleware - restrict data access based on user's team
const SuperAccessMiddleware = (req, res, next) => {
  // Skip for admin users - they can see all data
  if (req.user && (req.user.role === 'super_admin')) {
    return next();
  }else {
    return res.status(403).json({ message: 'Super admin access required' });
  }
};


// License key management routes
router.get('/license-keys',SuperAccessMiddleware, licenseKeyController.getLicenseKeys);
router.get('/license-keys/new',SuperAccessMiddleware, licenseKeyController.getLicenseForm);
router.get('/license-keys/:id/edit',SuperAccessMiddleware, licenseKeyController.getLicenseForm);
router.post('/license-keys',SuperAccessMiddleware, licenseKeyController.createLicenseKey);
router.put('/license-keys/:id',SuperAccessMiddleware, licenseKeyController.updateLicenseKey);
router.delete('/license-keys/:id',SuperAccessMiddleware, licenseKeyController.deleteLicenseKey);
module.exports = router;
