const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/user.model');

dotenv.config();

async function createOrUpdatesuper_admin() {
  const username = process.env.SUPER_ADMIN_USERNAME || 'admin';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'Matkhau1@';

  await connectDB();

  try {
    let user = await User.findOne({ username });

    if (!user) {
      user = new User({
        username,
        password,
        role: 'super_admin',
        active: true
      });
      await user.save();
      console.log(`Created super_admin user: ${username}`);
    } else {
      user.role = 'super_admin';
      user.active = true;
      user.password = password;
      await user.save();
      console.log(`Updated existing user to super_admin: ${username}`);
    }
  } catch (error) {
    console.error('Failed to create/update super_admin user:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

createOrUpdatesuper_admin();
