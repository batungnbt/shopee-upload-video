const { default: axios } = require("axios");
const shopeeAccountModel = require("../models/shopeeAccount.model");
const CommissionStats = require("../models/commissionStats.model");
const cron = require('node-cron');
const Team = require("../models/team.model");
const fs = require('fs');
const { CrawlCommission } = require('../utils/commissions');
const {
    nowDate,
    parseDateInAppTimezone,
    startOfDayInAppTimezone,
    endOfDayInAppTimezone,
    addHoursInAppTimezone,
    subtractDaysInAppTimezone,
    formatDateInAppTimezone,
    getUnixDayRangeInAppTimezone
} = require('../utils/datetime');

exports.getComissionByUserName = async (req, res) => {
    const { username } = req.params;
    const { start_date, end_date } = req.query;
    console.log(req.query);
    if (!username)
        return res.status(400).json({ message: "Username is required" });

    const shopeeAccount = await shopeeAccountModel.findOne({
        username: username,
    });

    if (!shopeeAccount)
        return res.status(404).json({ message: "Shopee Account not found" });

    const apiHeader = shopeeAccount?.api_header?.content;
    if (!apiHeader)
        return res.status(404).json({ message: "API Header not found" });

    // start_date và end_date là chuỗi định dạng "YYYY-MM-DD"
    const { start_time } = getUnixDayRangeInAppTimezone(start_date);
    const { end_time } = getUnixDayRangeInAppTimezone(end_date);

    const apiHeaderContent = JSON.parse(apiHeader);
    const commissionRes = await axios.get(`https://affiliate.shopee.vn/api/v3/dashboard/detail?start_time=${start_time}&end_time=${end_time}`, {
        headers: apiHeaderContent,
    });

    if (commissionRes.status !== 200) {
        return res.status(404).json({ message: "Commission not found" });
    }

    const commission = commissionRes.data;

    if (!commission) return res.status(404).json({ message: "Commission not found" });

    res.json(commission);
};
// Function to fetch and store commission data for a single account
async function fetchAndStoreCommissionData(shopeeAccount, date) {
    try {
        if (!shopeeAccount.cookie_live) {
            console.log(`Cookie Live not found for account: ${shopeeAccount.username}`);
            return null;
        }

        // Set the date to the beginning of the day
        const startDate = startOfDayInAppTimezone(date);
        const endDate = endOfDayInAppTimezone(date);
        const { start_time, end_time } = getUnixDayRangeInAppTimezone(date);
        console.log({ start_time, end_time })
        const summary = await CrawlCommission(shopeeAccount.cookie_live, start_time, end_time);
        if (!summary) {
            return null;
        }
        const commissionStats = await CommissionStats.findOneAndUpdate(
            {
                username: shopeeAccount.username,
                date: startDate
            },
            {
                shopee_account_id: shopeeAccount._id,
                stats: summary,
                raw_data: {
                    summary
                },
                created_at: nowDate(),
                is_mcn_data: shopeeAccount.isMcn || false
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        );
        return commissionStats;
    } catch (error) {
        console.error(`Error fetching commission for ${shopeeAccount.username}:`, error.message);
        return null;
    }
}

// Function to fetch and store commission data for all accounts
exports.fetchAllAccountsCommissionData = async (req, res) => {
    try {
        const date = req.query.date ? parseDateInAppTimezone(req.query.date) : nowDate();
        const { team } = req.query;
        let accountQuery = {};
        if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            accountQuery.team = req.user.team;
        } else if (team) {
            let _team = await Team.findOne({ name: team });
            if (!_team) {
                req.flash('error', 'Team not found');
                return res.status(404).json({ message: "Team not found" });
            }
            accountQuery.team = _team._id;
        }
        // Get all accounts with API headers
        const accounts = await shopeeAccountModel.find({
            cookie_live: { $exists: true, $ne: null }
        });

        if (!accounts || accounts.length === 0) {
            return res.status(404).json({ message: "No accounts with API headers found" });
        }

        const results = [];

        // Process each account
        for (const account of accounts) {
            const result = await fetchAndStoreCommissionData(account, date);
            if (result) {
                results.push({
                    username: account.username,
                    date: formatDateInAppTimezone(date),
                    success: true
                });
            } else {
                results.push({
                    username: account.username,
                    date: formatDateInAppTimezone(date),
                    success: false
                });
            }
        }

        return res.json({
            success: true,
            message: `Processed ${results.length} accounts`,
            results: results
        });
    } catch (error) {
        console.error("Error fetching all accounts commission data:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch commission data",
            error: error.message
        });
    }
};

