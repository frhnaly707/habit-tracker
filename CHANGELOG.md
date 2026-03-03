# 📝 Changelog

## [1.1.0] - 2026-03-03

### 🐛 Bug Fixes
- **CRITICAL** — Fix `/habit add` tidak menyimpan data (`saveHabits(loadHabits())` diganti ke `loadUser()` pattern yang benar)
- **CRITICAL** — Tambah `dotenv` ke dependencies dan `require('dotenv').config()` — token sebelumnya tidak pernah terbaca dari `.env`
- **CRITICAL** — Bot sekarang exit dengan pesan jelas jika `TELEGRAM_BOT_TOKEN` kosong
- Fix `userData.archive` crash pada user lama yang tidak punya field `archive` — auto-inisialisasi sekarang
- Fix `calculateStreak()` tidak validasi apakah target per hari terpenuhi — sekarang cek `count >= target`
- Fix `getStats()` tidak validasi target per hari
- Fix `/habit history` menggunakan `slice(-days)` yang tidak akurat — sekarang pakai loop kalender
- Fix status ikon di `/habits` menggunakan `includes()` bukan validasi count
- Fix `generateId()` tidak menghitung ID dari arsip — bisa menyebabkan ID collision

### ✨ New Features
- `/habit unarchive <nama|id>` — pulihkan habit dari arsip (sebelumnya tidak ada handler)
- `/archives` — lihat semua habit yang diarsipkan
- `/habit reset <nama|id>` — hapus semua check-in sebuah habit
- Delete konfirmasi — `/habit delete` tampilkan tombol inline Ya/Batal sebelum hapus
- Keyboard `/check` otomatis update setelah check-in diklik
- Streak icons — 💤🔥⚡🏅🏆 berdasarkan panjang streak
- Notifikasi `🎉 Semua habit selesai!` di `/progress` jika semua target terpenuhi
- Hint `/habit` (tanpa sub-command) menampilkan daftar sub-command
- `SIGINT` handler — bot berhenti bersih saat `Ctrl+C`

### 📱 Commands (Lengkap v1.1.0)
- `/start` — Welcome message + daftar command
- `/help` — Panduan lengkap
- `/habits` / `/habit list` — List semua habit aktif
- `/check` — Check-in hari ini (inline buttons)
- `/progress` — Progress hari ini
- `/stats` — Statistik 7 hari
- `/habit add` — Tambah habit baru
- `/habit edit` — Edit habit
- `/habit delete` — Hapus habit (dengan konfirmasi) ✨ updated
- `/habit archive` — Arsipkan habit
- `/habit unarchive` — Pulihkan dari arsip ✨ baru
- `/archives` — Lihat daftar arsip ✨ baru
- `/habit reset` — Reset check-in ✨ baru
- `/habit history` — Lihat history per hari ✨ updated

---

## [1.0.0] - 2026-02-26

### ✨ Added
- Habit management (add, edit, delete, archive)
- Daily check-in with inline buttons
- Progress tracking with visual progress bar
- Weekly statistics
- Habit history view
- Multi-user support (automatic data separation)
- JSON file storage
- PM2 auto-start support

### 🎨 Features
- Custom emoji untuk setiap habit
- Daily target setting
- Streak counter
- Progress bar visualization `███░░`
- Command `/help` dengan panduan lengkap

### 🚀 Deployment
- Setup script untuk DigitalOcean droplet
- PM2 integration untuk auto-start
- Environment variable support

## 🚧 Roadmap (Coming Soon)

### [1.2.0]
- [ ] Daily reminder otomatis (cron job)
- [ ] Pesan motivasi pagi
- [ ] Statistik 30 hari
- [ ] Best streak per habit
- [ ] Milestone celebration (7, 14, 30, 100 hari)
- [ ] Level sistem (Beginner → Master)

### [2.0.0]
- [ ] Export/import data (CSV/JSON)
- [ ] Habit mingguan (X kali/minggu)
- [ ] Skip hari tanpa putus streak
- [ ] Database support (SQLite / PostgreSQL)
- [ ] Webhook support

---
