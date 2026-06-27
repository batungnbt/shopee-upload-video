const express = require('express');
const router = express.Router();
const Product = require('../models/product.model');
const Team = require('../models/team.model');
const crypto = require('crypto');
const { getPaginationData } = require('../utils/pagination');

// Helper function to extract shop_id and item_id from Shopee link
function extractProductInfoFromLink(link) {
  try {
    // Shopee link format: SHOPEE_ORIGIN/product-name-i.shop_id.item_id
    const match = link.match(/-i\.(\d+)\.(\d+)/);
    if (match) {
      return {
        shop_id: match[1],
        item_id: match[2]
      };
    }
    
    // Alternative format: SHOPEE_ORIGIN/product-name-i.item_id
    const altMatch = link.match(/-i\.(\d+)$/);
    if (altMatch) {
      return {
        shop_id: 'unknown',
        item_id: altMatch[1]
      };
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// Helper function to generate hash-based item_id
function generateItemIdFromLink(link) {
  return crypto.createHash('md5').update(link).digest('hex').substring(0, 16);
}

// Get all products with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;
    const isPrivilegedUser = req.user && ['admin', 'super_admin'].includes(req.user.role);
    
    // Build filter from query parameters
    const filter = {};
     
    // Role-based filtering: users can only see their team's products
    if (!req.user) {
      // If no user is logged in, don't show any products
      filter._id = { $exists: false }; // This will return empty results
    } else if (!isPrivilegedUser) {
      // Regular users can only see their team's products
      filter.team = req.user.team;
    }
    
    // Text filters
    if (req.query.item_id) {
      filter.item_id = req.query.item_id;
    }
    if (req.query.shop_id) {
      filter.shop_id = req.query.shop_id;
    }
    if (req.query.name) {
      filter.name = { $regex: req.query.name, $options: 'i' };
    }
    
    // Number range filters
    if (req.query.min_price || req.query.max_price) {
      filter.price = {};
      if (req.query.min_price) filter.price.$gte = Number(req.query.min_price);
      if (req.query.max_price) filter.price.$lte = Number(req.query.max_price);
    }
    
    if (req.query.min_sold || req.query.max_sold) {
      filter.sold = {};
      if (req.query.min_sold) filter.sold.$gte = Number(req.query.min_sold);
      if (req.query.max_sold) filter.sold.$lte = Number(req.query.max_sold);
    }
    
    if (req.query.min_rating_star || req.query.max_rating_star) {
      filter.rating_star = {};
      if (req.query.min_rating_star) filter.rating_star.$gte = parseFloat(req.query.min_rating_star);
      if (req.query.max_rating_star) filter.rating_star.$lte = parseFloat(req.query.max_rating_star);
    }
    
    // Boolean filters
    if (req.query.isCreatedVideo !== undefined && req.query.isCreatedVideo !== '') {
      filter.isCreatedVideo = req.query.isCreatedVideo === 'true';
    }
    
    // Status filter
    if (req.query.statusUpVideo) {
      filter.statusUpVideo = req.query.statusUpVideo;
    }
    
    // Team filter - only apply if user is admin or filtering their own team
    if (req.query.team) {
      if (isPrivilegedUser) {
        filter.team = req.query.team;
      } else if (req.user && req.user.team && req.query.team === req.user.team.toString()) {
        filter.team = req.query.team;
      }
      // If user tries to filter a different team, ignore the filter (security)
    }
    
    // Get total count for pagination
    const totalCount = await Product.countDocuments(filter);
    
    // Get pagination data
    const pagination = getPaginationData(page, totalCount, limit);
    
    // Get products with pagination, populate team data
    const products = await Product.find(filter)
      .populate('team', 'name')
      .sort({ sold: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get teams for filter dropdown - filter based on user role
    let teams;
    if (!req.user) {
      // No user logged in - show no teams
      teams = [];
    } else if (isPrivilegedUser) {
      // Admin can see all teams
      teams = await Team.find().sort({ name: 1 });
    } else if (req.user.team) {
      // Regular users can only see their own team
      teams = await Team.find({ _id: req.user.team }).sort({ name: 1 });
    } else {
      // User exists but has no team assigned
      teams = [];
    }
    
    // Handle import messages from query parameters
    let message = null;
    if (req.query.importSuccess) {
      const count = req.query.count || 0;
      const errors = req.query.errors || 0;
      message = {
        type: 'success',
        text: `Successfully imported ${count} products. ${errors > 0 ? `Failed to import ${errors} products.` : ''}`
      };
    } else if (req.query.importError) {
      message = {
        type: 'error',
        text: 'Failed to import products. Please check the server logs.'
      };
    } else if (req.query.handleSuccess) {
      const count = req.query.count || 0;
      const actionText = req.query.handleSuccess === 'checking_to_no_info'
        ? 'Normalized status from Checking to No_Info'
        : req.query.handleSuccess === 'creating_to_checked'
          ? 'Normalized status from Creating to Checked'
          : 'Status normalization completed';
      message = {
        type: 'success',
        text: `${actionText}. Updated ${count} products.`
      };
    } else if (req.query.handleError) {
      message = {
        type: 'error',
        text: req.query.handleError
      };
    } else if (req.query.deleteSuccess) {
      const count = req.query.count || 0;
      message = {
        type: 'success',
        text: `Deleted ${count} selected products.`
      };
    } else if (req.query.deleteError) {
      message = {
        type: 'error',
        text: req.query.deleteError
      };
    }
    
    // Helper function to build query string for pagination links
    const buildQueryString = (pageNum) => {
      const params = new URLSearchParams(req.query);
      params.set('page', pageNum);
      return `/products?${params.toString()}`;
    };
    res.render('products', {
      products,
      teams,
      pagination,
      query: req.query,
      currentPage: page,
      limit,
      totalItems: totalCount,
      activePage: 'products',
      title: 'Products Management',
      message,
      formatPrice: (price) => {
        return (price / 100000).toLocaleString('en-US', { style: 'currency', currency: 'VND' });
      },
      formatPriceDefault: (price) => {
        return (price).toLocaleString('en-US', { style: 'currency', currency: 'VND' });
      },
      buildQueryString
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).send('Server error');
  }
});

router.get('/summary', async (req, res) => {
  try {
    const isPrivilegedUser = req.user && ['admin', 'super_admin'].includes(req.user.role);
    const match = {};

    if (req.query.team && isPrivilegedUser) {
      match.team = req.query.team;
    } else if (!isPrivilegedUser && req.user && req.user.team) {
      match.team = req.user.team;
    }

    const summaryAgg = await Product.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          noInfo: { $sum: { $cond: [{ $eq: ['$statusUpVideo', 'No_Info'] }, 1, 0] } },
          checking: { $sum: { $cond: [{ $eq: ['$statusUpVideo', 'Checking'] }, 1, 0] } },
          checked: { $sum: { $cond: [{ $eq: ['$statusUpVideo', 'Checked'] }, 1, 0] } },
          created: { $sum: { $cond: [{ $eq: ['$statusUpVideo', 'Created'] }, 1, 0] } },
          uploaded: { $sum: { $cond: [{ $eq: ['$statusUpVideo', 'Uploaded'] }, 1, 0] } }
        }
      }
    ]);

    const summary = summaryAgg[0] || {
      total: 0,
      noInfo: 0,
      checking: 0,
      checked: 0,
      created: 0,
      uploaded: 0
    };

    return res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error fetching products summary:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch products summary' });
  }
});

