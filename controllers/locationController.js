const Location = require('../models/Location');
const Device = require('../models/Device');
const logger = require('../utils/logger');
const { reverseGeocode } = require('../utils/geocoding');

// @desc    Report device location
// @route   POST /api/locations/report
// @access  Public (authenticated by device token)
const reportLocation = async (req, res) => {
  try {
    const { deviceId, latitude, longitude, accuracy, ...otherData } = req.body;

    // Verify device exists
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Get address from coordinates
    let address = null;
    try {
      address = await reverseGeocode(latitude, longitude);
    } catch (geocodeError) {
      logger.warn('Geocoding failed:', geocodeError);
    }

    const location = await Location.create({
      deviceId,
      parentId: device.parentId,
      latitude,
      longitude,
      accuracy,
      address,
      ...otherData,
      timestamp: new Date()
    });

    // Update device's last known location
    device.location = {
      latitude,
      longitude,
      accuracy,
      timestamp: new Date(),
      address: address?.formattedAddress
    };
    await device.save();

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    io.to(device.parentId.toString()).emit('location-update', {
      deviceId,
      latitude,
      longitude,
      accuracy,
      address,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: 'Location reported successfully'
    });
  } catch (error) {
    logger.error('Report location error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error reporting location'
    });
  }
};

// @desc    Get device location history
// @route   GET /api/locations/device/:deviceId/history
// @access  Private
const getLocationHistory = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { hours = 24, limit = 100 } = req.query;

    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const locations = await Location.find({
      deviceId,
      parentId: req.user._id,
      timestamp: { $gte: startTime }
    })
    .sort({ timestamp: -1 })
    .limit(parseInt(limit));

    res.json({
      success: true,
      count: locations.length,
      locations
    });
  } catch (error) {
    logger.error('Get location history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching location history'
    });
  }
};

// @desc    Get current device location
// @route   GET /api/locations/device/:deviceId/current
// @access  Private
const getCurrentLocation = async (req, res) => {
  try {
    const { deviceId } = req.params;

    const location = await Location.findOne({
      deviceId,
      parentId: req.user._id
    })
    .sort({ timestamp: -1 })
    .limit(1);

    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'No location data found'
      });
    }

    res.json({
      success: true,
      location
    });
  } catch (error) {
    logger.error('Get current location error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching current location'
    });
  }
};

// @desc    Get location statistics
// @route   GET /api/locations/device/:deviceId/stats
// @access  Private
const getLocationStats = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { days = 7 } = req.query;

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const stats = await Location.aggregate([
      {
        $match: {
          deviceId,
          parentId: req.user._id,
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
          },
          count: { $sum: 1 },
          avgAccuracy: { $avg: "$accuracy" },
          locations: { $push: "$$ROOT" }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Get location stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching location statistics'
    });
  }
};

// @desc    Delete location history
// @route   DELETE /api/locations/device/:deviceId/history
// @access  Private
const deleteLocationHistory = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { olderThan } = req.query;

    const filter = {
      deviceId,
      parentId: req.user._id
    };

    if (olderThan) {
      const cutoffDate = new Date(Date.now() - parseInt(olderThan) * 24 * 60 * 60 * 1000);
      filter.timestamp = { $lt: cutoffDate };
    }

    const result = await Location.deleteMany(filter);

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} location records`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    logger.error('Delete location history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting location history'
    });
  }
};

module.exports = {
  reportLocation,
  getLocationHistory,
  getCurrentLocation,
  getLocationStats,
  deleteLocationHistory
};