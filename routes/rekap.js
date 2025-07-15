const express = require('express');
const router = express.Router();
const rekapController = require('../controllers/rekapController');
const { verifyToken, rateLimit, requireRole } = require('../middleware/auth');

// GET /api/rekap/harian - Rekap absensi harian
router.get('/harian', verifyToken, rateLimit, requireRole(['admin', 'petugas']), rekapController.rekapHarian);

// GET /api/rekap/bulanan - Rekap absensi bulanan
router.get('/bulanan', verifyToken, rateLimit, requireRole(['admin', 'petugas']), rekapController.rekapBulanan);

// GET /api/rekap/petugas - Rekap absensi per petugas
router.get('/petugas', verifyToken, rateLimit, requireRole(['admin', 'petugas']), rekapController.rekapPerPetugas);

// GET /api/rekap/export - Export rekap ke JSON (admin only)
router.get('/export', verifyToken, rateLimit, requireRole(['admin']), rekapController.exportRekap);

module.exports = router; 