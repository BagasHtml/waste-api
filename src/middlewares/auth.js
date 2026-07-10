import dotenv from 'dotenv';
dotenv.config();

const VALID_API_KEY = process.env.API_KEY;

export const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (!VALID_API_KEY) {
    console.error("⚠️ API_KEY belum dikonfigurasi di .env");
    return res.status(500).json({ 
      status: "error", 
      message: "Server configuration error." 
    });
  }

  if (!apiKey || apiKey !== VALID_API_KEY) {
    return res.status(401).json({
      status: "error",
      message: "Unauthorized. Invalid or missing API Key.",
    });
  }

  next();
};