const axios = require('axios');
const CronApiJob = require('../models/cronApiJob.model');
const CronApiJobLog = require('../models/cronApiJobLog.model');
const { nowDate } = require('../utils/datetime');

class CronManagerService {
  constructor() {
    this.timers = new Map();
    this.running = new Set();
  }

  async init() {
    await this.reloadAll();
  }

  async reloadAll() {
    for (const [jobId, timer] of this.timers.entries()) {
      clearInterval(timer);
      this.timers.delete(jobId);
    }
    const jobs = await CronApiJob.find({ active: true });
    for (const job of jobs) {
      this.startJob(job);
    }
  }

  startJob(job) {
    const jobId = String(job._id);
    if (this.timers.has(jobId)) {
      clearInterval(this.timers.get(jobId));
    }
    if (!job.active) {
      return;
    }
    const intervalMs = Math.max(5000, Number(job.intervalSeconds || 60) * 1000);
    const timer = setInterval(() => {
      this.runJobById(jobId);
    }, intervalMs);
    this.timers.set(jobId, timer);
  }

  stopJob(jobId) {
    const key = String(jobId);
    if (this.timers.has(key)) {
      clearInterval(this.timers.get(key));
      this.timers.delete(key);
    }
  }

  async upsertJobTimer(jobId) {
    const job = await CronApiJob.findById(jobId);
    if (!job) {
      this.stopJob(jobId);
      return;
    }
    if (!job.active) {
      this.stopJob(jobId);
      return;
    }
    this.startJob(job);
  }

  async runJobById(jobId, force = false) {
    const key = String(jobId);
    if (this.running.has(key) && !force) {
      return { skipped: true, reason: 'already_running' };
    }
    const job = await CronApiJob.findById(key);
    if (!job) {
      this.stopJob(key);
      return { skipped: true, reason: 'job_not_found' };
    }
    this.running.add(key);
    job.running = true;
    await job.save();

    const startedAt = nowDate();
    let endedAt = startedAt;
    let durationMs = 0;
    let success = false;
    let httpStatus = 0;
    let responsePreview = '';
    let errorMessage = '';

    try {
      let parsedHeaders = {};
      if (job.headers && job.headers.trim()) {
        parsedHeaders = JSON.parse(job.headers);
      }
      let parsedBody = undefined;
      if (job.body && job.body.trim()) {
        parsedBody = JSON.parse(job.body);
      }

      const response = await axios({
        method: job.method,
        url: job.apiUrl,
        headers: parsedHeaders,
        data: parsedBody,
        timeout: job.timeoutMs || 15000
      });
      httpStatus = response.status;
      success = response.status >= 200 && response.status < 300;
      responsePreview = typeof response.data === 'string'
        ? response.data.slice(0, 800)
        : JSON.stringify(response.data || {}).slice(0, 800);
    } catch (error) {
      httpStatus = error.response?.status || 0;
      errorMessage = error.message || 'Unknown error';
      if (error.response?.data) {
        const extra = typeof error.response.data === 'string'
          ? error.response.data
          : JSON.stringify(error.response.data);
        responsePreview = extra.slice(0, 800);
      }
    } finally {
      endedAt = nowDate();
      durationMs = endedAt.getTime() - startedAt.getTime();
      await CronApiJobLog.create({
        job: job._id,
        startedAt,
        endedAt,
        durationMs,
        success,
        httpStatus,
        responsePreview,
        error: errorMessage
      });
      job.running = false;
      job.lastRunAt = endedAt;
      job.lastDurationMs = durationMs;
      job.lastHttpStatus = httpStatus;
      job.lastStatus = success ? 'success' : 'failed';
      job.lastError = success ? '' : errorMessage;
      await job.save();
      this.running.delete(key);
    }

    return { success, httpStatus };
  }
}

module.exports = new CronManagerService();
