const nodemailer = require('nodemailer');
const logger = require('./logger');

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Send welcome email
const sendWelcomeEmail = async (email, name) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Welcome to Watcher Parental Control',
      html: `
        <h2>Welcome to Watcher, ${name}!</h2>
        <p>Thank you for choosing Watcher Parental Control to keep your family safe.</p>
        <p>With Watcher, you can:</p>
        <ul>
          <li>Monitor your child's device usage</li>
          <li>Receive real-time alerts</li>
          <li>Set screen time limits</li>
          <li>Track location safely</li>
        </ul>
        <p>If you have any questions, please contact our support team.</p>
        <br>
        <p>Best regards,<br>The Watcher Team</p>
      `
    };

    await transporter.sendMail(mailOptions);
    logger.info('Welcome email sent successfully', { email });
  } catch (error) {
    logger.error('Error sending welcome email:', error);
    throw error;
  }
};

// Send verification email
const sendVerificationEmail = async (email, name, token) => {
  try {
    const transporter = createTransporter();
    
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${token}`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify Your Watcher Account',
      html: `
        <h2>Hello ${name},</h2>
        <p>Please verify your email address to complete your Watcher account registration.</p>
        <p>Click the link below to verify your email:</p>
        <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
          Verify Email
        </a>
        <p>Or copy and paste this URL in your browser:</p>
        <p>${verificationUrl}</p>
        <br>
        <p>If you didn't create this account, please ignore this email.</p>
      `
    };

    await transporter.sendMail(mailOptions);
    logger.info('Verification email sent successfully', { email });
  } catch (error) {
    logger.error('Error sending verification email:', error);
    throw error;
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, name, token) => {
  try {
    const transporter = createTransporter();
    
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${token}`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Reset Your Watcher Password',
      html: `
        <h2>Hello ${name},</h2>
        <p>You requested to reset your password for your Watcher account.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 4px;">
          Reset Password
        </a>
        <p>Or copy and paste this URL in your browser:</p>
        <p>${resetUrl}</p>
        <p>This link will expire in 1 hour.</p>
        <br>
        <p>If you didn't request this reset, please ignore this email and your password will remain unchanged.</p>
      `
    };

    await transporter.sendMail(mailOptions);
    logger.info('Password reset email sent successfully', { email });
  } catch (error) {
    logger.error('Error sending password reset email:', error);
    throw error;
  }
};

// Send alert notification email
const sendEmailNotification = async (userId, notification) => {
  try {
    // In a real implementation, you would:
    // 1. Get user email and preferences from database
    // 2. Check if user wants email notifications
    // 3. Send the email
    
    logger.info('Email notification prepared', { userId, subject: notification.subject });
    return true;
  } catch (error) {
    logger.error('Error sending email notification:', error);
    return false;
  }
};

// Send push notification
const sendPushNotification = async (userId, notification) => {
  try {
    // In a real implementation, you would:
    // 1. Get user's FCM/APNS tokens from database
    // 2. Send push notification via appropriate service
    
    logger.info('Push notification prepared', { userId, title: notification.title });
    return true;
  } catch (error) {
    logger.error('Error sending push notification:', error);
    return false;
  }
};

// Send SMS notification
const sendSMSNotification = async (userId, message) => {
  try {
    // In a real implementation, you would:
    // 1. Get user's phone number from database
    // 2. Send SMS via Twilio or similar service
    
    logger.info('SMS notification prepared', { userId });
    return true;
  } catch (error) {
    logger.error('Error sending SMS notification:', error);
    return false;
  }
};

module.exports = {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendEmailNotification,
  sendPushNotification,
  sendSMSNotification
};