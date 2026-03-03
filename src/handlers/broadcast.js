'use strict';

const { getAllUsers } = require('../db/queries/users');

const ADMIN_ID = parseInt(process.env.ADMIN_ID || '0', 10);

function register(bot) {
  // /broadcast <pesan> — kirim pesan ke semua user (admin only)
  bot.onText(/^\/broadcast\s+([\s\S]+)$/, async (msg, match) => {
    const senderId = msg.from?.id;

    if (!ADMIN_ID || senderId !== ADMIN_ID) {
      return bot.sendMessage(msg.chat.id, '⛔ Kamu tidak punya izin untuk menggunakan perintah ini.');
    }

    const message = match[1].trim();
    if (!message) {
      return bot.sendMessage(msg.chat.id, '⚠️ Pesan tidak boleh kosong.\nContoh: /broadcast Server akan maintenance pukul 22.00 malam ini.');
    }

    const users = getAllUsers.all();
    if (!users.length) {
      return bot.sendMessage(msg.chat.id, '📭 Belum ada user terdaftar.');
    }

    const broadcastText = `📢 *Pesan dari Admin*\n\n${message}`;
    let success = 0;
    let failed = 0;

    for (const user of users) {
      try {
        await bot.sendMessage(user.chat_id, broadcastText, { parse_mode: 'Markdown' });
        success++;
      } catch (err) {
        failed++;
        console.warn(`⚠️ Gagal kirim ke user ${user.id} (chat ${user.chat_id}): ${err.message}`);
      }
    }

    bot.sendMessage(
      msg.chat.id,
      `✅ Broadcast selesai.\n✉️ Terkirim: ${success} user\n❌ Gagal: ${failed} user`
    );
  });

  // /broadcast tanpa pesan — tampilkan cara penggunaan
  bot.onText(/^\/broadcast$/, (msg) => {
    const senderId = msg.from?.id;
    if (!ADMIN_ID || senderId !== ADMIN_ID) {
      return bot.sendMessage(msg.chat.id, '⛔ Kamu tidak punya izin untuk menggunakan perintah ini.');
    }
    bot.sendMessage(
      msg.chat.id,
      `📢 *Cara Penggunaan Broadcast*\n\n` +
      `/broadcast <pesan kamu>\n\n` +
      `Contoh:\n` +
      `/broadcast Server akan maintenance malam ini pukul 23.00\\. Mohon maaf atas ketidaknyamanannya\\.`,
      { parse_mode: 'Markdown' }
    );
  });
}

module.exports = { register };
