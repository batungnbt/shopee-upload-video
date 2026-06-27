const Product = require("../models/product.model");
const mongoose = require("mongoose");
const shopeeAccountModel = require("../models/shopeeAccount.model");

// Hàm build filter dựa vào query params
async function buildFilter(query) {
  let {
    item_id,
    item_ids,
    shop_id,
    name,
    min_shop_rating,
    max_shop_rating,
    min_price,
    max_price,
    min_sold,
    max_sold,
    min_liked,
    max_liked,
    min_seller_commission_rate,
    max_seller_commission_rate,
    min_default_commission_rate,
    max_default_commission_rate,
    shopee_category_id,
    parent_shopee_category_id,
    shopee_account_id,
    shopee_account_username,
    is_not_assigned = "1",
    for_admin,
  } = query;
  const filter = {};

  if (
    parent_shopee_category_id && parent_shopee_category_id.includes(",") &&
    parent_shopee_category_id.split(",").length > 1
  ) {
    parent_shopee_category_id = parent_shopee_category_id.split(",");
  }

  if (for_admin !== undefined) {
    filter.for_admin = for_admin;
  }

  if (item_id) filter.item_id = item_id;
  if (shop_id) filter.shop_id = shop_id;
  if (name) filter.name = { $regex: name, $options: "i" }; // Tìm gần đúng

  if (item_ids) {
    filter.item_id = { $in: item_ids.split(",") };
  }

  if (min_shop_rating || max_shop_rating) {
    filter.shop_rating = {};
    if (min_shop_rating) filter.shop_rating.$gte = parseFloat(min_shop_rating);
    if (max_shop_rating) filter.shop_rating.$lte = parseFloat(max_shop_rating);
  }

  if (min_price || max_price) {
    filter.price = {};
    if (min_price) filter.price.$gte = Number(min_price);
    if (max_price) filter.price.$lte = Number(max_price);
  }

  if (min_sold || max_sold) {
    filter.sold = {};
    if (min_sold) filter.sold.$gte = Number(min_sold);
    if (max_sold) filter.sold.$lte = Number(max_sold);
  }

  if (min_liked || max_liked) {
    filter.liked_count = {};
    if (min_liked) filter.liked_count.$gte = Number(min_liked);
    if (max_liked) filter.liked_count.$lte = Number(max_liked);
  }

  if (min_seller_commission_rate || max_seller_commission_rate) {
    filter.seller_commission_rate = {};
    if (min_seller_commission_rate) {
      filter.seller_commission_rate.$gte = min_seller_commission_rate;
    }
    if (max_seller_commission_rate) {
      filter.seller_commission_rate.$lte = max_seller_commission_rate;
    }
  }
  if (min_default_commission_rate || max_default_commission_rate) {
    filter.default_commission_rate = {};
    if (min_default_commission_rate) {
      filter.default_commission_rate.$gte = parseFloat(
        min_default_commission_rate
      );
    }
    if (max_default_commission_rate) {
      filter.default_commission_rate.$lte = parseFloat(
        max_default_commission_rate
      );
    }
  }

  if (shopee_account_id) {
    if (shopee_account_id === "assigned") {
      filter.shopee_account = { $ne: null };
    } else if (shopee_account_id === "unassigned") {
      filter.shopee_account = null;
    } else {
      filter.shopee_account = shopee_account_id;
    }
  }

  if (parent_shopee_category_id) {
    const childShopeeCategoryIds = await getChildCategoryIds(
      parent_shopee_category_id
    );

    filter.shopee_category_id = {
      $in: childShopeeCategoryIds,
    };
  }

  // Lọc theo username từ ShopeeAccount
  if (shopee_account_username) {
    const account = await shopeeAccountModel.findOne({
      username: shopee_account_username,
    });
    if (account) {
      filter.shopee_account = account._id;
    } else {
      filter.shopee_account = null; // Không có kết quả nếu username không tồn tại
    }
  }

  return filter;
}

async function getAllProducts(query) {
  const filter = await buildFilter(query);
  console.log("filter", filter);
  const limit = query.limit ? Number(query.limit) : 100; // Mặc định lấy 100 nếu không có limit

  let products;

  if (query?.is_random) {
    // Lấy sản phẩm ngẫu nhiên bằng Aggregation $sample
    products = await Product.aggregate([
      { $match: filter }, // Áp dụng bộ lọc
      { $sort: { times_used: 1 } }, // Sắp xếp theo times_used thấp nhất trước
      { $sample: { size: limit } },
    ]);
  } else {
     // Lấy sản phẩm bình thường với find()
     products = await Product.find(filter)
     .sort({ times_used: 1 }) // Sắp xếp theo times_used thấp nhất trước
     .limit(limit);
  }

  const result = {
    total: products.length,
    data: products,
  };

  if (query?.item_ids) {
    // trả về thêm danh sách id không có trong db
    const itemIds = query.item_ids.split(",");
    const existingItemIds = products.map((product) => product.item_id);
    const notFoundItemIds = itemIds.filter(
      (itemId) => !existingItemIds.includes(itemId)
    );
    result.not_found_item_ids = notFoundItemIds;
  }

  return result;
}


module.exports = {
  getAllProducts,
};
