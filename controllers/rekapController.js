const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const moment = require('moment');

// Database connection
const dbPath = path.join(__dirname, '..', 'database', 'absensi.db');
const db = new sqlite3.Database(dbPath);

// Rekap absensi harian
const rekapHarian = (req, res) => {
    const { tanggal } = req.query;
    const queryDate = tanggal || moment().format('YYYY-MM-DD');

    db.all(`SELECT 
                a.id,
                a.petugas_id,
                p.nip,
                p.nama,
                p.role,
                a.tanggal,
                a.jam_masuk,
                a.jam_keluar,
                a.status,
                a.keterangan,
                a.created_at,
                -- Hitung durasi kerja (dalam menit)
                CASE 
                    WHEN a.jam_masuk IS NOT NULL AND a.jam_keluar IS NOT NULL 
                    THEN ROUND((julianday(a.jam_keluar) - julianday(a.jam_masuk)) * 24 * 60)
                    ELSE NULL 
                END as durasi_kerja_menit,
                -- Status keterlambatan (jika masuk setelah jam 08:00)
                CASE 
                    WHEN a.jam_masuk > '08:00:00' THEN 'terlambat'
                    WHEN a.jam_masuk IS NULL THEN 'tidak_hadir'
                    ELSE 'tepat_waktu'
                END as status_kehadiran
            FROM absensi a
            JOIN petugas p ON a.petugas_id = p.id
            WHERE a.tanggal = ?
            ORDER BY p.nama`, 
            [queryDate], (err, absensi) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                message: 'Terjadi kesalahan pada server!'
            });
        }

        // Hitung statistik
        const totalPetugas = absensi.length;
        const hadir = absensi.filter(a => a.jam_masuk !== null).length;
        const tidakHadir = absensi.filter(a => a.jam_masuk === null).length;
        const terlambat = absensi.filter(a => a.status_kehadiran === 'terlambat').length;
        const tepatWaktu = absensi.filter(a => a.status_kehadiran === 'tepat_waktu').length;

        res.json({
            success: true,
            data: {
                tanggal: queryDate,
                statistik: {
                    total_petugas: totalPetugas,
                    hadir: hadir,
                    tidak_hadir: tidakHadir,
                    terlambat: terlambat,
                    tepat_waktu: tepatWaktu,
                    persentase_kehadiran: totalPetugas > 0 ? Math.round((hadir / totalPetugas) * 100) : 0
                },
                detail_absensi: absensi
            }
        });
    });
};

