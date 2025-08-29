const mongoose = require('mongoose');

const geofenceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  deviceId: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['circle', 'polygon', 'address'],
    required: true
  },
  // For circle geofences
  center: {
    latitude: {
      type: Number,
      required: function() {
        return this.type === 'circle';
      }
    },
    longitude: {
      type: Number,
      required: function() {
        return this.type === 'circle';
      }
    }
  },
  radius: {
    type: Number, // in meters
    required: function() {
      return this.type === 'circle';
    },
    min: 10,
    max: 100000
  },
  // For polygon geofences
  coordinates: [{
    latitude: Number,
    longitude: Number
  }],
  // For address-based geofences
  address: {
    formattedAddress: String,
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String
  },
  // Geofence settings
  settings: {
    notifyOnEntry: {
      type: Boolean,
      default: true
    },
    notifyOnExit: {
      type: Boolean,
      default: true
    },
    notifyOnDwell: {
      type: Boolean,
      default: false
    },
    dwellTime: {
      type: Number, // in minutes
      default: 5,
      min: 1,
      max: 60
    },
    workingHours: {
      enabled: {
        type: Boolean,
        default: false
      },
      startTime: String, // HH:mm format
      endTime: String,   // HH:mm format
      days: [{
        type: Number, // 0-6 (Sunday-Saturday)
        min: 0,
        max: 6
      }]
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    }
  },
  // Geofence status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastTriggered: Date,
  triggerCount: {
    type: Number,
    default: 0
  },
  // Statistics
  statistics: {
    entries: {
      type: Number,
      default: 0
    },
    exits: {
      type: Number,
      default: 0
    },
    dwells: {
      type: Number,
      default: 0
    },
    lastUpdated: Date
  },
  // Metadata
  metadata: {
    createdBy: {
      type: String,
      enum: ['parent', 'system', 'admin'],
      default: 'parent'
    },
    color: {
      type: String,
      default: '#3B82F6'
    },
    icon: {
      type: String,
      default: 'location'
    }
  }
}, {
  timestamps: true
});

// Indexes
geofenceSchema.index({ parentId: 1, deviceId: 1 });
geofenceSchema.index({ parentId: 1, isActive: 1 });
geofenceSchema.index({ 'center.latitude': 1, 'center.longitude': 1 });
geofenceSchema.index({ createdAt: 1 });

// 2dsphere index for geospatial queries
geofenceSchema.index({ 
  location: "2dsphere" 
});

// Virtual for location (for geospatial queries)
geofenceSchema.virtual('location').get(function() {
  if (this.type === 'circle' && this.center) {
    return {
      type: "Point",
      coordinates: [this.center.longitude, this.center.latitude]
    };
  }
  return null;
});

// Virtual for geofence area (approximate)
geofenceSchema.virtual('area').get(function() {
  if (this.type === 'circle') {
    return Math.PI * Math.pow(this.radius, 2);
  }
  // For polygons, this would require complex calculation
  return null;
});

// Method to check if point is inside geofence
geofenceSchema.methods.containsPoint = function(latitude, longitude) {
  if (this.type === 'circle') {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.deg2rad(latitude - this.center.latitude);
    const dLon = this.deg2rad(longitude - this.center.longitude);
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(this.center.latitude)) * 
      Math.cos(this.deg2rad(latitude)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance <= this.radius;
  }
  
  // For polygons, implement point-in-polygon algorithm
  // This is a simplified implementation
  return false;
};

// Helper method to convert degrees to radians
geofenceSchema.methods.deg2rad = function(deg) {
  return deg * (Math.PI/180);
};

// Method to update statistics
geofenceSchema.methods.updateStatistics = function(eventType) {
  switch (eventType) {
    case 'enter':
      this.statistics.entries += 1;
      break;
    case 'exit':
      this.statistics.exits += 1;
      break;
    case 'dwell':
      this.statistics.dwells += 1;
      break;
  }
  
  this.statistics.lastUpdated = new Date();
  this.lastTriggered = new Date();
  this.triggerCount += 1;
  
  return this.save();
};

// Static method to find active geofences for device
geofenceSchema.statics.findActiveForDevice = function(deviceId, parentId) {
  return this.find({
    deviceId,
    parentId,
    isActive: true
  });
};

// Static method to check point against all geofences
geofenceSchema.statics.checkPoint = async function(latitude, longitude, deviceId, parentId) {
  const geofences = await this.findActiveForDevice(deviceId, parentId);
  const results = [];
  
  for (const geofence of geofences) {
    if (geofence.containsPoint(latitude, longitude)) {
      results.push({
        geofenceId: geofence._id,
        name: geofence.name,
        type: geofence.type,
        event: 'inside'
      });
    }
  }
  
  return results;
};

// Pre-save middleware to validate coordinates
geofenceSchema.pre('save', function(next) {
  if (this.type === 'circle') {
    if (!this.center || !this.center.latitude || !this.center.longitude) {
      return next(new Error('Center coordinates are required for circle geofences'));
    }
    
    if (this.center.latitude < -90 || this.center.latitude > 90) {
      return next(new Error('Latitude must be between -90 and 90'));
    }
    
    if (this.center.longitude < -180 || this.center.longitude > 180) {
      return next(new Error('Longitude must be between -180 and 180'));
    }
  }
  
  if (this.type === 'polygon' && (!this.coordinates || this.coordinates.length < 3)) {
    return next(new Error('Polygon requires at least 3 coordinates'));
  }
  
  next();
});

module.exports = mongoose.model('Geofence', geofenceSchema);