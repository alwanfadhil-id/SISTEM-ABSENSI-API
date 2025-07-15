const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Konfigurasi
const JWT_SECRET = process.env.JWT_SECRET || 'rahasia_super_aman_untuk_token_absensi_2024';
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW) || 60000; // 1 menit
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;

// Database connection
const dbPath = path.join(__dirname, '..', 'database', 'absensi.db');
const db = new sqlite3.Database(dbPath);

// Middleware untuk verifikasi JWT token
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1] || req.headers['x-access-token'];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Token tidak ditemukan! Silakan login terlebih dahulu.'
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Token tidak valid atau sudah kadaluarsa!'
        });
    }
};

// Middleware untuk rate limiting berdasarkan token
const rateLimit = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1] || req.headers['x-access-token'];
    
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Token diperlukan untuk rate limiting!'
        });
    }

    const tokenHash = bcrypt.hashSync(token, 10);
    const endpoint = req.originalUrl;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const currentTime = new Date().toISOString();

    // Hapus request lama (lebih dari window time)
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW).toISOString();
    
    db.run(`DELETE FROM token_usage WHERE timestamp < ?`, [windowStart], (err) => {
        if (err) {
            console.error('Error cleaning old requests:', err);
        }

        // Hitung request dalam window time
        db.get(`SELECT COUNT(*) as count FROM token_usage 
                WHERE token_hash = ? AND endpoint = ? AND timestamp > ?`, 
                [tokenHash, endpoint, windowStart], (err, row) => {
            if (err) {
                console.error('Error checking rate limit:', err);
                return next();
            }

            const requestCount = row ? row.count : 0;

            if (requestCount >= RATE_LIMIT_MAX_REQUESTS) {
                return res.status(429).json({
                    success: false,
                    message: `Terlalu banyak request! Maksimal ${RATE_LIMIT_MAX_REQUESTS} request per ${RATE_LIMIT_WINDOW/1000} detik.`
                });
            }

            // Catat request ini
            db.run(`INSERT INTO token_usage (token_hash, endpoint, timestamp, ip_address) 
                    VALUES (?, ?, ?, ?)`, 
                    [tokenHash, endpoint, currentTime, ipAddress], (err) => {
                if (err) {
                    console.error('Error logging request:', err);
                }
                next();
            });
        });
    });
};

// Middleware untuk checklock rate limiting (lebih ketat)
const checklockRateLimit = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1] || req.headers['x-access-token'];
    
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Token diperlukan!'
        });
    }

    const tokenHash = bcrypt.hashSync(token, 10);
    const endpoint = '/api/checklock';
    const currentTime = new Date().toISOString();
    
    // Untuk checklock, batasi 1 request per 5 detik
    const checklockWindow = 5000; // 5 detik
    const windowStart = new Date(Date.now() - checklockWindow).toISOString();

    db.run(`DELETE FROM token_usage WHERE timestamp < ?`, [windowStart], (err) => {
        if (err) {
            console.error('Error cleaning old checklock requests:', err);
        }

        db.get(`SELECT COUNT(*) as count FROM token_usage 
                WHERE token_hash = ? AND endpoint = ? AND timestamp > ?`, 
                [tokenHash, endpoint, windowStart], (err, row) => {
            if (err) {
                console.error('Error checking checklock rate limit:', err);
                return next();
            }

            const requestCount = row ? row.count : 0;

            if (requestCount >= 1) {
                return res.status(429).json({
                    success: false,
                    message: 'Request checklock terlalu sering! Tunggu 5 detik sebelum request berikutnya.'
                });
            }

            // Catat request checklock
            db.run(`INSERT INTO token_usage (token_hash, endpoint, timestamp, ip_address) 
                    VALUES (?, ?, ?, ?)`, 
                    [tokenHash, endpoint, currentTime, req.ip], (err) => {
                if (err) {
                    console.error('Error logging checklock request:', err);
                }
                next();
            });
        });
    });
};

// Middleware untuk role-based access
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'User tidak terautentikasi!'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Anda tidak memiliki akses ke endpoint ini!'
            });
        }

        next();
    };
};

module.exports = {
    verifyToken,
    rateLimit,
    checklockRateLimit,
    requireRole
}; 