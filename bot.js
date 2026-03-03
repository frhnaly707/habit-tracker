'use strict';
require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');

// ── DB bootstrap (runs migrations automatically) ──────────────────
const db = require('./src/db/index');

// ── Handlers ──────────────────────────────────────────────────────
const habitHandler     = require('./src/handlers/habit');
const checkinHandler   = require('./src/handlers/checkin');
const statsHandler     = require('./src/handlers/stats');
const reminderHandler  = require('./src/handlers/reminder');
const broadcastHandler = require('./src/handlers/broadcast');

// ── Utils ─────────────────────────────────────────────────────────
const { ensureUser } = require('./src/utils/middleware');
const { mainMenu } = require('./src/utils/keyboard');

// ── Config ────────────────────────────────────────────────────────
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN tidak ditemukan!');
  console.error('   Buat file .env dan isi: TELEGRAM_BOT_TOKEN=token_kamu');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

console.log('🚀 Habit Tracker Bot running (v2.0.0)');
console.log(`   Token: ${TOKEN.substring(0, 10)}...`);

// ── Register all handlers ─────────────────────────────────────────
habitHandler.register(bot);
checkinHandler.register(bot);
statsHandler.register(bot);
reminderHandler.register(bot);
broadcastHandler.register(bot);

// ── Start scheduler ───────────────────────────────────────────────
reminderHandler.startScheduler(bot, cron);

// ── Core commands ─────────────────────────────────────────────────
const HELP_TEXT = `
🤖 *Lunero Habit Tracker* v2.0

Gunakan *tombol di bawah* untuk navigasi, atau ketik perintah:

✅ *Check-in* — Catat habit hari ini
📊 *Progress* — Ringkasan hari ini
📈 *Statistik* — Lihat statistik habit
🏅 *Badges* — Lihat badge & level
🎯 *Kelola Habit* — Tambah, edit, hapus habit
⏰ *Reminder* — Atur pengingat harian
📤 *Export* — Export data ke CSV
`.trim();

bot.onText(/^\/start$|^\/menu$/, (msg) => {
  ensureUser(msg);
  const name = msg.from?.first_name || 'Sobat';
  bot.sendMessage(msg.chat.id,
    `👋 Halo *${name}*! Selamat datang di Lunero Habit Tracker!\n\nGunakan tombol di bawah untuk mulai, atau ketik /help.`,
    { parse_mode: 'Markdown', reply_markup: mainMenu }
  );
});

bot.onText(/^\/help$|^❔ Bantuan$/, (msg) => {
  bot.sendMessage(msg.chat.id, HELP_TEXT, { parse_mode: 'Markdown', reply_markup: mainMenu });
});

// ── Global error handling ─────────────────────────────────────────
let pollingRetries = 0;
bot.on('polling_error', (err) => {
  if (err.code === 'EFATAL') {
    pollingRetries++;
    const delay = Math.min(3000 * pollingRetries, 15000);
    console.warn(`⚠️ Polling conflict (retry #${pollingRetries} dalam ${delay/1000}s)...`);
    setTimeout(() => {
      bot.stopPolling()
        .then(() => bot.startPolling())
        .catch(() => {});
    }, delay);
  } else {
    console.error('Polling error:', err.code, err.message);
  }
});

process.on('SIGINT', () => {
  console.log('\n⛔ Bot berhenti...');
  bot.stopPolling();
  process.exit(0);
});
