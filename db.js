// db.js - Простой модуль для эмуляции функциональности базы данных

// Хранилище данных в памяти
const storage = {
    users: {},
    games: {},
    _collections: {
      users: [],
      games: [],
      answers: []
    }
};

/**
 * Сохраняет пользователя в базу данных
 * @param {string} userId - ID пользователя
 * @param {object} userData - Данные пользователя
 */
function saveUser(userId, userData) {
    storage.users[userId] = userData;
    return userData;
}

/**
 * Получает пользователя из базы данных
 * @param {string} userId - ID пользователя
 * @returns {object|null} - Данные пользователя или null, если пользователь не найден
 */
function getUser(userId) {
    return storage.users[userId] || null;
}

/**
 * Получает всех пользователей из базы данных
 * @returns {object} - Объект с пользователями
 */
function getAllUsers() {
    return storage.users;
}

/**
 * Сохраняет игру в базу данных
 * @param {string} gameId - ID игры
 * @param {object} gameData - Данные игры
 */
function saveGame(gameId, gameData) {
    storage.games[gameId] = gameData;
    return gameData;
}

/**
 * Получает игру из базы данных
 * @param {string} gameId - ID игры
 * @returns {object|null} - Данные игры или null, если игра не найдена
 */
function getGame(gameId) {
    return storage.games[gameId] || null;
}

/**
 * Получает все игры из базы данных
 * @returns {object} - Объект с играми
 */
function getAllGames() {
    return storage.games;
}

/**
 * Удаляет игру из базы данных
 * @param {string} gameId - ID игры
 * @returns {boolean} - true, если игра была удалена, false - если игра не была найдена
 */
function deleteGame(gameId) {
    if (storage.games[gameId]) {
        delete storage.games[gameId];
        return true;
    }
    return false;
}

/**
 * Удаляет пользователя из базы данных
 * @param {string} userId - ID пользователя
 * @returns {boolean} - true, если пользователь был удален, false - если пользователь не был найден
 */
function deleteUser(userId) {
    if (storage.users[userId]) {
        delete storage.users[userId];
        return true;
    }
    return false;
}

/**
 * Метод get для получения доступа к коллекции в стиле lowdb
 * @param {string} collectionName - Имя коллекции 
 * @returns {object} - Объект для работы с коллекцией
 */
function get(collectionName) {
  if (!storage._collections[collectionName]) {
    storage._collections[collectionName] = [];
  }
  
  return {
    // Поиск объекта в коллекции
    find: (query = {}) => {
      const keys = Object.keys(query);
      return {
        value: () => {
          if (keys.length === 0) return null;
          return storage._collections[collectionName].find(item => 
            keys.every(key => item[key] === query[key])
          ) || null;
        },
        // Обновление объекта
        assign: (newData) => {
          return {
            write: () => {
              if (keys.length === 0) return;
              const index = storage._collections[collectionName].findIndex(item => 
                keys.every(key => item[key] === query[key])
              );
              if (index !== -1) {
                storage._collections[collectionName][index] = {
                  ...storage._collections[collectionName][index],
                  ...newData
                };
              }
            }
          };
        }
      };
    },
    // Добавление объекта в коллекцию
    push: (item) => {
      return {
        write: () => {
          storage._collections[collectionName].push(item);
          return item;
        }
      };
    },
    // Фильтрация коллекции
    filter: (query = {}) => {
      const keys = Object.keys(query);
      return {
        size: () => {
          return {
            value: () => {
              if (keys.length === 0) return storage._collections[collectionName].length;
              return storage._collections[collectionName].filter(item => 
                keys.every(key => item[key] === query[key])
              ).length;
            }
          };
        },
        value: () => {
          if (keys.length === 0) return storage._collections[collectionName];
          return storage._collections[collectionName].filter(item => 
            keys.every(key => item[key] === query[key])
          );
        }
      };
    }
  };
}

// Экспортируем функции модуля
module.exports = {
    saveUser,
    getUser,
    getAllUsers,
    saveGame,
    getGame,
    getAllGames,
    deleteGame,
    deleteUser,
    get
}; 