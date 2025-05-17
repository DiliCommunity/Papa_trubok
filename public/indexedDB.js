// Класс для работы с IndexedDB в приложении Papa Trubok
class PapaTrubokDB {
    constructor(dbName = 'PapaTrubokDB', version = 4) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
    }

    // Открываем базу данных с расширенной схемой
    async openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Создаем хранилища для разных типов данных с индексами
                if (!db.objectStoreNames.contains('games')) {
                    const gameStore = db.createObjectStore('games', { keyPath: 'id' });
                    gameStore.createIndex('status', 'status', { unique: false });
                    gameStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                if (!db.objectStoreNames.contains('users')) {
                    const userStore = db.createObjectStore('users', { keyPath: 'id' });
                    userStore.createIndex('name', 'name', { unique: false });
                }
                if (!db.objectStoreNames.contains('appState')) {
                    db.createObjectStore('appState', { keyPath: 'key' });
                }
                if (!db.objectStoreNames.contains('navigation')) {
                    db.createObjectStore('navigation', { keyPath: 'key' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject(`IndexedDB error: ${event.target.error}`);
            };
        });
    }

    // Общий метод для сохранения данных
    async save(storeName, data) {
        await this.openDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            const request = store.put({
                ...data,
                timestamp: Date.now()
            });

            request.onsuccess = () => resolve(true);
            request.onerror = (event) => {
                console.error(`Error saving to ${storeName}:`, event.target.error);
                reject(false);
            };
        });
    }

    // Общий метод для получения данных
    async get(storeName, key) {
        await this.openDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            
            const request = store.get(key);

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };
            request.onerror = (event) => {
                console.error(`Error getting from ${storeName}:`, event.target.error);
                reject(null);
            };
        });
    }

    // Сохранение состояния игры
    async saveGameState(gameId, gameData) {
        return this.save('games', { id: gameId, data: gameData });
    }

    // Получение состояния игры
    async getGameState(gameId) {
        const result = await this.get('games', gameId);
        return result ? result.data : null;
    }

    // Сохранение пользователя
    async saveUser(userData) {
        return this.save('users', userData);
    }

    // Получение пользователя
    async getUser(userId) {
        return this.get('users', userId);
    }

    // Сохранение состояния приложения
    async saveAppState(key, value) {
        return this.save('appState', { key, value });
    }

    // Получение состояния приложения
    async getAppState(key) {
        const result = await this.get('appState', key);
        return result ? result.value : null;
    }

    // Удаление записи
    async delete(storeName, key) {
        await this.openDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            const request = store.delete(key);

            request.onsuccess = () => resolve(true);
            request.onerror = (event) => {
                console.error(`Error deleting from ${storeName}:`, event.target.error);
                reject(false);
            };
        });
    }

    // Получение всех записей из хранилища
    async getAll(storeName) {
        await this.openDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            
            const request = store.getAll();

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };
            request.onerror = (event) => {
                console.error(`Error getting all from ${storeName}:`, event.target.error);
                reject([]);
            };
        });
    }

    // Сохранение навигационного состояния
    async saveNavigationState(key, value) {
        return this.save('navigation', { key, value, timestamp: Date.now() });
    }

    // Получение навигационного состояния
    async getNavigationState(key) {
        const result = await this.get('navigation', key);
        return result ? result.value : null;
    }

    // Метод для очистки старых записей
    async cleanupOldData(storeName, maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 дней
        await this.openDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const now = Date.now();

            const request = store.openCursor();
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const item = cursor.value;
                    if (item.timestamp && (now - item.timestamp > maxAge)) {
                        cursor.delete();
                    }
                    cursor.continue();
                }
            };

            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(false);
        });
    }

    // Расширенный метод сохранения с автоматической очисткой
    async saveWithCleanup(storeName, data) {
        await this.cleanupOldData(storeName);
        return this.save(storeName, data);
    }
}

// Создаем глобальный экземпляр базы данных
const papaTrubokDB = new PapaTrubokDB();

// Экспортируем для использования в других скриптах
window.papaTrubokDB = papaTrubokDB;

// Функции-обертки для глобального использования
async function saveGameStateToIndexedDB(gameId, gameData) {
    try {
        await papaTrubokDB.saveGameState(gameId, gameData);
        console.log('Состояние игры сохранено в IndexedDB');
        return true;
    } catch (error) {
        console.error('Ошибка сохранения состояния игры:', error);
        return false;
    }
}

async function getGameStateFromIndexedDB(gameId) {
    try {
        const gameData = await papaTrubokDB.getGameState(gameId);
        if (gameData) {
            console.log('Состояние игры восстановлено из IndexedDB');
            return gameData;
        }
        return null;
    } catch (error) {
        console.error('Ошибка восстановления состояния игры:', error);
        return null;
    }
}

// Функции для работы с пользователями
async function saveUserToIndexedDB(userData) {
    try {
        await papaTrubokDB.saveUser(userData);
        console.log('Данные пользователя сохранены в IndexedDB');
        return true;
    } catch (error) {
        console.error('Ошибка сохранения данных пользователя:', error);
        return false;
    }
}

async function getUserFromIndexedDB(userId) {
    try {
        const userData = await papaTrubokDB.getUser(userId);
        if (userData) {
            console.log('Данные пользователя восстановлены из IndexedDB');
            return userData;
        }
        return null;
    } catch (error) {
        console.error('Ошибка восстановления данных пользователя:', error);
        return null;
    }
}

// Функции для работы с состоянием приложения
async function saveAppStateToIndexedDB(key, value) {
    try {
        await papaTrubokDB.saveAppState(key, value);
        console.log(`Состояние приложения для ключа "${key}" сохранено в IndexedDB`);
        return true;
    } catch (error) {
        console.error(`Ошибка сохранения состояния приложения для ключа "${key}":`, error);
        return false;
    }
}

async function getAppStateFromIndexedDB(key) {
    try {
        const value = await papaTrubokDB.getAppState(key);
        if (value !== null) {
            console.log(`Состояние приложения для ключа "${key}" восстановлено из IndexedDB`);
            return value;
        }
        return null;
    } catch (error) {
        console.error(`Ошибка восстановления состояния приложения для ключа "${key}":`, error);
        return null;
    }
}

// Глобальные функции для работы с навигацией
async function saveLastRoute(route) {
    try {
        await papaTrubokDB.saveNavigationState('lastRoute', route);
        console.log(`Сохранена последняя маршрутизация: ${route}`);
    } catch (error) {
        console.error('Ошибка сохранения маршрута:', error);
    }
}

async function getLastRoute() {
    try {
        const lastRoute = await papaTrubokDB.getNavigationState('lastRoute');
        console.log(`Восстановлен последний маршрут: ${lastRoute}`);
        return lastRoute;
    } catch (error) {
        console.error('Ошибка восстановления маршрута:', error);
        return null;
    }
}

// Расширенные функции навигации
function safeNavigate(url, saveHistory = true) {
    console.log(`Безопасный переход: ${url}`);
    
    // Сохраняем текущий маршрут перед переходом
    if (saveHistory) {
        saveLastRoute(url);
    }
    
    // Предотвращаем стандартное поведение
    window.preventUnload = false;
    
    // Переход на новую страницу
    window.location.href = url;
}

// Функция восстановления состояния навигации
async function restoreNavigation() {
    const lastRoute = await getLastRoute();
    
    if (lastRoute && lastRoute !== window.location.href) {
        console.log(`Восстановление навигации: ${lastRoute}`);
        safeNavigate(lastRoute, false);
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', restoreNavigation); 