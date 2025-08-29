const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  role: {
    type: String,
    enum: ['parent', 'child'],
    required: true
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  parentEmail: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: {
    type: String,
    select: false
  },
  verificationTokenExpires: {
    type: Date,
    select: false
  },
  resetPasswordToken: {
    type: String,
    select: false
  },
  resetPasswordExpires: {
    type: Date,
    select: false
  },
  refreshToken: {
    type: String,
    select: false
  },
  lastLogin: {
    type: Date
  },
  loginHistory: [{
    ip: String,
    userAgent: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    location: {
      country: String,
      city: String,
      region: String
    }
  }],
  preferences: {
    notifications: {
      email: { 
        type: Boolean, 
        default: true 
      },
      push: { 
        type: Boolean, 
        default: true 
      },
      sms: { 
        type: Boolean, 
        default: false 
      },
      alertLevels: {
        critical: { type: Boolean, default: true },
        high: { type: Boolean, default: true },
        medium: { type: Boolean, default: false },
        low: { type: Boolean, default: false }
      }
    },
    language: { 
      type: String, 
      default: 'en',
      enum: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko']
    },
    timezone: { 
      type: String, 
      default: 'UTC' 
    },
    theme: {
      type: String,
      default: 'light',
      enum: ['light', 'dark', 'auto']
    },
    privacy: {
      dataRetention: {
        type: Number,
        default: 365, // days
        min: 30,
        max: 730
      },
      locationHistory: {
        type: Boolean,
        default: true
      },
      activityLogs: {
        type: Boolean,
        default: true
      }
    }
  },
  devices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device'
  }],
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'premium', 'enterprise'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'canceled', 'expired', 'trial'],
      default: 'active'
    },
    trialEnds: Date,
    currentPeriodEnd: Date,
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false
    }
  },
  limits: {
    devices: {
      type: Number,
      default: 3,
      min: 1,
      max: 100
    },
    alerts: {
      monthly: {
        type: Number,
        default: 1000
      }
    },
    storage: {
      type: Number, // in MB
      default: 100
    }
  },
  usage: {
    devicesCount: {
      type: Number,
      default: 0
    },
    alertsThisMonth: {
      type: Number,
      default: 0
    },
    storageUsed: {
      type: Number, // in MB
      default: 0
    },
    lastReset: {
      type: Date,
      default: Date.now
    }
  },
  profile: {
    avatar: String,
    phone: String,
    country: String,
    timezone: String,
    birthYear: Number,
    children: [{
      name: String,
      birthYear: Number,
      relationship: {
        type: String,
        enum: ['son', 'daughter', 'ward', 'other']
      }
    }]
  },
  security: {
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    twoFactorSecret: {
      type: String,
      select: false
    },
    backupCodes: [{
      type: String,
      select: false
    }],
    lastPasswordChange: Date,
    loginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: Date
  },
  metadata: {
    signupSource: {
      type: String,
      enum: ['web', 'mobile', 'api', 'admin'],
      default: 'web'
    },
    ipAddress: String,
    userAgent: String,
    referrer: String,
    campaign: String
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.verificationToken;
      delete ret.resetPasswordToken;
      delete ret.refreshToken;
      delete ret.twoFactorSecret;
      delete ret.backupCodes;
      return ret;
    }
  },
  toObject: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.verificationToken;
      delete ret.resetPasswordToken;
      delete ret.refreshToken;
      delete ret.twoFactorSecret;
      delete ret.backupCodes;
      return ret;
    }
  }
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ parentId: 1 });
userSchema.index({ 'subscription.status': 1 });
userSchema.index({ 'subscription.plan': 1 });
userSchema.index({ createdAt: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ emailVerified: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return this.name;
});

// Virtual for account age
userSchema.virtual('accountAge').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for isTrial
userSchema.virtual('isTrial').get(function() {
  return this.subscription.status === 'trial' && 
         this.subscription.trialEnds > new Date();
});

// Virtual for isPremium
userSchema.virtual('isPremium').get(function() {
  return ['premium', 'enterprise'].includes(this.subscription.plan) &&
         this.subscription.status === 'active';
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    this.security.lastPasswordChange = new Date();
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to update usage reset
userSchema.pre('save', function(next) {
  if (this.isNew) return next();
  
  // Reset monthly usage if it's a new month
  const now = new Date();
  const lastReset = this.usage.lastReset;
  
  if (lastReset.getMonth() !== now.getMonth() || 
      lastReset.getFullYear() !== now.getFullYear()) {
    this.usage.alertsThisMonth = 0;
    this.usage.lastReset = now;
  }
  
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check if account is locked
userSchema.methods.isLocked = function() {
  return !!(this.security.lockUntil && this.security.lockUntil > Date.now());
};

// Method to increment login attempts
userSchema.methods.incrementLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.security.lockUntil && this.security.lockUntil < Date.now()) {
    return this.update({
      'security.loginAttempts': 1,
      'security.lockUntil': null
    });
  }
  
  // Otherwise increment
  const updates = { $inc: { 'security.loginAttempts': 1 } };
  
  // Lock the account if we've reached max attempts and it's not already locked
  if (this.security.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { 'security.lockUntil': Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.update(updates);
};

// Method to generate verification token
userSchema.methods.generateVerificationToken = function() {
  this.verificationToken = require('crypto').randomBytes(20).toString('hex');
  this.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return this.verificationToken;
};

// Method to generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
  this.resetPasswordToken = require('crypto').randomBytes(20).toString('hex');
  this.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  return this.resetPasswordToken;
};

// Method to generate two-factor backup codes
userSchema.methods.generateBackupCodes = function() {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    codes.push(require('crypto').randomBytes(4).toString('hex').toUpperCase());
  }
  this.security.backupCodes = codes;
  return codes;
};

// Method to verify two-factor backup code
userSchema.methods.verifyBackupCode = function(code) {
  const index = this.security.backupCodes.indexOf(code.toUpperCase());
  if (index === -1) return false;
  
  // Remove used code
  this.security.backupCodes.splice(index, 1);
  return true;
};

// Static method to find by email case-insensitively
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: new RegExp('^' + email + '$', 'i') });
};

// Static method to get dashboard statistics
userSchema.statics.getDashboardStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
        verifiedUsers: { $sum: { $cond: [{ $eq: ['$emailVerified', true] }, 1, 0] } },
        parentUsers: { $sum: { $cond: [{ $eq: ['$role', 'parent'] }, 1, 0] } },
        childUsers: { $sum: { $cond: [{ $eq: ['$role', 'child'] }, 1, 0] } },
        premiumUsers: { 
          $sum: { 
            $cond: [{ 
              $and: [
                { $in: ['$subscription.plan', ['premium', 'enterprise']] },
                { $eq: ['$subscription.status', 'active'] }
              ]
            }, 1, 0] 
          } 
        }
      }
    }
  ]);
};

// Static method to cleanup expired tokens
userSchema.statics.cleanupExpiredTokens = function() {
  return this.updateMany(
    {
      $or: [
        { verificationTokenExpires: { $lt: new Date() } },
        { resetPasswordExpires: { $lt: new Date() } }
      ]
    },
    {
      $unset: {
        verificationToken: 1,
        verificationTokenExpires: 1,
        resetPasswordToken: 1,
        resetPasswordExpires: 1
      }
    }
  );
};

module.exports = mongoose.model('User', userSchema);