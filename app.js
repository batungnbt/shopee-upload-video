const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const ejsLayouts = require("express-ejs-layouts");
const cors = require("cors");
const connectDB = require("./config/db");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const flash = require("connect-flash");
const jwt = require("jsonwebtoken");
const User = require("./models/user.model");
const adminRoutes = require("./routes/admin");
const apiRoutes = require("./routes/api");
const settingsRoutes = require("./routes/settings");
const revenueStatsRoutes = require("./routes/revenueStats");
const http = require("http");
const { initUploadLogSocket } = require("./services/uploadLogSocket.service");
const dns = require("node:dns/promises");
dns.setServers(["1.1.1.1"]);

const app = express();
app.set("trust proxy", 1);
const WEB_PRO = Number(process.env.WEB_PRO ?? 1);
const COUNTRY = String(process.env.COUNTRY || "vn")
  .trim()
  .toLowerCase();
const SHOPEE_ORIGIN = (
  process.env.SHOPEE_ORIGIN || "https://shopee.vn"
).startsWith("http")
  ? process.env.SHOPEE_ORIGIN || "https://shopee.vn"
  : `https://${process.env.SHOPEE_ORIGIN || "shopee.vn"}`;

function getDefaultShopeePage() {
  return WEB_PRO === 0
    ? "/shopee-accounts/upload-video"
    : "/shopee-accounts/video-upload-manager";
}

// Connect to MongoDB
connectDB();

// Set up EJS with layouts
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layouts/main");
app.use(ejsLayouts);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-session-secret",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: { secure: process.env.NODE_ENV === "production" },
  }),
);
app.use(flash());

// Configure CORS for API routes
app.use(
  "/api",
  cors({
    origin: [
      "https://affiliate.shopee.vn",
      SHOPEE_ORIGIN,
      "http://localhost:3000",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

// Add this middleware to make flash messages available to all views
app.use((req, res, next) => {
  const moneyLocale = COUNTRY === "ph" ? "en-PH" : "vi-VN";
  const currencyCode = COUNTRY === "ph" ? "PHP" : "VND";

  const formatMoney = (value) => {
    const amount = Number(value || 0);
    const hasFraction = !Number.isInteger(amount);

    return amount.toLocaleString(moneyLocale, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2,
    });
  };

  const formatNumber = (value, options = {}) => {
    const amount = Number(value || 0);
    return amount.toLocaleString(moneyLocale, options);
  };

  res.locals.error = req.flash("error");
  res.locals.success = req.flash("success");
  res.locals.WEB_PRO = WEB_PRO;
  res.locals.COUNTRY = COUNTRY;
  res.locals.formatMoney = formatMoney;
  res.locals.formatNumber = formatNumber;
  next();
});

// Your auth routes should be defined BEFORE the protectRoute middleware
const authRoutes = require("./routes/auth");
app.use("/", authRoutes);

// Protected routes middleware
const protectRoute = async (req, res, next) => {
  // Public routes that don't need authentication
  if (
    req.path === "/login" ||
    req.path === "/logout" ||
    req.path.startsWith("/api/")
  ) {
    return next();
  }

  try {
    const token = req.cookies.token;
    // Remove this console log to avoid flooding the console
    // console.log('Token:', token);

    if (!token) {
      // If no token and trying to access protected route, redirect to login
      return res.redirect("/login");
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key",
    );

    const user = await User.findById(decoded.id)
      .populate("team")
      .select("-password");

    if (!user) {
      res.clearCookie("token");
      return res.redirect("/login");
    }

    req.user = user;

    // Add user info to res.locals so it's available in all views
    res.locals.user = user;
    res.locals.isAdmin = user.role === "admin";
    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.clearCookie("token");
    return res.redirect("/login");
  }
};

// Team access middleware - restrict data access based on user's team
const teamAccessMiddleware = (req, res, next) => {
  // Skip for admin users - they can see all data
  if (
    req.user &&
    (req.user.role === "admin" || req.user.role === "super_admin")
  ) {
    return next();
  }

  // For regular users, enforce team restrictions
  if (req.user && req.user.team) {
    // Add team filter to all queries
    req.teamFilter = { team: req.user.team };

    // Make team info available to templates
    res.locals.userTeam = req.user.team;
  }

  next();
};

const apiServicesRoutes = require("./routes/api.service");
app.use("/api-services", apiServicesRoutes);
// API routes (these might not need authentication)
app.use("/api", apiRoutes);
// Apply the protectRoute middleware globally ONLY ONCE
app.use(protectRoute);

// Protected routes
const accountsRoutes = require("./routes/accounts");
const productsRoutes = require("./routes/products");

// Apply team access middleware to routes that need it
app.use("/shopee-accounts", teamAccessMiddleware, accountsRoutes);
app.use("/products", productsRoutes);
app.use("/admin", adminRoutes);
app.use("/settings", settingsRoutes);
app.use("/revenue-stats", teamAccessMiddleware, revenueStatsRoutes);

const indexRoutes = require("./routes/index");
app.use("/", teamAccessMiddleware, indexRoutes);
app.use("/", (req, res) => {
  res.redirect(getDefaultShopeePage());
});

// Start server
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(404).render("error", {
    message: "Page not found",
    error: err,
  });
});
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
initUploadLogSocket(server);
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

if (Number(process.env.IS_AUTO_CHECK_COMMISSION) === 1) {
  // Initialize the commission cron job
  const commissionController = require("./controllers/commissionController");
  commissionController.initCommissionCronJob();
  const cronManagerService = require("./services/cronManager.service");
  cronManagerService.init().catch((error) => {
    console.error("Cron manager init failed:", error.message);
  });
} else {
  console.log("Commission cron job is disabled");
}
