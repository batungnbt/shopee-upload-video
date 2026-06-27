const ApiHeader = require("../models/apiHeader.model");
const shopeeAccountModel = require("../models/shopeeAccount.model");
const axios = require("axios");

// Create Category
exports.createApiHeader = async (req, res) => {
  try {
    const { content, user_id, shop_id, username, team } = req.body;
    let shopeeAccount = await shopeeAccountModel.findOne({
      username: username,
    });

    if (!shopeeAccount) {
      // chưa có thì tạo mới
      shopeeAccount = new shopeeAccountModel({
        username: username,
        shop_id: shop_id,
        product_setting: null,
        team: team || null,
      });
      await shopeeAccount.save();
    } else if (team) {
      // Update team if provided and account exists
      shopeeAccount.team = team;
      await shopeeAccount.save();
    }

    if (!shopeeAccount?.email || !shopeeAccount?.phone) {
      try {
        let headerObj;
        try {
          headerObj = JSON.parse(content);
        } catch (err) {
          console.log(err);
          return res.status(400).json({ message: "Invalid content" });
        }
        const accountInfoRes = await axios.get(
          "https://mall.shopee.vn/api/v4/account/basic/get_account_info",
          {
            headers: headerObj,
          }
        );
        const accountInfo = accountInfoRes.data.data;
      
        shopeeAccount.email = accountInfo.email;
        shopeeAccount.phone = accountInfo.phone;
        shopeeAccount.shop_id = accountInfo.shopid;
        await shopeeAccount.save();
      } catch (err) {
        console.log(err);
        return res.status(400).json({ message: "Cannot get account info" });
      }
    }

    // kiểm tra nếu shopeeAccount chưa có api_header thì tạo mới
    if (!shopeeAccount.api_header) {
      const newApiHeader = {
        content,
        user_id,
        shop_id,
        username,
      };
      shopeeAccount.api_header = newApiHeader;
      await shopeeAccount.save();
      return res.status(201).json(newApiHeader);
    } else {
      const updateApiHeader = {
        content,
        user_id,
        shop_id,
        username,
      };

      shopeeAccount.api_header = updateApiHeader;
      shopeeAccount.shop_id = shop_id;
      await shopeeAccount.save();
      return res.status(201).json(updateApiHeader);
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get Category by ID
exports.getApiHeaderByUsername = async (req, res) => {
  try {
    const shopeeAccount = await shopeeAccountModel
      .findOne({
        username: req.params.username,
      })
      .populate("api_header");
    if (!shopeeAccount)
      return res.status(404).json({ message: "Shopee Account not found" });
    res.json(shopeeAccount.api_header);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update Category
exports.updateApiHeaderByUsername = async (req, res) => {
  try {
    console.log("===> updateApiHeaderByUsername");
    const { content, user_id, shop_id } = req.body;
    const { username } = req.params;
    const shopeeAccount = await shopeeAccountModel.findOne({
      username: username,
    });

    if (!shopeeAccount) {
      return res.status(400).json({ message: "Shopee Account not found" });
    }

    const updateApiHeader = {
      content,
      user_id,
      shop_id,
    };

    shopeeAccount.api_header = updateApiHeader;
    await shopeeAccount.save();
    return res.status(201).json(updateApiHeader);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Delete Api Header
exports.deleteApiHeaderByUsername = async (req, res) => {
  try {
    const { username } = req.params;
    const shopeeAccount = await shopeeAccountModel.findOne({
      username: username,
    });
    if (!shopeeAccount)
      return res.status(404).json({ message: "Shopee Account not found" });
    shopeeAccount.api_header = null;
    await shopeeAccount.save();
    res.json({ message: "Api Header deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
