# 🎯 Habit Tracker Telegram Bot

Bot Telegram untuk membantu teman-teman membangun kebiasaan baru dan menjaga disiplin.

## ✨ Features

- **Tambah Habit Baru** — `/habit add "Nama habit"`
- **List Semua Habit** — `/habits` atau `/habit list`
- **Check-in Daily** — `/check` (tombol inline, auto-update count)
- **Progress Hari Ini** — `/progress` (progress bar visual + notif semua selesai)
- **Statistik** — `/stats` (mingguan, validasi target per hari)
- **Edit Habit** — `/habit edit <nama|id> --option value`
- **Delete Habit** — `/habit delete <nama|id>` (dengan konfirmasi)
- **Archive Habit** — `/habit archive <nama|id>`
- **Lihat Arsip** — `/archives`
- **Pulihkan Arsip** — `/habit unarchive <nama|id>`
- **Reset Check-in** — `/habit reset <nama|id>`
- **History Habit** — `/habit history <nama|id> --days 7` (kalender per hari)
- **Streak Icons** — 🔥⚡🏅🏆 berdasarkan panjang streak

## 🚀 Quick Start

### 1. Install Node.js (jika belum ada)

```bash
# Via NVM (direkomendasikan, tanpa sudo)
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment

Copy `.env.example` ke `.env`:

```bash
cp .env.example .env
nano .env
```

Masukkan token bot dari [@BotFather](https://t.me/BotFather):

```
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

### 4. Run Bot

```bash
npm start
```

Output yang benar:
```
🚀 Habit Tracker Bot is running...
📱 Token: 123456789...
```

> ⚠️ Jika muncul `EFATAL: AggregateError` — pastikan tidak ada instance bot lain yang berjalan dengan token yang sama (misalnya di server).

## 📋 Commands Guide

### Habit Management

**Tambah Habit:**
```
/habit add "Boxing" --emoji 🥊
/habit add "Baca buku" --target 2 --emoji 📚
```
> `--target` = jumlah check-in per hari (default: 1)

**List Habit:**
```
/habits
/habit list
```

**Check-in:**
```
/check
```
Bot tampilkan tombol inline. Tombol otomatis update count setelah diklik.

**Progress:**
```
/progress
```
Contoh output:
```
📊 Progress Hari Ini
2026-03-03

✅ 🥊 Boxing
██████████ 2/2 (100%)

⬜ 📚 Baca buku
█████░░░░░ 1/2 (50%)

🎉 Semua habit selesai hari ini! Keren!  ← muncul jika semua selesai
```

**Statistik:**
```
/stats
```
Menampilkan statistik 7 hari untuk setiap habit, termasuk streak dan completion rate.

**Edit Habit:**
```
/habit edit 1 --name "Boxing Malam"
/habit edit "Boxing" --target 3
/habit edit 1 --emoji 🥋
```

**Hapus Habit** (ada konfirmasi Ya/Batal):
```
/habit delete 1
/habit delete "Boxing"
```

**Archive Habit:**
```
/habit archive 1
/habit archive "Boxing"
```

**Lihat Arsip:**
```
/archives
```

**Pulihkan dari Arsip:**
```
/habit unarchive 1
/habit unarchive "Boxing"
```

**Reset Check-in:**
```
/habit reset 1
/habit reset "Boxing"
```
Menghapus semua riwayat check-in, streak kembali ke 0.

**History:**
```
/habit history 1
/habit history "Boxing" --days 14
```
Contoh output:
```
📜 History: 🥊 Boxing

📊 7 hari terakhir: 5/7 hari selesai
🔥 Streak saat ini: 3 hari
✅ Total check-in: 24 kali

📅 Detail per hari:
✅ 2026-03-03  ██████████ 2/2
✅ 2026-03-02  ██████████ 2/2
⬜ 2026-03-01  █████░░░░░ 1/2
```

### System Commands

| Command | Fungsi |
|---|---|
| `/start` | Welcome message + daftar command |
| `/help` | Panduan lengkap |
| `/habits` | List semua habit aktif |
| `/check` | Check-in hari ini |
| `/progress` | Progress hari ini |
| `/stats` | Statistik 7 hari |
| `/archives` | Daftar habit yang diarsipkan |

