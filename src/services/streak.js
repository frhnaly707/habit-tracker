'use strict';

const db = require('../db/index');
const checkinQueries = require('../db/queries/checkins');

/**
 * calculateStreak — hitung streak hari berturut-turut dimana count >= target.
 * Skip days dianggap bukan hari gagal (dilewati).
 * Jika hari ini belum memenuhi target, mulai hitung dari kemarin.
 */
function calculateStreak(habitId, targetPerDay = 1) {
  const rows = checkinQueries.getAllDates.all(habitId);
  const countMap = {};
  rows.forEach(r => { countMap[r.date] = r.count; });

  // Get skip_days for this habit
  const skipRows = db.prepare('SELECT date FROM skip_days WHERE habit_id=?').all(habitId);
  const skipSet = new Set(skipRows.map(r => r.date));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const todayDone = (countMap[todayStr] || 0) >= targetPerDay;
  const startOffset = todayDone ? 0 : 1;

  let streak = 0;
  for (let i = startOffset; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    if (skipSet.has(dateStr)) continue; // skip day = tidak hitung, lanjut
    if ((countMap[dateStr] || 0) >= targetPerDay) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * getBestStreak — rekor streak terpanjang sepanjang masa.
 */
function getBestStreak(habitId, targetPerDay = 1) {
  const rows = checkinQueries.getAllDates.all(habitId);
  if (!rows.length) return 0;

  const countMap = {};
  rows.forEach(r => { countMap[r.date] = r.count; });

  const skipRows = db.prepare('SELECT date FROM skip_days WHERE habit_id=?').all(habitId);
  const skipSet = new Set(skipRows.map(r => r.date));

  // Iterate dari tanggal pertama hingga hari ini
  const firstDate = new Date(rows[0].date + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let best = 0;
  let current = 0;

  for (let d = new Date(firstDate); d <= today; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    if (skipSet.has(dateStr)) continue;
    if ((countMap[dateStr] || 0) >= targetPerDay) {
      current++;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }

  return best;
}

/**
 * getStats — berapa hari dalam N hari terakhir yang memenuhi target.
 */
function getStats(habitId, targetPerDay = 1, days = 7) {
  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - (days - 1));
  const fromStr = fromDate.toISOString().split('T')[0];

  const rows = checkinQueries.getStatsByRange.all(habitId, fromStr);
  const countMap = {};
  rows.forEach(r => { countMap[r.date] = r.count; });

  const skipRows = db.prepare('SELECT date FROM skip_days WHERE habit_id=? AND date >= ?').all(habitId, fromStr);
  const skipSet = new Set(skipRows.map(r => r.date));

  let completed = 0;
  let skipped = 0;

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    if (skipSet.has(dateStr)) { skipped++; continue; }
    if ((countMap[dateStr] || 0) >= targetPerDay) completed++;
  }

  return { completed, total: days, skipped, effective: days - skipped };
}

/**
 * getCompletionRate — persentase sejak habit dibuat.
 */
function getCompletionRate(habitId, targetPerDay, createdAt) {
  const created = new Date(createdAt);
  created.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const totalDays = Math.floor((today - created) / 86400000) + 1;
  if (totalDays <= 0) return 0;

  const stats = getStats(habitId, targetPerDay, totalDays);
  return Math.round((stats.completed / (stats.total - stats.skipped || 1)) * 100);
}

module.exports = { calculateStreak, getBestStreak, getStats, getCompletionRate };