// Rekap absensi bulanan
const rekapBulanan = (req, res) => {
    const { bulan, tahun } = req.query;
    const queryMonth = bulan || moment().format('MM');
    const queryYear = tahun || moment().format('YYYY');
    const startDate = `${queryYear}-${queryMonth}-01`;
    const endDate = moment(startDate).endOf('month').format('YYYY-MM-DD');

    db.all(`SELECT 
                a.id,
                a.petugas_id,
                p.nip,
                p.nama,
                p.role,
                a.tanggal,
                a.jam_masuk,
                a.jam_keluar,
                a.status,
                a.keterangan,
                -- Hitung durasi kerja (dalam menit)
                CASE 
                    WHEN a.jam_masuk IS NOT NULL AND a.jam_keluar IS NOT NULL 
                    THEN ROUND((julianday(a.jam_keluar) - julianday(a.jam_masuk)) * 24 * 60)
                    ELSE NULL 
                END as durasi_kerja_menit,
                -- Status keterlambatan
                CASE 
                    WHEN a.jam_masuk > '08:00:00' THEN 'terlambat'
                    WHEN a.jam_masuk IS NULL THEN 'tidak_hadir'
                    ELSE 'tepat_waktu'
                END as status_kehadiran
            FROM absensi a
            JOIN petugas p ON a.petugas_id = p.id
            WHERE a.tanggal BETWEEN ? AND ?
            ORDER BY a.tanggal DESC, p.nama`, 
            [startDate, endDate], (err, absensi) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                message: 'Terjadi kesalahan pada server!'
            });
        }

        // Group by petugas untuk summary
        const petugasSummary = {};
        absensi.forEach(record => {
            if (!petugasSummary[record.petugas_id]) {
                petugasSummary[record.petugas_id] = {
                    petugas_id: record.petugas_id,
                    nip: record.nip,
                    nama: record.nama,
                    role: record.role,
                    total_hari: 0,
                    hadir: 0,
                    tidak_hadir: 0,
                    terlambat: 0,
                    tepat_waktu: 0,
                    total_durasi_kerja: 0,
                    rata_rata_durasi: 0
                };
            }

            petugasSummary[record.petugas_id].total_hari++;
            
            if (record.jam_masuk) {
                petugasSummary[record.petugas_id].hadir++;
                if (record.status_kehadiran === 'terlambat') {
                    petugasSummary[record.petugas_id].terlambat++;
                } else {
                    petugasSummary[record.petugas_id].tepat_waktu++;
                }
                if (record.durasi_kerja_menit) {
                    petugasSummary[record.petugas_id].total_durasi_kerja += record.durasi_kerja_menit;
                }
            } else {
                petugasSummary[record.petugas_id].tidak_hadir++;
            }
        });

        // Hitung rata-rata durasi kerja
        Object.values(petugasSummary).forEach(summary => {
            if (summary.hadir > 0) {
                summary.rata_rata_durasi = Math.round(summary.total_durasi_kerja / summary.hadir);
            }
        });

        // Hitung statistik keseluruhan
        const totalPetugas = Object.keys(petugasSummary).length;
        const totalHari = moment(endDate).diff(moment(startDate), 'days') + 1;
        const totalAbsensi = absensi.length;
        const totalHadir = absensi.filter(a => a.jam_masuk !== null).length;
        const totalTerlambat = absensi.filter(a => a.status_kehadiran === 'terlambat').length;

        res.json({
            success: true,
            data: {
                periode: {
                    bulan: queryMonth,
                    tahun: queryYear,
                    start_date: startDate,
                    end_date: endDate,
                    total_hari: totalHari
                },
                statistik_keseluruhan: {
                    total_petugas: totalPetugas,
                    total_absensi: totalAbsensi,
                    total_hadir: totalHadir,
                    total_tidak_hadir: totalAbsensi - totalHadir,
                    total_terlambat: totalTerlambat,
                    persentase_kehadiran: totalAbsensi > 0 ? Math.round((totalHadir / totalAbsensi) * 100) : 0
                },
                summary_per_petugas: Object.values(petugasSummary),
                detail_absensi: absensi
            }
        });
    });
};