## 💾 Data Structure

Data disimpan dalam `data/habits.json`:

```json
{
  "123456789": {
    "habits": [
      {
        "id": 1,
        "name": "Boxing",
        "emoji": "🥊",
        "target": 2,
        "checkins": ["2026-03-01", "2026-03-01", "2026-03-02", "2026-03-02"],
        "createdAt": "2026-02-26T00:00:00.000Z"
      }
    ],
    "archive": [
      {
        "id": 2,
        "name": "Lari Pagi",
        "emoji": "🏃",
        "target": 1,
        "checkins": ["2026-02-20"],
        "createdAt": "2026-02-20T00:00:00.000Z",
        "archivedAt": "2026-03-01T00:00:00.000Z"
      }
    ],
    "createdAt": "2026-02-26T00:00:00.000Z"
  }
}
```

> `checkins` menyimpan tanggal setiap check-in. Multi check-in per hari didukung untuk habit dengan `target > 1`.

## 🔄 Auto-start with PM2

Install PM2:
```bash
npm install -g pm2
```

Start bot:
```bash
pm2 start bot.js --name habit-bot
pm2 save
pm2 startup
```

Monitor:
```bash
pm2 logs habit-bot
pm2 status
```

## 🎨 Customization

### Streak Icons

Di `bot.js`, fungsi `getStreakIcon()`:

| Streak | Icon |
|---|---|
| 0 hari | 💤 |
| 1–6 hari | 🔥 |
| 7–13 hari | ⚡ |
| 14–29 hari | 🏅 |
| 30+ hari | 🏆 |

### Progress Bar

Karakter bar ada di fungsi `getProgressBar()` di `bot.js`:
```javascript
return '█'.repeat(filled) + '░'.repeat(empty);
```

## 📱 Multi-User Support

Bot ini sudah mendukung multi-user otomatis. Setiap user Telegram akan memiliki data terpisah berdasarkan `chatId`.

## 🔒 Security

- Token bot disimpan dalam file `.env`
- Tidak disimpan dalam version control
- File `.env` tidak di-commit ke Git

## 🐛 Troubleshooting

**Bot tidak merespon:**
- Cek token di `.env` sudah benar
- Pastikan `npm install` sudah dijalankan
- Cek log: `pm2 logs habit-bot`

**`EFATAL: AggregateError` saat jalankan lokal:**
- Ada instance bot lain yang berjalan dengan token yang sama
- Stop bot di server dulu: `pm2 stop habit-bot` (via SSH ke droplet)
- Atau gunakan token bot berbeda untuk testing lokal

**`❌ TELEGRAM_BOT_TOKEN tidak ditemukan!`:**
- File `.env` belum dibuat atau token masih default
- Jalankan: `cp .env.example .env` lalu isi token yang benar

**Data hilang:**
- Data tersimpan di `data/habits.json`
- Backup berkala: `cp data/habits.json data/habits-backup-$(date +%Y%m%d).json`

**`Cannot read properties of undefined`:**
- Biasanya terjadi pada data user lama yang tidak punya field `archive`
- Sudah difix di v1.1.0 — field `archive` otomatis dibuat jika belum ada

## 📝 Roadmap

- [ ] Daily reminder otomatis (cron job jam tertentu)
- [ ] Pesan motivasi pagi
- [ ] Statistik `/stats 30` untuk 30 hari
- [ ] Best streak (rekor terpanjang per habit)
- [ ] Level sistem (Beginner → Master)
- [ ] Milestone celebration (7, 14, 30, 100 hari)
- [ ] Habit mingguan (target X kali/minggu)
- [ ] Skip hari tanpa putus streak
- [ ] Export data `/export` (JSON/CSV)
- [ ] Import data `/import`
- [ ] Catatan saat check-in
- [ ] Database support (SQLite / PostgreSQL)

## 👥 Contribute

Feel free to fork and modify for your needs!

---

Made with ❤️ by ZeroClaw
