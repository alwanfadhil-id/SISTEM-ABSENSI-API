const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// POST /api/auth/login - Login petugas
router.post('/login', authController.login);

// POST /api/auth/logout - Logout (optional)
router.post('/logout', verifyToken, authController.logout);

// GET /api/auth/me - Get current user info
router.get('/me', verifyToken, authController.getCurrentUser);

// POST /api/auth/refresh - Refresh token
router.post('/refresh', verifyToken, authController.refreshToken);

module.exports = router; 