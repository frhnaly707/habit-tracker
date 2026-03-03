# 🎯 Lunero Habit Tracker Bot

Bot Telegram untuk membantu membangun kebiasaan baru dan menjaga konsistensi — dirancang untuk orang awam, cukup tap tombol tanpa perlu hafal perintah.

---

## ✨ Fitur

- **UI Berbasis Tombol** — Menu utama muncul otomatis di bawah keyboard, tidak perlu ketik `/command`
- **Check-in Harian** — Tap habit yang sudah dilakukan, auto-update hitungan
- **Progress Hari Ini** — Progress bar visual + notif semua selesai
- **Statistik Fleksibel** — Pilih periode 7, 14, 30, atau 90 hari; tingkat dihitung sesuai periode
- **Manajemen Habit** — Tambah, edit, hapus, arsipkan, salin, urutkan ulang
- **Streak & Badges** — Ikon streak 🔥⚡🏅🏆, sistem level, milestone badge
- **Reminder Harian** — Set jam reminder lewat tombol, tanpa ketik command
- **Export CSV** — Export semua data ke file CSV
- **Broadcast Admin** — Admin bisa kirim pesan ke semua user sekaligus
- **Multi-user** — Setiap user punya data terpisah secara otomatis
- **Database SQLite** — Data tersimpan via `better-sqlite3`

---

## 🚀 Quick Start

### 1. Install Node.js (jika belum ada)

```bash
# Via NVM (direkomendasikan)
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

```bash
cp .env.example .env
nano .env
```

Isi file `.env`:

```env
# Token bot dari @BotFather
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# Telegram User ID kamu sebagai admin (untuk /broadcast)
# Cara cek: kirim pesan ke @userinfobot di Telegram
ADMIN_ID=123456789
```

### 4. Jalankan Bot

```bash
npm start
```

---

## 🖥️ Tampilan UI

Saat user kirim `/start` atau `/menu`, muncul tombol permanen di bawah chat:

```
[✅ Check-in]     [📊 Progress  ]
[📈 Statistik]    [🏅 Badges    ]
[🎯 Kelola Habit] [⏰ Reminder  ]
[📤 Export]       [❔ Bantuan   ]
```

Setiap tombol memunculkan menu lebih lanjut — user cukup tap, tanpa perlu tahu format perintah apapun.

---

## 📋 Panduan Fitur

### ✅ Check-in
Tap **✅ Check-in** → Daftar habit hari ini muncul sebagai tombol. Tap habit yang sudah dilakukan. Tap lagi untuk undo.

### 📊 Progress
Tap **📊 Progress** → Ringkasan semua habit hari ini lengkap dengan progress bar dan streak.

### 📈 Statistik
Tap **📈 Statistik** → Pilih periode:

```
[7 Hari]  [14 Hari]
[30 Hari] [90 Hari]
```

Contoh output:
```
📈 Statistik 7 Hari Terakhir

🥊 Boxing
  ███████░░░ 5/6 hari
  🔥 Streak: 3 | Best: 7
  Tingkat: 83% (7 hari terakhir)
