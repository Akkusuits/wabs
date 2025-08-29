const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Different rate limits for different routes
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message
    },
    handler: (req, res, next, options) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        url: req.originalUrl,
        method: req.method
      });
      res.status(options.statusCode).json(options.message);
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

// General API rate limiting
const generalLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per window
  'Too many requests from this IP, please try again later.'
);

// Strict rate limiting for auth endpoints
const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts per window
  'Too many login attempts, please try again later.'
);

// Lenient rate limiting for reports
const reportLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  10, // 10 reports per minute
  'Too many reports, please slow down.'
);

// Device heartbeat rate limiting
const heartbeatLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  2, // 2 heartbeats per minute per device
  'Too many heartbeats, please check your device configuration.'
);

// Command rate limiting
const commandLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  5, // 5 commands per minute
  'Too many commands, please slow down.'
);

module.exports = {
  generalLimiter,
  authLimiter,
  reportLimiter,
  heartbeatLimiter,
  commandLimiter
};