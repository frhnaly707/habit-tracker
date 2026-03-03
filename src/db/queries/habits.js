'use strict';

const db = require('../index');

const insert = db.prepare(`
  INSERT INTO habits(user_id, name, emoji, target_per_day, target_per_week, mode, category, sort_order)
  VALUES(@userId, @name, @emoji, @targetPerDay, @targetPerWeek, @mode, @category,
    COALESCE((SELECT MAX(sort_order)+1 FROM habits WHERE user_id = @userId), 0))
`);

const findById = db.prepare('SELECT * FROM habits WHERE id = ? AND user_id = ?');

const findActive = db.prepare(
  'SELECT * FROM habits WHERE user_id = ? AND is_archived = 0 ORDER BY sort_order ASC, id ASC'
);

const findArchived = db.prepare(
  'SELECT * FROM habits WHERE user_id = ? AND is_archived = 1 ORDER BY archived_at DESC'
);

const findByName = db.prepare(`
  SELECT * FROM habits
  WHERE user_id = ? AND is_archived = 0
    AND (LOWER(name) = LOWER(?) OR LOWER(name) LIKE '%' || LOWER(?) || '%')
  ORDER BY CASE WHEN LOWER(name) = LOWER(?) THEN 0 ELSE 1 END
  LIMIT 1
`);

const findArchivedByName = db.prepare(`
  SELECT * FROM habits
  WHERE user_id = ? AND is_archived = 1
    AND (LOWER(name) = LOWER(?) OR LOWER(name) LIKE '%' || LOWER(?) || '%')
  ORDER BY CASE WHEN LOWER(name) = LOWER(?) THEN 0 ELSE 1 END
  LIMIT 1
`);

const update = db.prepare(`
  UPDATE habits SET name=@name, emoji=@emoji, target_per_day=@targetPerDay,
    category=@category, mode=@mode, rest_days=@restDays
  WHERE id=@id AND user_id=@userId
`);

const archive = db.prepare(`
  UPDATE habits SET is_archived=1, archived_at=datetime('now') WHERE id=? AND user_id=?
`);

const unarchive = db.prepare(`
  UPDATE habits SET is_archived=0, archived_at=NULL WHERE id=? AND user_id=?
`);

const remove = db.prepare('DELETE FROM habits WHERE id=? AND user_id=?');

const updateSortOrder = db.prepare('UPDATE habits SET sort_order=? WHERE id=? AND user_id=?');

const findByCategory = db.prepare(`
  SELECT * FROM habits WHERE user_id=? AND is_archived=0 AND category=?
  ORDER BY sort_order ASC
`);

module.exports = {
  insert, findById, findActive, findArchived, findByName,
  findArchivedByName, update, archive, unarchive, remove,
  updateSortOrder, findByCategory
};
