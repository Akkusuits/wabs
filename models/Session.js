const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  deviceId: {
    type: String,
    index: true
  },
  deviceName: String,
  deviceType: {
    type: String,
    enum: ['mobile', 'tablet', 'desktop', 'unknown'],
    default: 'unknown'
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: String,
  location: {
    country: String,
    city: String,
    region: String,
    latitude: Number,
    longitude: Number
  },
  token: {
    type: String,
    required: true,
    index: true
  },
  refreshToken: {
    type: String,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  logoutReason: {
    type: String,
    enum: ['user', 'timeout', 'security', 'system', 'other']
  },
  metadata: {
    appVersion: String,
    osVersion: String,
    screenResolution: String,
    language: String,
    timezone: String
  }
}, {
  timestamps: true
});

// Indexes
sessionSchema.index({ userId: 1, isActive: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ token: 1, isActive: 1 });

// Virtual for session duration
sessionSchema.virtual('duration').get(function() {
  if (!this.isActive) {
    return this.updatedAt - this.createdAt;
  }
  return Date.now() - this.createdAt;
});

// Method to check if session is expired
sessionSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

// Method to refresh session
sessionSchema.methods.refresh = function(additionalTime = 24 * 60 * 60 * 1000) {
  this.expiresAt = new Date(Date.now() + additionalTime);
  this.lastActivity = new Date();
  return this.save();
};

// Method to logout session
sessionSchema.methods.logout = function(reason = 'user') {
  this.isActive = false;
  this.logoutReason = reason;
  this.expiresAt = new Date();
  return this.save();
};

// Static method to cleanup expired sessions
sessionSchema.statics.cleanupExpiredSessions = function() {
  return this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
};

// Static method to get active sessions for user
sessionSchema.statics.getActiveSessions = function(userId) {
  return this.find({
    userId,
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).sort({ lastActivity: -1 });
};

// Static method to logout all sessions for user
sessionSchema.statics.logoutAllSessions = function(userId, reason = 'security') {
  return this.updateMany(
    {
      userId,
      isActive: true
    },
    {
      isActive: false,
      logoutReason: reason,
      expiresAt: new Date()
    }
  );
};

// Pre-save middleware to update last activity
sessionSchema.pre('save', function(next) {
  if (this.isModified('lastActivity') || this.isNew) {
    this.lastActivity = new Date();
  }
  next();
});

module.exports = mongoose.model('Session', sessionSchema);