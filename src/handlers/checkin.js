'use strict';

const db = require('../db/index');
const habitQueries = require('../db/queries/habits');
const checkinQueries = require('../db/queries/checkins');
const { calculateStreak, getBestStreak, getStats, getCompletionRate } = require('../services/streak');
const { checkMilestones, checkFirstCheckin, checkPerfectWeek, getBadgeCelebration } = require('../services/gamification');
const { buildCheckKeyboard } = require('../utils/keyboard');
const { getToday, getProgressBar, getStreakIcon } = require('../utils/format');
const { ensureUser, rateLimiter } = require('../utils/middleware');

function register(bot) {
  // /check atau tombol ✅ Check-in
  bot.onText(/^\/check$|^✅ Check-in$/, (msg) => {
    const userId = ensureUser(msg);
    if (!rateLimiter(userId)) return;
    const chatId = msg.chat.id;

    const habits = habitQueries.findActive.all(userId);
    if (!habits.length) {
      return bot.sendMessage(chatId, '📭 Belum ada habit aktif. Tambah dulu dengan /habit add <nama>');
    }

    const today = getToday();
    const keyboard = buildCheckKeyboard(habits);
    bot.sendMessage(chatId,
      `📅 *Check-in Hari Ini* — ${today}\n\nTap habit yang sudah kamu lakukan:`,
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } }
    );
  });

  // Callback: check_<habitId>
  bot.on('callback_query', async (query) => {
    if (!query.data.startsWith('check_')) return;
    const habitId = parseInt(query.data.split('_')[1]);
    const userId = query.from.id;
    const chatId = query.message.chat.id;
    const today = getToday();

    const habit = habitQueries.findById.get(habitId, userId);
    if (!habit) return bot.answerCallbackQuery(query.id, { text: '❌ Habit tidak ditemukan' });

    const target = habit.target_per_day || 1;
    const existing = checkinQueries.countByHabitAndDate.get(habitId, today).count;

    if (existing >= target) {
      // Toggle off (undo last checkin)
      db.prepare('DELETE FROM checkins WHERE habit_id=? AND date=? ORDER BY id DESC LIMIT 1').run(habitId, today);
      await bot.answerCallbackQuery(query.id, { text: `↩️ ${habit.name} dicek mundur` });
    } else {
      checkinQueries.insert.run(habitId, userId, today, null);

      const newCount = existing + 1;
      const badges = [];
      badges.push(...checkFirstCheckin(userId, habitId));

      if (newCount >= target) {
        const streak = calculateStreak(habitId, target);
        badges.push(...checkMilestones(userId, habitId, streak));
        const perfectWeek = checkPerfectWeek(userId);

        let text = `✅ *${habit.emoji} ${habit.name}* — Day ${streak} ${getStreakIcon(streak)}`;
        if (perfectWeek) text += '\n\n🌟 *Perfect Week diraih!* Semua habit 7 hari penuh!';
        if (badges.length > 0) {
          const msg = badges.map(b => `🏆 ${getBadgeCelebration(b)}`).join('\n');
          text += `\n\n${msg}`;
        }
        await bot.answerCallbackQuery(query.id, { text: `✅ ${habit.name} selesai! Streak: ${streak} ${getStreakIcon(streak)}`, show_alert: !!badges.length });

        if (badges.length > 0) {
          bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
        }
      } else {
        await bot.answerCallbackQuery(query.id, { text: `✔️ ${habit.name}: ${newCount}/${target}` });
      }
    }

    // Refresh keyboard
    const habits = habitQueries.findActive.all(userId);
    const keyboard = buildCheckKeyboard(habits);
    try {
      await bot.editMessageReplyMarkup(
        { inline_keyboard: keyboard },
        { chat_id: chatId, message_id: query.message.message_id }
      );
    } catch (_) {}
  });
}

module.exports = { register };
