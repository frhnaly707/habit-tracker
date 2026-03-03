'use strict';

const db = require('../db/index');
const { calculateStreak, getBestStreak } = require('./streak');

const BADGE_DEFINITIONS = {
  streak_7:      { label: '🔥 Streak 7 Hari',    desc: 'Kamu konsisten 7 hari berturut-turut!' },
  streak_14:     { label: '⚡ Streak 14 Hari',   desc: '2 minggu tanpa berhenti!' },
  streak_30:     { label: '🏅 Streak 30 Hari',   desc: 'Satu bulan penuh! Luar biasa!' },
  streak_100:    { label: '🏆 Streak 100 Hari',  desc: '100 hari! Kamu seorang Master!' },
  perfect_week:  { label: '🌟 Perfect Week',     desc: 'Semua habit selesai 7 hari berturut-turut!' },
  comeback:      { label: '💪 Comeback',          desc: 'Resume habit setelah istirahat panjang!' },
  first_checkin: { label: '🎯 Langkah Pertama',  desc: 'Check-in pertama kamu!' },
};

const MILESTONE_STREAKS = [7, 14, 30, 100];

function checkMilestones(userId, habitId, newStreak) {
  const newBadges = [];

  for (const ms of MILESTONE_STREAKS) {
    if (newStreak === ms) {
      const type = `streak_${ms}`;
      const exists = db.prepare(
        'SELECT id FROM badges WHERE user_id=? AND habit_id=? AND badge_type=?'
      ).get(userId, habitId, type);
      if (!exists) {
        db.prepare(
          'INSERT OR IGNORE INTO badges(user_id, habit_id, badge_type) VALUES(?,?,?)'
        ).run(userId, habitId, type);
        newBadges.push(type);
      }
    }
  }

  return newBadges;
}

function checkFirstCheckin(userId, habitId) {
  const count = db.prepare(
    'SELECT COUNT(*) as c FROM checkins WHERE habit_id=? AND user_id=?'
  ).get(habitId, userId);
  if (count.c === 1) {
    db.prepare(
      'INSERT OR IGNORE INTO badges(user_id, habit_id, badge_type) VALUES(?,?,?)'
    ).run(userId, habitId, 'first_checkin');
    return ['first_checkin'];
  }
  return [];
}

function checkPerfectWeek(userId) {
  const habits = db.prepare(
    'SELECT * FROM habits WHERE user_id=? AND is_archived=0'
  ).all(userId);
  if (!habits.length) return false;

  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    for (const h of habits) {
      const count = db.prepare(
        'SELECT COUNT(*) as c FROM checkins WHERE habit_id=? AND date=?'
      ).get(h.id, dateStr).c;
      if (count < (h.target_per_day || 1)) return false;
    }
  }

  // Award badge
  const exists = db.prepare(
    'SELECT id FROM badges WHERE user_id=? AND habit_id IS NULL AND badge_type=?'
  ).get(userId, 'perfect_week');
  if (!exists) {
    db.prepare(
      'INSERT OR IGNORE INTO badges(user_id, habit_id, badge_type) VALUES(?,NULL,?)'
    ).run(userId, 'perfect_week');
    return true;
  }
  return false;
}

function getBadges(userId) {
  return db.prepare(`
    SELECT b.*, h.name as habit_name, h.emoji as habit_emoji
    FROM badges b
    LEFT JOIN habits h ON b.habit_id = h.id
    WHERE b.user_id=?
    ORDER BY b.earned_at DESC
  `).all(userId);
}

function getUserLevel(userId) {
  const habits = db.prepare(
    'SELECT id, target_per_day FROM habits WHERE user_id=? AND is_archived=0'
  ).all(userId);
  if (!habits.length) return { icon: '🌱', name: 'Beginner', maxStreak: 0, next: 7 };

  let maxStreak = 0;
  for (const h of habits) {
    const s = getBestStreak(h.id, h.target_per_day || 1);
    if (s > maxStreak) maxStreak = s;
  }

  if (maxStreak >= 100) return { icon: '🏆', name: 'Master', maxStreak, next: null };
  if (maxStreak >= 30)  return { icon: '🏅', name: 'Expert', maxStreak, next: 100 };
  if (maxStreak >= 7)   return { icon: '⚡', name: 'Intermediate', maxStreak, next: 30 };
  return { icon: '🌱', name: 'Beginner', maxStreak, next: 7 };
}

function getBadgeLabel(type) {
  return BADGE_DEFINITIONS[type]?.label || type;
}

function getBadgeCelebration(type) {
  return BADGE_DEFINITIONS[type]?.desc || 'Badge baru diraih!';
}

module.exports = {
  checkMilestones, checkFirstCheckin, checkPerfectWeek,
  getBadges, getUserLevel, getBadgeLabel, getBadgeCelebration,
  BADGE_DEFINITIONS
};
