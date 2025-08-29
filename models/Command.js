const mongoose = require('mongoose');

const commandSchema = new mongoose.Schema({
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
    ],
    index: true
  },
  command: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'critical'],
    default: 'normal',
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'executing', 'completed', 'failed', 'expired'],
    default: 'pending',
    index: true
  },
  executionResult: {
    success: Boolean,
    message: String,
    errorCode: String,
    timestamp: Date,
    data: mongoose.Schema.Types.Mixed
  },
  expiresAt: {
    type: Date,
    index: true,
    expires: 0 // TTL index for auto-deletion
  },
  retryCount: {
    type: Number,
    default: 0,
    max: 5
  },
  nextRetryAt: Date,
  scheduledAt: Date,
  deliveredAt: Date,
  executedAt: Date,
  failureReason: String
}, {
  timestamps: true
});

// Compound indexes
commandSchema.index({ deviceId: 1, status: 1 });
commandSchema.index({ parentId: 1, createdAt: -1 });
commandSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware to set expiration
commandSchema.pre('save', function(next) {
  if (!this.expiresAt) {
    // Default expiration: 24 hours for normal, 7 days for critical
    const expirationHours = this.priority === 'critical' ? 168 : 24;
    this.expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);
  }
  next();
});

// Method to mark as delivered
commandSchema.methods.markAsDelivered = function() {
  this.status = 'delivered';
  this.deliveredAt = new Date();
  return this.save();
};

// Method to mark as executing
commandSchema.methods.markAsExecuting = function() {
  this.status = 'executing';
  return this.save();
};

// Method to mark as completed
commandSchema.methods.markAsCompleted = function(result) {
  this.status = 'completed';
  this.executedAt = new Date();
  this.executionResult = result;
  return this.save();
};

// Method to mark as failed
commandSchema.methods.markAsFailed = function(reason) {
  this.retryCount += 1;
  this.failureReason = reason;
  
  if (this.retryCount >= 5) {
    this.status = 'failed';
  } else {
    this.status = 'pending';
    // Exponential backoff for retries
    const backoff = Math.pow(2, this.retryCount) * 1000;
    this.nextRetryAt = new Date(Date.now() + backoff);
  }
  
  return this.save();
};

module.exports = mongoose.model('Command', commandSchema);