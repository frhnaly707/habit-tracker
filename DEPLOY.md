# 🚀 Deploy ke Server (DigitalOcean / VPS)

Panduan deploy Lunero Habit Tracker Bot v2.0.0 ke server.

---

## 📋 Prasyarat

- Akses SSH ke server / droplet
- Token bot dari [@BotFather](https://t.me/BotFather)
- Telegram User ID kamu (cek via [@userinfobot](https://t.me/userinfobot))
- Node.js >= 18 di server

---

## 🚀 Langkah Deploy

### 1. SSH ke Server

```bash
ssh root@your-server-ip
```

### 2. Upload File ke Server

**Via GitHub (direkomendasikan):**

```bash
# Di lokal — push ke GitHub dulu
git add .
git commit -m "deploy: v2.0.0"
git push origin main

# Di server — clone atau pull
git clone https://github.com/USERNAME/REPO.git ~/habit-tracker
# Atau jika sudah ada:
cd ~/habit-tracker && git pull origin main
```

**Via SCP:**

```bash
scp -r /path/to/habit-tracker-main/* root@your-server-ip:~/habit-tracker/
```

### 3. Install Dependencies

```bash
cd ~/habit-tracker
npm install
```

### 4. Setup Environment

```bash
cp .env.example .env
nano .env
```

Isi `.env`:

```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
ADMIN_ID=123456789
```

> `ADMIN_ID` adalah Telegram User ID kamu untuk fitur `/broadcast`.
> Cara cek: kirim pesan ke [@userinfobot](https://t.me/userinfobot)

Set permission:
```bash
chmod 600 .env
```

### 5. Jalankan dengan PM2

```bash
npm install -g pm2
pm2 start bot.js --name habit-bot
pm2 save
pm2 startup
```

### 6. Verifikasi

```bash
pm2 status
pm2 logs habit-bot --lines 20
```

Buka Telegram → cari bot → kirim `/start` → tombol keyboard harus muncul di bawah chat.

---

## 🔧 Management

| Perintah | Fungsi |
|---|---|
| `pm2 status` | Cek status bot |
| `pm2 logs habit-bot` | Lihat log real-time |
| `pm2 restart habit-bot` | Restart bot |
| `pm2 stop habit-bot` | Stop bot |
| `pm2 delete habit-bot` | Hapus dari PM2 |

---

## 🔄 Update Bot

```bash
ssh root@your-server-ip
cd ~/habit-tracker

git pull origin main
npm install
pm2 restart habit-bot
pm2 logs habit-bot --lines 20
```

---

## 💾 Backup Database

Data tersimpan di `data/habits.db` (SQLite). Backup berkala:

```bash
cp data/habits.db data/habits-backup-$(date +%Y%m%d).db
```

---

## 🐛 Troubleshooting

**Bot tidak merespon:**
```bash
pm2 logs habit-bot
```

**`EFATAL: AggregateError` — conflict token:**
```bash
pm2 stop habit-bot
pm2 start bot.js --name habit-bot
```

**`❌ TELEGRAM_BOT_TOKEN tidak ditemukan!`:**
```bash
cat .env   # pastikan token terisi
```

**Tombol keyboard tidak muncul di user:**
- Minta user kirim `/menu` atau `/start`

**`Cannot find module`:**
```bash
npm install
pm2 restart habit-bot
```

**Out of memory:**
```bash
pm2 start bot.js --name habit-bot --max-memory-restart 200M
```

---

## 🔒 Keamanan

- Jangan commit `.env` ke Git
- `ADMIN_ID` hanya untuk satu user admin
- Gunakan token berbeda untuk testing lokal vs production

---

**Bot siap pakai!** 🚀
