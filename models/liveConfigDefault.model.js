const mongoose = require('mongoose');

const liveConfigDefaultSchema = new mongoose.Schema({
    min_sold: {
        type: Number,
        default: 100
    },
    min_default_commission_rate: {
        type: Number,
        default: 4
    },
    min_rating_star: {
        type: Number,
        default: 3 
    },
    min_shop_rating: {
        type: Number,
        default: 3 
    },
    min_price: {
        type: Number,
        default: 10
    },
    max_price: {
        type: Number,
        default: 1000
    },
    min_liked_count: {
        type: Number,
        default: 100
    },
})

module.exports = mongoose.model('LiveConfigDefault', liveConfigDefaultSchema);