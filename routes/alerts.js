const express = require('express');
const router = express.Router();
const {
  getAlerts,
  getAlert,
  createAlert,
  markAsRead,
  markMultipleAsRead,
  resolveAlert,
  acknowledgeAlert,
  deleteAlert,
  getAlertStats
} = require('../controllers/alertController');
const { auth } = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const { validateAlert } = require('../middleware/validation');

// Public route (called by child devices)
router.post('/', validateAlert, createAlert);

// Protected routes
router.use(auth);
router.use(requireRole(['parent']));

router.get('/', getAlerts);
router.get('/stats/overview', getAlertStats);
router.get('/:id', getAlert);
router.put('/:id/read', markAsRead);
router.put('/read-multiple', markMultipleAsRead);
router.put('/:id/resolve', resolveAlert);
router.put('/:id/acknowledge', acknowledgeAlert);
router.delete('/:id', deleteAlert);

module.exports = router;