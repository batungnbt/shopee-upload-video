const { default: axios } = require("axios");
const productModel = require("../models/product.model");
const shopeeAccountModel = require("../models/shopeeAccount.model");
const productService = require("../services/productService");
const liveConfigDefaultModel = require("../models/liveConfigDefault.model");
const { generateRandomString } = require("../utils/common");
const apiHeaderModel = require("../models/apiHeader.model");
const { nowDate, addHoursInAppTimezone } = require('../utils/datetime');


exports.startLive = async (req, res) => {
  try {
    const { username } = req.body;

    if (!username)
      return res.status(400).json({ message: "Username is required" });

    const shopeeAccount = await shopeeAccountModel.findOne({
      username: username,
    }).populate("products");

    if (!shopeeAccount)
      return res.status(404).json({ message: "Shopee Account not found" });

    const liveConfig = shopeeAccount.live_config;

    if (
      !liveConfig ||
      !liveConfig.avatar_file_id
    ) {
      return res.status(400).json({ message: "Live config is not set" });
    }

    const liveConfigDefault = await liveConfigDefaultModel.findOne({});

    let productItems = [];
    if(shopeeAccount.isCustomCart){
      productItems = shopeeAccount.products;;
    }else{
      productItems = await productModel.find({
        shopee_account: shopeeAccount._id,
      });
    }

    let itemsForLive = [];

    if (shopeeAccount.live_config.live_mode === "test") {
      const takeProductItems = await productService.getAllProducts({
        min_sold: 100,
        min_default_commission_rate: 1,
        max_default_commission_rate: 1,
        shopee_account_id: "unassigned",
        is_random: true,
        limit: shopeeAccount.live_config.product_quantity,
      });

      if (takeProductItems.data.length === 0) {
        return res.status(404).json({ message: "Product not found" });
      }
      itemsForLive = takeProductItems.data.map((item) => {
        return {
          item_id: parseInt(item.item_id),
          shop_id: parseInt(item.shop_id),
        };
      });
      // cập nhật shopee_account cho product
      await productModel.updateMany(
        { item_id: { $in: itemsForLive.map((item) => item.item_id) } },
        { shopee_account: shopeeAccount._id }
      );
    } else {
      if (productItems.length === 0) {
     
        const takeProductItems = await productService.getAllProducts({
          min_sold: liveConfigDefault.min_sold,
          min_rating_star: liveConfigDefault.min_rating_star,
          min_shop_rating: liveConfigDefault.min_shop_rating,
          max_price: liveConfigDefault.max_price * 100000,
          min_price: liveConfigDefault.min_price * 100000,
          min_default_commission_rate:
          liveConfigDefault.min_default_commission_rate,
          shopee_account_id: "unassigned",
          is_random: true,
          limit: 100
        });

        if (takeProductItems.data.length === 0) {
          return res.status(404).json({ message: "Product not found" });
        }

        itemsForLive = takeProductItems.data.map((item) => {
          return {
            item_id: parseInt(item.item_id),
            shop_id: parseInt(item.shop_id),
          };
        });
        // add items
        // cập nhật shopee_account cho product
        await productModel.updateMany(
          { item_id: { $in: itemsForLive.map((item) => item.item_id) } },
          { shopee_account: shopeeAccount._id }
        );
      } else {
        itemsForLive = productItems.map((item) => {
          return {
            item_id: parseInt(item.item_id),
            shop_id: parseInt(item.shop_id),
          };
        });
      }
    }

    const apiHeader = shopeeAccount?.api_header?.content;
    const apiHeaderParsed = JSON.parse(apiHeader);
    const title_lists = [
      "Cảnh Báo Siêu Sale – Chỉ Trong Thời Gian Giới Hạn!",
      "Flash Sale Trực Tiếp – Giảm Sốc Bên Trong!",
      "Giá Giảm Điên Đảo – Đừng Bỏ Lỡ!",
      "Thêm Vào Giỏ Ngay – Tiết Kiệm Nhiều Hơn!",
      "Ưu Đãi Độc Quyền CHỈ CÓ Trên Livestream!",
      "Mua 1 Tặng 1 – Ưu Đãi Chỉ Khi Live!",
      "Deal Hời & Bất Ngờ – Mua Sắm Live Cực Vui!",
      "Đếm Ngược Deal Khủng – Xem Ngay!",
      "Mở Hộp & Tiết Kiệm – Đại Tiệc Mua Sắm Live!",
      "Tiết Kiệm Lớn Khi Live – Nhanh Tay Kẻo Hết!",
      "Giảm Giá Chớp Nhoáng – Vào Xem Ngay!",
      "Deal Phá Giỏ LIVE – Giá Tốt Nhất Tối Nay!",
      "Giờ Vàng Voucher Bí Mật – Tham Gia Ngay!",
      "Deal ₫1 Gây Sốc – Số Lượng Có Hạn!",
      "Lướt Là Mua – Săn Deal Live Cực Đã!",
      "Đại Hạ Giá Nửa Đêm – Đừng Rời Mắt!",
      "Sản Phẩm Hot – Giá Còn Hot Hơn Khi Live!",
      "Vòng Quay May Mắn – Quà Tặng Chỉ Có Khi Live!",
      "Giờ Flash Turbo – Giá Thấp Không Tưởng!",
      "Giỏ Hàng Bùng Nổ – Thêm Là Trúng!",
      "Hộp Quà Bí Ẩn Live – Giảm Giá Bất Ngờ!",
      "Deal Chỉ 1 Ngày – Chớp Mắt Là Hết!",
      "Bão Deal Sắp Đổ Bộ – Giữ Chỗ Ngay!",
      "Đại Chiến Thêm Giỏ – Ai Nhanh Người Đó Có!",
      "Giá Tan Chảy Tức Thì – Mua Ngay Khi Còn Nóng!",
      "Mưa Voucher – Chỉ Có Trên Livestream!",
      "Mua Sắm & Nhận Quà – Quà Live Độc Quyền!",
      "Đếm Ngược Giá Sập – Những Giây Cuối!",
      "Deal Chim Sớm – Vào Live Trước Lợi Hơn!",
      "Sét Đánh Giỏ Hàng – Chạm, Mua, Xong!",
      "Marathon Giảm Giá Khủng – Xem Live Liên Tục!",
      "Vòng Quay Deal Hot – Quay Là Tiết Kiệm!",
      "Flash Frenzy Thứ Sáu – Phiên Bản Livestream!",
      "Lao Vào Deal – Giá Giảm Trực Tiếp!",
      "Chốt Đơn Ngay – Không Hối Hận!",
      "Đại Tiệc Phá Giỏ – Số Lượng Giới Hạn!",
      "Cơn Lốc Hộp Bí Ẩn – Mở Trực Tiếp!",
      "Cuộc Đua Siêu Tiết Kiệm – 60 Phút Bùng Nổ!",
      "Diễu Hành Giảm Giá – Tham Gia Ngay!",
      "Nhà Vô Địch Thanh Toán – Ai Nhanh Nhất?",
      "Núi Lửa Voucher – BÙNG NỔ NGAY!"
    ];

    

    // Get current date in Vietnam timezone (UTC+7) and subtract 5 hours
    const currentDate = addHoursInAppTimezone(nowDate(), 5);
    const day = currentDate.getDate();
    const month = currentDate.getMonth() + 1; // Months in JavaScript start from 0

    apiHeaderParsed["user-agent"] = "okhttp/3.12.4 app_type=1 platform=native_android os_ver=35 appver=29627 Cronet/102.0.5005.61";
    
    apiHeaderParsed["Cookie"] = apiHeaderParsed["Cookie"].replace("shopee_app_version=36024", "shopee_app_version=29627");

    let title = `${day}/${month} - ${title_lists[Math.floor(Math.random() * title_lists.length)]
      } `;
    const startLiveRes = await axios.get(
      "https://live.shopee.vn/api/v1/session/",
      {
        headers: apiHeaderParsed,
      }
    );
    const startLiveData = startLiveRes.data;
    console.log("startLiveData", startLiveData);
    const startLiveSessionId = startLiveData.data.session.session_id;

    // update data
    const dataUpdate = {
      device_id: Buffer.from(generateRandomString(16)).toString("base64"),
      is_test: false,
      session: startLiveSessionId,
      title: title,
      cover_pic: liveConfig.avatar_file_id,
    };
    console.log("dataUpdate", dataUpdate);
    // Update live session
    const updateLiveInfoRes = await axios.put(
      `https://live.shopee.vn/api/v1/session/${startLiveSessionId}`,
      dataUpdate,
      { headers: apiHeaderParsed }
    );
    console.log("updateLiveInfoRes", updateLiveInfoRes.data);
    // add items
    
    let data_items =  {
        items: itemsForLive.sort((a, b) => {
          if (b.confirmed_orders !== a.confirmed_orders) return b.confirmed_orders - a.confirmed_orders;
          if (b.placed_orders !== a.placed_orders) return b.placed_orders - a.placed_orders;
          return b.clicks - a.clicks;
        })
      }
    apiHeaderModel['Content-Type'] = "application/json";
    apiHeaderModel['content-length'] = JSON.stringify(data_items).length;
   
    const addItemsRes = await axios.put(
      `https://live.shopee.vn/api/v1/session/${startLiveSessionId}/add_items`,
       JSON.stringify(data_items) ,
      {
        headers: apiHeaderParsed,
      }
    );
    console.log("addItemsRes", addItemsRes.data);
    res.json(startLiveRes.data);
  } catch (error) {
    console.error("Error starting live session:", error);
    return res.status(500).json({
      success: false,
      message: "Error starting live session",
      error: error.message
    });
  }
};

exports.getLiveSessions = async (req, res) => {
  return res.json({ message: "Live Session Controller" });
};

exports.updateLiveState = async (req, res) => {
  try {
    const { session_id, state, username } = req.body;

    if (!session_id || !state || !username) {
     
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu các trường bắt buộc: session_id, state, username'
      }); 
    }
    await shopeeAccountModel.findOneAndUpdate(
      { username: username },
      { $set: { state: state ,  session_id: session_id} },
      { new: true }
    );
    return res.json({
      success: true,
      message: 'Cập nhật trạng thái thành công',
      data: { session_id, state, username }
    });

  } catch (error) {
    console.error('Lỗi cập nhật trạng thái:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật trạng thái'
    });
  }
};
