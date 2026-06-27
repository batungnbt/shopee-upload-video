const ShopeeAccount = require('../models/shopeeAccount.model');
const Product = require('../models/product.model');
const Team = require('../models/team.model');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { formatDateInAppTimezone, nowDate } = require('../utils/datetime');
const SHOPEE_ORIGIN = (process.env.SHOPEE_ORIGIN || 'https://shopee.vn').startsWith('http')
  ? (process.env.SHOPEE_ORIGIN || 'https://shopee.vn')
  : `https://${process.env.SHOPEE_ORIGIN || 'shopee.vn'}`;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../public/uploads/temp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
// API to insert or update Shopee account
exports.insertShopeeAccount = async (req, res) => {
  try {
    const { content, shop_id, user_id, username, team } = req.body;

    // Validate required fields
    if (!username) {
      return res.status(400).json({ 
        success: false, 
        message: "Username is required" 
      });
    }

    // Check if account already exists
    const existingAccount = await ShopeeAccount.findOne({ username });
    
    if (existingAccount) {
      // Update existing account
      if (content) {
        existingAccount.api_header = { content };
      }
      
      if (shop_id) {
        existingAccount.shop_id = shop_id;
      }
      
      if (user_id) {
        existingAccount.user_id = user_id;
      }
      
      if (team) {
        existingAccount.team = team;
      }
      
      await existingAccount.save();
      
      return res.status(200).json({
        success: true,
        message: "Shopee account updated successfully",
        data: existingAccount
      });
    } else {
      // Create new Shopee account
      const newShopeeAccount = new ShopeeAccount({
        username,
        api_header: content ? { content } : undefined,
        shop_id,
        user_id,
        team: team || null,
        status: 'active'
      });

      // Initialize live_config with default values
      newShopeeAccount.live_config = {
        live_mode: 'real',
        shopee_category_ids: [],
        product_quantity: 30
      };

      await newShopeeAccount.save();

      // Return success response
      return res.status(201).json({
        success: true,
        message: "Shopee account created successfully",
        data: newShopeeAccount
      });
    }
  } catch (err) {
    console.error('Error processing Shopee account:', err);
    return res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: err.message 
    });
  }
};
exports.updateIsUploadApiShopeeAccount =  async (req, res) => {
  const { _id, is_upload_api } = req.body;
  const account = await ShopeeAccount.findByIdAndUpdate(_id, { is_upload_api }, { new: true });
  if (!account) {
    return res.status(404).json({ success: false, message: "Shopee account not found" });
  }
  
  if (account.is_upload_api === is_upload_api) {
    return res.status(200).json({ success: true, message: "Shopee account is already updated" });
  }

}
// Get all accounts with team filtering
exports.getAllAccounts = async (req, res) => {
  try {
    // Build query based on user role and team
    const query = {};
    
    // If user is not admin, restrict to their team
    if (req.user && req.user.role !== 'admin' && req.user.team) {
      query.team = req.user.team;
    }
    
    // Apply search filter if provided
    if (req.query.search) {
      query.username = { $regex: req.query.search, $options: 'i' };
    }
    
    // Apply team filter if provided (for admins only)
    if (req.query.team && req.user && req.user.role === 'admin') {
      query.team = req.query.team;
    }
    
    // Get all teams for the dropdown (admin only)
    const teams = req.user && req.user.role === 'admin' 
      ? await Team.find({ active: true }).sort({ name: 1 }) 
      : [];
    
    // Get accounts with team info
    const accounts = await ShopeeAccount.find(query)
      .populate('team', 'name')
      .sort({ createdAt: -1 });
    
    res.render('accounts', {
      title: 'Tài khoản Shopee',
      activePage: 'shopee-accounts',
      accounts,
      teams,
      search: req.query.search || '',
      selectedTeam: req.query.team || '',
      isAdmin: req.user && req.user.role === 'admin'
    });
  } catch (error) {
    console.error('Error fetching shopee accounts:', error);
    req.flash('error', 'Không thể tải danh sách tài khoản Shopee');
    res.status(500).send('Server error');
  }
};
const upload = multer({ storage: storage });
// Get Setup Live Page
exports.getSetupLivePage = async (req, res) => {
  try {
    const accountId = req.params.id;
    const shopeeAccount = await ShopeeAccount.findById(accountId);
    
    if (!shopeeAccount) {
      return res.status(404).send('Shopee account not found');
    }
    
    res.render('shopee-accounts/setup-live', {
      title: 'Setup Live',
      shopeeAccount,
      activePage: 'shopee-accounts'
    });
  } catch (err) {
    console.error('Error loading setup live page:', err);
    res.status(500).send('Server error');
  }
};
// Process Setup Live
exports.processSetupLive = async (req, res) => {
  try {
    const accountId = req.params.id;
    const shopeeAccount = await ShopeeAccount.findById(accountId);
    
    if (!shopeeAccount) {
      return res.status(404).send('Shopee account not found');
    }
    
    // Initialize live_config if it doesn't exist
    if (!shopeeAccount.live_config) {
      shopeeAccount.live_config = {};
    }
    
    // Update live_config with form data
    shopeeAccount.live_config.live_mode = req.body.testMode ? 'test' : 'real';
    
    // Keep existing category IDs if they exist
    if (!shopeeAccount.live_config.shopee_category_ids || 
        shopeeAccount.live_config.shopee_category_ids.length === 0) {
      shopeeAccount.live_config.shopee_category_ids = ["100001"]; // Default to fashion category
    }
    
    shopeeAccount.live_config.product_quantity = parseInt(req.body.product_quantity) || 30;
    
    // Handle file upload if a file was uploaded
    if (req.file) {
      try {
        // Create a permanent directory for avatars if it doesn't exist
        const avatarDir = path.join(__dirname, '../public/uploads/avatars');
        if (!fs.existsSync(avatarDir)) {
          fs.mkdirSync(avatarDir, { recursive: true });
        }
        
        // Generate a unique filename
        const filename = Date.now() + '-' + req.file.originalname;
        const targetPath = path.join(avatarDir, filename);
        
        // Copy file from temp to permanent location
        fs.copyFileSync(req.file.path, targetPath);
        
        // Store the web-accessible path in the database (relative to public folder)
        shopeeAccount.live_config.avatar_path = '/uploads/avatars/' + filename;
        
        // Generate a random file ID if needed for compatibility
        // Upload image to Shopee Live API and get file_id
        const formData = new FormData();
        formData.append('cover_pic', fs.createReadStream(targetPath));
        
        const apiHeader = shopeeAccount?.api_header?.content;
        const apiHeaderParsed = JSON.parse(apiHeader);
        
        const uploadResponse = await axios({
          method: 'post',
          url: 'https://live.shopee.vn/api/v1/image/upload',
          headers: apiHeaderParsed,
          data: formData,
          maxBodyLength: Infinity
        });

        if (uploadResponse.data?.data?.file_id) {
          shopeeAccount.live_config.avatar_file_id = uploadResponse.data.data.file_id;
        } else {
          throw new Error('Failed to get file_id from Shopee API');
        }
        
        // Clean up the temporary file
        fs.unlinkSync(req.file.path);
      } catch (uploadError) {
        console.error('Error processing uploaded image:', uploadError);
        // Continue with saving other settings even if image upload fails
      }
    }
    console.log(shopeeAccount.live_config);
    await shopeeAccount.save();
    
    res.redirect('/shopee-accounts');
  } catch (err) {
    console.error('Error processing setup live:', err);
    res.status(500).send('Server error');
  }
};
// Middleware for handling file uploads
exports.uploadMiddleware = upload.single('avatar');

