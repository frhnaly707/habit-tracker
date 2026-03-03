# 📝 Changelog

## [2.0.0] - 2026-03-04

### ✨ New Features
- **UI Berbasis Tombol** — Menu utama permanen di bawah chat menggunakan Reply Keyboard, user tidak perlu tahu format `/command` apapun
- **Tombol Statistik** — Tap 📈 Statistik → pilih periode (7/14/30/90 hari) via inline keyboard
- **Tombol Kelola Habit** — Semua operasi habit (tambah, edit, hapus, arsip, reset, reorder) dapat diakses lewat satu menu inline
- **Tombol Reminder** — Set, cek status, dan matikan reminder via inline keyboard; bot minta input waktu secara interaktif
- **Fitur Broadcast Admin** — `/broadcast <pesan>` untuk kirim pesan ke seluruh user (khusus admin via `ADMIN_ID` di `.env`)
- **`/menu`** — Command baru untuk memunculkan kembali keyboard utama kapan saja

### 🐛 Bug Fixes
- **Fix Tingkat di `/stats`** — Sebelumnya selalu menampilkan persentase "sepanjang masa" meskipun user memilih 7 hari; sekarang dihitung sesuai periode yang dipilih

### 🗑️ Removed
- Referensi Leaderboard dihapus dari roadmap (fitur tidak jadi diimplementasi)

### 🔧 Technical
- `src/utils/keyboard.js` — Ditambah `mainMenu`, `habitMenuKeyboard()`, `habitSelectKeyboard()`, `statsKeyboard()`, `reminderMenuKeyboard()`
- `src/handlers/broadcast.js` — File baru, handler broadcast admin
- `src/db/queries/users.js` — Ditambah `getAllUsers` query untuk keperluan broadcast
- `src/handlers/stats.js` — Ditambah helper `buildStatsText()`, callback `stats_N`, regex handler tombol `📈 Statistik`
- `src/handlers/checkin.js` — Regex diperluas menangkap tombol `✅ Check-in`
- `src/handlers/reminder.js` — Ditambah `reminderMenuKeyboard`, `pendingReminderSet` state, callback `rmenu_*`, message handler interaktif
- `bot.js` — Import `mainMenu`, combine regex `/start|/menu`, import & register `broadcastHandler`

---

## [1.1.0] - 2026-03-03

### 🐛 Bug Fixes
- **CRITICAL** — Fix `/habit add` tidak menyimpan data
- **CRITICAL** — Tambah `dotenv` ke dependencies, token sebelumnya tidak terbaca dari `.env`
- **CRITICAL** — Bot exit dengan pesan jelas jika `TELEGRAM_BOT_TOKEN` kosong
- Fix `userData.archive` crash pada user lama yang tidak punya field `archive`
- Fix `calculateStreak()` tidak validasi apakah target per hari terpenuhi
- Fix `getStats()` tidak validasi target per hari
- Fix `/habit history` menggunakan `slice(-days)` yang tidak akurat
- Fix status ikon di `/habits` menggunakan `includes()` bukan validasi count
- Fix `generateId()` tidak menghitung ID dari arsip

### ✨ New Features
- `/habit unarchive <nama|id>` — pulihkan habit dari arsip
- `/archives` — lihat semua habit yang diarsipkan
- `/habit reset <nama|id>` — hapus semua check-in sebuah habit
- Delete konfirmasi dengan tombol inline Ya/Batal
- Keyboard `/check` otomatis update setelah check-in diklik
- Streak icons — 💤🔥⚡🏅🏆 berdasarkan panjang streak
- Notifikasi `🎉 Semua habit selesai!` di `/progress`
- `SIGINT` handler — bot berhenti bersih saat `Ctrl+C`

---

## [1.0.0] - 2026-02-26

### ✨ Added
- Habit management (add, edit, delete, archive)
- Daily check-in dengan inline buttons
- Progress tracking dengan visual progress bar
- Weekly statistics
- Habit history view
- Multi-user support
- JSON file storage
- PM2 auto-start support
