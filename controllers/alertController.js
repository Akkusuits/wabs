const Alert = require('../models/Alert');
const Device = require('../models/Device');
const logger = require('../utils/logger');
const { sendPushNotification, sendEmailNotification } = require('../utils/notifications');

// @desc    Get all alerts for parent
// @route   GET /api/alerts
// @access  Private
const getAlerts = async (req, res) => {
  try {
    const { page = 1, limit = 50, type, severity, read, deviceId } = req.query;
    
    const filter = { parentId: req.user._id };
    
    // Apply filters
    if (type) filter.type = type;
    if (severity) filter.severity = severity;
    if (read !== undefined) filter.isRead = read === 'true';
    if (deviceId) filter.deviceId = deviceId;

    const alerts = await Alert.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Alert.countDocuments(filter);

    res.json({
      success: true,
      count: alerts.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      alerts
    });
  } catch (error) {
    logger.error('Get alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching alerts'
    });
  }
};

// @desc    Get alert by ID
// @route   GET /api/alerts/:id
// @access  Private
const getAlert = async (req, res) => {
  try {
    const alert = await Alert.findOne({
      _id: req.params.id,
      parentId: req.user._id
    });

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    res.json({
      success: true,
      alert
    });
  } catch (error) {
    logger.error('Get alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching alert'
    });
  }
};

// @desc    Create alert (called by child device)
// @route   POST /api/alerts
// @access  Public (authenticated by device token)
const createAlert = async (req, res) => {
  try {
    const { deviceId, type, message, severity = 'medium', data } = req.body;

    // Find device to get parent ID
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    const alert = await Alert.create({
      deviceId,
      parentId: device.parentId,
      type,
      message,
      severity,
      data
    });

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    io.to(device.parentId.toString()).emit('new-alert', alert);

    // Send notifications based on severity and user preferences
    try {
      await sendAlertNotifications(alert, device.parentId);
    } catch (notificationError) {
      logger.error('Alert notification error:', notificationError);
    }

    logger.info('Alert created', { 
      alertId: alert._id, 
      deviceId, 
      type, 
      severity 
    });

    res.status(201).json({
      success: true,
      message: 'Alert created successfully',
      alert
    });
  } catch (error) {
    logger.error('Create alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating alert'
    });
  }
};

// @desc    Mark alert as read
// @route   PUT /api/alerts/:id/read
// @access  Private
const markAsRead = async (req, res) => {
  try {
    const alert = await Alert.findOneAndUpdate(
      {
        _id: req.params.id,
        parentId: req.user._id
      },
      { isRead: true },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    res.json({
      success: true,
      message: 'Alert marked as read',
      alert
    });
  } catch (error) {
    logger.error('Mark alert as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error marking alert as read'
    });
  }
};

// @desc    Mark multiple alerts as read
// @route   PUT /api/alerts/read-multiple
// @access  Private
const markMultipleAsRead = async (req, res) => {
  try {
    const { alertIds } = req.body;

    if (!alertIds || !Array.isArray(alertIds)) {
      return res.status(400).json({
        success: false,
        message: 'Array of alert IDs is required'
      });
    }

    const result = await Alert.updateMany(
      {
        _id: { $in: alertIds },
        parentId: req.user._id
      },
      { isRead: true }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} alerts marked as read`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    logger.error('Mark multiple alerts as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error marking alerts as read'
    });
  }
};

// @desc    Resolve alert
// @route   PUT /api/alerts/:id/resolve
// @access  Private
const resolveAlert = async (req, res) => {
  try {
    const alert = await Alert.findOneAndUpdate(
      {
        _id: req.params.id,
        parentId: req.user._id
      },
      { 
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: req.user._id
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    res.json({
      success: true,
      message: 'Alert resolved',
      alert
    });
  } catch (error) {
    logger.error('Resolve alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error resolving alert'
    });
  }
};

// @desc    Acknowledge alert
// @route   PUT /api/alerts/:id/acknowledge
// @access  Private
const acknowledgeAlert = async (req, res) => {
  try {
    const alert = await Alert.findOneAndUpdate(
      {
        _id: req.params.id,
        parentId: req.user._id
      },
      { 
        acknowledged: true,
        acknowledgedAt: new Date()
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    res.json({
      success: true,
      message: 'Alert acknowledged',
      alert
    });
  } catch (error) {
    logger.error('Acknowledge alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error acknowledging alert'
    });
  }
};

// @desc    Delete alert
// @route   DELETE /api/alerts/:id
// @access  Private
const deleteAlert = async (req, res) => {
  try {
    const alert = await Alert.findOneAndDelete({
      _id: req.params.id,
      parentId: req.user._id
    });

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    res.json({
      success: true,
      message: 'Alert deleted successfully'
    });
  } catch (error) {
    logger.error('Delete alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting alert'
    });
  }
};

// @desc    Get alert statistics
// @route   GET /api/alerts/stats/overview
// @access  Private
const getAlertStats = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const stats = await Alert.aggregate([
      {
        $match: {
          parentId: req.user._id,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: {
            $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
          },
          bySeverity: {
            $push: {
              severity: '$severity',
              count: 1
            }
          },
          byType: {
            $push: {
              type: '$type',
              count: 1
            }
          }
        }
      },
      {
        $project: {
          total: 1,
          unread: 1,
          bySeverity: {
            $arrayToObject: {
              $map: {
                input: '$bySeverity',
                as: 'item',
                in: {
                  k: '$$item.severity',
                  v: { $sum: '$$item.count' }
                }
              }
            }
          },
          byType: {
            $arrayToObject: {
              $map: {
                input: '$byType',
                as: 'item',
                in: {
                  k: '$$item.type',
                  v: { $sum: '$$item.count' }
                }
              }
            }
          }
        }
      }
    ]);

    const result = stats[0] || {
      total: 0,
      unread: 0,
      bySeverity: {},
      byType: {}
    };

    res.json({
      success: true,
      stats: result
    });
  } catch (error) {
    logger.error('Get alert stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching alert statistics'
    });
  }
};

// Helper function to send alert notifications
const sendAlertNotifications = async (alert, parentId) => {
  try {
    // In a real implementation, you would:
    // 1. Get user notification preferences
    // 2. Send push notifications via FCM/APNS
    // 3. Send email notifications
    // 4. Send SMS notifications
    
    // Example implementation:
    if (alert.severity === 'critical' || alert.severity === 'high') {
      // Send immediate push notification
      await sendPushNotification(parentId, {
        title: `Alert: ${alert.type.replace('_', ' ')}`,
        body: alert.message,
        data: { alertId: alert._id.toString() }
      });

      // Send email for critical alerts
      if (alert.severity === 'critical') {
        await sendEmailNotification(parentId, {
          subject: `CRITICAL ALERT: ${alert.type.replace('_', ' ')}`,
          text: alert.message,
          html: `<h2>Critical Alert</h2><p>${alert.message}</p>`
        });
      }
    }

    // Update alert with notification status
    alert.pushSent = true;
    if (alert.severity === 'critical') {
      alert.emailSent = true;
    }
    await alert.save();

  } catch (error) {
    logger.error('Error sending alert notifications:', error);
  }
};

module.exports = {
  getAlerts,
  getAlert,
  createAlert,
  markAsRead,
  markMultipleAsRead,
  resolveAlert,
  acknowledgeAlert,
  deleteAlert,
  getAlertStats
};