// Rekap absensi per petugas
const rekapPerPetugas = (req, res) => {
    const { petugas_id, start_date, end_date } = req.query;
    const queryPetugasId = petugas_id || req.user.id;
    const queryStartDate = start_date || moment().startOf('month').format('YYYY-MM-DD');
    const queryEndDate = end_date || moment().endOf('month').format('YYYY-MM-DD');

    db.all(`SELECT 
                a.id,
                a.petugas_id,
                p.nip,
                p.nama,
                p.role,
                a.tanggal,
                a.jam_masuk,
                a.jam_keluar,
                a.status,
                a.keterangan,
                -- Hitung durasi kerja (dalam menit)
                CASE 
                    WHEN a.jam_masuk IS NOT NULL AND a.jam_keluar IS NOT NULL 
                    THEN ROUND((julianday(a.jam_keluar) - julianday(a.jam_masuk)) * 24 * 60)
                    ELSE NULL 
                END as durasi_kerja_menit,
                -- Status keterlambatan
                CASE 
                    WHEN a.jam_masuk > '08:00:00' THEN 'terlambat'
                    WHEN a.jam_masuk IS NULL THEN 'tidak_hadir'
                    ELSE 'tepat_waktu'
                END as status_kehadiran
            FROM absensi a
            JOIN petugas p ON a.petugas_id = p.id
            WHERE a.petugas_id = ? AND a.tanggal BETWEEN ? AND ?
            ORDER BY a.tanggal DESC`, 
            [queryPetugasId, queryStartDate, queryEndDate], (err, absensi) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                message: 'Terjadi kesalahan pada server!'
            });
        }

        if (absensi.length === 0) {
            return res.json({
                success: true,
                data: {
                    petugas: null,
                    periode: {
                        start_date: queryStartDate,
                        end_date: queryEndDate
                    },
                    statistik: {
                        total_hari: 0,
                        hadir: 0,
                        tidak_hadir: 0,
                        terlambat: 0,
                        tepat_waktu: 0,
                        total_durasi_kerja: 0,
                        rata_rata_durasi: 0
                    },
                    detail_absensi: []
                }
            });
        }

        const petugas = {
            id: absensi[0].petugas_id,
            nip: absensi[0].nip,
            nama: absensi[0].nama,
            role: absensi[0].role
        };

        // Hitung statistik
        const totalHari = absensi.length;
        const hadir = absensi.filter(a => a.jam_masuk !== null).length;
        const tidakHadir = absensi.filter(a => a.jam_masuk === null).length;
        const terlambat = absensi.filter(a => a.status_kehadiran === 'terlambat').length;
        const tepatWaktu = absensi.filter(a => a.status_kehadiran === 'tepat_waktu').length;
        const totalDurasi = absensi.reduce((sum, a) => sum + (a.durasi_kerja_menit || 0), 0);
        const rataRataDurasi = hadir > 0 ? Math.round(totalDurasi / hadir) : 0;

        res.json({
            success: true,
            data: {
                petugas: petugas,
                periode: {
                    start_date: queryStartDate,
                    end_date: queryEndDate,
                    total_hari: totalHari
                },
                statistik: {
                    total_hari: totalHari,
                    hadir: hadir,
                    tidak_hadir: tidakHadir,
                    terlambat: terlambat,
                    tepat_waktu: tepatWaktu,
                    total_durasi_kerja: totalDurasi,
                    rata_rata_durasi: rataRataDurasi,
                    persentase_kehadiran: totalHari > 0 ? Math.round((hadir / totalHari) * 100) : 0
                },
                detail_absensi: absensi
            }
        });
    });
};

// Export rekap ke JSON file (untuk admin)
const exportRekap = (req, res) => {
    const { format, start_date, end_date } = req.query;
    const queryStartDate = start_date || moment().startOf('month').format('YYYY-MM-DD');
    const queryEndDate = end_date || moment().endOf('month').format('YYYY-MM-DD');

    db.all(`SELECT 
                a.id,
                a.petugas_id,
                p.nip,
                p.nama,
                p.role,
                a.tanggal,
                a.jam_masuk,
                a.jam_keluar,
                a.status,
                a.keterangan,
                a.created_at,
                -- Hitung durasi kerja (dalam menit)
                CASE 
                    WHEN a.jam_masuk IS NOT NULL AND a.jam_keluar IS NOT NULL 
                    THEN ROUND((julianday(a.jam_keluar) - julianday(a.jam_masuk)) * 24 * 60)
                    ELSE NULL 
                END as durasi_kerja_menit,
                -- Status keterlambatan
                CASE 
                    WHEN a.jam_masuk > '08:00:00' THEN 'terlambat'
                    WHEN a.jam_masuk IS NULL THEN 'tidak_hadir'
                    ELSE 'tepat_waktu'
                END as status_kehadiran
            FROM absensi a
            JOIN petugas p ON a.petugas_id = p.id
            WHERE a.tanggal BETWEEN ? AND ?
            ORDER BY a.tanggal DESC, p.nama`, 
            [queryStartDate, queryEndDate], (err, absensi) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                message: 'Terjadi kesalahan pada server!'
            });
        }

        const exportData = {
            metadata: {
                generated_at: moment().format('YYYY-MM-DD HH:mm:ss'),
                periode: {
                    start_date: queryStartDate,
                    end_date: queryEndDate
                },
                total_records: absensi.length
            },
            data: absensi
        };

        if (format === 'download') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="rekap_absensi_${queryStartDate}_${queryEndDate}.json"`);
        }

        res.json({
            success: true,
            message: 'Rekap berhasil diexport!',
            data: exportData
        });
    });
};

module.exports = {
    rekapHarian,
    rekapBulanan,
    rekapPerPetugas,
    exportRekap
}; 