// Базовый URL для API
const API_URL = window.location.origin + '/api';

console.log("papyrus.js загружен");

// Переопределяем Telegram WebApp объект для предотвращения ошибок
window.Telegram = {
  WebApp: {
    initDataUnsafe: {
      user: {
        id: Math.floor(Math.random() * 1000000),
        first_name: '',
      }
    },
    BackButton: {
      onClick: function(callback) {
        console.log('BackButton.onClick зарегистрирован');
      }
    }
  }
};

// Глобальные переменные
let currentUser = {
  id: Math.floor(Math.random() * 1000000),
  name: ''
};

// Простые функции для базовой работы
function showScreen(screenId) {
  // Получаем все экраны
  const screens = [
    'startScreen', 'nameScreen', 'gameScreen', 'questionScreen',
    'answerScreen', 'votingScreen', 'resultsScreen'
  ];
  
  console.log(`Показываем экран: ${screenId}`);
  
  // Скрываем все экраны
  screens.forEach(id => {
    const screen = document.getElementById(id);
    if (screen) {
      screen.style.display = 'none';
    }
  });
  
  // Показываем нужный экран
  const screenToShow = document.getElementById(screenId);
  if (screenToShow) {
    screenToShow.style.display = 'block';
  } else {
    console.error(`Экран ${screenId} не найден!`);
  }
}

// Обработчик для начала приложения
window.startApp = function() {
  console.log("Вызвана функция startApp()");
  showScreen('nameScreen');
};

// Сохранение имени пользователя
function saveName() {
  const nameInput = document.getElementById('nameInput');
  if (!nameInput) {
    console.error('Элемент ввода имени не найден!');
    return;
  }
  
  const name = nameInput.value.trim();
  if (name.length < 3) {
    alert('Имя должно содержать минимум 3 символа');
    return;
  }
  
  console.log(`Сохраняем имя: ${name}`);
  currentUser.name = name;
  showScreen('gameScreen');
  
  // Симуляция загрузки списка игр
  const gamesList = document.getElementById('gamesList');
  if (gamesList) {
    gamesList.innerHTML = '<p>Нет доступных игр. Создайте новую!</p>';
  }
}

// Обработчик для возврата назад
function goBack() {
  console.log("Вызвана функция goBack()");
  showScreen('startScreen');
}

// Функция создания новой игры
function createNewGame() {
  console.log("Вызвана функция createNewGame()");
  showScreen('questionScreen');
}

// Функция для обновления списка игр
function refreshGames() {
  console.log("Вызвана функция refreshGames()");
  const gamesList = document.getElementById('gamesList');
  if (gamesList) {
    gamesList.innerHTML = '<p>Обновляем список игр...</p>';
    setTimeout(() => {
      gamesList.innerHTML = '<p>Нет доступных игр. Создайте новую!</p>';
    }, 500);
  }
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOMContentLoaded вызван");
  
  try {
    // Добавляем обработчики для кнопок
    const buttonHandlers = {
      'submitNameBtn': saveName,
      'backToStartBtn': goBack,
      'createGameBtn': createNewGame,
      'refreshGamesBtn': refreshGames,
      'backToMainFromQuestionBtn': function() { showScreen('gameScreen'); },
      'backToMainFromAnswerBtn': function() { showScreen('gameScreen'); },
      'backToMainBtn': function() { showScreen('gameScreen'); }
    };
    
    // Регистрируем обработчики через безопасную функцию
    Object.keys(buttonHandlers).forEach(btnId => {
      const button = document.getElementById(btnId);
      if (button) {
        console.log(`Регистрируем обработчик для кнопки ${btnId}`);
        button.addEventListener('click', buttonHandlers[btnId]);
      } else {
        console.warn(`Кнопка ${btnId} не найдена`);
      }
    });
    
    // Добавляем обработчик для поля ввода имени
    const nameInput = document.getElementById('nameInput');
    if (nameInput) {
      nameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          console.log('Нажат Enter в поле имени');
          saveName();
        }
      });
    }
    
    // Показываем стартовый экран
    showScreen('startScreen');
    console.log("Инициализация успешно завершена");
    
    // Добавляем информацию в debugInfo, если он существует
    const debugInfo = document.getElementById('debugInfo');
    if (debugInfo) {
      debugInfo.innerHTML += '<div style="color: white;">Инициализация JS успешно завершена</div>';
    }
    
  } catch (error) {
    console.error("Критическая ошибка при инициализации:", error);
  }
});

// Обработка ошибок
window.addEventListener('error', function(event) {
  console.error('Глобальная ошибка:', event.error || event.message);
});