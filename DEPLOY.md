# 🚀 Deploy ke DigitalOcean Droplet

Panduan deploy Habit Tracker Bot v1.1.0 ke droplet DigitalOcean.

## 📋 Prasyarat

- Akses SSH ke droplet DigitalOcean
- Token bot dari [@BotFather](https://t.me/BotFather)
- Node.js >= 16 di droplet

## 🚀 Langkah Deploy

### 1. SSH ke Droplet

```bash
ssh root@your-droplet-ip
```

### 2. Upload File ke Droplet

**Opsi A: Via GitHub (direkomendasikan)**

```bash
# Di lokal — push ke GitHub dulu
git add .
git commit -m "update: v1.1.0 fixes and new features"
git push origin main

# Di droplet — pull dari GitHub
cd ~/habit-tracker
git pull origin main
```

**Opsi B: Upload dengan SCP**

```bash
# Di lokal komputer:
scp -r /path/to/habit-tracker-main/* root@your-droplet-ip:~/habit-tracker/
```

**Opsi C: Copy manual file**

File yang perlu di-copy:
- `bot.js`
- `package.json`
- `.env.example`
- `.gitignore`
- `setup.sh`

### 3. Setup di Droplet

```bash
cd ~/habit-tracker

# Install dependencies (termasuk dotenv yang baru)
npm install

# Atau gunakan setup script otomatis:
chmod +x setup.sh
./setup.sh
```

Setup script akan:
- ✅ Cek dan install Node.js
- ✅ Install semua dependencies (`node-telegram-bot-api` + `dotenv`)
- ✅ Setup PM2 (opsional)
- ✅ Start bot otomatis

### 4. Edit Token Bot

```bash
nano .env
```

Masukkan token bot:
```
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

Save: `Ctrl+O`, `Enter`, `Ctrl+X`

### 5. Start Bot

**Manual:**
```bash
npm start
```

**Dengan PM2 (auto-start):**
```bash
pm2 start bot.js --name habit-bot
pm2 save
pm2 startup
```

### 6. Verify Bot

1. Buka Telegram
2. Cari bot yang kamu buat
3. Send `/start`
4. Seharusnya bot merespon dengan welcome message

## 🔧 Management

### Cek Status

```bash
pm2 status
```

### Lihat Logs

```bash
pm2 logs habit-bot
```

### Restart Bot

```bash
pm2 restart habit-bot
```

### Stop Bot

```bash
pm2 stop habit-bot
```

### Delete Bot dari PM2

```bash
pm2 delete habit-bot
```

## 📊 Backup Data

Data tersimpan di `data/habits.json`. Backup secara berkala:

```bash
cp data/habits.json backups/habits-$(date +%Y%m%d).json
```

## 🔒 Security

- File `.env` berisi token bot sensitif
- Jangan commit `.env` ke version control
- Set permissions: `chmod 600 .env`

## 🐛 Troubleshooting

### Bot tidak merespon

1. Cek token di `.env` sudah benar
2. Cek log: `pm2 logs habit-bot`
3. Restart: `pm2 restart habit-bot`

### `EFATAL: AggregateError` — bot baru tidak bisa connect

Penyebab: **2 instance bot berjalan dengan token yang sama.**

```bash
# Cek apakah bot lama masih jalan
pm2 status

# Stop dulu sebelum jalankan ulang
pm2 stop habit-bot
pm2 start bot.js --name habit-bot
```

### `❌ TELEGRAM_BOT_TOKEN tidak ditemukan!`

```bash
# Pastikan .env ada dan berisi token
cat .env

# Jika belum ada:
cp .env.example .env
nano .env
# Isi: TELEGRAM_BOT_TOKEN=token_kamu
```

### `Cannot find module 'dotenv'`

```bash
npm install
pm2 restart habit-bot
```

### Port conflict

Bot menggunakan polling method, tidak perlu port publik.

### Droplet out of memory

```bash
pm2 start bot.js --name habit-bot --max-memory-restart 200M
```

## 📱 Multi-user Deployment

Bot ini sudah multi-user ready. Untuk deploy multi-instance:

1. Deploy instance lain di droplet yang sama
2. Gunakan port berbeda (kalau pakai webhook)
3. Gunakan file data terpisah

## 🔄 Update Bot (setelah ada perubahan kode)

```bash
# SSH ke droplet
ssh root@your-droplet-ip

# Pull update terbaru
cd ~/habit-tracker
git pull origin main

# Install dependency baru jika ada
npm install

# Restart bot
pm2 restart habit-bot

# Verifikasi berjalan normal
pm2 logs habit-bot --lines 20
```

## 🎯 Scaling

Jika ingin scale ke banyak users:

- **< 100 users:** JSON file sudah cukup
- **100–1000 users:** Migrasi ke SQLite (`better-sqlite3`) — file-based, tanpa server
- **> 1000 users:** PostgreSQL atau MongoDB

---

**Bot siap pakai!** 🚀

Test bot dan share ke teman-temanmu!
