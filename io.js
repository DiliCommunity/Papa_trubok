// io.js - Простой модуль для эмуляции функциональности Socket.IO или другой системы коммуникации

// Хранилище подключений
const connections = new Map();
const eventHandlers = new Map();

/**
 * Инициализирует соединение
 * @param {string} userId - ID пользователя
 * @returns {object} - Объект соединения
 */
function initConnection(userId) {
    const connection = {
        id: userId,
        isConnected: true,
        lastActivity: Date.now()
    };
    
    connections.set(userId, connection);
    console.log(`IO: Соединение инициализировано для пользователя ${userId}`);
    return connection;
}

/**
 * Закрывает соединение
 * @param {string} userId - ID пользователя
 * @returns {boolean} - true, если соединение было закрыто, false - если соединение не было найдено
 */
function closeConnection(userId) {
    if (connections.has(userId)) {
        connections.delete(userId);
        console.log(`IO: Соединение закрыто для пользователя ${userId}`);
        return true;
    }
    return false;
}

/**
 * Добавляет обработчик события
 * @param {string} event - Название события
 * @param {function} handler - Функция-обработчик
 */
function on(event, handler) {
    if (!eventHandlers.has(event)) {
        eventHandlers.set(event, []);
    }
    eventHandlers.get(event).push(handler);
    console.log(`IO: Добавлен обработчик для события ${event}`);
}

/**
 * Эмитирует событие
 * @param {string} event - Название события
 * @param {*} data - Данные события
 */
function emit(event, data) {
    console.log(`IO: Эмитировано событие ${event}`);
    
    if (eventHandlers.has(event)) {
        eventHandlers.get(event).forEach(handler => {
            try {
                handler(data);
            } catch (error) {
                console.error(`IO: Ошибка в обработчике события ${event}:`, error);
            }
        });
    }
}

/**
 * Отправляет данные конкретному пользователю
 * @param {string} userId - ID пользователя
 * @param {string} event - Название события
 * @param {*} data - Данные события
 * @returns {boolean} - true, если данные были отправлены, false - если соединение не было найдено
 */
function sendTo(userId, event, data) {
    if (connections.has(userId)) {
        console.log(`IO: Отправлено событие ${event} пользователю ${userId}`);
        return true;
    }
    console.log(`IO: Пользователь ${userId} не подключен, событие ${event} не отправлено`);
    return false;
}

/**
 * Отправляет данные всем подключенным пользователям
 * @param {string} event - Название события
 * @param {*} data - Данные события
 * @returns {number} - Количество пользователей, которым были отправлены данные
 */
function broadcast(event, data) {
    let sentCount = 0;
    
    connections.forEach((connection, userId) => {
        try {
            console.log(`IO: Broadcast события ${event} пользователю ${userId}`);
            sentCount++;
        } catch (error) {
            console.error(`IO: Ошибка при отправке события ${event} пользователю ${userId}:`, error);
        }
    });
    
    console.log(`IO: Broadcast события ${event} отправлен ${sentCount} пользователям`);
    return sentCount;
}

// Экспортируем функции модуля
module.exports = {
    initConnection,
    closeConnection,
    on,
    emit,
    sendTo,
    broadcast
}; 