const fs = require('fs');
const USERS_FILE = 'users.json';

let userGames = {};

function loadUsers() {
  if (fs.existsSync(USERS_FILE)) {
    userGames = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  }
}

function saveUsers() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(userGames, null, 2), 'utf8');
}

function getUsers() {
  return userGames;
}

function setUser(userId, userData) {
  userGames[userId] = userData;
  saveUsers();
}

// Добавьте функцию очистки пользователей
function clearAllUsers() {
  userGames = {};
  saveUsers();
  console.log('Все пользователи удалены');
  return true;
}

module.exports = {
  loadUsers,
  saveUsers,
  getUsers,
  setUser,
  clearAllUsers
};