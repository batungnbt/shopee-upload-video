const express = require('express');
const router = express.Router();
const CommissionStats = require('../models/commissionStats.model');
const ShopeeAccount = require('../models/shopeeAccount.model');
const {
  nowDate,
  getMonthInAppTimezone,
  getYearInAppTimezone,
  getDaysInMonthInAppTimezone,
  startOfDayInAppTimezone,
  endOfDayInAppTimezone,
  getDayOfMonthInAppTimezone,
  formatDateInAppTimezone
} = require('../utils/datetime');

function readNumericStat(...values) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function extractCommissionAmount(commission) {
  const summary = commission?.stats || {};
  const rawSummary = commission?.raw_data?.summary || {};

  return readNumericStat(
    summary.totalCommission,
    rawSummary.totalCommission,
    summary.total_commission
  );
}

// Dashboard route
router.get('/dashboard', async (req, res, next) => {
  try {
    const currentDate = nowDate();
    const currentMonth = getMonthInAppTimezone(currentDate);
    const currentYear = getYearInAppTimezone(currentDate);
    const daysInMonth = getDaysInMonthInAppTimezone(currentYear, currentMonth);
    const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    const accountQuery = {};
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      accountQuery.team = req.user.team;
    }

    const managedAccounts = await ShopeeAccount.find(accountQuery)
      .populate('team', 'name')
      .sort({ username: 1 });
    const managedAccountIds = managedAccounts.map((account) => account._id);

    const totalVideosUploaded = managedAccounts.reduce((sum, account) => {
      return sum + readNumericStat(account.totalVideosUploaded);
    }, 0);
    const totalDailyVideosUploaded = managedAccounts.reduce((sum, account) => {
      return sum + readNumericStat(account.dalyVideosUploaded);
    }, 0);

    const dailyCommissionSeries = Array(daysInMonth).fill(0);
    let currentMonthCommission = 0;

    if (managedAccountIds.length > 0) {
      const monthStart = startOfDayInAppTimezone(`${monthKey}-01`);
      const monthEnd = endOfDayInAppTimezone(`${monthKey}-${String(daysInMonth).padStart(2, '0')}`);

      const monthlyCommissionData = await CommissionStats.find({
        shopee_account_id: { $in: managedAccountIds },
        date: { $gte: monthStart, $lte: monthEnd }
      }).select('date stats raw_data');

      monthlyCommissionData.forEach((commission) => {
        const dayIndex = getDayOfMonthInAppTimezone(commission.date) - 1;
        if (dayIndex < 0 || dayIndex >= daysInMonth) {
          return;
        }

        const amount = extractCommissionAmount(commission);
        dailyCommissionSeries[dayIndex] += amount;
        currentMonthCommission += amount;
      });
    }

    const maxDailyCommission = dailyCommissionSeries.reduce((max, value) => Math.max(max, value), 0);
    const bestDayIndex = dailyCommissionSeries.reduce((bestIndex, value, index, arr) => {
      if (value > (arr[bestIndex] || 0)) {
        return index;
      }
      return bestIndex;
    }, 0);

    res.render('dashboard', {
      title: 'Dashboard',
      user: req.user,
      activePage: 'dashboard',
      dashboardStats: {
        managedAccounts: managedAccounts.length,
        currentMonthCommission,
        totalVideosUploaded,
        totalDailyVideosUploaded,
        currentMonth,
        currentYear,
        currentMonthLabel: `Tháng ${String(currentMonth).padStart(2, '0')}/${currentYear}`,
        todayLabel: formatDateInAppTimezone(currentDate, 'DD/MM/YYYY'),
        scopeLabel: req.user.role !== 'admin' && req.user.role !== 'super_admin'
          ? (req.user?.team?.name || 'Team của bạn')
          : 'Toàn bộ tài khoản quản lý',
        dailyCommissionSeries,
        maxDailyCommission,
        bestDayLabel: maxDailyCommission > 0
          ? `${String(bestDayIndex + 1).padStart(2, '0')}/${String(currentMonth).padStart(2, '0')}`
          : 'Chưa có dữ liệu'
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
