'use strict';

const { getToday } = require('./format');
const checkinQueries = require('../db/queries/checkins');

// ── Persistent Reply Keyboard (tombol bawah chat) ─────────────────
const mainMenu = {
  keyboard: [
    [{ text: '✅ Check-in' }, { text: '📊 Progress' }],
    [{ text: '📈 Statistik' }, { text: '🏅 Badges' }],
    [{ text: '🎯 Kelola Habit' }, { text: '⏰ Reminder' }],
    [{ text: '📤 Export' }, { text: '❔ Bantuan' }],
  ],
  resize_keyboard: true,
  persistent: true,
};

// ── Inline Keyboards ──────────────────────────────────────────────
function buildCheckKeyboard(habits) {
  const today = getToday();
  return habits.map(habit => {
    const count = checkinQueries.countByHabitAndDate.get(habit.id, today).count;
    const target = habit.target_per_day || 1;
    const done = count >= target;
    return [{
      text: `${done ? '✅' : '⬜'} ${habit.emoji} ${habit.name} (${count}/${target})`,
      callback_data: `check_${habit.id}`
    }];
  });
}

function buildConfirmKeyboard(action, habitId) {
  return [[
    { text: '✅ Ya', callback_data: `${action}confirm_${habitId}` },
    { text: '❎ Batal', callback_data: `${action}cancel_${habitId}` }
  ]];
}

function buildReorderKeyboard(habits) {
  return habits.map((habit, index) => {
    const row = [];
    if (index > 0) row.push({ text: '⬆️', callback_data: `reorder_up_${habit.id}` });
    row.push({ text: `${habit.emoji} ${habit.name}`, callback_data: `reorder_noop_${habit.id}` });
    if (index < habits.length - 1) row.push({ text: '⬇️', callback_data: `reorder_down_${habit.id}` });
    return row;
  });
}

function habitMenuKeyboard() {
  return [
    [{ text: '➕ Tambah Habit', callback_data: 'hmenu_add' }, { text: '📋 Daftar Habit', callback_data: 'hmenu_list' }],
    [{ text: '✏️ Edit', callback_data: 'hmenu_edit' }, { text: '🗑️ Hapus', callback_data: 'hmenu_delete' }],
    [{ text: '📦 Arsipkan', callback_data: 'hmenu_archive' }, { text: '📂 Lihat Arsip', callback_data: 'hmenu_archives' }],
    [{ text: '♻️ Pulihkan Arsip', callback_data: 'hmenu_unarchive' }, { text: '🔄 Reset', callback_data: 'hmenu_reset' }],
    [{ text: '↕️ Urutkan Ulang', callback_data: 'hmenu_reorder' }],
  ];
}

function habitSelectKeyboard(habits, action) {
  return habits.map(h => ([{
    text: `${h.emoji} ${h.name}`,
    callback_data: `hpick_${action}_${h.id}`
  }]));
}

function statsKeyboard() {
  return [
    [{ text: '7 Hari', callback_data: 'stats_7' }, { text: '14 Hari', callback_data: 'stats_14' }],
    [{ text: '30 Hari', callback_data: 'stats_30' }, { text: '90 Hari', callback_data: 'stats_90' }],
  ];
}

function reminderMenuKeyboard() {
  return [
    [{ text: '⏰ Set Reminder', callback_data: 'rmenu_set' }],
    [{ text: '📋 Status', callback_data: 'rmenu_status' }, { text: '🔕 Matikan', callback_data: 'rmenu_off' }],
  ];
}

module.exports = {
  mainMenu,
  buildCheckKeyboard,
  buildConfirmKeyboard,
  buildReorderKeyboard,
  habitMenuKeyboard,
  habitSelectKeyboard,
  statsKeyboard,
  reminderMenuKeyboard,
};
