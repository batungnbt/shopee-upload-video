
const Product = require("../models/product.model");
const productService = require("../services/productService");
const { nowDate } = require('../utils/datetime');

// Create Product
exports.createProduct = async (req, res) => {
  try {
    // kiểm tra đã có sản phẩm với item_id này chưa
    const existingProduct = await Product.findOne({
      item_id: req.body.item_id,
    });
    if (existingProduct) {
      return res.status(400).json({ message: "Product already exists" });
    }
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Import Products from JSON
exports.importProducts = async (req, res) => {
  try {
    // Check if request body contains products array
    if (!req.body.products || !Array.isArray(req.body.products)) {
      return res.status(400).json({
        success: false,
        message: "Request must include a 'products' array"
      });
    }

    const productsData = req.body.products;
    const id_team = req.body.id_team;

    // Track import statistics
    let importCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;
    let errors = [];

    // Process each product
    for (const productData of productsData) {
      try {
        // Check if product already exists
        const existingProduct = await Product.findOne({ item_id: productData.item_id });

        if (existingProduct) {
          
          duplicateCount++;
          continue; // Skip this product
        }

        // Transform the data to match the schema
        const transformedProduct = {
          item_id: productData.item_id,
          shop_id: productData.shop_id,
          name: productData.name,
          rating_star: productData.rating_star,
          shop_rating: productData.shop_rating,
          // Convert price from string to number
          price: productData.price,
          sold: productData.sold,
          liked_count: productData.liked_count,
          // Extract numeric value from commission rates
          default_commission_rate: productData.default_commission_rate,
          seller_commission_rate: productData.seller_commission_rate,
          product_link: productData.product_link,
          // Set a default shopee_category_id
          shopee_category_id: productData.shopee_category_id || '0',
          team: id_team,
          stock: productData.stock,
          images: productData.images || [],
        };

        // Create and save the product
        const product = new Product(transformedProduct);
        await product.save();
        importCount++;
      } catch (productError) {
        errorCount++;
        errors.push({
          item_id: productData.item_id || 'unknown',
          error: productError.message
        });
      }
    }
    console.log('importCount:', importCount);
    console.log('duplicateCount:', duplicateCount);
    console.log('errorCount:', errorCount);
    console.log('total:', productsData.length);
    console.log('errorDetails:', errors.length > 0 ? errors : undefined);
    // Return JSON response with import results
    res.json({
      success: true,
      message: 'Import completed',
      data: {
        imported: importCount,
        duplicates: duplicateCount,
        errors: errorCount,
        total: productsData.length,
        errorDetails: errors.length > 0 ? errors : undefined
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to import products",
      error: err.message
    });
  }
};


// Get All Products
exports.getAllProducts = async (req, res) => {
  try {
    const result = await productService.getAllProducts(req.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get Product by ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("category");
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update Product
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Delete Product
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.addForAdmin = async (req, res) => {
  try {
    const filterQuery = req.query;
    filterQuery.for_admin = false; // chỉ lấy những sản phẩm chưa có for_admin = true
    filterQuery.is_random = true; // chỉ lấy sản phẩm ngẫu nhiên
    filterQuery.shopee_account_id = "unassigned"; // chỉ lấy sản phẩm chưa có shopee_account
    const result = await productService.getAllProducts(filterQuery);
    const limit = req.query.limit ? Number(req.query.limit) : 100;

    if (result.total < limit) {
      return res.status(400).json({
        message: `Sản phẩm tìm thấy chỉ có ${result.total} sản phẩm`,
      });
    }

    // lấy tất cả kết quả này update for_admin = true
    const productIds = result.data.map((item) => item._id);
    await Product.updateMany(
      { _id: { $in: productIds } },
      { for_admin: true }
    );
    // lấy lại danh sách sản phẩm đã update
    const updatedProducts = await Product.find({
      _id: { $in: productIds },
    });
    res.json(updatedProducts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}
exports.getForCheckInfo = async (req, res) => {
  try {
    // Use atomic findOneAndUpdate to prevent race conditions
    // This ensures only one request can get and update the product at a time
    const id_team = req.query.id_team;
    
    // Build dynamic query conditions
    const queryConditions = {
      isChecked: false,
      statusUpVideo: "No_Info"
    };
    
    // Add id_team condition only if provided
    if (id_team) {
      queryConditions.team = id_team;
    }
    
    const product = await Product.findOneAndUpdate(
      queryConditions,
      {
        $set: { 
          statusUpVideo: "Checking",
          updatedAt: nowDate()
        }
      },
      {
        sort: { createdAt: 1 }, // Get oldest first
        new: true, // Return updated document
        runValidators: true
      }
    );

    if (!product) {
      const message = id_team 
        ? `No unchecked products found with No_Info status for team ${id_team}`
        : "No unchecked products found with No_Info status";
      return res.status(404).json({
        success: false,
        message: message
      });
    }

    res.status(200).json({
      success: true,
      data: product,
      message: "Product retrieved and status updated to Checking"
    });

  } catch (error) {
    console.error("Error in getForCheckInfo:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get product for checking info",
      error: error.message
    });
  }
}
exports.getAnalytics = async (req, res) => {
  try {
    // Use atomic findOneAndUpdate to prevent race conditions
    // This ensures only one request can get and update the product at a time
    const id_team = req.query.id_team;
    
    // Build dynamic query conditions
    const queryConditions = {
      isChecked: false,
      statusUpVideo: "No_Info",
      images: { $exists: true, $ne: [] }
    };
    
    // Add id_team condition only if provided
    if (id_team) {
      queryConditions.team = id_team;
    }
    
    const product = await Product.findOneAndUpdate(
      queryConditions,
      {
        $set: { 
          statusUpVideo: "Analytics",
          updatedAt: nowDate()
        }
      },
      {
        sort: { createdAt: 1 }, // Get oldest first
        new: true, // Return updated document
        runValidators: true
      }
    );

    if (!product) {
      const message = id_team 
        ? `No unchecked products found with No_Info status for team ${id_team}`
        : "No unchecked products found with No_Info status";
      return res.status(404).json({
        success: false,
        message: message
      });
    }

    res.status(200).json({
      success: true,
      data: product,
      message: "Product retrieved and status updated to Checking"
    });

  } catch (error) {
    console.error("Error in getForCheckInfo:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get product for checking info",
      error: error.message
    });
  }
}

exports.postAnalytics = async (req, res) => {
  try {
    const { bestImageUrl, bestImageScore, item_id} = req.body;
    
    // Find product by item_id instead of _id
    const product = await Product.findOneAndUpdate(
      { item_id: item_id }, // Find by item_id
      {
        isChecked: true,
        statusUpVideo: "Checked",
        bestImageUrl, 
        bestImageScore,
        updatedAt: nowDate()
      }, 
      {
        new: true, // Return updated document
        runValidators: true
      }
    );
    
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "Product not found with item_id: " + item_id 
      });
    }
    
    res.status(200).json({
      success: true,
      data: product,
      message: "Product info updated successfully"
    });
  } catch (err) {
    console.error("Error updating product info:", err);
    res.status(400).json({ 
      success: false, 
      message: err.message 
    });
  }
}



exports.updateInfoProduct = async (req, res) => {
  try {
    const {item_id_olb, item_id, shop_id, name, rating_star, shop_rating, price, sold, liked_count, default_commission_rate, seller_commission_rate, product_link, bestImageUrl, bestImageScore, commission_rate} = req.body;
    
    // Find product by item_id instead of _id
    const product = await Product.findOneAndUpdate(
      { item_id: item_id_olb }, // Find by item_id
      {
        item_id,
        shop_id,
        name,
        rating_star,
        shop_rating,
        price,
        sold,
        liked_count,
        default_commission_rate,
        seller_commission_rate,
        product_link,
        isChecked: true,
        statusUpVideo: "Checked",
        bestImageUrl, 
        bestImageScore,
        commission_rate,
        updatedAt: nowDate()
      }, 
      {
        new: true, // Return updated document
        runValidators: true
      }
    );
    
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "Product not found with item_id: " + item_id 
      });
    }
    
    res.status(200).json({
      success: true,
      data: product,
      message: "Product info updated successfully"
    });
  } catch (err) {
    console.error("Error updating product info:", err);
    res.status(400).json({ 
      success: false, 
      message: err.message 
    });
  }
}

