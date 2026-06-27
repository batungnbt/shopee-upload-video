const CommissionStats = require('../models/commissionStats.model');
const ShopeeAccount = require('../models/shopeeAccount.model');
const Commission = require('../models/commissionStats.model');
const Team = require('../models/team.model');
const {
  nowDate,
  getMonthInAppTimezone,
  getYearInAppTimezone,
  getDaysInMonthInAppTimezone,
  startOfDayInAppTimezone,
  startOfYesterdayInAppTimezone,
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

function extractCommissionMetrics(commission) {
  const summary = commission.stats || {};
  const rawSummary = commission.raw_data?.summary || {};

  return {
    totalCommission: readNumericStat(
      summary.totalCommission,
      rawSummary.totalCommission,
      summary.total_commission
    ),
    totalItemsSold: readNumericStat(
      summary.totalItemsSold,
      rawSummary.totalItemsSold,
      summary.items_sold
    ),
    totalClicks: readNumericStat(
      summary.totalClicks,
      rawSummary.totalClicks,
      summary.total_clicks
    ),
    totalGMV: readNumericStat(
      summary.totalGMV,
      rawSummary.totalGMV,
      summary.total_sales
    ),
    totalOrders: readNumericStat(
      summary.totalOrders,
      rawSummary.totalOrders,
      summary.total_orders
    )
  };
}

// Get revenue statistics page
exports.getRevenueStatsPage = async (req, res) => {
  try {
    // Get query parameters
    const { month, year, username, team, summary_date } = req.query;

    // Set default month and year to current month if not provided
    const currentDate = nowDate();
    const currentMonth = getMonthInAppTimezone(currentDate);
    const currentYear = getYearInAppTimezone(currentDate);

    const selectedMonth = parseInt(month) || currentMonth;
    const selectedYear = parseInt(year) || currentYear;

    // Calculate days in month
    const daysInMonth = getDaysInMonthInAppTimezone(selectedYear, selectedMonth);

    // Build query for accounts
    const accountQuery = {};

    // Apply team filter based on user role
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      accountQuery.team = req.user.team;
    } else if (team) {
      let _team = await Team.findOne({ name: team });
      if (!_team) {
        req.flash('error', 'Team not found');
        return res.redirect('/revenue-stats');
      }
      accountQuery.team = _team._id;
    }

    if (username) {
      accountQuery.username = { $regex: username, $options: 'i' };
    }

    console.log('Account Query:', accountQuery);

    // Get all accounts matching the query
    const shopeeAccounts = await ShopeeAccount.find(accountQuery)
      .populate('team', 'name')
      .sort({ username: 1 });
    const shopeeAccountIds = shopeeAccounts.map((account) => account._id);

    console.log('Found Accounts:', shopeeAccounts.length);

    // Get commission data for the selected month and year
    const startDate = startOfDayInAppTimezone(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`);
    const endDate = endOfDayInAppTimezone(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`);

    console.log('Date Range:', { startDate, endDate });

    const commissionData = await Commission.find({
      date: { $gte: startDate, $lte: endDate }
    });

    const selectedSummaryDate = summary_date
      ? startOfDayInAppTimezone(summary_date)
      : startOfYesterdayInAppTimezone();
    const selectedSummaryEnd = endOfDayInAppTimezone(selectedSummaryDate);
    const selectedSummaryCommissionData = await Commission.find({
      shopee_account_id: { $in: shopeeAccountIds },
      date: { $gte: selectedSummaryDate, $lte: selectedSummaryEnd }
    });

    console.log('Commission Data Count:', commissionData.length);

    // Process data for display
    const accounts = [];
    const dailyTotals = Array(daysInMonth).fill(0);
    const dailyItemsSoldTotals = Array(daysInMonth).fill(0);
    const dailyClickTotals = Array(daysInMonth).fill(0);
    const dailyGmvTotals = Array(daysInMonth).fill(0);
    let grandTotal = 0;
    let totalItemsSold = 0;
    let totalClicks = 0;
    let totalGMV = 0;
    let totalOrders = 0;

    // Process each account
    shopeeAccounts.forEach(account => {
      const dailyCommissions = Array(daysInMonth).fill(0);
      const dailyItemsSold = Array(daysInMonth).fill(0);
      const dailyClicks = Array(daysInMonth).fill(0);
      const dailyGMV = Array(daysInMonth).fill(0);
      const dailyOrders = Array(daysInMonth).fill(0);
      let accountTotalCommission = 0;
      let accountTotalItemsSold = 0;
      let accountTotalClicks = 0;
      let accountTotalGMV = 0;
      let accountTotalOrders = 0;

      // Find commission data for this account
      commissionData.forEach(commission => {
        if (commission.shopee_account_id &&
          commission.shopee_account_id.toString() === account._id.toString()) {
          const day = getDayOfMonthInAppTimezone(commission.date) - 1;
          const metrics = extractCommissionMetrics(commission);
          const amount = metrics.totalCommission;
          const itemsSold = metrics.totalItemsSold;
          const clicks = metrics.totalClicks;
          const gmv = metrics.totalGMV;
          const orders = metrics.totalOrders;

          dailyCommissions[day] += amount;
          dailyItemsSold[day] += itemsSold;
          dailyClicks[day] += clicks;
          dailyGMV[day] += gmv;
          dailyOrders[day] += orders;

          dailyTotals[day] += amount;
          dailyItemsSoldTotals[day] += itemsSold;
          dailyClickTotals[day] += clicks;
          dailyGmvTotals[day] += gmv;

          accountTotalCommission += amount;
          accountTotalItemsSold += itemsSold;
          accountTotalClicks += clicks;
          accountTotalGMV += gmv;
          accountTotalOrders += orders;

          grandTotal += amount;
          totalItemsSold += itemsSold;
          totalClicks += clicks;
          totalGMV += gmv;
          totalOrders += orders;
        }
      });

      accounts.push({
        id: account._id,
        username: account.username,
        team: account.team ? account.team.name : 'N/A',
        isMcn: account.isMcn || false,
        dailyCommissions,
        dailyItemsSold,
        dailyClicks,
        dailyGMV,
        dailyOrders,
        totalCommission: accountTotalCommission,
        totalItemsSold: accountTotalItemsSold,
        totalClicks: accountTotalClicks,
        totalGMV: accountTotalGMV,
        totalOrders: accountTotalOrders,
        averageEpc: accountTotalClicks > 0 ? accountTotalCommission / accountTotalClicks : 0,
        averageCvr: accountTotalClicks > 0 ? (accountTotalOrders / accountTotalClicks) * 100 : 0
      });
    });

    console.log('Processed Accounts:', accounts.length);

    const selectedDaySummary = selectedSummaryCommissionData.reduce((acc, commission) => {
      const metrics = extractCommissionMetrics(commission);
      acc.totalCommission += metrics.totalCommission;
      acc.totalGMV += metrics.totalGMV;
      acc.totalClicks += metrics.totalClicks;
      acc.totalItemsSold += metrics.totalItemsSold;
      acc.totalOrders += metrics.totalOrders;
      return acc;
    }, {
      dateLabel: formatDateInAppTimezone(selectedSummaryDate, 'DD/MM/YYYY'),
      totalCommission: 0,
      totalGMV: 0,
      totalClicks: 0,
      totalItemsSold: 0,
      totalOrders: 0,
      averageEpc: 0,
      averageCvr: 0
    });
    selectedDaySummary.averageEpc = selectedDaySummary.totalClicks > 0
      ? selectedDaySummary.totalCommission / selectedDaySummary.totalClicks
      : 0;
    selectedDaySummary.averageCvr = selectedDaySummary.totalClicks > 0
      ? (selectedDaySummary.totalOrders / selectedDaySummary.totalClicks) * 100
      : 0;

    // Get all teams for the filter dropdown
    const teams = await Team.find().distinct('name');

    // Render the page with data
    res.render('revenue-stats', {
      title: 'Thống kê doanh thu',
      activePage: 'revenue-stats',
      month: selectedMonth,
      year: selectedYear,
      username: username || '',
      team: team || '',
      summaryDateInput: formatDateInAppTimezone(selectedSummaryDate, 'YYYY-MM-DD'),
      daysInMonth,
      accounts,
      dailyTotals,
      dailyItemsSoldTotals,
      dailyClickTotals,
      dailyGmvTotals,
      grandTotal,
      totalItemsSold,
      totalClicks,
      totalGMV,
      totalOrders,
      averageEpc: totalClicks > 0 ? grandTotal / totalClicks : 0,
      averageCvr: totalClicks > 0 ? (totalOrders / totalClicks) * 100 : 0,
      selectedDaySummary,
      teams,
      showTeamFilter: req.user.role === 'admin'
    });

  } catch (error) {
    console.error('Error fetching revenue stats:', error);
    req.flash('error', 'Không thể tải dữ liệu thống kê doanh thu');
    res.status(500).render('error', {
      message: 'Lỗi khi tải dữ liệu thống kê doanh thu',
      error: { status: 500, stack: process.env.NODE_ENV === 'development' ? error.stack : '' }
    });
  }
};
