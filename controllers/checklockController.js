const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const moment = require('moment');

// Database connection
const dbPath = path.join(__dirname, '..', 'database', 'absensi.db');
const db = new sqlite3.Database(dbPath);

// Checklock masuk/keluar/istirahat
const checklock = (req, res) => {
    const { status, latitude, longitude, device_info } = req.body;
    const petugasId = req.user.id;

    // Validasi input
    if (!status || !['masuk', 'keluar', 'istirahat'].includes(status)) {
        return res.status(400).json({
            success: false,
            message: 'Status harus berupa: masuk, keluar, atau istirahat!'
        });
    }

    const currentTime = moment().format('YYYY-MM-DD HH:mm:ss');
    const currentDate = moment().format('YYYY-MM-DD');

    // Cek apakah sudah ada absensi hari ini
    db.get(`SELECT * FROM absensi WHERE petugas_id = ? AND tanggal = ?`, 
        [petugasId, currentDate], (err, absensi) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                message: 'Terjadi kesalahan pada server!'
            });
        }

        // Proses berdasarkan status
        if (status === 'masuk') {
            if (absensi && absensi.jam_masuk) {
                return res.status(400).json({
                    success: false,
                    message: 'Anda sudah melakukan check-in hari ini!'
                });
            }

            // Insert atau update absensi
            if (absensi) {
                // Update jam masuk
                db.run(`UPDATE absensi SET jam_masuk = ? WHERE id = ?`, 
                    [moment().format('HH:mm:ss'), absensi.id], (err) => {
                    if (err) {
                        console.error('Error updating absensi:', err);
                        return res.status(500).json({
                            success: false,
                            message: 'Gagal mencatat check-in!'
                        });
                    }
                    recordChecklock();
                });
            } else {
                // Insert absensi baru
                db.run(`INSERT INTO absensi (petugas_id, tanggal, jam_masuk, status) 
                        VALUES (?, ?, ?, 'hadir')`, 
                        [petugasId, currentDate, moment().format('HH:mm:ss')], (err) => {
                    if (err) {
                        console.error('Error inserting absensi:', err);
                        return res.status(500).json({
                            success: false,
                            message: 'Gagal mencatat check-in!'
                        });
                    }
                    recordChecklock();
                });
            }
        } else if (status === 'keluar') {
            if (!absensi || !absensi.jam_masuk) {
                return res.status(400).json({
                    success: false,
                    message: 'Anda belum melakukan check-in hari ini!'
                });
            }

            if (absensi.jam_keluar) {
                return res.status(400).json({
                    success: false,
                    message: 'Anda sudah melakukan check-out hari ini!'
                });
            }

            // Update jam keluar
            db.run(`UPDATE absensi SET jam_keluar = ? WHERE id = ?`, 
                [moment().format('HH:mm:ss'), absensi.id], (err) => {
                if (err) {
                    console.error('Error updating absensi:', err);
                    return res.status(500).json({
                        success: false,
                        message: 'Gagal mencatat check-out!'
                    });
                }
                recordChecklock();
            });
        } else if (status === 'istirahat') {
            // Untuk istirahat, hanya catat di checklock
            recordChecklock();
        }
    });

    // Fungsi untuk mencatat checklock
    function recordChecklock() {
        db.run(`INSERT INTO checklock (petugas_id, status, timestamp, latitude, longitude, device_info) 
                VALUES (?, ?, ?, ?, ?, ?)`, 
                [petugasId, status, currentTime, latitude, longitude, device_info], (err) => {
            if (err) {
                console.error('Error recording checklock:', err);
                return res.status(500).json({
                    success: false,
                    message: 'Gagal mencatat checklock!'
                });
            }

            res.json({
                success: true,
                message: `Checklock ${status} berhasil dicatat!`,
                data: {
                    petugas_id: petugasId,
                    status: status,
                    timestamp: currentTime,
                    latitude: latitude,
                    longitude: longitude
                }
            });
        });
    }
};

// Get real-time checklock status (untuk monitoring)
const getChecklockStatus = (req, res) => {
    const { tanggal } = req.query;
    const queryDate = tanggal || moment().format('YYYY-MM-DD');

    // Ambil semua checklock hari ini dengan info petugas
    db.all(`SELECT 
                c.id,
                c.petugas_id,
                p.nip,
                p.nama,
                c.status,
                c.timestamp,
                c.latitude,
                c.longitude,
                c.device_info
            FROM checklock c
            JOIN petugas p ON c.petugas_id = p.id
            WHERE DATE(c.timestamp) = ?
            ORDER BY c.timestamp DESC`, 
            [queryDate], (err, checklocks) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                message: 'Terjadi kesalahan pada server!'
            });
        }

        // Group by petugas untuk mendapatkan status terbaru
        const petugasStatus = {};
        checklocks.forEach(checklock => {
            if (!petugasStatus[checklock.petugas_id] || 
                moment(checklock.timestamp).isAfter(petugasStatus[checklock.petugas_id].timestamp)) {
                petugasStatus[checklock.petugas_id] = {
                    id: checklock.petugas_id,
                    nip: checklock.nip,
                    nama: checklock.nama,
                    status: checklock.status,
                    timestamp: checklock.timestamp,
                    latitude: checklock.latitude,
                    longitude: checklock.longitude,
                    device_info: checklock.device_info
                };
            }
        });

        res.json({
            success: true,
            data: {
                tanggal: queryDate,
                total_petugas: Object.keys(petugasStatus).length,
                petugas_status: Object.values(petugasStatus),
                checklock_history: checklocks
            }
        });
    });
};

// Get checklock history untuk petugas tertentu
const getChecklockHistory = (req, res) => {
    const { petugas_id, tanggal } = req.query;
    const queryDate = tanggal || moment().format('YYYY-MM-DD');
    const queryPetugasId = petugas_id || req.user.id;

    db.all(`SELECT 
                c.id,
                c.petugas_id,
                p.nip,
                p.nama,
                c.status,
                c.timestamp,
                c.latitude,
                c.longitude,
                c.device_info
            FROM checklock c
            JOIN petugas p ON c.petugas_id = p.id
            WHERE c.petugas_id = ? AND DATE(c.timestamp) = ?
            ORDER BY c.timestamp DESC`, 
            [queryPetugasId, queryDate], (err, history) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                message: 'Terjadi kesalahan pada server!'
            });
        }

        res.json({
            success: true,
            data: {
                petugas_id: queryPetugasId,
                tanggal: queryDate,
                total_checklock: history.length,
                history: history
            }
        });
    });
};

module.exports = {
    checklock,
    getChecklockStatus,
    getChecklockHistory
}; 