router.post('/handle-status', async (req, res) => {
  try {
    const { action, team } = req.body;
    const isPrivilegedUser = req.user && ['admin', 'super_admin'].includes(req.user.role);
    let statusFilter;
    let nextStatus;

    if (action === 'checking_to_no_info') {
      statusFilter = { $regex: 'Checking', $options: 'i' };
      nextStatus = 'No_Info';
    } else if (action === 'creating_to_checked') {
      statusFilter = { $regex: 'Creating', $options: 'i' };
      nextStatus = 'Checked';
    } else {
      return res.redirect('/products?handleError=Invalid status normalization action');
    }

    const teamFilter = {};
    if (isPrivilegedUser) {
      if (team) {
        teamFilter.team = team;
      }
    } else if (req.user && req.user.team) {
      teamFilter.team = req.user.team;
    }

    const result = await Product.updateMany(
      {
        ...teamFilter,
        statusUpVideo: statusFilter
      },
      {
        $set: { statusUpVideo: nextStatus }
      }
    );

    const params = new URLSearchParams({
      handleSuccess: action,
      count: String(result.modifiedCount || 0)
    });
    if (isPrivilegedUser && team) {
      params.set('team', team);
    }
    return res.redirect(`/products?${params.toString()}`);
  } catch (error) {
    console.error('Error normalizing product statuses:', error);
    return res.redirect('/products?handleError=Failed to normalize status');
  }
});

