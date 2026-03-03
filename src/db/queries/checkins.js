'use strict';

const db = require('../index');

const insert = db.prepare(`
  INSERT INTO checkins(habit_id, user_id, date, note) VALUES(?, ?, ?, ?)
`);

const countByHabitAndDate = db.prepare(`
  SELECT COUNT(*) as count FROM checkins WHERE habit_id=? AND date=?
`);

const deleteByHabit = db.prepare('DELETE FROM checkins WHERE habit_id=?');

// All checkin dates for a habit (used for streak calculation)
const getAllDates = db.prepare(`
  SELECT date, COUNT(*) as count FROM checkins
  WHERE habit_id=? GROUP BY date ORDER BY date ASC
`);

// Stats for last N days
const getStatsByRange = db.prepare(`
  SELECT date, COUNT(*) as count FROM checkins
  WHERE habit_id=? AND date >= ? GROUP BY date
`);

// Recent check-ins with note
const getRecentWithNote = db.prepare(`
  SELECT date, note, checked_at FROM checkins
  WHERE habit_id=? AND date >= ?
  ORDER BY checked_at DESC
`);

// All checkins for a user (for export)
const getAllByUser = db.prepare(`
  SELECT c.*, h.name as habit_name FROM checkins c
  JOIN habits h ON c.habit_id = h.id
  WHERE c.user_id=? ORDER BY c.date DESC
`);

// Check-ins for today by user (for all-done check)
const getTodayCountByUser = db.prepare(`
  SELECT habit_id, COUNT(*) as count FROM checkins
  WHERE user_id=? AND date=? GROUP BY habit_id
`);

module.exports = {
  insert, countByHabitAndDate, deleteByHabit,
  getAllDates, getStatsByRange, getRecentWithNote,
  getAllByUser, getTodayCountByUser
};
