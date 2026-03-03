'use strict';

const habitQueries = require('../db/queries/habits');
const checkinQueries = require('../db/queries/checkins');
const { calculateStreak, getBestStreak, getStats } = require('../services/streak');
const { getUserLevel } = require('../services/gamification');
const { getProgressBar, getStreakIcon, formatDate, getToday } = require('../utils/format');
const { ensureUser, rateLimiter } = require('../utils/middleware');
const { statsKeyboard } = require('../utils/keyboard');

// ── Helper: render stats text ─────────────────────────────────────
function buildStatsText(userId, days) {
  const habits = habitQueries.findActive.all(userId);
  if (!habits.length) return null;

  let text = `📈 *Statistik ${days} Hari Terakhir*\n\n`;
  habits.forEach(h => {
    const target = h.target_per_day || 1;
    const stats = getStats(h.id, target, days);
    const streak = calculateStreak(h.id, target);
    const best = getBestStreak(h.id, target);
    const rate = stats.effective > 0 ? Math.round((stats.completed / stats.effective) * 100) : 0;
    const bar = getProgressBar(stats.completed, stats.effective || days);

    text += `${h.emoji} *${h.name}*\n`;
    text += `  ${bar} ${stats.completed}/${stats.effective} hari\n`;
    text += `  ${getStreakIcon(streak)} Streak: ${streak} | Best: ${best}\n`;
    text += `  Tingkat: ${rate}% (${days} hari terakhir)\n`;
    if (stats.skipped > 0) text += `  ⏭ ${stats.skipped} hari dilewati\n`;
    text += '\n';
  });
  return text;
}

function register(bot) {
  // /progress atau tombol 📊 Progress
  bot.onText(/^\/progress$|^📊 Progress$/, (msg) => {
    const userId = ensureUser(msg);
    if (!rateLimiter(userId)) return;
    const chatId = msg.chat.id;
    const today = getToday();

    const habits = habitQueries.findActive.all(userId);
    if (!habits.length) {
      return bot.sendMessage(chatId, '📭 Belum ada habit aktif.');
    }

    const level = getUserLevel(userId);
    let text = `📊 *Progress Hari Ini* — ${today}\n`;
    text += `Level: ${level.icon} ${level.name}\n\n`;

    let allDone = true;
    habits.forEach(h => {
      const count = checkinQueries.countByHabitAndDate.get(h.id, today).count;
      const target = h.target_per_day || 1;
      const done = count >= target;
      if (!done) allDone = false;
      const bar = getProgressBar(count, target);
      const streak = calculateStreak(h.id, target);
      text += `${done ? '✅' : '⬜'} *${h.emoji} ${h.name}*\n`;
      text += `  ${bar} ${count}/${target}\n`;
      text += `  ${getStreakIcon(streak)} Streak: ${streak} hari\n\n`;
    });

    if (allDone) text += '🎉 Semua habit selesai hari ini! Luar biasa!';

    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  });

  // Tombol 📈 Statistik — tampilkan pilihan periode
  bot.onText(/^📈 Statistik$/, (msg) => {
    ensureUser(msg);
    bot.sendMessage(msg.chat.id, '📈 *Pilih periode statistik:*', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: statsKeyboard() }
    });
  });

  // /stats [N] — statistik N hari
  bot.onText(/^\/stats(?:\s+(\d+))?$/, (msg, match) => {
    const userId = ensureUser(msg);
    if (!rateLimiter(userId)) return;
    const chatId = msg.chat.id;
    const days = Math.min(90, Math.max(1, parseInt(match[1] || '7')));
    const text = buildStatsText(userId, days);
    if (!text) return bot.sendMessage(chatId, '📭 Belum ada habit aktif.');
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  });

  // Callback: stats_<N> dari tombol inline
  bot.on('callback_query', async (query) => {
    if (!query.data.startsWith('stats_')) return;
    const days = Math.min(90, Math.max(1, parseInt(query.data.split('_')[1])));
    const userId = query.from.id;
    const chatId = query.message.chat.id;

    await bot.answerCallbackQuery(query.id);
    const text = buildStatsText(userId, days);
    if (!text) return bot.sendMessage(chatId, '📭 Belum ada habit aktif.');
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  });

  // /habit history <nama> [N]
  bot.onText(/^\/habit\s+history(?:\s+(.+?))?(?:\s+(\d+))?$/, (msg, match) => {
    const userId = ensureUser(msg);
    if (!rateLimiter(userId)) return;
    const chatId = msg.chat.id;
    const nameRaw = match[1];
    const days = Math.min(30, Math.max(1, parseInt(match[2] || '14')));

    if (!nameRaw) {
      return bot.sendMessage(chatId, '⚠️ Penggunaan: /habit history <nama> [jumlah hari]');
    }

    const name = nameRaw.replace(/\s+\d+$/, '').trim();
    const habit = habitQueries.findByName.get(userId, name, name, name);
    if (!habit) return bot.sendMessage(chatId, `❌ Habit "${name}" tidak ditemukan.`);

    const today = new Date();
    const target = habit.target_per_day || 1;
    const fromDate = new Date(today);
    fromDate.setDate(fromDate.getDate() - (days - 1));
    const fromStr = fromDate.toISOString().split('T')[0];

    const rows = checkinQueries.getStatsByRange.all(habit.id, fromStr);
    const countMap = {};
    rows.forEach(r => { countMap[r.date] = r.count; });

    let text = `📅 *${habit.emoji} ${habit.name}* — Riwayat ${days} Hari\n\n`;

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = countMap[dateStr] || 0;
      const done = count >= target;
      const isToday = dateStr === today.toISOString().split('T')[0];
      text += `${done ? '✅' : (isToday ? '⬜' : '❌')} ${formatDate(dateStr)}: ${count}/${target}\n`;
    }

    const streak = calculateStreak(habit.id, target);
    const best = getBestStreak(habit.id, target);
    text += `\n${getStreakIcon(streak)} Streak: ${streak} | Best: ${best}`;

    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  });
}

module.exports = { register };
