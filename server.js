const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const checklockRoutes = require('./routes/checklock');
const rekapRoutes = require('./routes/rekap');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/checklock', checklockRoutes);
app.use('/api/rekap', rekapRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Sistem Absensi API berjalan dengan baik!',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
    res.json({
        success: true,
        message: 'API Documentation',
        endpoints: {
            auth: {
                'POST /api/auth/login': 'Login petugas dengan NIP dan password',
                'POST /api/auth/logout': 'Logout (memerlukan token)',
                'GET /api/auth/me': 'Get info user saat ini (memerlukan token)',
                'POST /api/auth/refresh': 'Refresh token (memerlukan token)'
            },
            checklock: {
                'POST /api/checklock': 'Checklock masuk/keluar/istirahat (memerlukan token, rate limit 5 detik)',
                'GET /api/checklock/status': 'Get status checklock real-time (memerlukan token)',
                'GET /api/checklock/history': 'Get history checklock (memerlukan token)'
            },
            rekap: {
                'GET /api/rekap/harian': 'Rekap absensi harian (memerlukan token)',
                'GET /api/rekap/bulanan': 'Rekap absensi bulanan (memerlukan token)',
                'GET /api/rekap/petugas': 'Rekap absensi per petugas (memerlukan token)',
                'GET /api/rekap/export': 'Export rekap ke JSON (admin only)'
            }
        },
        authentication: {
            method: 'JWT Token',
            header: 'Authorization: Bearer <token> atau x-access-token: <token>',
            token_expiry: '24 jam'
        },
        rate_limiting: {
            general: '100 request per menit',
            checklock: '1 request per 5 detik'
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan internal pada server!'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint tidak ditemukan!'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di port ${PORT}`);
    console.log(`📖 API Documentation: http://localhost:${PORT}/api/docs`);
    console.log(`💚 Health Check: http://localhost:${PORT}/health`);
    console.log(`🔐 Login endpoint: http://localhost:${PORT}/api/auth/login`);
});

module.exports = app; 