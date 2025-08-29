const Device = require('../models/Device');
const Alert = require('../models/Alert');
const Command = require('../models/Command');
const logger = require('../utils/logger');

// @desc    Get all devices for parent
// @route   GET /api/devices
// @access  Private
const getDevices = async (req, res) => {
  try {
    const devices = await Device.find({ 
      parentId: req.user._id,
      status: 'active'
    }).populate('childId', 'name email');

    res.json({
      success: true,
      count: devices.length,
      devices
    });
  } catch (error) {
    logger.error('Get devices error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching devices'
    });
  }
};

// @desc    Get single device
// @route   GET /api/devices/:deviceId
// @access  Private
const getDevice = async (req, res) => {
  try {
    const device = await Device.findOne({
      deviceId: req.params.deviceId,
      parentId: req.user._id,
      status: 'active'
    }).populate('childId', 'name email');

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    res.json({
      success: true,
      device
    });
  } catch (error) {
    logger.error('Get device error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching device'
    });
  }
};

// @desc    Link device to parent
// @route   POST /api/devices/link
// @access  Private
const linkDevice = async (req, res) => {
  try {
    const { deviceId, childEmail } = req.body;

    // Check if device is already linked
    const existingDevice = await Device.findOne({ deviceId });
    if (existingDevice) {
      return res.status(400).json({
        success: false,
        message: 'Device is already linked to another account'
      });
    }

    // Create new device entry
    const device = await Device.create({
      deviceId,
      deviceName: req.body.deviceName || `Child Device - ${deviceId.slice(-4)}`,
      parentId: req.user._id,
      childId: req.user._id, // For now, will be updated when child registers
      androidVersion: req.body.androidVersion,
      appVersion: req.body.appVersion
    });

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    io.to(req.user._id.toString()).emit('device-linked', device);

    logger.info('Device linked successfully', { 
      deviceId, 
      parentId: req.user._id 
    });

    res.status(201).json({
      success: true,
      message: 'Device linked successfully',
      device
    });
  } catch (error) {
    logger.error('Link device error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error linking device'
    });
  }
};

// @desc    Update device settings
// @route   PUT /api/devices/:deviceId/settings
// @access  Private
const updateDeviceSettings = async (req, res) => {
  try {
    const device = await Device.findOneAndUpdate(
      {
        deviceId: req.params.deviceId,
        parentId: req.user._id,
        status: 'active'
      },
      { 
        $set: { 
          'settings': { ...req.body } 
        } 
      },
      { new: true, runValidators: true }
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Create command to update settings on device
    await Command.create({
      deviceId: device.deviceId,
      parentId: req.user._id,
      type: 'update_settings',
      command: req.body,
      priority: 'high'
    });

    res.json({
      success: true,
      message: 'Device settings updated successfully',
      device
    });
  } catch (error) {
    logger.error('Update device settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating device settings'
    });
  }
};

// @desc    Receive heartbeat from device
// @route   POST /api/devices/heartbeat
// @access  Public (authenticated by device token)
const receiveHeartbeat = async (req, res) => {
  try {
    const { deviceId, batteryLevel, isCharging, ...otherData } = req.body;

    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not registered'
      });
    }

    // Update device status
    await device.updateHeartbeat(batteryLevel, isCharging);

    // Update additional data if provided
    if (Object.keys(otherData).length > 0) {
      await Device.findByIdAndUpdate(device._id, {
        ...otherData,
        lastHeartbeat: new Date()
      });
    }

    // Check for low battery
    if (batteryLevel <= device.settings.maxBatteryAlert && !isCharging) {
      await Alert.create({
        deviceId,
        parentId: device.parentId,
        type: 'low_battery',
        message: `Low battery alert: ${batteryLevel}% remaining`,
        severity: batteryLevel <= 10 ? 'critical' : 'medium',
        data: { batteryLevel }
      });
    }

    // Check for pending commands
    const pendingCommands = await Command.find({
      deviceId,
      status: { $in: ['pending', 'sent'] },
      expiresAt: { $gt: new Date() }
    });

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    io.to(device.parentId.toString()).emit('heartbeat-received', {
      deviceId,
      batteryLevel,
      isOnline: true,
      lastHeartbeat: new Date()
    });

    res.json({
      success: true,
      message: 'Heartbeat received',
      requiresAction: pendingCommands.length > 0,
      pendingCommands: pendingCommands.map(cmd => ({
        id: cmd._id,
        type: cmd.type,
        command: cmd.command,
        priority: cmd.priority
      }))
    });
  } catch (error) {
    logger.error('Heartbeat error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error processing heartbeat'
    });
  }
};

// @desc    Block/unblock device
// @route   PUT /api/devices/:deviceId/block
// @access  Private
const toggleDeviceBlock = async (req, res) => {
  try {
    const { blocked } = req.body;
    const device = await Device.findOneAndUpdate(
      {
        deviceId: req.params.deviceId,
        parentId: req.user._id
      },
      { isBlocked: blocked },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Create block/unblock command
    await Command.create({
      deviceId: device.deviceId,
      parentId: req.user._id,
      type: blocked ? 'lock_device' : 'unlock_device',
      command: { reason: 'Parent remote control' },
      priority: 'high'
    });

    res.json({
      success: true,
      message: `Device ${blocked ? 'blocked' : 'unblocked'} successfully`,
      device
    });
  } catch (error) {
    logger.error('Toggle device block error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error toggling device block'
    });
  }
};

// @desc    Delete device
// @route   DELETE /api/devices/:deviceId
// @access  Private
const deleteDevice = async (req, res) => {
  try {
    const device = await Device.findOneAndUpdate(
      {
        deviceId: req.params.deviceId,
        parentId: req.user._id
      },
      { status: 'deleted' },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    res.json({
      success: true,
      message: 'Device deleted successfully'
    });
  } catch (error) {
    logger.error('Delete device error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting device'
    });
  }
};

module.exports = {
  getDevices,
  getDevice,
  linkDevice,
  updateDeviceSettings,
  receiveHeartbeat,
  toggleDeviceBlock,
  deleteDevice
};