const Command = require('../models/Command');
const Device = require('../models/Device');
const logger = require('../utils/logger');

// @desc    Get pending commands for device
// @route   GET /api/commands/device/:deviceId/pending
// @access  Public (authenticated by device token)
const getPendingCommands = async (req, res) => {
  try {
    const { deviceId } = req.params;

    const commands = await Command.find({
      deviceId,
      status: { $in: ['pending', 'sent'] },
      expiresAt: { $gt: new Date() }
    }).sort({ priority: -1, createdAt: 1 });

    // Mark commands as sent
    if (commands.length > 0) {
      const commandIds = commands.map(cmd => cmd._id);
      await Command.updateMany(
        { _id: { $in: commandIds } },
        { status: 'sent' }
      );
    }

    res.json({
      success: true,
      commands: commands.map(cmd => ({
        id: cmd._id,
        type: cmd.type,
        command: cmd.command,
        priority: cmd.priority,
        createdAt: cmd.createdAt
      }))
    });
  } catch (error) {
    logger.error('Get pending commands error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching commands'
    });
  }
};

// @desc    Acknowledge command receipt
// @route   POST /api/commands/:commandId/acknowledge
// @access  Public (authenticated by device token)
const acknowledgeCommand = async (req, res) => {
  try {
    const { commandId } = req.params;

    const command = await Command.findByIdAndUpdate(
      commandId,
      { status: 'delivered' },
      { new: true }
    );

    if (!command) {
      return res.status(404).json({
        success: false,
        message: 'Command not found'
      });
    }

    res.json({
      success: true,
      message: 'Command acknowledged'
    });
  } catch (error) {
    logger.error('Acknowledge command error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error acknowledging command'
    });
  }
};

// @desc    Report command execution result
// @route   POST /api/commands/:commandId/result
// @access  Public (authenticated by device token)
const reportCommandResult = async (req, res) => {
  try {
    const { commandId } = req.params;
    const { success, message, errorCode, data } = req.body;

    const command = await Command.findById(commandId);
    if (!command) {
      return res.status(404).json({
        success: false,
        message: 'Command not found'
      });
    }

    if (success) {
      await command.markAsCompleted({
        success: true,
        message: message || 'Command executed successfully',
        data,
        timestamp: new Date()
      });
    } else {
      await command.markAsFailed(message || 'Command execution failed');
    }

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    io.to(command.parentId.toString()).emit('command-result', {
      commandId: command._id,
      success,
      message,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: 'Command result reported'
    });
  } catch (error) {
    logger.error('Report command result error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error reporting command result'
    });
  }
};

// @desc    Send command to device
// @route   POST /api/commands
// @access  Private
const sendCommand = async (req, res) => {
  try {
    const { deviceId, type, data = {}, priority = 'normal' } = req.body;

    // Verify device belongs to user
    const device = await Device.findOne({
      deviceId,
      parentId: req.user._id,
      status: 'active'
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or access denied'
      });
    }

    const command = await Command.create({
      deviceId,
      parentId: req.user._id,
      type,
      command: data,
      priority
    });

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    io.to(deviceId).emit('new-command', {
      id: command._id,
      type: command.type,
      command: command.command,
      priority: command.priority
    });

    logger.info('Command sent to device', {
      commandId: command._id,
      deviceId,
      type,
      priority,
      parentId: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Command sent successfully',
      command: {
        id: command._id,
        type: command.type,
        priority: command.priority,
        status: command.status,
        createdAt: command.createdAt
      }
    });
  } catch (error) {
    logger.error('Send command error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error sending command'
    });
  }
};

// @desc    Get command history
// @route   GET /api/commands/device/:deviceId/history
// @access  Private
const getCommandHistory = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { page = 1, limit = 50, status } = req.query;

    const filter = { 
      deviceId,
      parentId: req.user._id 
    };

    if (status) {
      filter.status = status;
    }

    const commands = await Command.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Command.countDocuments(filter);

    res.json({
      success: true,
      count: commands.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      commands
    });
  } catch (error) {
    logger.error('Get command history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching command history'
    });
  }
};

// @desc    Cancel command
// @route   DELETE /api/commands/:commandId
// @access  Private
const cancelCommand = async (req, res) => {
  try {
    const { commandId } = req.params;

    const command = await Command.findOneAndUpdate(
      {
        _id: commandId,
        parentId: req.user._id,
        status: { $in: ['pending', 'sent'] }
      },
      { status: 'expired' },
      { new: true }
    );

    if (!command) {
      return res.status(404).json({
        success: false,
        message: 'Command not found or cannot be cancelled'
      });
    }

    res.json({
      success: true,
      message: 'Command cancelled successfully'
    });
  } catch (error) {
    logger.error('Cancel command error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error cancelling command'
    });
  }
};

// @desc    Retry failed command
// @route   POST /api/commands/:commandId/retry
// @access  Private
const retryCommand = async (req, res) => {
  try {
    const { commandId } = req.params;

    const command = await Command.findOne({
      _id: commandId,
      parentId: req.user._id,
      status: 'failed'
    });

    if (!command) {
      return res.status(404).json({
        success: false,
        message: 'Command not found or cannot be retried'
      });
    }

    // Create a new command with the same parameters
    const newCommand = await Command.create({
      deviceId: command.deviceId,
      parentId: command.parentId,
      type: command.type,
      command: command.command,
      priority: command.priority
    });

    res.json({
      success: true,
      message: 'Command retried successfully',
      command: {
        id: newCommand._id,
        type: newCommand.type,
        priority: newCommand.priority,
        status: newCommand.status
      }
    });
  } catch (error) {
    logger.error('Retry command error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrying command'
    });
  }
};

module.exports = {
  getPendingCommands,
  acknowledgeCommand,
  reportCommandResult,
  sendCommand,
  getCommandHistory,
  cancelCommand,
  retryCommand
};