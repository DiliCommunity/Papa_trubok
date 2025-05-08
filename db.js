// db.js - Простой модуль для эмуляции функциональности базы данных

// Хранилище данных в памяти
const storage = {
    users: {},
    games: {}
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

// Экспортируем функции модуля
module.exports = {
    saveUser,
    getUser,
    getAllUsers,
    saveGame,
    getGame,
    getAllGames,
    deleteGame,
    deleteUser
}; 