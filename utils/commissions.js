/**
 * Test file for commissionController.js
 */
const fs = require('fs');
const axios = require('axios');

const path = require('path');

const MONEY_DIVISOR = 100000;
const USER_AGENT = 'Android app Shopee appver=29627 app_type=1 Cronet/102.0.5005.61';
const SHOPEE_ORIGIN_HOST = (process.env.SHOPEE_ORIGIN || 'shopee.vn')
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
const AFFILIATE_SHOPEE_ORIGIN = `https://affiliate.${SHOPEE_ORIGIN_HOST}`;

function toNumber(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
}
function moneyFromApi(value) {
    return toNumber(value) / MONEY_DIVISOR;
}

function summarizeReport(reportResponse) {
    const checkouts = reportResponse?.data?.list || [];
    const clickIds = new Set();
    const checkoutStatusCount = {};
    const orderStatusCount = {};

    let totalOrders = 0;
    let totalItemsSold = 0;
    let totalGMV = 0;
    let totalCommission = 0;
    let xtraCommission = 0;
    let shopeeCommission = 0;

    for (const checkout of checkouts) {
        if (checkout.click_id) {
            clickIds.add(checkout.click_id);
        }

        checkoutStatusCount[checkout.checkout_status] = (checkoutStatusCount[checkout.checkout_status] || 0) + 1;
        totalCommission += moneyFromApi(checkout.estimated_total_commission_with_mcn || checkout.estimated_total_commission);
        xtraCommission += moneyFromApi(checkout.total_brand_commission);
        shopeeCommission += moneyFromApi(checkout.gross_commission || checkout.capped_commission);

        for (const order of checkout.orders || []) {
            totalOrders += 1;
            orderStatusCount[order.order_status] = (orderStatusCount[order.order_status] || 0) + 1;

            for (const item of order.items || []) {
                totalItemsSold += toNumber(item.qty);
                totalGMV += moneyFromApi(item.actual_amount);
            }
        }
    }

    return {
        totalCheckouts: checkouts.length,
        totalOrders,
        totalItemsSold,
        totalGMV,
        totalCommission,
        xtraCommission,
        shopeeCommission,
        uniqueClickConversions: clickIds.size,
        checkoutStatusCount,
        orderStatusCount
    };
}

function summarizeClicks(clicksResponse) {
    const data = clicksResponse?.data;

    if (!data) {
        return null;
    }

    return {
        totalClicks: toNumber(data.total_count || data.list?.length || 0),
        uniqueClicks: new Set((data.list || []).map((item) => item.click_id).filter(Boolean)).size,
        raw: data
    };
}

function buildSummary(reportSummary, clicksSummary, startTime, endTime) {
    const totalGMV = reportSummary.totalGMV;
    const totalCommission = reportSummary.totalCommission;
    const totalClicks = clicksSummary?.totalClicks ?? 0;
    const totalOrders = reportSummary.totalOrders;
    const totalItemsSold = reportSummary.totalItemsSold;
    const averageEpc = totalClicks > 0 ? totalCommission / totalClicks : 0;
    const averageCvr = totalClicks > 0 ? (totalOrders / totalClicks) * 100 : 0;

    return {
        totalGMV: totalGMV,
        totalCommission: totalCommission,
        xtraCommission: reportSummary.xtraCommission,
        shopeeCommission: reportSummary.shopeeCommission,
        totalClicks,
        averageEpc,
        averageCvr,
        totalCheckouts: reportSummary.totalCheckouts,
        totalOrders,
        totalItemsSold,
        totalClicks,
        uniqueClicks: clicksSummary?.uniqueClicks ?? 0,
        uniqueClickConversions: reportSummary.uniqueClickConversions
    };
}

async function CrawlCommission(cookie, startTime, endTime) {
    try {
        const reportUrl = `${AFFILIATE_SHOPEE_ORIGIN}/api/v3/report/list?page_size=500&page_num=1&purchase_time_s=${startTime}&purchase_time_e=${endTime}&version=1`;
        const clicksUrl = `https://affiliate.shopee.vn/api/v1/click_report/list?click_time_s=${startTime}&click_time_e=${endTime}&page_num=1&page_size=500`;
        const headers = {
            Cookie: cookie,
            'user-agent': USER_AGENT
        };

        let reportResponse = null;
        let clicksResponse = null;

        try {
            const [reportRes, clicksRes] = await Promise.all([
                axios.get(reportUrl, { headers }),
                axios.get(clicksUrl, { headers })
            ]);
            reportResponse = reportRes.data;
            clicksResponse = clicksRes.data;
        } catch (error) {

        }

        const reportSummary = summarizeReport(reportResponse);
        const clicksSummary = summarizeClicks(clicksResponse);
        return buildSummary(reportSummary, clicksSummary, startTime, endTime);
    } catch (error) {
        console.error('Error crawling commission:', error);
        return null;
    }

}
module.exports = {
    CrawlCommission
}
