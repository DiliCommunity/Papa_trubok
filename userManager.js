const fs = require('fs');
const path = require('path');

// Определяем папку для данных
const DATA_DIR = process.env.NODE_ENV === 'production' 
  ? '/tmp' 
  : path.join(__dirname);

const USERS_FILE = path.join(DATA_DIR, 'users.json');

let users = {};
let lastSaveTime = 0;
const SAVE_DEBOUNCE = 5000; // 5 секунд

// Загрузка пользователей из файла
function loadUsers() {
  console.log(`Загрузка пользователей из ${USERS_FILE}`);
  if (fs.existsSync(USERS_FILE)) {
    try {
      const data = fs.readFileSync(USERS_FILE, 'utf8');
      users = data && data.trim() ? JSON.parse(data) : {};
      console.log(`Загружено ${Object.keys(users).length} пользователей`);
    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error);
      users = {};
    }
  } else {
    console.log('Файл с пользователями не найден, создаем новый');
    saveUsers(); // Создаем пустой файл
  }
}

// Сохранение пользователей в файл
function saveUsers() {
  try {
    const now = Date.now();
    if (now - lastSaveTime < SAVE_DEBOUNCE) {
      // Дебаунс для защиты от слишком частых сохранений
      return;
    }
    
    lastSaveTime = now;
    console.log(`Сохраняем ${Object.keys(users).length} пользователей в файл ${USERS_FILE}...`);
    
    // Убедимся, что директория существует
    const dir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    console.log('Пользователи сохранены успешно');
  } catch (error) {
    console.error('Ошибка при сохранении пользователей:', error);
  }
}

// Получить всех пользователей
function getUsers() {
  return users;
}

// Добавить/обновить пользователя
function setUser(userId, userData) {
  // Если пользователь существует, объединяем данные
  users[userId] = {
    ...(users[userId] || {}),
    ...userData
  };
  saveUsers();
}

// Функция для очистки всех пользователей
function clearAllUsers() {
  users = {};
  saveUsers();
  console.log('Все пользователи удалены');
  return true;
}

// Автосохранение каждую минуту
setInterval(saveUsers, 60000);

module.exports = {
  loadUsers,
  saveUsers,
  getUsers,
  setUser,
  clearAllUsers
};