exports. getForCreateVideo = async (req, res) => {
  try {
    const id_team = req.query.id_team;
    // Build dynamic query conditions
    const queryConditions = {
      isChecked: true,
      statusUpVideo: "Checked"
    };
    
    // Add id_team condition only if provided
    if (id_team) {
      queryConditions.team = id_team;
    }
    
    const product = await Product.findOneAndUpdate(
      queryConditions,
      {
        $set: { 
          statusUpVideo: "Creating",
          updatedAt: nowDate()
        }
      },
      {
        sort: { createdAt: 1 }, // Get oldest first
        new: true, // Return updated document
        runValidators: true
      }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "No checked products found with Checked status"
      });
    }

    res.status(200).json({
      success: true,
      data: product,
      message: "Product retrieved and status updated to Creating"
    });

  } catch (error) {
    console.error("Error in getForCreateVideo:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get product for creating video",
      error: error.message
    });
  }
}

exports.updateCreateVideo = async (req, res) => {
  try {
    const {is_created} = req.body;
    console.log(is_created);
    console.log(req.query.id);
    const product = await Product.findByIdAndUpdate(req.query.id, {
      statusUpVideo: is_created ? "Created" : "Created_Failed",
    }, {
      new: true,
    });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}
exports.getForUploadVideo = async (req, res) => {
  try {
    // Use atomic findOneAndUpdate to prevent race conditions
    // This ensures only one request can get and update the product at a time
    const product = await Product.findOneAndUpdate(
      {
        isChecked: true,
        statusUpVideo: "Created"
      },
      {
        $set: { 
          statusUpVideo: "Uploading",
          updatedAt: nowDate()
        }
      },
      {
        sort: { createdAt: 1 }, // Get oldest first
        new: true, // Return updated document
        runValidators: true
      }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "No checked products found with Created status"
      });
    }

    res.status(200).json({
      success: true,
      data: product,
      message: "Product retrieved and status updated to Uploading"
    });

  } catch (error) {
    console.error("Error in getForUploadVideo:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get product for uploading video",
      error: error.message
    });
  }
}
exports.updateUploadVideo = async (req, res) => {
  try {
    const {is_uploaded, shopee_account_id} = req.body;
    const product = await Product.findByIdAndUpdate(req.params.id, {
      statusUpVideo: is_uploaded ? "Uploaded" : "Uploaded_Failed",
      account_uploaded_video: mongoose.Types.ObjectId(shopee_account_id),
    }, {
      new: true,
    });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

exports.importMultiProducts = async (req, res) => {
  try {
    const { products } = req.body;
    if (!products || products.length === 0) {
      return res.status(400).json({ message: "No products provided" });
    }
    const importedProducts = await Product.insertMany(products);
    res.status(201).json({
      success: true,
      data: importedProducts,
      message: "Products imported successfully"
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}
