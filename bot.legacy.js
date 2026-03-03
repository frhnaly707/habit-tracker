// ================================================================
// FIX #1: require dotenv di paling atas sebelum proses env lainnya
// ================================================================
require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

// FIX #1 lanjutan: exit lebih awal dengan pesan jelas jika token kosong
if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN tidak ditemukan!');
  console.error('   Buat file .env dan isi: TELEGRAM_BOT_TOKEN=token_kamu');
  process.exit(1);
}

// Data file path
const DATA_DIR = path.join(__dirname, 'data');
const HABITS_FILE = path.join(DATA_DIR, 'habits.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load habits data
function loadHabits() {
  try {
    if (fs.existsSync(HABITS_FILE)) {
      return JSON.parse(fs.readFileSync(HABITS_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading habits:', error);
  }
  return {};
}

// Save habits data
function saveHabits(habits) {
  try {
    fs.writeFileSync(HABITS_FILE, JSON.stringify(habits, null, 2));
  } catch (error) {
    console.error('Error saving habits:', error);
  }
}

// Create bot
const bot = new TelegramBot(TOKEN, { polling: true });

// ================================================================
// FIX #3: initUser sekarang return [habits, userData] agar caller
// bisa langsung saveHabits(habits) tanpa loadHabits() ulang.
// Juga guard field archive untuk user lama yang tidak punya field itu.
// ================================================================
function initUser(userId) {
  const habits = loadHabits();
  let changed = false;

  if (!habits[userId]) {
    habits[userId] = {
      habits: [],
      archive: [],
      createdAt: new Date().toISOString()
    };
    changed = true;
  }

  // FIX #3b: guard archive field untuk user lama
  if (!habits[userId].archive) {
    habits[userId].archive = [];
    changed = true;
  }

  if (changed) saveHabits(habits);
  return habits[userId];
}

// Versi baru initUser yang return object habits global juga (untuk handler yang perlu save)
function loadUser(userId) {
  const habits = loadHabits();
  if (!habits[userId]) {
    habits[userId] = {
      habits: [],
      archive: [],
      createdAt: new Date().toISOString()
    };
  }
  if (!habits[userId].archive) {
    habits[userId].archive = [];
  }
  return { habits, userData: habits[userId] };
}

// FIX #8: generateId sekarang cek archived habits juga agar tidak ada ID collision
function generateId(userData) {
  const allHabits = [...userData.habits, ...(userData.archive || [])];
  const maxId = allHabits.reduce((max, h) => Math.max(max, h.id || 0), 0);
  return maxId + 1;
}

// Find habit by name or ID (active list)
function findHabit(userId, identifier) {
  const userData = initUser(userId);
  const trimmed = identifier.trim();

  if (!isNaN(trimmed) && trimmed !== '') {
    return userData.habits.find(h => h.id === parseInt(trimmed));
  }

  return userData.habits.find(h =>
    h.name.toLowerCase() === trimmed.toLowerCase() ||
    h.name.toLowerCase().includes(trimmed.toLowerCase())
  );
}

// Find habit in archive by name or ID
function findArchivedHabit(userId, identifier) {
  const userData = initUser(userId);
  const trimmed = identifier.trim();

  if (!isNaN(trimmed) && trimmed !== '') {
    return userData.archive.find(h => h.id === parseInt(trimmed));
  }

  return userData.archive.find(h =>
    h.name.toLowerCase() === trimmed.toLowerCase() ||
    h.name.toLowerCase().includes(trimmed.toLowerCase())
  );
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getProgressBar(current, target) {
  const percent = Math.min(100, Math.max(0, (current / target) * 100));
  const filled = Math.floor(percent / 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

// Ikon streak berdasarkan panjang streak
function getStreakIcon(streak) {
  if (streak >= 30) return '🏆';
  if (streak >= 14) return '🏅';
  if (streak >= 7) return '⚡';
  if (streak >= 1) return '🔥';
  return '💤';
}

// ================================================================
// FIX #4: calculateStreak sekarang menerima parameter target dan
// menghitung hari selesai hanya jika count check-in >= target.
// Juga fix edge case: hari ini belum selesai → mulai dari kemarin.
// ================================================================
function calculateStreak(checkins, target = 1) {
  if (!checkins || checkins.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // Jika hari ini sudah memenuhi target, mulai hitung dari hari ini
  // Jika belum, mulai hitung dari kemarin agar streak tidak putus
  const todayCount = checkins.filter(d => d === todayStr).length;
  const startOffset = todayCount >= target ? 0 : 1;

  for (let i = startOffset; i < 365; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const count = checkins.filter(d => d === dateStr).length;

    if (count >= target) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// ================================================================
// FIX #5: getStats sekarang terima parameter target dan validasi
// apakah jumlah check-in per hari memenuhi target, bukan sekadar ada.
// ================================================================
function getStats(checkins, target = 1, days = 7) {
  const stats = { completed: 0, total: days };
  const today = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const count = checkins.filter(d => d === dateStr).length;
    if (count >= target) {
      stats.completed++;
    }
  }

  return stats;
}

// Build keyboard /check — helper agar bisa dipakai untuk update message
function buildCheckKeyboard(userData) {
  const today = getToday();
  return userData.habits.map(habit => {
    const count = habit.checkins.filter(d => d === today).length;
    const done = count >= habit.target;
    return [{
      text: `${done ? '✅' : '⬜'} ${habit.emoji} ${habit.name} (${count}/${habit.target})`,
      callback_data: `check_${habit.id}`
    }];
  });
}

// ==================== COMMAND HANDLERS ====================

// /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  initUser(userId);

  bot.sendMessage(chatId,
    `🎯 *Habit Tracker Bot*\n\n` +
    `Selamat datang! Bot ini membantu kamu membangun habit baru dan tetap konsisten.\n\n` +
    `📋 *Commands:*\n` +
    `/habit add "nama" --target X --emoji 🎯\n` +
    `/habits - Lihat semua habit\n` +
    `/check - Check-in hari ini\n` +
    `/progress - Progress hari ini\n` +
    `/stats - Statistik mingguan\n` +
    `/habit edit - Edit habit\n` +
    `/habit delete - Hapus habit\n` +
    `/habit archive - Arsipkan habit\n` +
    `/archives - Lihat arsip\n` +
    `/habit unarchive - Pulihkan dari arsip\n` +
    `/habit reset - Reset check-in habit\n` +
    `/help - Bantuan lengkap`,
    { parse_mode: 'Markdown' }
  );
});

// /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId,
    `📖 *Panduan Habit Tracker*\n\n` +
    `🆕 *Tambah Habit:*\n` +
    `/habit add "Nama Habit"\n` +
    `/habit add "Baca buku" --target 30 --emoji 📚\n\n` +
    `✅ *Check-in:*\n` +
    `/check - Pilih habit dari tombol inline\n\n` +
    `📊 *Lihat Habit:*\n` +
    `/habits - List semua habit aktif\n` +
    `/progress - Progress hari ini\n` +
    `/stats - Statistik 7 hari\n\n` +
    `✏️ *Edit Habit:*\n` +
    `/habit edit <nama|id> --name "baru"\n` +
    `/habit edit <nama|id> --target 5\n` +
    `/habit edit <nama|id> --emoji 📖\n\n` +
    `🗑️ *Hapus/Arsip:*\n` +
    `/habit delete <nama|id> - Hapus (ada konfirmasi)\n` +
    `/habit archive <nama|id> - Pindah ke arsip\n` +
    `/habit unarchive <nama|id> - Pulihkan dari arsip\n` +
    `/archives - Lihat semua arsip\n\n` +
    `🔄 *Reset:*\n` +
    `/habit reset <nama|id> - Hapus semua check-in\n\n` +
    `📈 *History:*\n` +
    `/habit history <nama|id>\n` +
    `/habit history <nama|id> --days 14\n\n` +
    `💡 *Tips:* Streak 🔥 = 1-6 hari | ⚡ = 7-13 | 🏅 = 14-29 | 🏆 = 30+`,
    { parse_mode: 'Markdown' }
  );
});

// ================================================================
// FIX #2: /habit add sekarang load habits dulu, push ke dalamnya,
// BARU save — tidak lagi saveHabits(loadHabits()) yang membuang data.
// ================================================================
bot.onText(/\/habit\s+add\s+(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const args = match[1];

  const nameMatch = args.match(/"([^"]+)"/);
  const name = nameMatch ? nameMatch[1] : args.split('--')[0].trim();

  const targetMatch = args.match(/--target\s+(\d+)/);
  const emojiMatch = args.match(/--emoji\s+([\p{Emoji_Presentation}\p{Extended_Pictographic}]+)/u);

  const target = targetMatch ? parseInt(targetMatch[1]) : 1;
  const emoji = emojiMatch ? emojiMatch[1] : '✅';

  if (!name) {
    bot.sendMessage(chatId, '❌ Nama habit harus diisi!\nContoh: /habit add "Baca buku" --target 30 --emoji 📚');
    return;
  }

  // FIX: load habits global dulu, modifikasi, baru save
  const { habits, userData } = loadUser(userId);
  const habitId = generateId(userData);

  const newHabit = {
    id: habitId,
    name: name,
    emoji: emoji,
    target: target,
    checkins: [],
    createdAt: new Date().toISOString()
  };

  userData.habits.push(newHabit);
  saveHabits(habits); // ✅ save object yang sudah dimodifikasi

  bot.sendMessage(chatId,
    `✅ *Habit Ditambahkan!*\n\n` +
    `${emoji} ${name}\n` +
    `🎯 Target: ${target}x/hari\n` +
    `🆔 ID: ${habitId}`,
    { parse_mode: 'Markdown' }
  );
});

// /habits atau /habit list
bot.onText(/\/(habits|habit\s+list)/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const userData = initUser(userId);

  if (userData.habits.length === 0) {
    bot.sendMessage(chatId, '📭 Belum ada habit.\nKetik /habit add "Nama Habit" untuk membuat.');
    return;
  }

  const today = getToday();
  let message = '📋 *Daftar Habit Aktif*\n\n';

  userData.habits.forEach(habit => {
    // FIX #7: status ikon berdasarkan count >= target, bukan sekadar includes
    const todayCount = habit.checkins.filter(d => d === today).length;
    const isDoneToday = todayCount >= habit.target;
    const status = isDoneToday ? '✅' : '⬜';
    const streak = calculateStreak(habit.checkins, habit.target);
    const streakIcon = getStreakIcon(streak);

    message += `${status} ${habit.emoji} *${habit.name}* (ID: ${habit.id})\n`;
    message += `   ${streakIcon} Streak: ${streak} hari\n`;
    message += `   📊 Hari ini: ${todayCount}/${habit.target} ${getProgressBar(todayCount, habit.target)}\n\n`;
  });

  if (userData.archive && userData.archive.length > 0) {
    message += `_📦 ${userData.archive.length} habit di arsip — /archives_`;
  }

  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// /check
bot.onText(/\/check/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const userData = initUser(userId);

  if (userData.habits.length === 0) {
    bot.sendMessage(chatId, '📭 Belum ada habit.\nKetik /habit add "Nama Habit" untuk membuat.');
    return;
  }

  bot.sendMessage(chatId,
    '✅ *Check-in Hari Ini*\n\nPilih habit yang sudah kamu kerjakan:',
    {
      reply_markup: { inline_keyboard: buildCheckKeyboard(userData) },
      parse_mode: 'Markdown'
    }
  );
});

// ================================================================
// Handle callback queries (inline buttons)
// FIX #11: Setelah check-in, keyboard pada pesan /check ikut diperbarui
// ================================================================
bot.on('callback_query', (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;

  // --- Check-in button ---
  if (data.startsWith('check_')) {
    const habitId = parseInt(data.split('_')[1]);
    const { habits, userData } = loadUser(userId);
    const habit = userData.habits.find(h => h.id === habitId);

    if (!habit) {
      bot.answerCallbackQuery(callbackQuery.id, '❌ Habit tidak ditemukan.');
      return;
    }

    const today = getToday();
    const checkedToday = habit.checkins.filter(d => d === today).length;

    if (checkedToday < habit.target) {
      habit.checkins.push(today);
      saveHabits(habits);

      const newCount = checkedToday + 1;
      const streak = calculateStreak(habit.checkins, habit.target);
      const streakIcon = getStreakIcon(streak);

      bot.answerCallbackQuery(callbackQuery.id,
        `${habit.emoji} ${habit.name} (${newCount}/${habit.target}) ✅`
      );

      // FIX #11: update keyboard di pesan /check yang sudah ada
      bot.editMessageReplyMarkup(
        { inline_keyboard: buildCheckKeyboard(userData) },
        { chat_id: chatId, message_id: msg.message_id }
      ).catch(() => {}); // abaikan jika message terlalu lama

      bot.sendMessage(chatId,
        `✅ *Check-in Berhasil!*\n\n` +
        `${habit.emoji} ${habit.name}\n` +
        `📊 Hari ini: ${newCount}/${habit.target} ${getProgressBar(newCount, habit.target)}\n` +
        `${streakIcon} Streak: ${streak} hari`,
        { parse_mode: 'Markdown' }
      );
    } else {
      bot.answerCallbackQuery(callbackQuery.id, '⚠️ Target hari ini sudah tercapai!', { show_alert: true });
    }
    return;
  }

  // --- Konfirmasi delete: tombol Ya ---
  if (data.startsWith('delconfirm_')) {
    const habitId = parseInt(data.split('_')[1]);
    const { habits, userData } = loadUser(userId);
    const habitIndex = userData.habits.findIndex(h => h.id === habitId);

    if (habitIndex === -1) {
      bot.answerCallbackQuery(callbackQuery.id, '❌ Habit sudah tidak ada.');
      bot.editMessageText('❌ Habit tidak ditemukan atau sudah dihapus.',
        { chat_id: chatId, message_id: msg.message_id });
      return;
    }

    const deleted = userData.habits.splice(habitIndex, 1)[0];
    saveHabits(habits);

    bot.answerCallbackQuery(callbackQuery.id, '🗑️ Habit dihapus!');
    bot.editMessageText(
      `🗑️ *Habit Dihapus!*\n\n${deleted.emoji} ${deleted.name}\n📊 Total check-in: ${deleted.checkins.length} kali`,
      { chat_id: chatId, message_id: msg.message_id, parse_mode: 'Markdown' }
    );
    return;
  }

  // --- Konfirmasi delete: tombol Batal ---
  if (data.startsWith('delcancel_')) {
    bot.answerCallbackQuery(callbackQuery.id, 'Dibatalkan.');
    bot.editMessageText('❎ Penghapusan dibatalkan.',
      { chat_id: chatId, message_id: msg.message_id });
    return;
  }
});

// /progress
bot.onText(/\/progress/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const userData = initUser(userId);

  if (userData.habits.length === 0) {
    bot.sendMessage(chatId, '📭 Belum ada habit.\nKetik /habit add "Nama Habit" untuk membuat.');
    return;
  }

  const today = getToday();
  let message = `📊 *Progress Hari Ini*\n_${today}_\n\n`;

  let allDone = true;
  userData.habits.forEach(habit => {
    const checkedToday = habit.checkins.filter(d => d === today).length;
    const progress = getProgressBar(checkedToday, habit.target);
    const percent = Math.min(100, Math.round((checkedToday / habit.target) * 100));
    const done = checkedToday >= habit.target;
    if (!done) allDone = false;

    message += `${done ? '✅' : '⬜'} ${habit.emoji} ${habit.name}\n`;
    message += `${progress} ${checkedToday}/${habit.target} (${percent}%)\n\n`;
  });

  if (allDone) message += `🎉 *Semua habit selesai hari ini! Keren!*`;

  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// /stats
bot.onText(/\/stats/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const userData = initUser(userId);

  if (userData.habits.length === 0) {
    bot.sendMessage(chatId, '📭 Belum ada habit.\nKetik /habit add "Nama Habit" untuk membuat.');
    return;
  }

  let message = '📈 *Statistik (7 Hari Terakhir)*\n\n';

  userData.habits.forEach(habit => {
    // FIX #5: teruskan target ke getStats
    const stats = getStats(habit.checkins, habit.target, 7);
    const streak = calculateStreak(habit.checkins, habit.target);
    const streakIcon = getStreakIcon(streak);
    const percent = Math.round((stats.completed / stats.total) * 100);

    message += `${habit.emoji} *${habit.name}*\n`;
    message += `📊 Minggu ini: ${stats.completed}/7 hari (${percent}%)\n`;
    message += `${streakIcon} Streak: ${streak} hari\n\n`;
  });

  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// /habit edit
bot.onText(/\/habit\s+edit\s+(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const args = match[1];

  const identifier = args.split('--')[0].trim();
  const habit = findHabit(userId, identifier);

  if (!habit) {
    bot.sendMessage(chatId, `❌ Habit "${identifier}" tidak ditemukan.\nKetik /habits untuk melihat daftar.`);
    return;
  }

  const { habits, userData } = loadUser(userId);
  const habitIndex = userData.habits.findIndex(h => h.id === habit.id);

  const nameMatch = args.match(/--name\s+"([^"]+)"/);
  const targetMatch = args.match(/--target\s+(\d+)/);
  const emojiMatch = args.match(/--emoji\s+([\p{Emoji_Presentation}\p{Extended_Pictographic}]+)/u);

  let changed = false;

  if (nameMatch) { userData.habits[habitIndex].name = nameMatch[1]; changed = true; }
  if (targetMatch) { userData.habits[habitIndex].target = parseInt(targetMatch[1]); changed = true; }
  if (emojiMatch) { userData.habits[habitIndex].emoji = emojiMatch[1]; changed = true; }

  if (changed) {
    saveHabits(habits);
    const h = userData.habits[habitIndex];
    bot.sendMessage(chatId,
      `✅ *Habit Diperbarui!*\n\n${h.emoji} ${h.name}\n🎯 Target: ${h.target}x/hari\n🆔 ID: ${h.id}`,
      { parse_mode: 'Markdown' }
    );
  } else {
    bot.sendMessage(chatId,
      '⚠️ Tidak ada perubahan.\nOpsi: `--name "baru"` | `--target N` | `--emoji 🎯`',
      { parse_mode: 'Markdown' }
    );
  }
});

// ================================================================
// FIX #12: /habit delete sekarang minta konfirmasi dulu via inline buttons
// ================================================================
bot.onText(/\/habit\s+delete\s+(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const identifier = match[1].trim();

  const habit = findHabit(userId, identifier);

  if (!habit) {
    bot.sendMessage(chatId, `❌ Habit "${identifier}" tidak ditemukan.\nKetik /habits untuk melihat daftar.`);
    return;
  }

  bot.sendMessage(chatId,
    `⚠️ *Hapus Habit?*\n\n${habit.emoji} ${habit.name}\n📊 Total check-in: ${habit.checkins.length} kali\n\n_Aksi ini tidak bisa dibatalkan!_`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '🗑️ Ya, Hapus', callback_data: `delconfirm_${habit.id}` },
          { text: '❎ Batal', callback_data: `delcancel_${habit.id}` }
        ]]
      }
    }
  );
});

