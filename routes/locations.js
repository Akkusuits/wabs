const express = require('express');
const router = express.Router();
const {
  reportLocation,
  getLocationHistory,
  getCurrentLocation,
  getLocationStats,
  deleteLocationHistory
} = require('../controllers/locationController');
const { auth } = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');

// Public route (called by child devices)
router.post('/report', reportLocation);

// Protected routes
router.use(auth);
router.use(requireRole(['parent']));

router.get('/device/:deviceId/history', getLocationHistory);
router.get('/device/:deviceId/current', getCurrentLocation);
router.get('/device/:deviceId/stats', getLocationStats);
router.delete('/device/:deviceId/history', deleteLocationHistory);

module.exports = router;