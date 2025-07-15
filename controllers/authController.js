const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Konfigurasi
const JWT_SECRET = process.env.JWT_SECRET || 'rahasia_super_aman_untuk_token_absensi_2024';
const JWT_EXPIRES_IN = '24h'; // Token berlaku 24 jam

// Database connection
const dbPath = path.join(__dirname, '..', 'database', 'absensi.db');
const db = new sqlite3.Database(dbPath);

// Login petugas
const login = (req, res) => {
    const { nip, password } = req.body;

    // Validasi input
    if (!nip || !password) {
        return res.status(400).json({
            success: false,
            message: 'NIP dan password harus diisi!'
        });
    }

    // Cari petugas berdasarkan NIP
    db.get(`SELECT * FROM petugas WHERE nip = ?`, [nip], (err, petugas) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                message: 'Terjadi kesalahan pada server!'
            });
        }

        if (!petugas) {
            return res.status(401).json({
                success: false,
                message: 'NIP atau password salah!'
            });
        }

        // Verifikasi password
        const isValidPassword = bcrypt.compareSync(password, petugas.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'NIP atau password salah!'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: petugas.id,
                nip: petugas.nip,
                nama: petugas.nama,
                role: petugas.role
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Response sukses
        res.json({
            success: true,
            message: 'Login berhasil!',
            data: {
                token: token,
                user: {
                    id: petugas.id,
                    nip: petugas.nip,
                    nama: petugas.nama,
                    role: petugas.role
                },
                expires_in: JWT_EXPIRES_IN
            }
        });
    });
};

// Logout (optional - untuk tracking)
const logout = (req, res) => {
    // Dalam implementasi JWT, logout biasanya dilakukan di client side
    // dengan menghapus token dari storage
    res.json({
        success: true,
        message: 'Logout berhasil! Token akan dihapus dari client.'
    });
};

// Get current user info
const getCurrentUser = (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'User tidak terautentikasi!'
        });
    }

    res.json({
        success: true,
        data: {
            id: req.user.id,
            nip: req.user.nip,
            nama: req.user.nama,
            role: req.user.role
        }
    });
};

// Refresh token (optional)
const refreshToken = (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'User tidak terautentikasi!'
        });
    }

    // Generate token baru
    const newToken = jwt.sign(
        {
            id: req.user.id,
            nip: req.user.nip,
            nama: req.user.nama,
            role: req.user.role
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
        success: true,
        message: 'Token berhasil diperbarui!',
        data: {
            token: newToken,
            expires_in: JWT_EXPIRES_IN
        }
    });
};

module.exports = {
    login,
    logout,
    getCurrentUser,
    refreshToken
}; 