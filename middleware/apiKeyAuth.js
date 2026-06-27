// API key authentication middleware
const API_KEY = "Baole28372hd";

const apiKeyAuth = (req, res, next) => {
  const apiKey = req.query.apiKey;
  
  if (!apiKey || apiKey !== API_KEY) {
    return res.status(401).json({ message: "Invalid API key" });
  }
  
  next();
};

module.exports = apiKeyAuth;