const mongoose = require('mongoose');
const userController = require('../controllers/user.controller');
const dotenv = require('dotenv');
dotenv.config();
const connectDB = require('../config/db');

// Connect to the database
connectDB();
userController.createAdminUser();