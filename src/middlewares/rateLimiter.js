// src/middlewares/rateLimiter.js
import rateLimit from 'express-rate-limit';

export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,      
  max: 10,                  
  standardHeaders: true,    
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many requests. Please wait before predicting again.",
    retry_after_seconds: 60
  }
});

export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000,    
  max: 30,                   
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many requests. Please slow down."
  }
});

export const statusRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,                  
  standardHeaders: true,
  legacyHeaders: false
});