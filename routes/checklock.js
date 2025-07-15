const express = require('express');
const router = express.Router();
const checklockController = require('../controllers/checklockController');
const { verifyToken, checklockRateLimit, requireRole } = require('../middleware/auth');

// POST /api/checklock - Checklock masuk/keluar/istirahat (dengan rate limiting ketat)
router.post('/', verifyToken, checklockRateLimit, checklockController.checklock);

// GET /api/checklock/status - Get real-time checklock status (untuk monitoring)
router.get('/status', verifyToken, requireRole(['admin', 'petugas']), checklockController.getChecklockStatus);

// GET /api/checklock/history - Get checklock history untuk petugas tertentu
router.get('/history', verifyToken, requireRole(['admin', 'petugas']), checklockController.getChecklockHistory);

module.exports = router; 