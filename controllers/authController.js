const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Device = require('../models/Device');
const logger = require('../utils/logger');
const { sendWelcomeEmail, sendVerificationEmail, sendPasswordResetEmail } = require('../utils/notifications');

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Generate refresh token
const generateRefreshToken = () => {
  return crypto.randomBytes(40).toString('hex');
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { email, password, name, role, parentEmail, deviceId, deviceName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create user
    const user = await User.create({
      email,
      password,
      name,
      role,
      ...(role === 'child' && parentEmail && { parentEmail }),
      verificationToken: crypto.randomBytes(20).toString('hex')
    });

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken();

    // Save refresh token (you might want to store this in a separate collection)
    user.refreshToken = refreshToken;
    await user.save();

    // Handle device registration if deviceId is provided
    if (deviceId && role === 'child') {
      try {
        const existingDevice = await Device.findOne({ deviceId });
        if (!existingDevice) {
          await Device.create({
            deviceId,
            deviceName: deviceName || `Child Device - ${deviceId.slice(-4)}`,
            childId: user._id,
            parentId: user.parentId || null,
            androidVersion: req.body.androidVersion,
            appVersion: req.body.appVersion || '1.0.0'
          });
        }
      } catch (deviceError) {
        logger.error('Device registration error during registration:', deviceError);
      }
    }

    // Send verification email
    if (process.env.NODE_ENV === 'production') {
      try {
        await sendVerificationEmail(user.email, user.name, user.verificationToken);
      } catch (emailError) {
        logger.error('Failed to send verification email:', emailError);
      }
    }

    logger.info('User registered successfully', { userId: user._id, email: user.email, role: user.role });

    res.status(201).json({
      success: true,
      message: 'User created successfully. Please check your email for verification.',
      token,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password, deviceId, deviceName } = req.body;

    // Check if user exists with password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken();

    // Update user with refresh token and last login
    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    user.loginHistory.push({
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date()
    });

    // Keep only last 10 login history entries
    if (user.loginHistory.length > 10) {
      user.loginHistory = user.loginHistory.slice(-10);
    }

    await user.save();

    // Handle device registration for child users
    if (user.role === 'child' && deviceId) {
      try {
        const existingDevice = await Device.findOne({ deviceId });
        if (!existingDevice) {
          await Device.create({
            deviceId,
            deviceName: deviceName || `Child Device - ${deviceId.slice(-4)}`,
            childId: user._id,
            parentId: user.parentId || null,
            androidVersion: req.body.androidVersion,
            appVersion: req.body.appVersion || '1.0.0'
          });
        } else if (existingDevice.childId.toString() !== user._id.toString()) {
          // Update device if it belongs to this user
          existingDevice.childId = user._id;
          await existingDevice.save();
        }
      } catch (deviceError) {
        logger.error('Device registration error during login:', deviceError);
      }
    }

    logger.info('User logged in successfully', { userId: user._id, email: user.email });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      refreshToken,
      expiresIn: process.env.JWT_EXPIRE || '7d',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
        isActive: user.isActive
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Refresh token
// @route   POST /api/auth/refresh
// @access  Public
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Find user by refresh token
    const user = await User.findOne({ refreshToken });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Generate new tokens
    const newToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken();

    // Update refresh token
    user.refreshToken = newRefreshToken;
    await user.save();

    res.json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken,
      expiresIn: process.env.JWT_EXPIRE || '7d'
    });
  } catch (error) {
    logger.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during token refresh'
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('parentId', 'name email');
    
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
        isActive: user.isActive,
        parentId: user.parentId,
        preferences: user.preferences,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching user profile'
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { name, preferences } = req.body;
    const updates = {};

    if (name) {
      updates.name = name;
    }

    if (preferences) {
      updates.preferences = { ...req.user.preferences, ...preferences };
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
        preferences: user.preferences
      }
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during profile update'
    });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

    // Check current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    logger.info('Password changed successfully', { userId: user._id });

    // Invalidate all refresh tokens (optional security measure)
    user.refreshToken = generateRefreshToken();
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password change'
    });
  }
};

// @desc    Verify email
// @route   GET /api/auth/verify-email/:token
// @access  Public
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({ 
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }

    user.emailVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    logger.info('Email verified successfully', { userId: user._id, email: user.email });

    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    logger.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during email verification'
    });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal that the email doesn't exist for security
      return res.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send reset email
    try {
      await sendPasswordResetEmail(user.email, user.name, resetToken);
    } catch (emailError) {
      logger.error('Failed to send password reset email:', emailError);
    }

    res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent'
    });
  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password reset request'
    });
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password/:token
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.refreshToken = generateRefreshToken(); // Invalidate old sessions
    await user.save();

    logger.info('Password reset successfully', { userId: user._id });

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password reset'
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  try {
    // Invalidate refresh token
    const user = await User.findById(req.user._id);
    if (user) {
      user.refreshToken = generateRefreshToken(); // Generate new token to invalidate old one
      await user.save();
    }

    logger.info('User logged out', { userId: req.user._id, email: req.user.email });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
};

// @desc    Delete account
// @route   DELETE /api/auth/account
// @access  Private
const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;

    // Verify password
    const user = await User.findById(req.user._id).select('+password');
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Password is incorrect'
      });
    }

    // Soft delete - mark as inactive
    user.isActive = false;
    user.email = `deleted-${Date.now()}@${user.email.split('@')[1]}`;
    await user.save();

    logger.info('Account deleted', { userId: req.user._id, email: req.user.email });

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    logger.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during account deletion'
    });
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  getMe,
  updateProfile,
  changePassword,
  verifyEmail,
  forgotPassword,
  resetPassword,
  logout,
  deleteAccount
};