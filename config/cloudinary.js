const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');

const configureCloudinary = () => {
  if (!process.env.CLOUDINARY_CLOUD_NAME || 
      !process.env.CLOUDINARY_API_KEY || 
      !process.env.CLOUDINARY_API_SECRET) {
    logger.warn('Cloudinary configuration missing. File uploads will be disabled.');
    return null;
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });

  logger.info('Cloudinary configured successfully');
  return cloudinary;
};

// File upload utility
const uploadFile = async (filePath, options = {}) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'watcher',
      resource_type: 'auto',
      ...options
    });
    
    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      bytes: result.bytes
    };
  } catch (error) {
    logger.error('Cloudinary upload error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// File delete utility
const deleteFile = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return {
      success: result.result === 'ok',
      result
    };
  } catch (error) {
    logger.error('Cloudinary delete error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Generate image transformation URL
const generateImageUrl = (publicId, transformations = {}) => {
  return cloudinary.url(publicId, {
    ...transformations,
    secure: true
  });
};

module.exports = {
  configureCloudinary,
  uploadFile,
  deleteFile,
  generateImageUrl,
  cloudinary
};