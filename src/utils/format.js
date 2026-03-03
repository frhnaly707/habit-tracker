'use strict';

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getProgressBar(current, target) {
  const percent = Math.min(100, Math.max(0, (current / target) * 100));
  const filled = Math.floor(percent / 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function getStreakIcon(streak) {
  if (streak >= 30) return '🏆';
  if (streak >= 14) return '🏅';
  if (streak >= 7) return '⚡';
  if (streak >= 1) return '🔥';
  return '💤';
}

function getLevelInfo(maxStreak) {
  if (maxStreak >= 100) return { icon: '🏆', name: 'Master', next: null };
  if (maxStreak >= 30) return { icon: '🏅', name: 'Expert', next: 100 };
  if (maxStreak >= 7) return { icon: '⚡', name: 'Intermediate', next: 30 };
  return { icon: '🌱', name: 'Beginner', next: 7 };
}

function formatDate(isoDate) {
  // Returns "Senin, 3 Mar 2026" style
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const d = new Date(isoDate + 'T00:00:00');
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

module.exports = { getToday, getProgressBar, getStreakIcon, getLevelInfo, formatDate };
