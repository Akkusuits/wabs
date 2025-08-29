const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  deviceName: {
    type: String,
    default: "Child Device",
    trim: true,
    maxlength: 100
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  childId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  isOnline: {
    type: Boolean,
    default: false,
    index: true
  },
  lastHeartbeat: {
    type: Date,
    index: true
  },
  batteryLevel: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  isCharging: {
    type: Boolean,
    default: false
  },
  androidVersion: String,
  appVersion: String,
  deviceModel: String,
  networkType: {
    type: String,
    enum: ['wifi', 'cellular', 'unknown'],
    default: 'unknown'
  },
  signalStrength: {
    type: Number,
    min: -1,
    max: 100,
    default: -1
  },
  storageInfo: {
    total: Number,
    free: Number
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  settings: {
    heartbeatInterval: {
      type: Number,
      default: 300,
      min: 60,
      max: 3600
    },
    maxBatteryAlert: {
      type: Number,
      default: 20,
      min: 5,
      max: 50
    },
    enableTamperProtection: {
      type: Boolean,
      default: true
    },
    enableScreenshot: {
      type: Boolean,
      default: false
    },
    enableLocation: {
      type: Boolean,
      default: false
    },
    enableNotificationMonitoring: {
      type: Boolean,
      default: false
    },
    enableCallMonitoring: {
      type: Boolean,
      default: false
    },
    enableSMSMonitoring: {
      type: Boolean,
      default: false
    }
  },
  location: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    timestamp: Date,
    address: String
  },
  usageStats: {
    screenTime: { type: Number, default: 0 },
    dataUsage: { type: Number, default: 0 },
    lastSync: Date
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'deleted'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Compound indexes
deviceSchema.index({ parentId: 1, isOnline: 1 });
deviceSchema.index({ deviceId: 1, status: 1 });
deviceSchema.index({ lastHeartbeat: 1 });

// Virtual for offline status
deviceSchema.virtual('isOffline').get(function() {
  if (!this.lastHeartbeat) return true;
  const offlineThreshold = this.settings.heartbeatInterval * 2 * 1000;
  return Date.now() - this.lastHeartbeat.getTime() > offlineThreshold;
});

// Method to update heartbeat
deviceSchema.methods.updateHeartbeat = function(batteryLevel, isCharging) {
  this.lastHeartbeat = new Date();
  this.isOnline = true;
  this.batteryLevel = batteryLevel;
  this.isCharging = isCharging;
  return this.save();
};

module.exports = mongoose.model('Device', deviceSchema);