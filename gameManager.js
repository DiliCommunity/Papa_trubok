const fs = require('fs');
const path = require('path');

// Определяем папку для данных
const DATA_DIR = process.env.NODE_ENV === 'production' 
  ? '/tmp' 
  : path.join(__dirname);

const GAMES_FILE = path.join(DATA_DIR, 'games.json');

let games = {};
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

// Автосохранение каждую минуту
setInterval(saveGames, 60000);

module.exports = {
  loadGames,
  saveGames,
  getGames,
  setGame,
  deleteGame,
  clearAllGames,
  cleanupOldGames
};