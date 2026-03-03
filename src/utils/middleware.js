'use strict';

const { upsertUser } = require('../db/queries/users');

// In-memory rate limiter: max 20 requests per minute per user
const requestCounts = new Map();
setInterval(() => requestCounts.clear(), 60 * 1000);

function rateLimiter(userId) {
  const count = (requestCounts.get(userId) || 0) + 1;
  requestCounts.set(userId, count);
  return count <= 20;
}

function ensureUser(msg) {
  const userId = msg.from?.id || msg.id;
  const chatId = msg.chat?.id || msg.id;
  const username = msg.from?.username || msg.from?.first_name || null;
  upsertUser.run({ id: userId, username, chat_id: chatId });
  return userId;
}

function ensureUserFromCallback(callbackQuery) {
  const userId = callbackQuery.from.id;
  const chatId = callbackQuery.message.chat.id;
  const username = callbackQuery.from.username || callbackQuery.from.first_name || null;
  upsertUser.run({ id: userId, username, chat_id: chatId });
  return userId;
}

module.exports = { rateLimiter, ensureUser, ensureUserFromCallback };
