const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Auth validation rules
const validateRegister = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('role')
    .isIn(['parent', 'child'])
    .withMessage('Role must be either parent or child'),
  handleValidationErrors
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

// Device validation rules
const validateDeviceLink = [
  body('deviceId')
    .notEmpty()
    .withMessage('Device ID is required')
    .isLength({ min: 5, max: 100 })
    .withMessage('Device ID must be between 5 and 100 characters'),
  body('childEmail')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid child email'),
  handleValidationErrors
];

const validateHeartbeat = [
  body('deviceId')
    .notEmpty()
    .withMessage('Device ID is required'),
  body('batteryLevel')
    .isInt({ min: 0, max: 100 })
    .withMessage('Battery level must be between 0 and 100'),
  handleValidationErrors
];

// Alert validation rules
const validateAlert = [
  body('deviceId')
    .notEmpty()
    .withMessage('Device ID is required'),
  body('type')
    .isIn([
      'tamper_attempt',
      'uninstall_attempt',
      'settings_access',
      'device_offline',
      'low_battery',
      'geofence_breach',
      'app_usage',
      'notification',
      'call',
      'sms',
      'website_visit',
      'screenshot'
    ])
    .withMessage('Invalid alert type'),
  body('message')
    .notEmpty()
    .withMessage('Alert message is required')
    .isLength({ max: 500 })
    .withMessage('Message must be less than 500 characters'),
  body('severity')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid severity level'),
  handleValidationErrors
];

// Command validation rules
const validateCommand = [
  body('deviceId')
    .notEmpty()
    .withMessage('Device ID is required'),
  body('type')
    .isIn([
      'lock_device',
      'unlock_device',
      'show_message',
      'play_sound',
      'vibrate',
      'take_screenshot',
      'get_location',
      'enable_app',
      'disable_app',
      'set_time_limit',
      'update_settings',
      'factory_reset'
    ])
    .withMessage('Invalid command type'),
  body('data')
    .optional()
    .isObject()
    .withMessage('Command data must be an object'),
  handleValidationErrors
];

module.exports = {
  validateRegister,
  validateLogin,
  validateDeviceLink,
  validateHeartbeat,
  validateAlert,
  validateCommand,
  handleValidationErrors
};