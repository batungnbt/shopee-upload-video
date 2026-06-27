const CronApiJob = require('../models/cronApiJob.model');
const CronApiJobLog = require('../models/cronApiJobLog.model');
const cronManagerService = require('../services/cronManager.service');

exports.getCronJobsPage = async (req, res) => {
  try {
    const jobs = await CronApiJob.find().sort({ createdAt: -1 });
    const logs = await CronApiJobLog.find()
      .populate('job', 'name')
      .sort({ createdAt: -1 })
      .limit(200);
    res.render('admin/cron-jobs', {
      title: 'Quản lý Cron API',
      activePage: 'admin-cron-jobs',
      jobs,
      logs
    });
  } catch (error) {
    console.error('Error loading cron jobs page:', error);
    res.status(500).send('Server error');
  }
};

exports.createCronJob = async (req, res) => {
  try {
    const payload = {
      name: req.body.name,
      apiUrl: req.body.apiUrl,
      method: (req.body.method || 'GET').toUpperCase(),
      headers: req.body.headers || '',
      body: req.body.body || '',
      intervalSeconds: Number(req.body.intervalSeconds || 60),
      timeoutMs: Number(req.body.timeoutMs || 15000),
      active: req.body.active === 'on'
    };
    const created = await CronApiJob.create(payload);
    await cronManagerService.upsertJobTimer(created._id);
    res.redirect('/admin/cron-jobs');
  } catch (error) {
    console.error('Error creating cron job:', error);
    res.status(400).send(error.message || 'Create cron job failed');
  }
};

exports.updateCronJob = async (req, res) => {
  try {
    const payload = {
      name: req.body.name,
      apiUrl: req.body.apiUrl,
      method: (req.body.method || 'GET').toUpperCase(),
      headers: req.body.headers || '',
      body: req.body.body || '',
      intervalSeconds: Number(req.body.intervalSeconds || 60),
      timeoutMs: Number(req.body.timeoutMs || 15000),
      active: req.body.active === 'on'
    };
    await CronApiJob.findByIdAndUpdate(req.params.id, payload, { new: true });
    await cronManagerService.upsertJobTimer(req.params.id);
    res.redirect('/admin/cron-jobs');
  } catch (error) {
    console.error('Error updating cron job:', error);
    res.status(400).send(error.message || 'Update cron job failed');
  }
};

exports.toggleCronJob = async (req, res) => {
  try {
    const job = await CronApiJob.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }
    job.active = !job.active;
    await job.save();
    await cronManagerService.upsertJobTimer(job._id);
    res.json({ success: true, active: job.active });
  } catch (error) {
    console.error('Error toggling cron job:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.runCronJobNow = async (req, res) => {
  try {
    const result = await cronManagerService.runJobById(req.params.id, true);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error running cron job now:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteCronJob = async (req, res) => {
  try {
    await CronApiJobLog.deleteMany({ job: req.params.id });
    await CronApiJob.findByIdAndDelete(req.params.id);
    cronManagerService.stopJob(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting cron job:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCronLogs = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 100), 500);
    const logs = await CronApiJobLog.find()
      .populate('job', 'name')
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Error loading cron logs:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
