'use strict';

/**
 * migrate_json.js — one-time migration from data/habits.json → SQLite.
 * Run once: node src/db/migrate_json.js
 * Re-runnable safely (uses INSERT OR IGNORE).
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const db = require('./index'); // triggers runMigrations()

const JSON_PATH = path.join(__dirname, '../../data/habits.json');

if (!fs.existsSync(JSON_PATH)) {
  console.log('ℹ️  No habits.json found. Nothing to migrate.');
  process.exit(0);
}

const raw = fs.readFileSync(JSON_PATH, 'utf8');
let allData;
try {
  allData = JSON.parse(raw);
} catch (e) {
  console.error('❌ Failed to parse habits.json:', e.message);
  process.exit(1);
}

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users(id, username, chat_id) VALUES(?, NULL, ?)
`);

const insertHabit = db.prepare(`
  INSERT OR IGNORE INTO habits(id, user_id, name, emoji, target_per_day, is_archived, archived_at, created_at, sort_order)
  VALUES(@id, @userId, @name, @emoji, @targetPerDay, @isArchived, @archivedAt, @createdAt, @sortOrder)
`);

const insertCheckin = db.prepare(`
  INSERT OR IGNORE INTO checkins(id, habit_id, user_id, date) VALUES(?, ?, ?, ?)
`);

const migrateAll = db.transaction(() => {
  let userCount = 0, habitCount = 0, checkinCount = 0;

  for (const [userId, userData] of Object.entries(allData)) {
    const uid = parseInt(userId);
    insertUser.run(uid, uid);
    userCount++;

    // Active habits
    const activeHabits = Array.isArray(userData.habits) ? userData.habits : [];
    activeHabits.forEach((habit, idx) => {
      insertHabit.run({
        id: Number(habit.id) || null,
        userId: uid,
        name: habit.name || 'Unnamed',
        emoji: habit.emoji || '✅',
        targetPerDay: habit.targetPerDay || habit.target || 1,
        isArchived: 0,
        archivedAt: null,
        createdAt: habit.createdAt || new Date().toISOString(),
        sortOrder: idx
      });
      habitCount++;

      // Checkins
      const checkins = habit.checkins || [];
      checkins.forEach(entry => {
        const date = typeof entry === 'string' ? entry : entry.date;
        if (!date) return;
        const habitId = db.prepare('SELECT id FROM habits WHERE user_id=? AND name=? LIMIT 1')
          .get(uid, habit.name)?.id;
        if (habitId) {
          insertCheckin.run(null, habitId, uid, date);
          checkinCount++;
        }
      });
    });

    // Archived habits
    const archive = Array.isArray(userData.archive) ? userData.archive : [];
    archive.forEach((habit, idx) => {
      insertHabit.run({
        id: Number(habit.id) || null,
        userId: uid,
        name: habit.name || 'Unnamed',
        emoji: habit.emoji || '✅',
        targetPerDay: habit.targetPerDay || habit.target || 1,
        isArchived: 1,
        archivedAt: habit.archivedAt || new Date().toISOString(),
        createdAt: habit.createdAt || new Date().toISOString(),
        sortOrder: idx
      });
      habitCount++;

      const checkins = habit.checkins || [];
      checkins.forEach(entry => {
        const date = typeof entry === 'string' ? entry : entry.date;
        if (!date) return;
        const habitId = db.prepare('SELECT id FROM habits WHERE user_id=? AND name=? AND is_archived=1 LIMIT 1')
          .get(uid, habit.name)?.id;
        if (habitId) {
          insertCheckin.run(null, habitId, uid, date);
          checkinCount++;
        }
      });
    });
  }

  return { userCount, habitCount, checkinCount };
});

try {
  const result = migrateAll();
  console.log(`✅ Migration complete!`);
  console.log(`   Users:     ${result.userCount}`);
  console.log(`   Habits:    ${result.habitCount}`);
  console.log(`   Checkins:  ${result.checkinCount}`);

  // Backup original JSON
  const backupPath = JSON_PATH + '.bak';
  fs.copyFileSync(JSON_PATH, backupPath);
  console.log(`   Backup saved: data/habits.json.bak`);
} catch (err) {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
}
