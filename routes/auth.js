const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  logout
} = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const {
  validateRegister,
  validateLogin
} = require('../middleware/validation');

// Public routes
router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);

// Protected routes
router.get('/me', auth, getMe);
router.put('/profile', auth, updateProfile);
router.put('/change-password', auth, changePassword);
router.post('/logout', auth, logout);

module.exports = router;