```

> Tingkat dihitung sesuai periode yang dipilih, bukan sepanjang masa.

### 🎯 Kelola Habit
Tap **🎯 Kelola Habit** → menu inline:

| Tombol | Fungsi |
|---|---|
| ➕ Tambah Habit | Ketik nama + emoji + target |
| 📋 Daftar Habit | Lihat semua habit aktif |
| ✏️ Edit | Pilih habit → ubah nama/emoji/target/kategori |
| 🗑️ Hapus | Pilih habit → konfirmasi Ya/Batal |
| 📦 Arsipkan | Pindahkan habit ke arsip |
| 📂 Lihat Arsip | Daftar habit yang diarsipkan |
| ♻️ Pulihkan Arsip | Kembalikan habit dari arsip |
| 🔄 Reset | Hapus semua check-in habit |
| ↕️ Urutkan Ulang | Atur urutan tampilan habit |

**Format tambah habit:**
```
Nama Habit 🎯 1
```
_(nama spasi emoji spasi target per hari)_

### ⏰ Reminder
Tap **⏰ Reminder** → menu inline:

| Tombol | Fungsi |
|---|---|
| ⏰ Set Reminder | Ketik waktu, misal `07:00` |
| 📋 Status | Cek apakah reminder aktif |
| 🔕 Matikan | Nonaktifkan reminder |

### 📤 Export
Tap **📤 Export** → Bot langsung kirim file `.csv` berisi semua data habit dan check-in.

### 🏅 Badges & Level

| Level | Syarat Streak |
|---|---|
| 🌱 Pemula | < 7 hari |
| 🔥 Konsisten | 7–13 hari |
| ⚡ Berdedikasi | 14–29 hari |
| 🏅 Ahli | 30–59 hari |
| 🏆 Master | 60+ hari |

---

## 📢 Broadcast Admin

Admin (sesuai `ADMIN_ID` di `.env`) bisa kirim pesan ke **seluruh user** sekaligus:

```
/broadcast Pesan kamu di sini
```

Contoh:
```
/broadcast Server akan maintenance malam ini pukul 23.00. Mohon maaf atas ketidaknyamanannya.
```

Bot melaporkan berapa user yang berhasil/gagal menerima pesan.

> Cara cek Telegram User ID: kirim pesan ke [@userinfobot](https://t.me/userinfobot)

---

## 🔄 Auto-start dengan PM2

```bash
npm install -g pm2
pm2 start bot.js --name habit-bot
pm2 save
pm2 startup
```

Monitor:
```bash
pm2 logs habit-bot
pm2 status
```

---

## 🗂️ Struktur Proyek

```
habit-tracker-main/
├── bot.js                    # Entry point, main menu, /start, /help, /menu
├── .env                      # Token bot & Admin ID (tidak di-commit)
├── .env.example              # Template environment
├── package.json
├── data/
│   └── habits.db             # Database SQLite
└── src/
    ├── db/
    │   ├── index.js
    │   ├── migrations/
    │   │   └── 001_init.sql
    │   └── queries/
    │       ├── habits.js
    │       ├── checkins.js
    │       └── users.js
    ├── handlers/
    │   ├── broadcast.js       # /broadcast (admin only)
    │   ├── checkin.js         # ✅ Check-in
    │   ├── habit.js           # 🎯 Kelola Habit
    │   ├── reminder.js        # ⏰ Reminder
    │   └── stats.js           # 📊 Progress, 📈 Statistik
    ├── services/
    │   ├── gamification.js
    │   └── streak.js
    └── utils/
        ├── format.js
        ├── keyboard.js        # Semua definisi keyboard (reply + inline)
        └── middleware.js
```

---

## 🔒 Keamanan

- Token bot dan Admin ID disimpan di `.env`
- `.env` tidak di-commit ke Git
- Set permission: `chmod 600 .env`

---

## 🐛 Troubleshooting

**Bot tidak merespon:**
- Cek token di `.env` sudah benar
- Pastikan `npm install` sudah dijalankan
- Cek log: `pm2 logs habit-bot`

**`EFATAL: AggregateError`:**
- Ada dua instance bot berjalan dengan token yang sama
- Stop dulu: `pm2 stop habit-bot`, lalu start ulang

**`❌ TELEGRAM_BOT_TOKEN tidak ditemukan!`:**
- Buat `.env` dari template: `cp .env.example .env`, lalu isi token

**Tombol tidak muncul:**
- Kirim `/menu` atau `/start` untuk memunculkan kembali keyboard

---

## 📝 Roadmap

- [ ] Habit mingguan (X kali/minggu)
- [ ] Skip hari tanpa putus streak
- [ ] Webhook support

---

Made with ❤️ by ZeroClaw
