const dotenv = require('dotenv');
dotenv.config();

module.exports = (req, res, next) => {
  const clientKey =
    req.headers['x-api-key'] || req.query.apiKey || req.body.apiKey;

  if (clientKey !== process.env.API_KEY) {
    return res.status(401).json({ message: 'Unauthorized: Invalid API Key' });
  }

  next();
};