// /habit archive
bot.onText(/\/habit\s+archive\s+(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const identifier = match[1].trim();

  const habit = findHabit(userId, identifier);

  if (!habit) {
    bot.sendMessage(chatId, `❌ Habit "${identifier}" tidak ditemukan.\nKetik /habits untuk melihat daftar.`);
    return;
  }

  const { habits, userData } = loadUser(userId);
  const habitIndex = userData.habits.findIndex(h => h.id === habit.id);

  const archivedHabit = userData.habits.splice(habitIndex, 1)[0];
  archivedHabit.archivedAt = new Date().toISOString();
  userData.archive.push(archivedHabit); // FIX #3: archive sudah pasti ada karena loadUser/initUser guard
  saveHabits(habits);

  bot.sendMessage(chatId,
    `📦 *Habit Diarsipkan!*\n\n${archivedHabit.emoji} ${archivedHabit.name}\n📊 Total check-in: ${archivedHabit.checkins.length} kali\n\n💡 Pulihkan dengan: /habit unarchive ${archivedHabit.id}`,
    { parse_mode: 'Markdown' }
  );
});

// ================================================================
// FITUR BARU: /habit unarchive — pulihkan habit dari arsip
// ================================================================
bot.onText(/\/habit\s+unarchive\s+(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const identifier = match[1].trim();

  const habit = findArchivedHabit(userId, identifier);

  if (!habit) {
    bot.sendMessage(chatId, `❌ Habit "${identifier}" tidak ada di arsip.\nKetik /archives untuk melihat arsip.`);
    return;
  }

  const { habits, userData } = loadUser(userId);
  const archiveIndex = userData.archive.findIndex(h => h.id === habit.id);

  const restoredHabit = userData.archive.splice(archiveIndex, 1)[0];
  delete restoredHabit.archivedAt;
  userData.habits.push(restoredHabit);
  saveHabits(habits);

  bot.sendMessage(chatId,
    `✅ *Habit Dipulihkan!*\n\n${restoredHabit.emoji} ${restoredHabit.name}\n🎯 Target: ${restoredHabit.target}x/hari\n📊 Check-in tersimpan: ${restoredHabit.checkins.length} kali`,
    { parse_mode: 'Markdown' }
  );
});

