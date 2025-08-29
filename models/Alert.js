const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    index: true
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: [
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
    ],
    index: true
  },
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  data: {
    // Flexible data field for different alert types
    packageName: String,
    url: String,
    contact: String,
    duration: Number,
    location: {
      latitude: Number,
      longitude: Number,
      accuracy: Number
    },
    screenshot: String,
    batteryLevel: Number,
    appName: String,
    notificationText: String
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  isResolved: {
    type: Boolean,
    default: false
  },
  resolvedAt: Date,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  acknowledged: {
    type: Boolean,
    default: false
  },
  acknowledgedAt: Date,
  pushSent: {
    type: Boolean,
    default: false
  },
  emailSent: {
    type: Boolean,
    default: false
  },
  smsSent: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Compound indexes
alertSchema.index({ parentId: 1, isRead: 1 });
alertSchema.index({ deviceId: 1, type: 1 });
alertSchema.index({ createdAt: -1 });
alertSchema.index({ parentId: 1, createdAt: -1 });

// Pre-save middleware
alertSchema.pre('save', function(next) {
  if (this.isModified('isResolved') && this.isResolved && !this.resolvedAt) {
    this.resolvedAt = new Date();
  }
  if (this.isModified('acknowledged') && this.acknowledged && !this.acknowledgedAt) {
    this.acknowledgedAt = new Date();
  }
  next();
});

// Static method to get unread count
alertSchema.statics.getUnreadCount = function(parentId) {
  return this.countDocuments({ parentId, isRead: false });
};

// Static method to mark multiple alerts as read
alertSchema.statics.markAsRead = function(alertIds, parentId) {
  return this.updateMany(
    { _id: { $in: alertIds }, parentId },
    { isRead: true }
  );
};

module.exports = mongoose.model('Alert', alertSchema);