const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

// Path database
const dbPath = path.join(__dirname, 'absensi.db');

// Membuat koneksi database
const db = new sqlite3.Database(dbPath);

// Inisialisasi database
db.serialize(() => {
    console.log('🔄 Membuat tabel database...');

    // Tabel Petugas
    db.run(`CREATE TABLE IF NOT EXISTS petugas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nip VARCHAR(20) UNIQUE NOT NULL,
        nama VARCHAR(100) NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'petugas',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabel Absensi
    db.run(`CREATE TABLE IF NOT EXISTS absensi (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        petugas_id INTEGER NOT NULL,
        tanggal DATE NOT NULL,
        jam_masuk TIME,
        jam_keluar TIME,
        status VARCHAR(20) DEFAULT 'hadir',
        keterangan TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (petugas_id) REFERENCES petugas (id),
        UNIQUE(petugas_id, tanggal)
    )`);

    // Tabel Checklock (untuk real-time tracking)
    db.run(`CREATE TABLE IF NOT EXISTS checklock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        petugas_id INTEGER NOT NULL,
        status VARCHAR(20) NOT NULL, -- 'masuk', 'keluar', 'istirahat'
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        device_info TEXT,
        FOREIGN KEY (petugas_id) REFERENCES petugas (id)
    )`);

    // Tabel Token (untuk rate limiting)
    db.run(`CREATE TABLE IF NOT EXISTS token_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_hash VARCHAR(255) NOT NULL,
        endpoint VARCHAR(100) NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45)
    )`);

    console.log('✅ Tabel database berhasil dibuat!');

    // Insert data petugas default (password: admin123)
    const defaultPassword = bcrypt.hashSync('admin123', 10);
    
    db.run(`INSERT OR IGNORE INTO petugas (nip, nama, password, role) VALUES 
        ('123456', 'Administrator', ?, 'admin'),
        ('654321', 'Petugas 1', ?, 'petugas'),
        ('789012', 'Petugas 2', ?, 'petugas')`, 
        [defaultPassword, defaultPassword, defaultPassword], 
        function(err) {
            if (err) {
                console.error('❌ Error inserting default data:', err);
            } else {
                console.log('✅ Data petugas default berhasil ditambahkan!');
                console.log('📋 Kredensial default:');
                console.log('   NIP: 123456, Password: admin123 (Admin)');
                console.log('   NIP: 654321, Password: admin123 (Petugas)');
                console.log('   NIP: 789012, Password: admin123 (Petugas)');
            }
        }
    );
});

// Menutup koneksi database
db.close((err) => {
    if (err) {
        console.error('❌ Error closing database:', err);
    } else {
        console.log('🔒 Database connection closed.');
    }
}); 