// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const {
  register,
  login,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');

// rutas
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
