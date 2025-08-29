const express = require('express');
const router = express.Router();

// Import all route files
const authRoutes = require('./auth');
const deviceRoutes = require('./devices');
const alertRoutes = require('./alerts');
const commandRoutes = require('./commands');
const locationRoutes = require('./locations');

// Use routes
router.use('/auth', authRoutes);
router.use('/devices', deviceRoutes);
router.use('/alerts', alertRoutes);
router.use('/commands', commandRoutes);
router.use('/locations', locationRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404 handler
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  });
});

module.exports = router;