// ================================================================
// FITUR BARU: /archives — lihat daftar habit yang diarsipkan
// ================================================================
bot.onText(/\/archives/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const userData = initUser(userId);

  if (!userData.archive || userData.archive.length === 0) {
    bot.sendMessage(chatId, '📭 Tidak ada habit di arsip.\nGunakan /habit archive <nama|id> untuk mengarsipkan.');
    return;
  }

  let message = '📦 *Daftar Arsip*\n\n';

  userData.archive.forEach(habit => {
    const archivedDate = habit.archivedAt ? habit.archivedAt.split('T')[0] : '-';
    message += `${habit.emoji} *${habit.name}* (ID: ${habit.id})\n`;
    message += `   📅 Diarsipkan: ${archivedDate}\n`;
    message += `   📊 Total check-in: ${habit.checkins.length} kali\n\n`;
  });

  message += `_Pulihkan: /habit unarchive <nama|id>_`;

  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// ================================================================
// FITUR BARU: /habit reset — reset semua check-in sebuah habit
// ================================================================
bot.onText(/\/habit\s+reset\s+(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const identifier = match[1].trim();

  const habit = findHabit(userId, identifier);

  if (!habit) {
    bot.sendMessage(chatId, `❌ Habit "${identifier}" tidak ditemukan.\nKetik /habits untuk melihat daftar.`);
    return;
  }

  const { habits, userData } = loadUser(userId);
  const h = userData.habits.find(h => h.id === habit.id);
  const oldCount = h.checkins.length;
  h.checkins = [];
  saveHabits(habits);

  bot.sendMessage(chatId,
    `🔄 *Check-in Direset!*\n\n${h.emoji} ${h.name}\n🗑️ ${oldCount} check-in dihapus.\nStreak kembali ke 0.`,
    { parse_mode: 'Markdown' }
  );
});

// ================================================================
// FIX #6: /habit history — recentCheckins sekarang berdasarkan
// kalender N hari terakhir, bukan slice(-days) dari array.
// ================================================================
bot.onText(/\/habit\s+history\s+(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const args = match[1];

  const identifier = args.split('--')[0].trim();
  const habit = findHabit(userId, identifier);

  if (!habit) {
    bot.sendMessage(chatId, `❌ Habit "${identifier}" tidak ditemukan.\nKetik /habits untuk melihat daftar.`);
    return;
  }

  const daysMatch = args.match(/--days\s+(\d+)/);
  const days = daysMatch ? Math.min(parseInt(daysMatch[1]), 30) : 7; // max 30 hari agar pesan tidak terlalu panjang

  // FIX: buat array tanggal kalender N hari terakhir
  const today = new Date();
  const calendarDays = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    calendarDays.push(d.toISOString().split('T')[0]);
  }

  // FIX #5 + #4: gunakan target yang benar di stats dan streak
  const stats = getStats(habit.checkins, habit.target, days);
  const streak = calculateStreak(habit.checkins, habit.target);

  let message = `📜 *History: ${habit.emoji} ${habit.name}*\n\n`;
  message += `📊 ${days} hari terakhir: ${stats.completed}/${days} hari selesai\n`;
  message += `${getStreakIcon(streak)} Streak saat ini: ${streak} hari\n`;
  message += `✅ Total check-in: ${habit.checkins.length} kali\n\n`;
  message += `📅 *Detail per hari:*\n`;

  calendarDays.forEach(dateStr => {
    const count = habit.checkins.filter(d => d === dateStr).length;
    const done = count >= habit.target;
    const bar = getProgressBar(count, habit.target);
    message += `${done ? '✅' : '⬜'} ${dateStr}  ${bar} ${count}/${habit.target}\n`;
  });

  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// Tangkap /habit tanpa sub-command → tampilkan hint
bot.onText(/^\/habit$/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '❓ Gunakan salah satu sub-command:\n\n' +
    '`/habit add` | `edit` | `delete` | `archive` | `unarchive` | `reset` | `history` | `list`',
    { parse_mode: 'Markdown' }
  );
});

// Error handling
bot.on('polling_error', (error) => {
  if (error.code === 'ETELEGRAM' && error.message.includes('terminated by other')) return;
  console.error(`Polling error [${error.code}]: ${error.message}`);
});

process.on('SIGINT', () => {
  console.log('\n👋 Bot dihentikan.');
  bot.stopPolling();
  process.exit(0);
});

// Start message
console.log('🚀 Habit Tracker Bot is running...');
console.log(`📱 Token: ${TOKEN.substring(0, 10)}...`);