// Get commission stats for all accounts in a date range
exports.getCommissionStats = async (req, res) => {
    try {
        const { start_date, end_date, username } = req.query;

        if (!start_date || !end_date) {
            return res.status(400).json({ message: "Start date and end date are required" });
        }

        const startDate = startOfDayInAppTimezone(start_date);
        const endDate = endOfDayInAppTimezone(end_date);

        const query = {
            date: { $gte: startDate, $lte: endDate }
        };

        // Filter by username if provided
        if (username) {
            query.username = username;
        }

        const stats = await CommissionStats.find(query)
            .sort({ date: 1, username: 1 })
            .populate('shopee_account_id', 'username email team');

        return res.json({
            success: true,
            count: stats.length,
            data: stats
        });
    } catch (error) {
        console.error("Error fetching commission stats:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch commission stats",
            error: error.message
        });
    }
};

// Initialize the cron job to run at midnight every day
exports.initCommissionCronJob = () => {
    cron.schedule('0 16 * * *', async () => {
        console.log('Running daily commission data collection job...');
        const yesterday = subtractDaysInAppTimezone(nowDate(), 1);

        try {
            // Get all accounts with API headers
            const accounts = await shopeeAccountModel.find({
                cookie_live: { $exists: true, $ne: null },
                // username: "ka85qha9qa"
            });

            console.log(`Found ${accounts.length} accounts to process`);

            // Process each account
            for (const account of accounts) {
                await fetchAndStoreCommissionData(account, yesterday);
            }

            console.log('Daily commission data collection completed');
        } catch (error) {
            console.error('Error in daily commission data collection:', error);
        }
    }, {
        timezone: "Asia/Ho_Chi_Minh" // Set to Vietnam timezone
    });
    console.log('Commission cron job initialized');
    // Run immediately to collect data for today and yesterday
    // this.runCommissionCollection();
};

// Function to run commission collection immediately
exports.runCommissionCollection = async () => {
    console.log('Running immediate commission data collection...');

    try {
        // Collect data for today
        const today = nowDate();
        console.log(`Collecting data for today: ${formatDateInAppTimezone(today)}`);

        let query = { cookie_live: { $exists: true, $ne: null } };

        // Get all accounts with API headers
        let accounts = await shopeeAccountModel.find(query);

        console.log(`Found ${accounts.length} accounts to process`);


        let yesterday = subtractDaysInAppTimezone(nowDate(), 1);
        for (const account of accounts) {
            await fetchAndStoreCommissionData(account, yesterday);

        }


        console.log('Immediate commission data collection completed');
    } catch (error) {
        console.error('Error in immediate commission data collection:', error);
    }
};

// Add a route handler to manually trigger data collection
exports.manualRunCollection = async (req, res) => {
    try {
        // Start the collection process in the background
        this.runCommissionCollection();

        return res.json({
            success: true,
            message: "Commission data collection started in the background"
        });
    } catch (error) {
        console.error("Error starting manual collection:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to start commission data collection",
            error: error.message
        });
    }
};


exports.manualRunCollectionByDate = async (req, res) => {
    try {
        // Start the collection process in the background
        console.log('Running immediate commission data collection...');

        try {
            const date = req.body.date;
            console.log(`Collecting data for date: ${formatDateInAppTimezone(date)}`);

            let query = { cookie_live: { $exists: true, $ne: null } };
            console.log(req.user);
            if (req.user && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
                query.team = req.user.team;
            }

            // Get all accounts with API headers
            let accounts = await shopeeAccountModel.find(query);
            console.log(`Found ${accounts.length} accounts to process`);

            for (const account of accounts) {
                await fetchAndStoreCommissionData(account, date);
            }


            console.log('Immediate commission data collection completed');
        } catch (error) {
            console.error('Error in immediate commission data collection:', error);
        }

        return res.json({
            success: true,
            message: "Commission data collection started in the background"
        });
    } catch (error) {
        console.error("Error starting manual collection:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to start commission data collection",
            error: error.message
        });
    }
};
