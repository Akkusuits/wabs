const crypto = require('crypto');

// Generate random string
const generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Generate device ID
const generateDeviceId = () => {
  return `DEV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
};

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate phone number (basic validation)
const isValidPhone = (phone) => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
};

// Format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Sanitize input
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// Delay function
const delay = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Retry function with exponential backoff
const retryWithBackoff = async (fn, retries = 3, delayMs = 1000) => {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    
    await delay(delayMs);
    return retryWithBackoff(fn, retries - 1, delayMs * 2);
  }
};

// Parse JSON safely
const safeJsonParse = (str, defaultValue = null) => {
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
};

// Deep clone object
const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

// Generate pagination metadata
const generatePagination = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;
  
  return {
    page: parseInt(page),
    limit: parseInt(limit),
    total,
    totalPages,
    hasNext,
    hasPrev,
    nextPage: hasNext ? page + 1 : null,
    prevPage: hasPrev ? page - 1 : null
  };
};

module.exports = {
  generateRandomString,
  generateDeviceId,
  isValidEmail,
  isValidPhone,
  formatFileSize,
  sanitizeInput,
  delay,
  retryWithBackoff,
  safeJsonParse,
  deepClone,
  generatePagination
};