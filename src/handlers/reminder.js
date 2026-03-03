'use strict';

const db = require('../db/index');
const { ensureUser, rateLimiter } = require('../utils/middleware');
const { getToday } = require('../utils/format');
const { reminderMenuKeyboard } = require('../utils/keyboard');

// Pending state for set reminder flow from button
const pendingReminderSet = new Map(); // userId -> true

// Motivation quotes
const QUOTES = [
  '💪 Konsistensi adalah kunci. Terus lanjutkan!',
  '🌱 Setiap hari kecil membentuk hasil besar.',
  '⚡ Mulai dari yang kecil, tapi mulai hari ini!',
  '🎯 Fokus pada progress, bukan kesempurnaan.',
  '🔥 Keberhasilan bukan kebetulan — itu kebiasaan.',
];

function register(bot) {
  // Tombol ⏰ Reminder — tampilkan menu inline
  bot.onText(/^⏰ Reminder$/, (msg) => {
    ensureUser(msg);
    bot.sendMessage(msg.chat.id, '⏰ *Menu Reminder*', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: reminderMenuKeyboard() }
    });
  });

  // Callback: rmenu_*
  bot.on('callback_query', async (query) => {
    if (!query.data.startsWith('rmenu_')) return;
    const userId = query.from.id;
    const chatId = query.message.chat.id;

    if (query.data === 'rmenu_status') {
      await bot.answerCallbackQuery(query.id);
      const r = db.prepare('SELECT * FROM reminders WHERE user_id=?').get(userId);
      if (!r) return bot.sendMessage(chatId, '⏰ Belum ada reminder. Tap "Set Reminder" untuk mengatur.');
      const status = r.is_active ? `✅ Aktif (${r.time})` : '🔕 Nonaktif';
      return bot.sendMessage(chatId, `⏰ Status reminder: ${status}`);
    }

    if (query.data === 'rmenu_off') {
      db.prepare('UPDATE reminders SET is_active=0 WHERE user_id=?').run(userId);
      await bot.answerCallbackQuery(query.id, { text: '🔕 Reminder dimatikan' });
      return bot.sendMessage(chatId, '🔕 Reminder dinonaktifkan.');
    }

    if (query.data === 'rmenu_set') {
      pendingReminderSet.set(userId, true);
      await bot.answerCallbackQuery(query.id);
      return bot.sendMessage(chatId,
        '⏰ Ketik waktu reminder dalam format *HH:MM* (24 jam):\n_Contoh:_ `07:00` atau `20:30`\n\nAtau ketik `batal` untuk membatalkan.',
        { parse_mode: 'Markdown' }
      );
    }
  });

  // Handle message input for set reminder flow
  bot.on('message', (msg) => {
    if (!msg.text) return;
    const userId = msg.from?.id;
    if (!userId || !pendingReminderSet.has(userId)) return;
    const chatId = msg.chat.id;

    if (msg.text.toLowerCase() === 'batal') {
      pendingReminderSet.delete(userId);
      return bot.sendMessage(chatId, '❎ Dibatalkan.');
    }

    const timeMatch = msg.text.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!timeMatch) {
      return bot.sendMessage(chatId, '❌ Format salah. Ketik waktu dalam format HH:MM, contoh: `08:00`', { parse_mode: 'Markdown' });
    }

    const h = parseInt(timeMatch[1]);
    const m = parseInt(timeMatch[2]);
    if (h > 23 || m > 59) {
      return bot.sendMessage(chatId, '❌ Waktu tidak valid. Gunakan format HH:MM (0-23 jam, 0-59 menit).');
    }

    const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    db.prepare(`
      INSERT INTO reminders(user_id, chat_id, time, is_active)
      VALUES(?, ?, ?, 1)
      ON CONFLICT(user_id) DO UPDATE SET chat_id=excluded.chat_id, time=excluded.time, is_active=1
    `).run(userId, chatId, time);

    pendingReminderSet.delete(userId);
    bot.sendMessage(chatId, `⏰ Reminder diaktifkan: *${time}* setiap hari.`, { parse_mode: 'Markdown' });
  });

  // /reminder <HH:MM>
  bot.onText(/^\/reminder\s+(\d{1,2}:\d{2})$/, (msg, match) => {
    const userId = ensureUser(msg);
    if (!rateLimiter(userId)) return;
    const chatId = msg.chat.id;
    const time = match[1].padStart(5, '0');

    const [h, m] = time.split(':').map(Number);
    if (h > 23 || m > 59) {
      return bot.sendMessage(chatId, '❌ Waktu tidak valid. Format: HH:MM (24 jam), contoh: 08:00');
    }

    db.prepare(`
      INSERT INTO reminders(user_id, chat_id, time, is_active)
      VALUES(?, ?, ?, 1)
      ON CONFLICT(user_id) DO UPDATE SET chat_id=excluded.chat_id, time=excluded.time, is_active=1
    `).run(userId, chatId, time);

    bot.sendMessage(chatId,
      `⏰ Reminder diaktifkan: *${time}* setiap hari.\nGunakan /reminder off untuk menonaktifkan.`,
      { parse_mode: 'Markdown' }
    );
  });

  // /reminder off
  bot.onText(/^\/reminder\s+off$/, (msg) => {
    const userId = ensureUser(msg);
    const chatId = msg.chat.id;
    db.prepare('UPDATE reminders SET is_active=0 WHERE user_id=?').run(userId);
    bot.sendMessage(chatId, '🔕 Reminder dinonaktifkan.');
  });

  // /reminder status
  bot.onText(/^\/reminder(?:\s+status)?$/, (msg) => {
    const userId = ensureUser(msg);
    const chatId = msg.chat.id;
    // Don't match if it's /reminder <time>
    if (msg.text.match(/^\/reminder\s+\d/)) return;

    const r = db.prepare('SELECT * FROM reminders WHERE user_id=?').get(userId);
    if (!r) return bot.sendMessage(chatId, '⏰ Belum ada reminder. Set dengan: /reminder HH:MM');

    const status = r.is_active ? `✅ Aktif (${r.time})` : '🔕 Nonaktif';
    bot.sendMessage(chatId, `⏰ Status reminder: ${status}\nGunakan /reminder HH:MM untuk mengubah waktu.`);
  });
}