// Toggle live mode between test and real
exports.toggleLiveMode = async (req, res) => {
  try {
    const { id } = req.params;
    const { newMode } = req.body;
    
    // Validate mode
    if (newMode !== 'test' && newMode !== 'real') {
      return res.status(400).json({ success: false, message: 'Invalid mode. Must be "test" or "real"' });
    }
    
    // Get the account
    const shopeeAccount = await ShopeeAccount.findById(id);
    if (!shopeeAccount) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }
    
    // Update object
    const updateData = {
      'live_config.live_mode': newMode
    };
    
    // If switching from test to real, clear product links
    if (shopeeAccount.live_config && shopeeAccount.live_config.live_mode === 'test' && newMode === 'real') {
      // Clear product links by updating the productModel
      // Set shopee_account to null for all products linked to this account
      const productModel = require('../models/product.model');
      await productModel.updateMany(
        { shopee_account: shopeeAccount._id },
        { $set: { shopee_account: null } }
      );
    }
    
    // Update the account
    const updatedAccount = await ShopeeAccount.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );
    
    return res.json({ 
      success: true, 
      message: `Live mode changed to ${newMode}`,
      account: updatedAccount
    });
  } catch (error) {
    console.error('Error toggling live mode:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};



const productModel = require('../models/product.model');
exports.filterCustomAccountProducts = async (req, res) => {
  try{
    const { username } = req.params;
    let shopeeAccount = await ShopeeAccount.findOne({ username });
    if (!shopeeAccount) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }
  
    const products = await productModel.find({ clicks: { $gt: 0 }, order: { $gt: 0 }}).sort({ order: -1, custom_number: 1 }).limit(100);
    const ids = products.map(p => p._id);
    await productModel.updateMany(
      { _id: { $in: ids } },
      { $inc: { custom_number: 1 } }
    );

    shopeeAccount.products = ids;
    await shopeeAccount.save();

    return res.json({ success: true, products });

  }catch(err){
    console.error('Error filtering custom account products:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}
// Filter and clean up products for a Shopee account
exports.olb_filterAccountProducts = async (req, res) => {
  try {
    const { username } = req.params;
    
    if (!username) {
      return res.status(400).json({ success: false, message: "Username is required" });
    }
    
    // Find the Shopee account
    const shopeeAccount = await ShopeeAccount.findOne({ username });
    
    if (!shopeeAccount) {
      return res.status(404).json({ success: false, message: "Shopee Account not found" });
    }
    
    // Check if API headers exist
    const apiHeaders = shopeeAccount?.api_header?.content;
    if (!apiHeaders) {
      return res.status(400).json({ success: false, message: "API header not found" });
    }
    
    // Get current date for API request
    const formattedDate = formatDateInAppTimezone(nowDate(), 'YYYY-MM-DD');
    
    // Get products data from Shopee API
    const productsRes = await axios.get(
      `https://creator.shopee.vn/supply/api/lm/sellercenter/productsList/v2?page=1&pageSize=100&sort=&orderBy=&timeDim=7d&endDate=${formattedDate}&name=`, 
      {
        headers: JSON.parse(apiHeaders),
      }
    );
    
    if (!productsRes.data || !productsRes.data.data || !productsRes.data.data.list) {
      return res.status(500).json({ success: false, message: "Invalid API response" });
    }
    
    // Get all products linked to this account
    const linkedProducts = await productModel.find({ shopee_account: shopeeAccount._id });
    
    // Create a map of item IDs for quick lookup
    const apiProductsMap = {};
    productsRes.data.data.list.forEach(product => {
      apiProductsMap[product.itemId] = product;
    });
    
    // Track products to unlink
    const productsToUnlink = [];
    
    // Check each linked product against API data
    for (const product of linkedProducts) {
      const apiProduct = apiProductsMap[product.item_id];
      
      // If product exists in API response
      if (apiProduct) {
        // Update product stats from API response
        const updateData = {};
        
        // Update product stats if they exist in API response
        if (apiProduct.clicks !== undefined) updateData.clicks = apiProduct.clicks;
        if (apiProduct.atc !== undefined) updateData.atc = apiProduct.atc;
        if (apiProduct.placedOrders !== undefined) updateData.placed_orders = apiProduct.placedOrders;
        if (apiProduct.placedItemSold !== undefined) updateData.placed_items_sold = apiProduct.placedItemSold;
        if (apiProduct.placedSales !== undefined) updateData.placed_sales = apiProduct.placedSales;
        if (apiProduct.confirmedOrders !== undefined) updateData.confirmed_orders = apiProduct.confirmedOrders;
        if (apiProduct.confirmedItemSold !== undefined) updateData.confirmed_items_sold = apiProduct.confirmedItemSold;
        if (apiProduct.confirmedSales !== undefined) updateData.confirmed_sales = apiProduct.confirmedSales;
        if (apiProduct.coverImage !== undefined) updateData.cover_image = apiProduct.coverImage;
        
        // Check if product meets criteria for unlinking
        if (apiProduct.atc === 0 && apiProduct.clicks === 0) {
          productsToUnlink.push(product.item_id);
        } else {
          // Only update stats if product is not being unlinked
          if (Object.keys(updateData).length > 0) {
            await productModel.updateOne({ item_id: product.item_id }, { $set: updateData });
          }
        }
      }
      // If product doesn't exist in API response, also unlink it
      else {
        productsToUnlink.push(product.item_id);
      }
    }
    
    // Unlink products that meet criteria
    if (productsToUnlink.length > 0) {
      await productModel.updateMany(
        { item_id: { $in: productsToUnlink } },
        { $set: { shopee_account: null } }
      );
    }
    
    // Count remaining linked products after unlinking
    const remainingCount = await productModel.countDocuments({ shopee_account: shopeeAccount._id });
    
    // If we need more products, get them from unassigned products
    let newProductsAdded = 0;
    if (remainingCount < shopeeAccount.live_config.product_quantity) {
      const neededCount = shopeeAccount.live_config.product_quantity - remainingCount;
      
      // Get default live config for product criteria
      const liveConfigDefault = await require('../models/liveConfigDefault.model').findOne({});
      
      // Get unassigned products
      const productService = require('../services/productService');
    //  let  takeProductItems  =   await productModel.find({ isVip : true, sold: {$gt: 1000} }).sort({ custom_number: 1 }).limit(neededCount);
      const takeProductItems = await productService.getAllProducts({
        min_sold: liveConfigDefault?.min_sold || 100,
        min_rating_star: liveConfigDefault.min_rating_star,
        min_shop_rating: liveConfigDefault.min_shop_rating,
        min_liked_count: liveConfigDefault.min_liked_count,
        max_price: liveConfigDefault.max_price * 100000,
        min_price: liveConfigDefault.min_price * 100000,
        min_default_commission_rate: liveConfigDefault?.min_default_commission_rate || 1,
        shopee_account_id: "unassigned",
        is_random: true,
        limit: neededCount
      });
      //takeProductItems = {data: takeProductItems, total: takeProductItems.length}
      //console.log(takeProductItems);
      if (takeProductItems.data && takeProductItems.data.length > 0) {
        // Get item IDs of new products
        const newItemIds = takeProductItems.data.map(item => item.item_id);
        
        // Assign these products to the account
        await productModel.updateMany(
          { item_id: { $in: newItemIds } },
          { $set: { shopee_account: shopeeAccount._id } , $inc: { times_used: 1 }}
        );
        
        newProductsAdded = newItemIds.length;
      }
    }
    
    return res.status(200).json({
      success: true,
      message: "Products filtered successfully",
      stats: {
        initialCount: linkedProducts.length,
        unlinkedCount: productsToUnlink.length,
        remainingCount,
        newProductsAdded,
        finalCount: remainingCount + newProductsAdded
      }
    });
    
  } catch (error) {
    console.error("Error filtering account products:", error);
    return res.status(500).json({
      success: false,
      message: "Error filtering account products",
      error: error.message
    });
  }
};

exports.filterAccountProducts = async (req, res) => {
  try {
    const { username } = req.params;
    
    if (!username) {
      return res.status(400).json({ success: false, message: "Username is required" });
    }
    
    // Tìm tài khoản Shopee
    const shopeeAccount = await ShopeeAccount.findOne({ username });
    
    if (!shopeeAccount) {
      return res.status(404).json({ success: false, message: "Shopee Account not found" });
    }
    
    // Kiểm tra API headers
    const apiHeaders = shopeeAccount?.api_header?.content;
    if (!apiHeaders) {
      return res.status(400).json({ success: false, message: "API header not found" });
    }
    
    // Lấy ngày hiện tại cho API request
    const formattedDate = formatDateInAppTimezone(nowDate(), 'YYYY-MM-DD');
    
    // Lấy dữ liệu sản phẩm từ API Shopee
    const productsRes = await axios.get(
      `https://creator.shopee.vn/supply/api/lm/sellercenter/productsList/v2?page=1&pageSize=100&sort=&orderBy=&timeDim=7d&endDate=${formattedDate}&name=`, 
      {
        headers: JSON.parse(apiHeaders),
      }
    );
    
    if (!productsRes.data || !productsRes.data.data || !productsRes.data.data.list) {
      return res.status(500).json({ success: false, message: "Invalid API response" });
    }
    
    // Lấy danh sách sản phẩm từ API
    const apiProducts = productsRes.data.data.list;
    //console.log(apiProducts);
    // Đếm số lượng sản phẩm đã liên kết với tài khoản này
    const linkedProductsCount = await productModel.countDocuments({ shopee_account: shopeeAccount._id });
    
    // Thống kê
    let updatedCount = 0;
    let newProductsAdded = 0;
    
    // Xử lý từng sản phẩm từ API
    for (const apiProduct of apiProducts) {
      // Kiểm tra sản phẩm đã tồn tại trong DB chưa
      let product = await productModel.findOne({ item_id: apiProduct.itemId });
      
      if (product) {
        // Nếu sản phẩm đã tồn tại, cập nhật thông tin
        const updateData = {};
        
        // Cập nhật thông tin sản phẩm từ API
        if (apiProduct.clicks !== undefined) updateData.clicks = apiProduct.clicks;
        if (apiProduct.atc !== undefined) updateData.atc = apiProduct.atc;
        if (apiProduct.placedOrders !== undefined) updateData.placed_orders = apiProduct.placedOrders;
        if (apiProduct.placedItemSold !== undefined) updateData.placed_items_sold = apiProduct.placedItemSold;
        if (apiProduct.placedSales !== undefined) updateData.placed_sales = apiProduct.placedSales;
        if (apiProduct.confirmedOrders !== undefined) updateData.confirmed_orders = apiProduct.confirmedOrders;
        if (apiProduct.confirmedItemSold !== undefined) updateData.confirmed_items_sold = apiProduct.confirmedItemSold;
        if (apiProduct.confirmedSales !== undefined) updateData.confirmed_sales = apiProduct.confirmedSales;
        if (apiProduct.coverImage !== undefined) updateData.cover_image = apiProduct.coverImage;
        if (apiProduct.title !== undefined) updateData.name = apiProduct.title;
        
        // Liên kết sản phẩm với tài khoản nếu chưa được liên kết
        if (!product.shopee_account || !product.shopee_account.equals(shopeeAccount._id)) {
          updateData.shopee_account = shopeeAccount._id;
        }
        
        // Cập nhật sản phẩm trong DB
        if (Object.keys(updateData).length > 0) {
          await productModel.updateOne({ item_id: apiProduct.itemId }, { $set: updateData });
          updatedCount++;
        }
      } 
    }
    
    // Đếm lại số lượng sản phẩm đã liên kết sau khi cập nhật
    const finalCount = await productModel.countDocuments({ shopee_account: shopeeAccount._id });
    
    return res.status(200).json({
      success: true,
      message: "Products processed successfully",
      stats: {
        initialCount: linkedProductsCount,
        updatedCount: updatedCount,
        newProductsAdded: newProductsAdded,
        finalCount: finalCount
      }
    });
    
  } catch (error) {
    console.error("Error processing account products:", error);
    return res.status(500).json({
      success: false,
      message: "Error processing account products",
      error: error.message
    });
  }
};
exports.getProductsByShopeeAccountId = async (req, res) => {
  try {
    const shopeeAccountId = req.params.id;

    const products = await productModel
      .find({ shopee_account: shopeeAccountId })
      // ưu tiên đã xác nhận đơn → đã đặt đơn → click
      .sort({ confirmed_orders: -1, placed_orders: -1, clicks: -1 });

    res.json({ success: true, products });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};


exports.addProducts = async (req, res) => {
  let { accountId, productLinks } = req.body;
  
  try {
      // Kiểm tra dữ liệu đầu vào
      if (!accountId || !productLinks || !Array.isArray(productLinks)) {
          return res.status(400).json({ 
              success: false, 
              message: 'Dữ liệu không hợp lệ. Cần accountId và mảng productLinks' 
          });
      }

      // Tìm tài khoản Shopee
      const shopeeAccount = await ShopeeAccount.findById(accountId);
      if (!shopeeAccount) {
          return res.status(404).json({ 
              success: false, 
              message: 'Không tìm thấy tài khoản Shopee' 
          });
      }

      // Mảng kết quả để trả về
      const results = {
          success: [],
          failed: [],
          duplicates: []
      };

      // Xử lý từng link sản phẩm
      for (const link of productLinks) {
          try {
              // Lọc link để lấy id_shop và id_item
              // Hỗ trợ nhiều định dạng URL Shopee
              // Ví dụ: SHOPEE_ORIGIN/product/158647903/2403800575
              // hoặc: SHOPEE_ORIGIN/Product-Name-i.158647903.2403800575
              
              let shopId, itemId;
              
              // Kiểm tra định dạng URL /product/{shopId}/{itemId}
              const productMatch = link.match(/\/product\/(\d+)\/(\d+)/);
              if (productMatch) {
                  shopId = productMatch[1];
                  itemId = productMatch[2];
              } else {
                  // Kiểm tra định dạng URL i.{shopId}.{itemId}
                  const iMatch = link.match(/i\.(\d+)\.(\d+)/);
                  if (iMatch) {
                      shopId = iMatch[1];
                      itemId = iMatch[2];
                  } else {
                      // Không tìm thấy định dạng phù hợp
                      results.failed.push({
                          link,
                          reason: 'Không thể trích xuất shopId và itemId từ link'
                      });
                      continue;
                  }
              }

              // Kiểm tra sản phẩm đã tồn tại trong database chưa
              let product = await Product.findOne({ item_id: itemId });
              
              if (!product) {
                  try {
                    // Nếu sản phẩm chưa tồn tại, tạo mới
                    product = new Product({
                        shop_id: shopId,
                        item_id: itemId,
                        name: `Sản phẩm từ ${shopId}/${itemId}`, // Tên tạm thời
                        source_url: link,
                        status: 'active',
                        times_used: 0,
                        shopee_account: shopeeAccount._id,
                        price: 0,
                        sold: 0,
                        rating: 0,
                        rating_star: 0,
                    });
                    
                    await product.save();
                    results.success.push({
                        link,
                        product: {
                            id: product._id,
                            shop_id: shopId,
                            item_id: itemId
                        },
                        action: 'created'
                    });
                  } catch (err) {
                    if (err.code === 11000) {
                         // Nếu sản phẩm đã tồn tại (lỗi duplicate key), cập nhật chủ sở hữu
                        product = await Product.findOne({ item_id: itemId });
                        if (product) {
                            product.shopee_account = shopeeAccount._id;
                            product.shop_id = shopId;
                            await product.save();

                            results.success.push({
                                link,
                                product: {
                                    id: product._id,
                                    shop_id: shopId,
                                    item_id: itemId
                                },
                                action: 'updated_ownership'
                            });
                        }
                    } else {
                        throw err;
                    }
                  }
              } else {
                  // Sản phẩm đã tồn tại -> Cập nhật chủ sở hữu
                  product.shopee_account = shopeeAccount._id;
                  product.shop_id = shopId;
                  await product.save();

                  results.success.push({
                      link,
                      product: {
                          id: product._id,
                          shop_id: shopId,
                          item_id: itemId
                      },
                      action: 'updated_ownership'
                  });
              }
              
             
          } catch (error) {
              console.error(`Lỗi xử lý link ${link}:`, error);
              results.failed.push({
                  link,
                  reason: error.message
              });
          }
      }
      
      // Trả về kết quả
      return res.json({
          success: true,
          message: `Đã xử lý ${productLinks.length} link sản phẩm \n Thêm ${results.success.length} sản phẩm \n Thất bại ${results.failed.length} \n Trùng ${results.duplicates.length} sản phẩm `,
          results
      });
      
  } catch (error) {
      console.error('Lỗi khi thêm sản phẩm:', error);
      return res.status(500).json({
          success: false,
          message: 'Lỗi server khi thêm sản phẩm',
          error: error.message
      });
  }
};

exports.deleteNoInteraction = async (req, res) => {
  try {
      const shopeeAccountId = req.params.id;
      if (!shopeeAccountId) {
          return res.status(400).json({
              success: false,
              message: 'Dữ liệu không hợp lệ. Cần accountId',
              deletedCount: 0,
          });
      }
      // Xóa sản phẩm không có tương tác trong 3 ngày
      // Get products before deleting them
      const productsToDelete = await Product.find({
          shopee_account: shopeeAccountId,
          clicks: 0,
      });

      // Generate Shopee links
      const links = productsToDelete.map(product => 
        `${SHOPEE_ORIGIN}/product/${product.shop_id}/${product.item_id}`
      );
      const ids = productsToDelete.map(product => 
        product.item_id
      );
      // Delete the products
      const deletedProducts = await Product.deleteMany({
          item_id: {$in: ids }
      });
      return res.json({
          success: true,
          message: `Đã xóa ${deletedProducts.deletedCount} sản phẩm không có tương tác trong 7 ngày`,
          deletedCount: deletedProducts.deletedCount,
          links
      })
  }catch (error) {
      console.error('Lỗi khi thêm sản phẩm:', error);
      return res.status(500).json({
          success: false,
          message: 'Lỗi server khi thêm sản phẩm',
          error: error.message,
          deletedCount: 0
      });
  }
}
exports.deleteCartProducts = async (req, res) => {
  try {
    const shopeeAccountId = req.params.id;
    if (!shopeeAccountId) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ. Cần accountId',
        deletedCount: 0,
      });
    }
    
    // Tìm các sản phẩm trong giỏ (có atc > 0)
    const productsToDelete = await Product.find({
      shopee_account: shopeeAccountId
    });

    // Tạo danh sách links sản phẩm
    const links = productsToDelete.map(product => 
      `${SHOPEE_ORIGIN}/product/${product.shop_id}/${product.item_id}`
    );
    
    const ids = productsToDelete.map(product => product.item_id);
    
    // Xóa các sản phẩm
    const deletedProducts = await Product.deleteMany({
      item_id: { $in: ids }
    });
    
    return res.json({
      success: true,
      message: `Đã xóa ${deletedProducts.deletedCount} sản phẩm trong giỏ`,
      deletedCount: deletedProducts.deletedCount,
      links
    });
  } catch (error) {
    console.error('Lỗi khi xóa sản phẩm trong giỏ:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa sản phẩm trong giỏ',
      error: error.message,
      deletedCount: 0
    });
  }
};
