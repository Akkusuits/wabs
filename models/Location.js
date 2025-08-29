const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
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
  latitude: {
    type: Number,
    required: true,
    min: -90,
    max: 90
  },
  longitude: {
    type: Number,
    required: true,
    min: -180,
    max: 180
  },
  accuracy: {
    type: Number,
    min: 0,
    default: 0
  },
  altitude: Number,
  speed: Number,
  heading: Number,
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String,
    formattedAddress: String
  },
  source: {
    type: String,
    enum: ['gps', 'network', 'fused', 'manual'],
    default: 'gps'
  },
  batteryLevel: Number,
  isCharging: Boolean,
  networkType: String,
  signalStrength: Number,
  geofenceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Geofence'
  },
  geofenceEvent: {
    type: String,
    enum: ['enter', 'exit', 'dwell']
  }
}, {
  timestamps: true
});

// Compound indexes for efficient querying
locationSchema.index({ deviceId: 1, timestamp: -1 });
locationSchema.index({ parentId: 1, timestamp: -1 });
locationSchema.index({ geofenceId: 1, timestamp: -1 });
locationSchema.index({ 
  latitude: 1, 
  longitude: 1,
  timestamp: -1 
});

// 2dsphere index for geospatial queries
locationSchema.index({ 
  location: "2dsphere" 
});

// Virtual for GeoJSON format
locationSchema.virtual('location').get(function() {
  return {
    type: "Point",
    coordinates: [this.longitude, this.latitude]
  };
});

// Method to get formatted location
locationSchema.methods.getFormattedAddress = function() {
  if (this.address && this.address.formattedAddress) {
    return this.address.formattedAddress;
  }
  return `${this.latitude.toFixed(6)}, ${this.longitude.toFixed(6)}`;
};

// Static method to get latest location for device
locationSchema.statics.getLatestLocation = function(deviceId) {
  return this.findOne({ deviceId })
    .sort({ timestamp: -1 })
    .limit(1);
};

// Static method to get location history
locationSchema.statics.getLocationHistory = function(deviceId, startTime, endTime, limit = 100) {
  const query = { deviceId };
  
  if (startTime && endTime) {
    query.timestamp = { $gte: new Date(startTime), $lte: new Date(endTime) };
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit);
};

module.exports = mongoose.model('Location', locationSchema);