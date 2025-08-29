const cron = require('node-cron');
const User = require('../models/User');
const Session = require('../models/Session');
const Alert = require('../models/Alert');
const Device = require('../models/Device');
const logger = require('./logger');

// Cleanup expired sessions every hour
cron.schedule('0 * * * *', async () => {
  try {
    const result = await Session.cleanupExpiredSessions();
    logger.info(`Cleaned up ${result.deletedCount} expired sessions`);
  } catch (error) {
    logger.error('Error cleaning up expired sessions:', error);
  }
});

// Cleanup expired tokens daily at midnight
cron.schedule('0 0 * * *', async () => {
  try {
    const result = await User.cleanupExpiredTokens();
    logger.info('Cleaned up expired verification and reset tokens');
  } catch (error) {
    logger.error('Error cleaning up expired tokens:', error);
  }
});

// Check for offline devices every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    const offlineThreshold = 15 * 60 * 1000; // 15 minutes
    const cutoffTime = new Date(Date.now() - offlineThreshold);
    
    const devices = await Device.find({
      isOnline: true,
      lastHeartbeat: { $lt: cutoffTime }
    });
    
    for (const device of devices) {
      device.isOnline = false;
      await device.save();
      
      // Create offline alert
      await Alert.create({
        deviceId: device.deviceId,
        parentId: device.parentId,
        type: 'device_offline',
        message: `Device ${device.deviceName} has been offline for more than 15 minutes`,
        severity: 'medium',
        data: {
          lastHeartbeat: device.lastHeartbeat,
          offlineSince: cutoffTime
        }
      });
      
      logger.info(`Marked device ${device.deviceId} as offline`);
    }
  } catch (error) {
    logger.error('Error checking offline devices:', error);
  }
});

// Reset monthly usage statistics on the first day of the month
cron.schedule('0 0 1 * *', async () => {
  try {
    await User.updateMany(
      {},
      {
        'usage.alertsThisMonth': 0,
        'usage.lastReset': new Date()
      }
    );
    logger.info('Reset monthly usage statistics for all users');
  } catch (error) {
    logger.error('Error resetting monthly usage:', error);
  }
});

// Cleanup old alerts (keep only from last 90 days)
cron.schedule('0 2 * * *', async () => {
  try {
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const result = await Alert.deleteMany({
      createdAt: { $lt: cutoffDate },
      severity: { $in: ['low', 'medium'] } // Keep high/critical alerts longer
    });
    
    logger.info(`Cleaned up ${result.deletedCount} old alerts`);
  } catch (error) {
    logger.error('Error cleaning up old alerts:', error);
  }
});

// Database backup reminder (weekly)
cron.schedule('0 9 * * 1', async () => {
  try {
    const userCount = await User.countDocuments({ isActive: true });
    const deviceCount = await Device.countDocuments({ status: 'active' });
    const alertCount = await Alert.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });
    
    logger.info('Weekly stats:', {
      activeUsers: userCount,
      activeDevices: deviceCount,
      alertsThisWeek: alertCount
    });
  } catch (error) {
    logger.error('Error generating weekly stats:', error);
  }
});

// Check for subscription expirations daily
cron.schedule('0 3 * * *', async () => {
  try {
    const expiringSubscriptions = await User.find({
      'subscription.status': 'active',
      'subscription.currentPeriodEnd': { 
        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Expiring in next 7 days
        $gte: new Date()
      }
    });
    
    for (const user of expiringSubscriptions) {
      // Send renewal reminder (implement email sending)
      logger.info(`Subscription expiring soon for user: ${user.email}`);
    }
  } catch (error) {
    logger.error('Error checking subscription expirations:', error);
  }
});

// System health check every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  try {
    const stats = {
      timestamp: new Date(),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      database: {
        users: await User.countDocuments(),
        activeUsers: await User.countDocuments({ isActive: true }),
        devices: await Device.countDocuments(),
        activeDevices: await Device.countDocuments({ isOnline: true }),
        alerts: await Alert.countDocuments(),
        unreadAlerts: await Alert.countDocuments({ isRead: false })
      }
    };
    
    logger.info('System health check:', stats);
  } catch (error) {
    logger.error('Error during system health check:', error);
  }
});

module.exports = {
  startAllJobs: () => {
    logger.info('All cron jobs started successfully');
  },
  
  stopAllJobs: () => {
    const jobs = cron.getTasks();
    jobs.forEach(job => job.stop());
    logger.info('All cron jobs stopped');
  }
};