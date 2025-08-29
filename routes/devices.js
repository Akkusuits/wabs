const express = require('express');
const router = express.Router();
const {
  getDevices,
  getDevice,
  linkDevice,
  updateDeviceSettings,
  receiveHeartbeat,
  toggleDeviceBlock,
  deleteDevice
} = require('../controllers/deviceController');
const { auth } = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const {
  validateDeviceLink,
  validateHeartbeat
} = require('../middleware/validation');

// All device routes require authentication
router.use(auth);
router.use(requireRole(['parent']));

router.get('/', getDevices);
router.get('/:deviceId', getDevice);
router.post('/link', validateDeviceLink, linkDevice);
router.put('/:deviceId/settings', updateDeviceSettings);
router.put('/:deviceId/block', toggleDeviceBlock);
router.delete('/:deviceId', deleteDevice);

// Heartbeat endpoint (called by child device)
router.post('/heartbeat', validateHeartbeat, receiveHeartbeat);

module.exports = router;