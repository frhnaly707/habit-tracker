'use strict';

const db = require('../index');

const upsertUser = db.prepare(`
  INSERT INTO users(id, username, chat_id)
  VALUES(@id, @username, @chat_id)
  ON CONFLICT(id) DO UPDATE SET
    username = excluded.username,
    chat_id = excluded.chat_id
`);

const getById = db.prepare('SELECT * FROM users WHERE id = ?');

const getAllUsers = db.prepare('SELECT * FROM users');

const updateMotivationIndex = db.prepare(
  'UPDATE users SET motivation_index = ? WHERE id = ?'
);

module.exports = { upsertUser, getById, getAllUsers, updateMotivationIndex };
