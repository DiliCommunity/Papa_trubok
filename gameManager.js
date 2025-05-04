const fs = require('fs');
const GAMES_FILE = 'games.json';

let games = {};

// Загрузка игр из файла
function loadGames() {
  if (fs.existsSync(GAMES_FILE)) {
    try {
      const data = fs.readFileSync(GAMES_FILE, 'utf8');
      games = data && data.trim() ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Ошибка загрузки игр:', error);
      games = {};
    }
  }
}

// Сохранение игр в файл
function saveGames() {
  try {
    console.log(`Сохраняем ${Object.keys(games).length} игр в файл...`); // Для отладки
    fs.writeFileSync(GAMES_FILE, JSON.stringify(games, null, 2), 'utf8');
    console.log('Игры сохранены успешно');
  } catch (error) {
    console.error('Ошибка при сохранении игр:', error);
  }
}

// Получить все игры
function getGames() {
  // Загружаем актуальные данные перед каждым запросом, если нужно
  // Это иногда может помочь с синхронизацией, но может быть ресурсоемким
  // Раскомментируйте, если возникают проблемы с синхронизацией
  // loadGames(); 
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

module.exports = {
  loadGames,
  saveGames,
  getGames,
  setGame,
  deleteGame,
  clearAllGames,
  cleanupOldGames
};