/**
 * startScheduler — dipanggil dari bot.js setelah bot init.
 * Mengirim reminder harian dan quote motivasi.
 */
function startScheduler(bot, cron) {
  // Cek setiap menit
  cron.schedule('* * * * *', () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hh}:${mm}`;
    const today = getToday();

    const reminders = db.prepare(
      'SELECT * FROM reminders WHERE is_active=1 AND time=?'
    ).all(currentTime);

    for (const r of reminders) {
      const habits = db.prepare(
        'SELECT * FROM habits WHERE user_id=? AND is_archived=0'
      ).all(r.user_id);

      if (!habits.length) continue;

      const pending = habits.filter(h => {
        const count = db.prepare(
          'SELECT COUNT(*) as c FROM checkins WHERE habit_id=? AND date=?'
        ).get(h.id, today).c;
        return count < (h.target_per_day || 1);
      });

      // Get motivation quote
      const userRow = db.prepare('SELECT motivation_index FROM users WHERE id=?').get(r.user_id);
      const idx = (userRow?.motivation_index || 0) % QUOTES.length;
      const quote = QUOTES[idx];
      db.prepare('UPDATE users SET motivation_index=? WHERE id=?').run((idx + 1) % QUOTES.length, r.user_id);

      if (pending.length === 0) {
        bot.sendMessage(r.chat_id, `✅ Semua habit selesai hari ini! ${quote}`).catch(() => {});
      } else {
        const names = pending.map(h => `${h.emoji} ${h.name}`).join('\n• ');
        bot.sendMessage(r.chat_id,
          `⏰ *Reminder Habit* — ${today}\n\nBelum selesai:\n• ${names}\n\n${quote}`,
          { parse_mode: 'Markdown' }
        ).catch(() => {});
      }
    }
  });

  console.log('  ⏰ Scheduler started');
}

module.exports = { register, startScheduler };
