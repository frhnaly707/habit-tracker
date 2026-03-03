'use strict';

const db = require('../db/index');
const habitQueries = require('../db/queries/habits');
const checkinQueries = require('../db/queries/checkins');
const { calculateStreak } = require('../services/streak');
const { getBadges, getUserLevel, getBadgeLabel } = require('../services/gamification');
const { buildConfirmKeyboard, buildReorderKeyboard, habitMenuKeyboard, habitSelectKeyboard } = require('../utils/keyboard');
const { getStreakIcon, getToday } = require('../utils/format');
const { ensureUser, rateLimiter } = require('../utils/middleware');

// Pending state for multi-step commands
const pendingEdits = new Map();   // userId -> { habitId, field }
const pendingAdds  = new Map();   // userId -> partial habit data

function register(bot) {
  // /habits or /habit list
  bot.onText(/^\/habits$|^\/habit\s+list$/, (msg) => {
    const userId = ensureUser(msg);
    const chatId = msg.chat.id;
    const today = getToday();

    const habits = habitQueries.findActive.all(userId);
    if (!habits.length) {
      return bot.sendMessage(chatId,
        '📭 Belum ada habit aktif.\nTambah dengan: `/habit add <nama>`',
        { parse_mode: 'Markdown' }
      );
    }

    const level = getUserLevel(userId);
    let text = `📋 *Habit Aktif* ${level.icon}(${level.name})\n\n`;
    habits.forEach((h, i) => {
      const count = checkinQueries.countByHabitAndDate.get(h.id, today).count;
      const target = h.target_per_day || 1;
      const streak = calculateStreak(h.id, target);
      text += `${i + 1}. ${count >= target ? '✅' : '⬜'} ${h.emoji} *${h.name}*`;
      if (h.category) text += ` _[${h.category}]_`;
      text += `\n    ${getStreakIcon(streak)} Streak ${streak} | Target: ${target}x/hari\n`;
    });

    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  });

  // /habit add <nama> [emoji] [target]
  bot.onText(/^\/habit\s+add\s+(.+)$/, (msg, match) => {
    const userId = ensureUser(msg);
    if (!rateLimiter(userId)) return;
    const chatId = msg.chat.id;

    const parts = match[1].trim().split(/\s+/);
    // Parse: first emoji-looking token = emoji, last number = target, rest = name
    const emojiRegex = /\p{Emoji_Presentation}/u;
    let emoji = '✅';
    let targetPerDay = 1;
    const filtered = [];

    for (const p of parts) {
      if (/^\d+$/.test(p)) { targetPerDay = Math.min(20, Math.max(1, parseInt(p))); }
      else if (emojiRegex.test(p)) { emoji = p; }
      else filtered.push(p);
    }

    const name = filtered.join(' ').trim();
    if (!name) return bot.sendMessage(chatId, '⚠️ Format: /habit add <nama> [emoji] [target]');

    // Check duplicate
    const existing = habitQueries.findByName.get(userId, name, name, name);
    if (existing) return bot.sendMessage(chatId, `❌ Habit "${name}" sudah ada!`);

    const result = habitQueries.insert.run({
      userId, name, emoji, targetPerDay, targetPerWeek: null, mode: 'daily', category: null
    });

    bot.sendMessage(chatId,
      `✅ Habit ditambahkan!\n\n${emoji} *${name}* — Target: ${targetPerDay}x/hari\nID: ${result.lastInsertRowid}`,
      { parse_mode: 'Markdown' }
    );
  });

  // /habit delete <nama|id>
  bot.onText(/^\/habit\s+delete\s+(.+)$/, (msg, match) => {
    const userId = ensureUser(msg);
    if (!rateLimiter(userId)) return;
    const chatId = msg.chat.id;
    const input = match[1].trim();

    const habit = findByInput(userId, input);
    if (!habit) return bot.sendMessage(chatId, `❌ Habit tidak ditemukan: "${input}"`);

    bot.sendMessage(chatId,
      `⚠️ Hapus habit *${habit.emoji} ${habit.name}*?\nSemua data check-in akan hilang permanen.`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buildConfirmKeyboard('del', habit.id) }
      }
    );
  });

  // /habit edit <nama|id>
  bot.onText(/^\/habit\s+edit\s+(.+)$/, (msg, match) => {
    const userId = ensureUser(msg);
    if (!rateLimiter(userId)) return;
    const chatId = msg.chat.id;
    const input = match[1].trim();

    const habit = findByInput(userId, input);
    if (!habit) return bot.sendMessage(chatId, `❌ Habit tidak ditemukan: "${input}"`);

    pendingEdits.set(userId, { habitId: habit.id, field: null, habit });
    bot.sendMessage(chatId,
      `✏️ Edit *${habit.emoji} ${habit.name}*\n\nKetik apa yang ingin diubah:\n` +
      `• \`name <nama baru>\`\n• \`emoji <emoji>\`\n• \`target <angka>\`\n• \`category <kategori>\`\n• \`cancel\``,
      { parse_mode: 'Markdown' }
    );
  });

  // /habit archive <nama|id>
  bot.onText(/^\/habit\s+archive\s+(.+)$/, (msg, match) => {
    const userId = ensureUser(msg);
    if (!rateLimiter(userId)) return;
    const chatId = msg.chat.id;
    const habit = findByInput(userId, match[1].trim());
    if (!habit) return bot.sendMessage(chatId, '❌ Habit tidak ditemukan.');
    habitQueries.archive.run(habit.id, userId);
    bot.sendMessage(chatId, `📦 *${habit.emoji} ${habit.name}* diarsipkan.`, { parse_mode: 'Markdown' });
  });

  // /habit unarchive <nama|id>
  bot.onText(/^\/habit\s+unarchive\s+(.+)$/, (msg, match) => {
    const userId = ensureUser(msg);
    if (!rateLimiter(userId)) return;
    const chatId = msg.chat.id;
    const input = match[1].trim();

    const habit = habitQueries.findArchivedByName.get(userId, input, input, input)
      || (isNumeric(input) ? db.prepare('SELECT * FROM habits WHERE id=? AND user_id=? AND is_archived=1').get(parseInt(input), userId) : null);

    if (!habit) return bot.sendMessage(chatId, '❌ Habit tidak ditemukan di arsip.');
    habitQueries.unarchive.run(habit.id, userId);
    bot.sendMessage(chatId, `♻️ *${habit.emoji} ${habit.name}* dipulihkan dari arsip.`, { parse_mode: 'Markdown' });
  });

  // /archives
  bot.onText(/^\/archives$/, (msg) => {
    const userId = ensureUser(msg);
    const chatId = msg.chat.id;
    const archived = habitQueries.findArchived.all(userId);
    if (!archived.length) return bot.sendMessage(chatId, '📭 Tidak ada habit yang diarsipkan.');

    let text = '📦 *Habit Terarsip*\n\n';
    archived.forEach((h, i) => {
      text += `${i + 1}. ${h.emoji} *${h.name}* (ID: ${h.id})\n`;
      text += `   Diarsipkan: ${h.archived_at?.split('T')[0] || '-'}\n`;
    });
    text += '\nGunakan `/habit unarchive <nama|id>` untuk memulihkan.';

    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  });

  // /habit reset <nama|id>
  bot.onText(/^\/habit\s+reset\s+(.+)$/, (msg, match) => {
    const userId = ensureUser(msg);
    if (!rateLimiter(userId)) return;
    const chatId = msg.chat.id;
    const habit = findByInput(userId, match[1].trim());
    if (!habit) return bot.sendMessage(chatId, '❌ Habit tidak ditemukan.');

    bot.sendMessage(chatId,
      `⚠️ Reset semua check-in *${habit.emoji} ${habit.name}*?\nStreak dan riwayat akan dihapus permanen.`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buildConfirmKeyboard('reset', habit.id) }
      }
    );
  });

  // /habit reorder
  bot.onText(/^\/habit\s+reorder$/, (msg) => {
    const userId = ensureUser(msg);
    const chatId = msg.chat.id;
    const habits = habitQueries.findActive.all(userId);
    if (habits.length < 2) return bot.sendMessage(chatId, 'Butuh minimal 2 habit untuk diurutkan ulang.');

    bot.sendMessage(chatId, '↕️ *Urut ulang habit* — tap tombol panah:',
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buildReorderKeyboard(habits, userId) }
      }
    );
  });

  // /habit copy <nama|id>
  bot.onText(/^\/habit\s+copy\s+(.+)$/, (msg, match) => {
    const userId = ensureUser(msg);
    if (!rateLimiter(userId)) return;
    const chatId = msg.chat.id;
    const habit = findByInput(userId, match[1].trim());
    if (!habit) return bot.sendMessage(chatId, '❌ Habit tidak ditemukan.');

    habitQueries.insert.run({
      userId, name: habit.name + ' (copy)', emoji: habit.emoji,
      targetPerDay: habit.target_per_day, targetPerWeek: habit.target_per_week,
      mode: habit.mode, category: habit.category
    });
    bot.sendMessage(chatId, `📋 Habit disalin: *${habit.emoji} ${habit.name} (copy)*`, { parse_mode: 'Markdown' });
  });

  // /badges atau tombol 🏅 Badges
  bot.onText(/^\/badges$|^🏅 Badges$/, (msg) => {
    const userId = ensureUser(msg);
    const chatId = msg.chat.id;
    const badges = getBadges(userId);

    if (!badges.length) {
      return bot.sendMessage(chatId, '🎖️ Belum ada badge. Mulai check-in untuk meraih yang pertama!');
    }

    let text = '🏆 *Badge Kamu*\n\n';
    const level = getUserLevel(userId);
    text += `Level: ${level.icon} ${level.name}\n`;
    if (level.next) text += `(${level.maxStreak}/${level.next} streak untuk naik level)\n`;
    text += '\n';

    badges.forEach(b => {
      const label = getBadgeLabel(b.badge_type);
      const habitTag = b.habit_name ? ` — ${b.habit_emoji} ${b.habit_name}` : '';
      text += `${label}${habitTag}\n  _Diraih: ${b.earned_at?.split('T')[0]}_\n\n`;
    });

    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  });

  // /export atau tombol 📤 Export
  bot.onText(/^\/export$|^📤 Export$/, (msg) => {
    const userId = ensureUser(msg);
    const chatId = msg.chat.id;

    const rows = db.prepare(`
      SELECT h.name, h.emoji, h.target_per_day, h.is_archived, h.created_at,
             c.date, c.note
      FROM habits h
      LEFT JOIN checkins c ON c.habit_id = h.id
      WHERE h.user_id=?
      ORDER BY h.id ASC, c.date ASC
    `).all(userId);

    if (!rows.length) return bot.sendMessage(chatId, '📭 Tidak ada data untuk diekspor.');

    // Build CSV
    let csv = 'habit_name,emoji,target_per_day,is_archived,created_at,check_date,note\n';
    rows.forEach(r => {
      csv += `"${r.name}","${r.emoji}",${r.target_per_day},${r.is_archived},"${r.created_at}","${r.date || ''}","${r.note || ''}"\n`;
    });

    const buf = Buffer.from(csv, 'utf8');
    bot.sendDocument(chatId, buf, {}, {
      filename: `habit_export_${new Date().toISOString().split('T')[0]}.csv`,
      contentType: 'text/csv'
    }).catch(() => bot.sendMessage(chatId, '❌ Gagal mengirim file.'));
  });

  // Tombol 🎯 Kelola Habit — tampilkan menu inline
  bot.onText(/^🎯 Kelola Habit$/, (msg) => {
    ensureUser(msg);
    bot.sendMessage(msg.chat.id, '🎯 *Kelola Habit*\nPilih aksi:', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: habitMenuKeyboard() }
    });
  });

  // Callback: delete, reset, reorder, hmenu, hpick
  bot.on('callback_query', async (query) => {
    const { data, from, message } = query;
    const userId = from.id;
    const chatId = message.chat.id;

    // ── Habit Menu ────────────────────────────────────────────────
    if (data === 'hmenu_add') {
      pendingAdds.set(userId, { step: 'waiting' });
      await bot.answerCallbackQuery(query.id);
      return bot.sendMessage(chatId,
        '➕ *Tambah Habit Baru*\n\nKetik nama habit, emoji, dan target (opsional):\n_Contoh:_ `Olahraga 🏃 1`\n\nAtau ketik `batal` untuk membatalkan.',
        { parse_mode: 'Markdown' }
      );
    }

    if (data === 'hmenu_list') {
      await bot.answerCallbackQuery(query.id);
      const habits = habitQueries.findActive.all(userId);
      if (!habits.length) return bot.sendMessage(chatId, '📭 Belum ada habit aktif.');
      const today = require('../utils/format').getToday();
      const level = getUserLevel(userId);
      let text = `📋 *Habit Aktif* ${level.icon}(${level.name})\n\n`;
      habits.forEach((h, i) => {
        const count = checkinQueries.countByHabitAndDate.get(h.id, today).count;
        const target = h.target_per_day || 1;
        const streak = calculateStreak(h.id, target);
        text += `${i + 1}. ${count >= target ? '✅' : '⬜'} ${h.emoji} *${h.name}*\n`;
        text += `    Streak ${streak} | Target: ${target}x/hari\n`;
      });
      return bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    }

    if (data === 'hmenu_edit') {
      await bot.answerCallbackQuery(query.id);
      const habits = habitQueries.findActive.all(userId);
      if (!habits.length) return bot.sendMessage(chatId, '📭 Belum ada habit aktif.');
      return bot.sendMessage(chatId, '✏️ Pilih habit yang ingin diedit:', {
        reply_markup: { inline_keyboard: habitSelectKeyboard(habits, 'edit') }
      });
    }

    if (data === 'hmenu_delete') {
      await bot.answerCallbackQuery(query.id);
      const habits = habitQueries.findActive.all(userId);
      if (!habits.length) return bot.sendMessage(chatId, '📭 Belum ada habit aktif.');
      return bot.sendMessage(chatId, '🗑️ Pilih habit yang ingin dihapus:', {
        reply_markup: { inline_keyboard: habitSelectKeyboard(habits, 'delete') }
      });
    }

    if (data === 'hmenu_archive') {
      await bot.answerCallbackQuery(query.id);
      const habits = habitQueries.findActive.all(userId);
      if (!habits.length) return bot.sendMessage(chatId, '📭 Belum ada habit aktif.');
      return bot.sendMessage(chatId, '📦 Pilih habit yang ingin diarsipkan:', {
        reply_markup: { inline_keyboard: habitSelectKeyboard(habits, 'archive') }
      });
    }

    if (data === 'hmenu_archives') {
      await bot.answerCallbackQuery(query.id);
      const archived = habitQueries.findArchived.all(userId);
      if (!archived.length) return bot.sendMessage(chatId, '📭 Tidak ada habit yang diarsipkan.');
      let text = '📦 *Habit Terarsip*\n\n';
      archived.forEach((h, i) => {
        text += `${i + 1}. ${h.emoji} *${h.name}*\n   Diarsipkan: ${h.archived_at?.split('T')[0] || '-'}\n`;
      });
      return bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    }

    if (data === 'hmenu_unarchive') {
      await bot.answerCallbackQuery(query.id);
      const archived = habitQueries.findArchived.all(userId);
      if (!archived.length) return bot.sendMessage(chatId, '📭 Tidak ada habit yang diarsipkan.');
      return bot.sendMessage(chatId, '♻️ Pilih habit yang ingin dipulihkan:', {
        reply_markup: { inline_keyboard: habitSelectKeyboard(archived, 'unarchive') }
      });
    }

    if (data === 'hmenu_reset') {
      await bot.answerCallbackQuery(query.id);
      const habits = habitQueries.findActive.all(userId);
      if (!habits.length) return bot.sendMessage(chatId, '📭 Belum ada habit aktif.');
      return bot.sendMessage(chatId, '🔄 Pilih habit yang ingin direset:', {
        reply_markup: { inline_keyboard: habitSelectKeyboard(habits, 'reset') }
      });
    }

    if (data === 'hmenu_reorder') {
      await bot.answerCallbackQuery(query.id);
      const habits = habitQueries.findActive.all(userId);
      if (habits.length < 2) return bot.sendMessage(chatId, 'Butuh minimal 2 habit untuk diurutkan ulang.');
      return bot.sendMessage(chatId, '↕️ *Urut ulang habit* — tap tombol panah:', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buildReorderKeyboard(habits) }
      });
    }

    // ── Habit Pick ───────────────────────────────────────────────
    if (data.startsWith('hpick_')) {
      const parts = data.split('_');
      const action = parts[1];
      const habitId = parseInt(parts[2]);
      const habit = db.prepare('SELECT * FROM habits WHERE id=? AND user_id=?').get(habitId, userId);
      if (!habit) return bot.answerCallbackQuery(query.id, { text: '❌ Habit tidak ditemukan' });

      if (action === 'edit') {
        pendingEdits.set(userId, { habitId: habit.id, field: null, habit });
        await bot.answerCallbackQuery(query.id);
        return bot.sendMessage(chatId,
          `✏️ Edit *${habit.emoji} ${habit.name}*\n\nKetik apa yang ingin diubah:\n` +
          `• \`name <nama baru>\`\n• \`emoji <emoji>\`\n• \`target <angka>\`\n• \`category <kategori>\`\n• \`cancel\``,
          { parse_mode: 'Markdown' }
        );
      }

      if (action === 'delete') {
        await bot.answerCallbackQuery(query.id);
        return bot.sendMessage(chatId,
          `⚠️ Hapus habit *${habit.emoji} ${habit.name}*?\nSemua data check-in akan hilang permanen.`,
          { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buildConfirmKeyboard('del', habit.id) } }
        );
      }

      if (action === 'archive') {
        habitQueries.archive.run(habit.id, userId);
        await bot.answerCallbackQuery(query.id, { text: '📦 Diarsipkan' });
        return bot.sendMessage(chatId, `📦 *${habit.emoji} ${habit.name}* diarsipkan.`, { parse_mode: 'Markdown' });
      }

      if (action === 'unarchive') {
        habitQueries.unarchive.run(habit.id, userId);
        await bot.answerCallbackQuery(query.id, { text: '♻️ Dipulihkan' });
        return bot.sendMessage(chatId, `♻️ *${habit.emoji} ${habit.name}* dipulihkan dari arsip.`, { parse_mode: 'Markdown' });
      }

      if (action === 'reset') {
        await bot.answerCallbackQuery(query.id);
        return bot.sendMessage(chatId,
          `⚠️ Reset semua check-in *${habit.emoji} ${habit.name}*?\nStreak dan riwayat akan dihapus permanen.`,
          { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buildConfirmKeyboard('reset', habit.id) } }
        );
      }

      return bot.answerCallbackQuery(query.id);
    }

    if (data.startsWith('delconfirm_')) {
      const habitId = parseInt(data.split('_')[1]);
      const habit = db.prepare('SELECT * FROM habits WHERE id=? AND user_id=?').get(habitId, userId);
      if (!habit) return bot.answerCallbackQuery(query.id, { text: '❌ Habit tidak ditemukan' });
      checkinQueries.deleteByHabit.run(habitId);
      habitQueries.remove.run(habitId, userId);
      await bot.editMessageText(`🗑️ *${habit.emoji} ${habit.name}* dihapus.`, {
        chat_id: chatId, message_id: message.message_id, parse_mode: 'Markdown'
      });
      return bot.answerCallbackQuery(query.id, { text: 'Dihapus.' });
    }

    if (data.startsWith('delcancel_')) {
      await bot.editMessageText('❎ Penghapusan dibatalkan.', {
        chat_id: chatId, message_id: message.message_id
      });
      return bot.answerCallbackQuery(query.id, { text: 'Dibatalkan.' });
    }

    if (data.startsWith('resetconfirm_')) {
      const habitId = parseInt(data.split('_')[1]);
      const habit = db.prepare('SELECT * FROM habits WHERE id=? AND user_id=?').get(habitId, userId);
      if (!habit) return bot.answerCallbackQuery(query.id, { text: '❌ Tidak ditemukan' });
      checkinQueries.deleteByHabit.run(habitId);
      await bot.editMessageText(`♻️ *${habit.emoji} ${habit.name}* direset.`, {
        chat_id: chatId, message_id: message.message_id, parse_mode: 'Markdown'
      });
      return bot.answerCallbackQuery(query.id, { text: 'Reset berhasil.' });
    }

    if (data.startsWith('resetcancel_')) {
      await bot.editMessageText('❎ Reset dibatalkan.', {
        chat_id: chatId, message_id: message.message_id
      });
      return bot.answerCallbackQuery(query.id, { text: 'Dibatalkan.' });
    }

    if (data.startsWith('reorder_up_') || data.startsWith('reorder_down_')) {
      const dir = data.startsWith('reorder_up_') ? 'up' : 'down';
      const habitId = parseInt(data.split('_').pop());
      const habits = habitQueries.findActive.all(userId);
      const idx = habits.findIndex(h => h.id === habitId);
      if (idx < 0) return bot.answerCallbackQuery(query.id, { text: 'Tidak ditemukan' });

      const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= habits.length) return bot.answerCallbackQuery(query.id);

      const swapTx = db.transaction(() => {
        habitQueries.updateSortOrder.run(habits[swapIdx].sort_order, habitId, userId);
        habitQueries.updateSortOrder.run(habits[idx].sort_order, habits[swapIdx].id, userId);
      });
      swapTx();

      const updated = habitQueries.findActive.all(userId);
      const keyboard = buildReorderKeyboard(updated, userId);
      try {
        await bot.editMessageReplyMarkup({ inline_keyboard: keyboard }, {
          chat_id: chatId, message_id: message.message_id
        });
      } catch (_) {}
      return bot.answerCallbackQuery(query.id, { text: dir === 'up' ? '⬆️ Naik' : '⬇️ Turun' });
    }
  });

  // Intercept plain messages for pending adds and edits
  bot.on('message', (msg) => {
    if (!msg.text) return;
    // skip button texts that are handled by onText
    const buttonTexts = ['✅ Check-in','📊 Progress','📈 Statistik','🏅 Badges','🎯 Kelola Habit','⏰ Reminder','📤 Export','❔ Bantuan'];
    if (buttonTexts.includes(msg.text)) return;
    const userId = msg.from?.id;
    if (!userId) return;
    const chatId = msg.chat.id;

    // ── Handle pendingAdds (from ➕ Tambah Habit button) ──────────
    if (pendingAdds.has(userId)) {
      pendingAdds.delete(userId);
      if (msg.text.toLowerCase() === 'batal') {
        return bot.sendMessage(chatId, '❎ Tambah habit dibatalkan.');
      }
      const parts = msg.text.trim().split(/\s+/);
      const emojiRegex = /\p{Emoji_Presentation}/u;
      let emoji = '✅';
      let targetPerDay = 1;
      const filtered = [];
      for (const p of parts) {
        if (/^\d+$/.test(p)) { targetPerDay = Math.min(20, Math.max(1, parseInt(p))); }
        else if (emojiRegex.test(p)) { emoji = p; }
        else filtered.push(p);
      }
      const name = filtered.join(' ').trim();
      if (!name) return bot.sendMessage(chatId, '⚠️ Nama habit tidak boleh kosong. Coba lagi dengan mengetik nama habit.');
      const existing = habitQueries.findByName.get(userId, name, name, name);
      if (existing) return bot.sendMessage(chatId, `❌ Habit "${name}" sudah ada!`);
      const result = habitQueries.insert.run({ userId, name, emoji, targetPerDay, targetPerWeek: null, mode: 'daily', category: null });
      return bot.sendMessage(chatId,
        `✅ Habit ditambahkan!\n\n${emoji} *${name}* — Target: ${targetPerDay}x/hari\nID: ${result.lastInsertRowid}`,
        { parse_mode: 'Markdown' }
      );
    }

    // ── Handle pendingEdits ───────────────────────────────────────
    if (!pendingEdits.has(userId)) return;
    if (msg.text.startsWith('/')) return; // let slash commands pass through
    const state = pendingEdits.get(userId);

    const parts = msg.text.trim().split(/\s+/);
    const field = parts[0].toLowerCase();
    const value = parts.slice(1).join(' ');

    if (field === 'cancel') {
      pendingEdits.delete(userId);
      return bot.sendMessage(chatId, '❎ Edit dibatalkan.');
    }

    const h = state.habit;
    let updated = { name: h.name, emoji: h.emoji, targetPerDay: h.target_per_day, category: h.category, mode: h.mode, restDays: h.rest_days, id: h.id, userId };

    if (field === 'name' && value) updated.name = value;
    else if (field === 'emoji' && value) updated.emoji = value.trim();
    else if (field === 'target') updated.targetPerDay = Math.max(1, Math.min(20, parseInt(value) || 1));
    else if (field === 'category') updated.category = value || null;
    else {
      return bot.sendMessage(chatId, '❓ Field tidak dikenali. Gunakan: name, emoji, target, category, atau cancel.');
    }

    habitQueries.update.run(updated);
    pendingEdits.delete(userId);
    bot.sendMessage(chatId,
      `✅ Habit diperbarui: *${updated.emoji} ${updated.name}*\nTarget: ${updated.targetPerDay}x/hari`,
      { parse_mode: 'Markdown' }
    );
  });

  // bare /habit
  bot.onText(/^\/habit$/, (msg) => {
    bot.sendMessage(msg.chat.id,
      '📖 *Perintah Habit*\n\n' +
      '`/habit add <nama> [emoji] [target]` — Tambah\n' +
      '`/habit list` — Daftar aktif\n' +
      '`/habit edit <nama|id>` — Edit\n' +
      '`/habit delete <nama|id>` — Hapus\n' +
      '`/habit archive <nama|id>` — Arsipkan\n' +
      '`/habit unarchive <nama|id>` — Pulihkan\n' +
      '`/habit reset <nama|id>` — Reset checkins\n' +
      '`/habit reorder` — Urutkan ulang\n' +
      '`/habit copy <nama|id>` — Salin habit\n' +
      '`/habit history <nama> [hari]` — Riwayat\n',
      { parse_mode: 'Markdown' }
    );
  });
}

// Helper: find by id or name
function findByInput(userId, input) {
  if (isNumeric(input)) {
    return db.prepare('SELECT * FROM habits WHERE id=? AND user_id=? AND is_archived=0').get(parseInt(input), userId);
  }
  return habitQueries.findByName.get(userId, input, input, input);
}

function isNumeric(str) {
  return /^\d+$/.test(str);
}

module.exports = { register };