router.post('/delete-selected', async (req, res) => {
  try {
    const idsRaw = req.body.ids;
    const ids = Array.isArray(idsRaw) ? idsRaw : idsRaw ? [idsRaw] : [];
    const isPrivilegedUser = req.user && ['admin', 'super_admin'].includes(req.user.role);

    if (!ids.length) {
      return res.redirect('/products?deleteError=No products selected');
    }

    const deleteFilter = { _id: { $in: ids } };
    if (!isPrivilegedUser) {
      if (!req.user || !req.user.team) {
        return res.redirect('/products?deleteError=Permission denied');
      }
      deleteFilter.team = req.user.team;
    }

    const result = await Product.deleteMany(deleteFilter);

    return res.redirect(`/products?deleteSuccess=true&count=${result.deletedCount || 0}`);
  } catch (error) {
    console.error('Error deleting selected products:', error);
    return res.redirect('/products?deleteError=Failed to delete selected products');
  }
});

// Import products by links
router.post('/import-links', async (req, res) => {
  try {
    const { productLinks, team } = req.body;
    
    if (!productLinks || !team) {
      return res.status(400).json({
        success: false,
        message: 'Product links and team are required'
      });
    }
    
    // Parse links from textarea (one per line)
    const links = productLinks.split('\n')
      .map(link => link.trim())
      .filter(link => link.length > 0);
    
    if (links.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid product links provided'
      });
    }
    
    const results = {
      total: links.length,
      imported: 0,
      skipped: 0,
      errors: 0,
      details: []
    };
    
    // Process each link
    for (const link of links) {
      try {
        // Generate unique item_id from link hash
        const item_id = generateItemIdFromLink(link);
        
        // Check if product already exists
        const existingProduct = await Product.findOne({ item_id });
        
        if (existingProduct) {
          results.skipped++;
          results.details.push({
            link,
            status: 'skipped',
            reason: 'Product already exists'
          });
          continue;
        }
        
        // Extract shop info from link if possible
        const linkInfo = extractProductInfoFromLink(link);
        const shop_id = linkInfo ? linkInfo.shop_id : 'unknown';
        
        // Create basic product data
        const productData = {
          item_id,
          shop_id,
          name: `Product from link ${item_id.substring(0, 8)}`,
          price: 0,
          sold: 0,
          rating_star: null,
          shop_rating: null,
          liked_count: 0,
          default_commission_rate: null,
          seller_commission_rate: null,
          product_link: link,
          for_admin: true,
          team: team,
          isCreatedVideo: false,
          statusUpVideo: 'No_Info',
          times_used: 0
        };
        
        // Create and save product
        const product = new Product(productData);
        await product.save();
        
        results.imported++;
        results.details.push({
          link,
          status: 'imported',
          item_id
        });
        
      } catch (error) {
        results.errors++;
        results.details.push({
          link,
          status: 'error',
          reason: error.message
        });
        console.error(`Error importing product from link ${link}:`, error);
      }
    }
    
    res.json({
      success: true,
      message: `Imported ${results.imported} products, skipped ${results.skipped}, errors: ${results.errors}`,
      data: results
    });
    
  } catch (error) {
    console.error('Error importing products by links:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import products by links',
      error: error.message
    });
  }
});

// Import products from JSON file
router.post('/import', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Read the JSON file from uploads directory
    const filePath = path.join(__dirname, '../uploads/4cfa8517cf1237f36ef300c95840d1a3');
    const jsonData = fs.readFileSync(filePath, 'utf8');
    const productsData = JSON.parse(jsonData);
    
    // Insert products into database
    let importCount = 0;
    let errorCount = 0;
    
    for (const productData of productsData) {
      try {
        // Check if product already exists
        const existingProduct = await Product.findOne({ item_id: productData.item_id });
        
        if (!existingProduct) {
          // Transform the data to match the schema
          const transformedProduct = {
            item_id: productData.item_id,
            shop_id: productData.shop_id,
            name: productData.name,
            rating_star: productData.rating_star,
            shop_rating: productData.shop_rating,
            // Convert price from string to number
            price: parseInt(productData.price),
            sold: productData.sold,
            liked_count: productData.liked_count,
            // Extract numeric value from commission rates
            default_commission_rate: parseFloat(productData.default_commission_rate.replace('%', '')),
            seller_commission_rate: parseFloat(productData.seller_commission_rate.replace('%', '')),
            product_link: productData.product_link,
            // Set a default shopee_category_id
            shopee_category_id: '0',
            for_admin: true
          };
          
          await Product.create(transformedProduct);
          importCount++;
        }
      } catch (productError) {
        console.error(`Error importing product:`, productError);
        errorCount++;
      }
    }
    
    // Redirect with query parameters instead of using flash
    res.redirect(`/products?importSuccess=true&count=${importCount}&errors=${errorCount}`);
  } catch (error) {
    console.error('Error importing products:', error);
    // Redirect with error query parameter
    res.redirect('/products?importError=true');
  }
});

module.exports = router;
