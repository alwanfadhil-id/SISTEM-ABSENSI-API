# Sistem Absensi API

Sistem API untuk absensi petugas dengan fitur real-time checklock, token authentication, dan rekap absensi dalam format JSON.

## 🚀 Fitur Utama

1. **Authentication dengan JWT Token**
   - Login dengan NIP dan password
   - Token berlaku 24 jam
   - Rate limiting untuk keamanan

2. **Real-time Checklock**
   - Check-in/Check-out/Istirahat
   - Rate limiting ketat (1 request per 5 detik)
   - Tracking lokasi dan device info
   - Monitoring real-time status petugas

3. **Rekap Absensi JSON**
   - Rekap harian, bulanan, per petugas
   - Export data ke JSON
   - Statistik kehadiran dan keterlambatan
   - Durasi kerja otomatis

## 📋 Prasyarat

- Node.js (versi 14 atau lebih baru)
- npm atau yarn
- SQLite3 (terinstall otomatis)

## 🛠️ Instalasi

1. **Clone atau download proyek**
   ```bash
   cd sistem-absensi
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Inisialisasi database**
   ```bash
   npm run init-db
   ```

4. **Jalankan server**
   ```bash
   # Development mode (dengan auto-reload)
   npm run dev
   
   # Production mode
   npm start
   ```

## 🔐 Kredensial Default

Setelah inisialisasi database, tersedia akun default:

| NIP      | Password | Role    |
|----------|----------|---------|
| 123456   | admin123 | Admin   |
| 654321   | admin123 | Petugas |
| 789012   | admin123 | Petugas |

## 📖 API Documentation

### Base URL
```
http://localhost:3000
```

### 1. Authentication

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "nip": "123456",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login berhasil!",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "nip": "123456",
      "nama": "Administrator",
      "role": "admin"
    },
    "expires_in": "24h"
  }
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### 2. Checklock (Real-time)

#### Checklock Masuk/Keluar/Istirahat
```http
POST /api/checklock
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "masuk",
  "latitude": -6.2088,
  "longitude": 106.8456,
  "device_info": "Android 12, Samsung Galaxy"
}
```

**Status yang tersedia:**
- `masuk` - Check-in
- `keluar` - Check-out  
- `istirahat` - Istirahat

**Rate Limit:** 1 request per 5 detik

#### Get Real-time Status
```http
GET /api/checklock/status?tanggal=2024-01-15
Authorization: Bearer <token>
```

#### Get Checklock History
```http
GET /api/checklock/history?petugas_id=1&tanggal=2024-01-15
Authorization: Bearer <token>
```

### 3. Rekap Absensi

#### Rekap Harian
```http
GET /api/rekap/harian?tanggal=2024-01-15
Authorization: Bearer <token>
```

#### Rekap Bulanan
```http
GET /api/rekap/bulanan?bulan=01&tahun=2024
Authorization: Bearer <token>
```

#### Rekap Per Petugas
```http
GET /api/rekap/petugas?petugas_id=1&start_date=2024-01-01&end_date=2024-01-31
Authorization: Bearer <token>
```

#### Export Rekap (Admin Only)
```http
GET /api/rekap/export?start_date=2024-01-01&end_date=2024-01-31&format=download
Authorization: Bearer <token>
```

## 🔧 Konfigurasi

File konfigurasi: `config.env`

```env
# Konfigurasi Server
PORT=3000
NODE_ENV=development

# JWT Secret Key
JWT_SECRET=rahasia_super_aman_untuk_token_absensi_2024

# Database
DB_PATH=./database/absensi.db

# Rate Limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=100
```

## 📊 Struktur Database

### Tabel Petugas
- `id` - Primary Key
- `nip` - NIP petugas (unique)
- `nama` - Nama petugas
- `password` - Password terenkripsi
- `role` - Role (admin/petugas)

### Tabel Absensi
- `id` - Primary Key
- `petugas_id` - Foreign Key ke petugas
- `tanggal` - Tanggal absensi
- `jam_masuk` - Jam check-in
- `jam_keluar` - Jam check-out
- `status` - Status absensi
- `keterangan` - Keterangan tambahan

### Tabel Checklock
- `id` - Primary Key
- `petugas_id` - Foreign Key ke petugas
- `status` - Status (masuk/keluar/istirahat)
- `timestamp` - Waktu checklock
- `latitude` - Koordinat latitude
- `longitude` - Koordinat longitude
- `device_info` - Info device

## 🧪 Testing dengan Postman

### 1. Login untuk mendapatkan token
```http
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "nip": "123456",
  "password": "admin123"
}
```

### 2. Gunakan token untuk request lain
```http
POST http://localhost:3000/api/checklock
Authorization: Bearer <token_dari_login>
Content-Type: application/json

{
  "status": "masuk",
  "latitude": -6.2088,
  "longitude": 106.8456,
  "device_info": "Postman Test"
}
```

### 3. Get rekap absensi
```http
GET http://localhost:3000/api/rekap/harian
Authorization: Bearer <token_dari_login>
```

## 🔒 Keamanan

1. **JWT Token Authentication**
   - Semua endpoint (kecuali login) memerlukan token
   - Token berlaku 24 jam
   - Verifikasi otomatis di setiap request

2. **Rate Limiting**
   - Umum: 100 request per menit
   - Checklock: 1 request per 5 detik
   - Mencegah spam dan abuse

3. **Role-based Access**
   - Admin: Akses penuh
   - Petugas: Akses terbatas
   - Export rekap hanya untuk admin

4. **Password Security**
   - Password dienkripsi dengan bcrypt
   - Salt rounds: 10

## 📱 Contoh Response JSON

### Rekap Harian
```json
{
  "success": true,
  "data": {
    "tanggal": "2024-01-15",
    "statistik": {
      "total_petugas": 3,
      "hadir": 2,
      "tidak_hadir": 1,
      "terlambat": 1,
      "tepat_waktu": 1,
      "persentase_kehadiran": 67
    },
    "detail_absensi": [
      {
        "id": 1,
        "petugas_id": 1,
        "nip": "123456",
        "nama": "Administrator",
        "role": "admin",
        "tanggal": "2024-01-15",
        "jam_masuk": "08:30:00",
        "jam_keluar": "17:00:00",
        "status": "hadir",
        "durasi_kerja_menit": 510,
        "status_kehadiran": "terlambat"
      }
    ]
  }
}
```

## 🚨 Troubleshooting

### Error "Token tidak ditemukan"
- Pastikan header `Authorization: Bearer <token>` ada
- Atau gunakan header `x-access-token: <token>`

### Error "Request checklock terlalu sering"
- Tunggu 5 detik sebelum request checklock berikutnya
- Rate limiting untuk mencegah spam

### Error "Database error"
- Pastikan database sudah diinisialisasi: `npm run init-db`
- Cek file `database/absensi.db` ada

### Port sudah digunakan
- Ganti port di `config.env`: `PORT=3001`
- Atau matikan aplikasi yang menggunakan port 3000

##  Support

Untuk masalah:
1. Cek API documentation: `http://localhost:3000/api/docs`
2. Cek health status: `http://localhost:3000/health`
3. Review log server untuk error detail

## 🔄 Update dan Maintenance

### Backup Database
```bash
cp database/absensi.db database/absensi_backup.db
```

### Update Dependencies
```bash
npm update
```

### Reset Database
```bash
rm database/absensi.db
npm run init-db
```

---

**Sistem Absensi API v1.0.0** - Dibuat dengan ❤️ menggunakan Node.js, Express, dan SQLite 
