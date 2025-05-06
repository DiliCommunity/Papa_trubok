const fs = require('fs');
const path = require('path');

// Определяем папку для данных
const DATA_DIR = process.env.NODE_ENV === 'production' 
  ? '/tmp' 
  : path.join(__dirname);

const GAMES_FILE = path.join(DATA_DIR, 'games.json');
const REMINDERS_FILE = path.join(DATA_DIR, 'reminders.json');

let games = {};
let reminders = {};
let lastSaveTime = 0;
const SAVE_DEBOUNCE = 5000; // 5 секунд

// Загрузка игр из файла
function loadGames() {
  console.log(`Загрузка игр из ${GAMES_FILE}`);
  if (fs.existsSync(GAMES_FILE)) {
    try {
      const data = fs.readFileSync(GAMES_FILE, 'utf8');
      games = data && data.trim() ? JSON.parse(data) : {};
      console.log(`Загружено ${Object.keys(games).length} игр`);
    } catch (error) {
      console.error('Ошибка загрузки игр:', error);
      games = {};
    }
  } else {
    console.log('Файл с играми не найден, создаем новый');
    saveGames(); // Создаем пустой файл
  }
  
  // Загружаем напоминания
  loadReminders();
}

// Загрузка напоминаний из файла
function loadReminders() {
  console.log(`Загрузка напоминаний из ${REMINDERS_FILE}`);
  if (fs.existsSync(REMINDERS_FILE)) {
    try {
      const data = fs.readFileSync(REMINDERS_FILE, 'utf8');
      reminders = data && data.trim() ? JSON.parse(data) : {};
      console.log(`Загружено ${Object.keys(reminders).length} напоминаний`);
    } catch (error) {
      console.error('Ошибка загрузки напоминаний:', error);
      reminders = {};
    }
  } else {
    console.log('Файл с напоминаниями не найден, создаем новый');
    saveReminders(); // Создаем пустой файл
  }
}

// Сохранение игр в файл
function saveGames() {
  try {
    const now = Date.now();
    if (now - lastSaveTime < SAVE_DEBOUNCE) {
      // Дебаунс для защиты от слишком частых сохранений
      return;
    }
    
    lastSaveTime = now;
    console.log(`Сохраняем ${Object.keys(games).length} игр в файл ${GAMES_FILE}...`);
    
    // Убедимся, что директория существует
    const dir = path.dirname(GAMES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(GAMES_FILE, JSON.stringify(games, null, 2), 'utf8');
    console.log('Игры сохранены успешно');
  } catch (error) {
    console.error('Ошибка при сохранении игр:', error);
  }
}

// Сохранение напоминаний в файл
function saveReminders() {
  try {
    console.log(`Сохраняем ${Object.keys(reminders).length} напоминаний в файл ${REMINDERS_FILE}...`);
    
    // Убедимся, что директория существует
    const dir = path.dirname(REMINDERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(REMINDERS_FILE, JSON.stringify(reminders, null, 2), 'utf8');
    console.log('Напоминания сохранены успешно');
  } catch (error) {
    console.error('Ошибка при сохранении напоминаний:', error);
  }
}

// Получить все игры
function getGames() {
  return games;
}

// Добавить/обновить игру
function setGame(gameId, gameData) {
  games[gameId] = gameData;
  saveGames();
}

// Удалить игру
function deleteGame(gameId) {
  delete games[gameId];
  saveGames();
}

// Добавьте эту функцию для полной очистки игр
function clearAllGames() {
  games = {};
  saveGames();
  console.log('Все игры удалены');
  return true;
}

// Функция проверки и удаления старых игр (опционально)
function cleanupOldGames(maxAgeInHours = 24) {
  const now = new Date();
  let cleaned = 0;
  
  Object.keys(games).forEach(gameId => {
    const game = games[gameId];
    if (game.createdAt) {
      const createdAt = new Date(game.createdAt);
      const ageInHours = (now - createdAt) / (1000 * 60 * 60);
      
      if (ageInHours > maxAgeInHours) {
        delete games[gameId];
        cleaned++;
      }
    }
  });
  
  if (cleaned > 0) {
    saveGames();
    console.log(`Очищено ${cleaned} старых игр`);
  }
  
  return cleaned;
}

// Добавляем напоминание о голосовании через 12 часов
function addVotingReminder(gameId, userId) {
  const remindTime = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 часов
  const reminderId = `${gameId}_${Date.now()}`;
  
  reminders[reminderId] = {
    gameId,
    userId,
    remindTime: remindTime.toISOString(),
    isNotified: false,
    createdAt: new Date().toISOString()
  };
  
  console.log(`Добавлено напоминание ${reminderId} для игры ${gameId}, пользователя ${userId} на ${remindTime}`);
  saveReminders();
  return reminderId;
}

// Получить все напоминания
function getReminders() {
  return reminders;
}

// Пометить напоминание как отправленное
function markReminderAsNotified(reminderId) {
  if (reminders[reminderId]) {
    reminders[reminderId].isNotified = true;
    saveReminders();
    return true;
  }
  return false;
}

// Удалить напоминание
function deleteReminder(reminderId) {
  if (reminders[reminderId]) {
    delete reminders[reminderId];
    saveReminders();
    return true;
  }
  return false;
}

// Получить просроченные напоминания, которые не были отправлены
function getOverdueReminders() {
  const now = new Date();
  const overdue = [];
  
  Object.entries(reminders).forEach(([reminderId, reminder]) => {
    const remindTime = new Date(reminder.remindTime);
    if (!reminder.isNotified && remindTime <= now) {
      overdue.push({
        id: reminderId,
        ...reminder
      });
    }
  });
  
  return overdue;
}

// Автосохранение каждую минуту
setInterval(saveGames, 60000);
setInterval(saveReminders, 60000);

module.exports = {
  loadGames,
  saveGames,
  getGames,
  setGame,
  deleteGame,
  clearAllGames,
  cleanupOldGames,
  addVotingReminder,
  getReminders,
  markReminderAsNotified,
  deleteReminder,
  getOverdueReminders
};