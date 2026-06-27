const LiveConfigDefault = require('../models/liveConfigDefault.model');

// Get settings page
exports.getSettingsPage = async (req, res) => {
  try {
    // Get the settings from the database or create default if not exists
    let settings = await LiveConfigDefault.findOne();
    if (!settings) {
      settings = await LiveConfigDefault.create({});
    }
    
    res.render('settings', {
      title: 'System Settings',
      activePage: 'settings',
      settings
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    req.flash('error', 'Failed to load settings');
    res.status(500).send('Server error');
  }
};

// Update settings
exports.updateSettings = async (req, res) => {
  try {
    const { min_sold, min_default_commission_rate, min_rating_star,min_shop_rating, min_price, min_liked_count , max_price } = req.body;
    console.log({ min_sold, min_default_commission_rate, min_rating_star,min_shop_rating, min_price, min_liked_count ,max_price} );
    // Find existing settings or create new
    let settings = await LiveConfigDefault.findOne();
    
    if (settings) {
      // Update existing settings
      settings.min_sold = parseInt(min_sold);
      settings.min_rating_star = parseInt(min_rating_star);
      settings.min_shop_rating = parseInt(min_shop_rating);
      settings.min_price = parseInt(min_price);
      settings.min_liked_count = parseInt(min_liked_count);
      settings.max_price = parseInt(max_price);
      settings.min_default_commission_rate = parseFloat(min_default_commission_rate);
      await settings.save();
    } else {
      // Create new settings
      await LiveConfigDefault.create({
        min_sold: parseInt(min_sold),
        min_default_commission_rate: parseFloat(min_default_commission_rate),
        min_rating_star: parseInt(min_rating_star),
        min_shop_rating: parseInt(min_shop_rating),
        min_price: parseInt(min_price),
        min_liked_count: parseInt(min_liked_count),
        max_price: parseInt(max_price)
      });
    }
    
    req.flash('success', 'Settings updated successfully');
    res.redirect('/settings');
  } catch (error) {
    console.error('Error updating settings:', error);
    req.flash('error', 'Failed to update settings');
    res.redirect('/settings');
  }
};