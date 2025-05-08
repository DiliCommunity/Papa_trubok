// Базовый URL для API
const API_URL = window.location.origin + '/api';

console.log("papyrus.js загружен");

// Правильное определение объекта Telegram WebApp
// Если мы внутри Telegram WebApp, используем его объект, иначе создаем заглушку
if (!window.Telegram || !window.Telegram.WebApp) {
  console.log("Telegram WebApp не обнаружен, создаем заглушку для локального тестирования");
  window.Telegram = {
    WebApp: {
  initDataUnsafe: {
    user: {
          id: Math.floor(Math.random() * 1000000),
          first_name: '',
          username: '',
        }
      },
      BackButton: {
        show: function() { console.log('BackButton.show вызван'); },
        hide: function() { console.log('BackButton.hide вызван'); },
        onClick: function(callback) { console.log('BackButton.onClick зарегистрирован'); },
        offClick: function(callback) { console.log('BackButton.offClick вызван'); },
        isVisible: false
      },
      ready: function() { console.log('WebApp.ready вызван'); },
      expand: function() { console.log('WebApp.expand вызван'); },
      close: function() { console.log('WebApp.close вызван'); },
      isExpanded: true,
      HapticFeedback: {
        impactOccurred: function(style) { console.log('HapticFeedback.impactOccurred вызван с', style); }
      }
    }
  };
} else {
  console.log("Telegram WebApp обнаружен, используем встроенные функции");
}

// Глобальные переменные
let currentUser = {
  id: getTelegramUserId(),
  name: '',
  anonymous: false // Всегда будет false
};
let currentGame = null;
let navigationHistory = []; // История навигации для кнопки "Назад"
let keyboardVisible = false; // Флаг для отслеживания видимости клавиатуры

// Использование Telegram ID пользователя
function getTelegramUserId() {
  if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
    return window.Telegram.WebApp.initDataUnsafe.user.id || Math.floor(Math.random() * 1000000);
  }
  return Math.floor(Math.random() * 1000000);
}

// Получение имени пользователя из Telegram
function getTelegramUserName() {
  if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
    const user = window.Telegram.WebApp.initDataUnsafe.user;
    if (user.username) return user.username;
    if (user.first_name) {
      if (user.last_name) return `${user.first_name} ${user.last_name}`;
      return user.first_name;
    }
  }
  return '';
}

// Функция для показа красивых уведомлений
function showNotification(message, type = 'info') {
  // Создаем элемент для уведомления
  const notification = document.createElement('div');
  notification.className = `papyrus-notification ${type}`;
  
  // Определяем иконки для разных типов уведомлений
  let icon = '📜';
  if (type === 'success') icon = '✅';
  else if (type === 'error') icon = '❌';
  else if (type === 'warning') icon = '⚠️';
  
  // Добавляем контент
  notification.innerHTML = `
    <div class="notification-icon">${icon}</div>
    <div class="notification-message">${message}</div>
    <div class="notification-close" onclick="this.parentNode.remove()">×</div>
  `;
  
  // Добавляем на страницу
  document.body.appendChild(notification);
  
  // Анимация появления
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
    notification.style.opacity = '1';
  }, 10);
  
  // Автоматическое закрытие через 5 секунд
  setTimeout(() => {
    notification.style.transform = 'translateX(400px)';
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 500);
  }, 5000);
}

// Функция для проверки, активен ли какой-либо элемент ввода
function isInputActive() {
  const activeElement = document.activeElement;
  return activeElement && (
    activeElement.tagName === 'INPUT' || 
    activeElement.tagName === 'TEXTAREA' ||
    activeElement.isContentEditable
  );
}

// Функция для скрытия клавиатуры
function hideKeyboard() {
  if (!isInputActive()) return false;
  
  document.activeElement.blur();
  return true;
}

// Функция для показа экранов с отслеживанием истории
function showScreen(screenId) {
  // Получаем текущий экран
  let currentScreenId = null;
  const screens = [
    'startScreen', 'nameScreen', 'gameScreen', 'questionScreen',
    'answerScreen', 'votingScreen', 'resultsScreen'
  ];
  
  for (const id of screens) {
    const screen = document.getElementById(id);
    if (screen && screen.style.display === 'block') {
      currentScreenId = id;
      break;
    }
  }
  
  console.log(`Показываем экран: ${screenId} (предыдущий: ${currentScreenId})`);
  
  // Сохраняем текущий экран в историю, если переходим на новый экран
  if (currentScreenId && currentScreenId !== screenId) {
    navigationHistory.push(currentScreenId);
    console.log(`История навигации: ${navigationHistory.join(' -> ')}`);
  }
  
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
    
    // Управление кнопкой "Назад" в Telegram
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.BackButton) {
      if (navigationHistory.length > 0 && screenId !== 'startScreen') {
        // Показываем кнопку назад, если есть история и не на начальном экране
        window.Telegram.WebApp.BackButton.show();
      } else {
        // Скрываем кнопку назад на начальном экране
        window.Telegram.WebApp.BackButton.hide();
      }
    }
    
    // Фокус на поля ввода
    if (screenId === 'nameScreen') {
const nameInput = document.getElementById('nameInput');
      if (nameInput) nameInput.focus();
    } else if (screenId === 'questionScreen') {
const questionInput = document.getElementById('questionInput');
      if (questionInput) questionInput.focus();
    } else if (screenId === 'answerScreen') {
const answerInput = document.getElementById('answerInput');
      if (answerInput) answerInput.focus();
    }
  } else {
    console.error(`Экран ${screenId} не найден!`);
  }
}

// Функция возврата назад
function goBack() {
  // Проверяем, не нужно ли сначала скрыть клавиатуру
  if (hideKeyboard()) {
    console.log('Клавиатура скрыта');
    keyboardVisible = false;
    return; // Останавливаемся, если клавиатура была скрыта
  }

  if (navigationHistory.length > 0) {
    const previousScreen = navigationHistory.pop();
    console.log(`Возвращаемся к экрану: ${previousScreen}`);
    
    // Показываем предыдущий экран без добавления в историю
    const screens = [
      'startScreen', 'nameScreen', 'gameScreen', 'questionScreen',
      'answerScreen', 'votingScreen', 'resultsScreen'
    ];
    
    screens.forEach(id => {
      const screen = document.getElementById(id);
      if (screen) {
        screen.style.display = id === previousScreen ? 'block' : 'none';
      }
    });
    
    // Управление кнопкой "Назад" в Telegram
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.BackButton) {
      if (navigationHistory.length > 0 && previousScreen !== 'startScreen') {
        window.Telegram.WebApp.BackButton.show();
      } else {
        window.Telegram.WebApp.BackButton.hide();
      }
    }
  } else {
    // Если истории нет, возвращаемся на начальный экран
    showScreen('startScreen');
  }
}

// Обработчик для начала приложения
window.startApp = function() {
  console.log("Вызвана функция startApp()");
  
  // Инициализация WebApp
  if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
    
    // Настраиваем обработчик кнопки "Назад"
    // Обработчик уже устанавливается в DOMContentLoaded, не дублируем его здесь
  }
  
  // Проверяем, есть ли у пользователя сохраненные имена или данные Telegram
  const telegramName = getTelegramUserName();
  const savedNames = getSavedNames();
  
  if (savedNames.length > 0) {
    // Если есть сохраненные имена, показываем экран выбора
    showScreen('nameScreen');
    showNameChoiceOptions();
  } else if (telegramName) {
    // Если есть имя из Telegram, предлагаем его использовать
    showScreen('nameScreen');
    showTelegramNameOption();
  } else {
    // Если нет ни сохраненных имен, ни данных Telegram, показываем форму для нового имени
    showScreen('nameScreen');
    showNewNameForm();
  }
};

// Обработчики для отслеживания состояния клавиатуры
document.addEventListener('focusin', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    console.log('Клавиатура активирована');
    keyboardVisible = true;
    document.body.classList.add('keyboard-open');
  }
});

document.addEventListener('focusout', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    // Небольшая задержка для правильной обработки событий
    setTimeout(() => {
      if (!isInputActive()) {
        console.log('Клавиатура скрыта');
        keyboardVisible = false;
        document.body.classList.remove('keyboard-open');
      }
    }, 100);
  }
});

// Добавляем обработчик для аппаратной кнопки "Назад" на Android
window.addEventListener('popstate', function(e) {
  // Предотвращаем стандартное поведение только если клавиатура открыта
  if (keyboardVisible) {
    e.preventDefault();
    hideKeyboard();
  } else {
    goBack();
  }
});

// Предотвращаем стандартное поведение событий "back" Telegram WebApp
document.addEventListener('DOMContentLoaded', function() {
  // Добавляем history state, чтобы сработал popstate
  history.pushState({page: 1}, "Папа Трубок", null);
  
  // Для Telegram WebApp устанавливаем дополнительный обработчик
  if (window.Telegram && window.Telegram.WebApp) {
    // Если доступен, включаем подтверждение закрытия
    if (typeof window.Telegram.WebApp.enableClosingConfirmation === 'function') {
      window.Telegram.WebApp.enableClosingConfirmation();
    }
    
    // Устанавливаем обработчик кнопки "Назад" Telegram
    if (window.Telegram.WebApp.BackButton) {
      window.Telegram.WebApp.BackButton.onClick(function() {
        goBack();
      });
    }
  }
  
  // Добавляем кнопки для анонимной регистрации
  setupAnonymousRegistration();
});

// Отключаем функцию setupAnonymousRegistration, заменяя её на заглушку
function setupAnonymousRegistration() {
  // Анонимность отключена
  console.log('Анонимное голосование отключено');
}

// Функция для отображения опции использования имени из Telegram
function showTelegramNameOption() {
  const telegramName = getTelegramUserName();
  
  // Скрываем все секции ввода имени
  const sections = ['newNameSection', 'existingNameSection'];
  sections.forEach(id => {
    const section = document.getElementById(id);
    if (section) section.style.display = 'none';
  });
  
  // Показываем главные кнопки выбора
  const choiceButtons = document.getElementById('nameChoiceButtons');
  if (choiceButtons) {
    // Создаем HTML для кнопок
    choiceButtons.innerHTML = `
      <button id="useTelegramNameBtn" class="papyrus-button shimmer">Использовать имя из Telegram: ${telegramName}</button>
      <button id="newNameBtn" class="papyrus-button shimmer">Придумать другое имя</button>
      <button id="existingNameBtn" class="papyrus-button shimmer ${getSavedNames().length ? '' : 'disabled'}" ${getSavedNames().length ? '' : 'disabled'}>Использовать сохранённое имя</button>
    `;
    choiceButtons.style.display = 'block';
    
    // Добавляем обработчики для кнопок
    document.getElementById('useTelegramNameBtn').addEventListener('click', function() {
      currentUser.name = telegramName;
      currentUser.anonymous = false; // Имя из Telegram не анонимное
      showScreen('gameScreen');
      showNotification(`Используем имя: ${telegramName}`, 'success');
      loadGames();
    });
    
    document.getElementById('newNameBtn').addEventListener('click', showNewNameForm);
    
    const existingNameBtn = document.getElementById('existingNameBtn');
    existingNameBtn.addEventListener('click', showExistingNames);
    
    // Отключаем кнопку, если нет сохраненных имен
    if (getSavedNames().length === 0) {
      existingNameBtn.classList.add('disabled');
      existingNameBtn.style.opacity = '0.5';
      existingNameBtn.title = 'Нет сохраненных имен';
    }
  }
}

// Функция для отображения опций выбора имени
function showNameChoiceOptions() {
  // Скрываем все секции ввода имени
  const sections = ['newNameSection', 'existingNameSection'];
  sections.forEach(id => {
    const section = document.getElementById(id);
    if (section) section.style.display = 'none';
  });
  
  // Проверяем, есть ли имя из Telegram
  const telegramName = getTelegramUserName();
  
  // Показываем главные кнопки выбора
  const choiceButtons = document.getElementById('nameChoiceButtons');
  if (choiceButtons) {
    // Создаем HTML для кнопок, включая опцию имени из Telegram, если доступно
    let buttonHtml = '';
    
    if (telegramName) {
      buttonHtml += `<button id="useTelegramNameBtn" class="papyrus-button shimmer">Использовать имя из Telegram: ${telegramName}</button>`;
    }
    
    buttonHtml += `
      <button id="newNameBtn" class="papyrus-button shimmer">Новое имя</button>
      <button id="existingNameBtn" class="papyrus-button shimmer">Использовать сохранённое имя</button>
    `;
    
    choiceButtons.innerHTML = buttonHtml;
    choiceButtons.style.display = 'block';
    
    // Добавляем обработчики для кнопок
    if (telegramName) {
      document.getElementById('useTelegramNameBtn').addEventListener('click', function() {
        currentUser.name = telegramName;
        currentUser.anonymous = false; // Имя из Telegram не анонимное
        showScreen('gameScreen');
        showNotification(`Используем имя: ${telegramName}`, 'success');
        loadGames();
      });
    }
    
    document.getElementById('newNameBtn').addEventListener('click', showNewNameForm);
    document.getElementById('existingNameBtn').addEventListener('click', showExistingNames);
  }
  
  // Проверяем, есть ли сохраненные имена
  const savedNames = getSavedNames();
  const existingNameBtn = document.getElementById('existingNameBtn');
  if (existingNameBtn) {
    // Деактивируем кнопку, если нет сохраненных имен
    if (savedNames.length === 0) {
      existingNameBtn.classList.add('disabled');
      existingNameBtn.style.opacity = '0.5';
      existingNameBtn.title = 'Нет сохраненных имен';
    } else {
      existingNameBtn.classList.remove('disabled');
      existingNameBtn.style.opacity = '1';
      existingNameBtn.title = '';
    }
  }
}

// Функция для показа формы ввода нового имени
function showNewNameForm() {
  // Скрываем кнопки выбора
  const choiceButtons = document.getElementById('nameChoiceButtons');
  if (choiceButtons) choiceButtons.style.display = 'none';
  
  // Скрываем секцию существующих имен
  const existingNameSection = document.getElementById('existingNameSection');
  if (existingNameSection) existingNameSection.style.display = 'none';
  
  // Показываем форму нового имени
  const newNameSection = document.getElementById('newNameSection');
  if (newNameSection) newNameSection.style.display = 'block';
  
  // Фокус на поле ввода
  const nameInput = document.getElementById('nameInput');
  if (nameInput) nameInput.focus();
}

// Функция для показа списка сохраненных имен
function showExistingNames() {
  // Получаем сохраненные имена
  const savedNames = getSavedNames();
  if (savedNames.length === 0) {
    showNotification('Нет сохраненных имен. Создайте новое имя.', 'info');
    showNewNameForm();
    return;
  }
  
  // Скрываем кнопки выбора
  const choiceButtons = document.getElementById('nameChoiceButtons');
  if (choiceButtons) choiceButtons.style.display = 'none';
  
  // Скрываем форму нового имени
  const newNameSection = document.getElementById('newNameSection');
  if (newNameSection) newNameSection.style.display = 'none';
  
  // Показываем секцию с сохраненными именами
  const existingNameSection = document.getElementById('existingNameSection');
  if (existingNameSection) existingNameSection.style.display = 'block';
  
  // Заполняем список сохраненных имен
  const savedNamesList = document.getElementById('savedNamesList');
  if (savedNamesList) {
    let html = '';
    savedNames.forEach((nameData) => {
      html += `
        <div class="game-item">
          <h3>${nameData.name} ${nameData.anonymous ? '(анонимно)' : ''}</h3>
          <div class="button-group">
            <button class="papyrus-button shimmer" onclick="selectExistingName('${nameData.name}', ${nameData.anonymous})">Выбрать</button>
            <button class="papyrus-button shimmer" onclick="deleteExistingName('${nameData.name}')">Удалить</button>
          </div>
        </div>
      `;
    });
    savedNamesList.innerHTML = html;
  }
}

// Функция для выбора существующего имени
function selectExistingName(name, anonymous = false) {
  console.log(`Выбрано имя: ${name}, анонимно: ${anonymous}`);
  currentUser.name = name;
  currentUser.anonymous = anonymous;
  showScreen('gameScreen');
  showNotification(`Добро пожаловать, ${name}!`, 'success');
  
  // Реальная загрузка списка игр с сервера
  loadGames();
}

// Функция для удаления существующего имени
function deleteExistingName(name) {
  const savedNames = getSavedNames();
  const updatedNames = savedNames.filter(nameData => nameData.name !== name);
  saveNamesToStorage(updatedNames);
  
  showNotification(`Имя ${name} удалено`, 'success');
  
  // Перезагружаем список имен
  showExistingNames();
  
  // Если больше нет имен, показываем форму нового имени
  if (updatedNames.length === 0) {
    showNewNameForm();
  }
}

// Получение сохраненных имен из localStorage для текущего пользователя
function getSavedNames() {
  // Получаем уникальный ключ для текущего пользователя Telegram
  const userId = getTelegramUserId();
  const storageKey = `papaTrubokSavedNames_${userId}`;
  
  let savedNames = localStorage.getItem(storageKey);
  
  if (savedNames) {
    try {
      savedNames = JSON.parse(savedNames);
      if (Array.isArray(savedNames)) {
        return savedNames;
      }
    } catch (e) {
      console.error('Ошибка парсинга сохраненных имен:', e);
    }
  }
  
  return [];
}

// Сохранение имен в localStorage для текущего пользователя
function saveNamesToStorage(names) {
  // Получаем уникальный ключ для текущего пользователя Telegram
  const userId = getTelegramUserId();
  const storageKey = `papaTrubokSavedNames_${userId}`;
  
  if (Array.isArray(names)) {
    localStorage.setItem(storageKey, JSON.stringify(names));
  }
}

// Обновляем функцию saveName, чтобы всегда устанавливать anonymous в false
function saveName() {
  const nameInput = document.getElementById('nameInput');
  if (!nameInput) {
    console.error('Элемент ввода имени не найден!');
    showNotification('Ошибка приложения. Попробуйте обновить страницу.', 'error');
    return;
  }
  
  const name = nameInput.value.trim();
  if (name.length < 3) {
    showNotification('Имя должно содержать минимум 3 символа', 'warning');
    return;
  }
  
  // Анонимность всегда отключена
  const anonymous = false;
  
  console.log(`Сохраняем имя: ${name}, анонимно: ${anonymous}`);
  currentUser.name = name;
  currentUser.anonymous = anonymous;
  
  // Сохраняем имя в локальное хранилище
  const savedNames = getSavedNames();
  const existingNameIndex = savedNames.findIndex(nameData => nameData.name === name);
  
  if (existingNameIndex !== -1) {
    // Обновляем существующее имя
    savedNames[existingNameIndex].anonymous = anonymous;
  } else {
    // Добавляем новое имя
    savedNames.push({ name, anonymous });
  }
  
  saveNamesToStorage(savedNames);
  
  showScreen('gameScreen');
  showNotification(`Добро пожаловать, ${name}!`, 'success');
  
  // Реальная загрузка списка игр с сервера
  loadGames();
}

// Загрузка списка доступных игр
async function loadGames() {
  const gamesList = document.getElementById('gamesList');
  if (!gamesList) return;
  
  try {
    gamesList.innerHTML = '<p>Загрузка списка игр...</p>';
    
    const response = await fetch(`${API_URL}/games`);
    if (!response.ok) {
      throw new Error(`Ошибка HTTP: ${response.status}`);
    }
    
    const games = await response.json();
    
    if (games.length === 0) {
      gamesList.innerHTML = '<p>Нет доступных игр. Создайте новую!</p>';
      return;
    }
    
    gamesList.innerHTML = '';
    
    games.forEach(game => {
      const gameRoom = document.createElement('div');
      gameRoom.className = 'game-room';
      
      gameRoom.innerHTML = `
        <div class="game-room-header">
          <h2 class="game-room-title">Комната: ${game.name}</h2>
          <span class="game-room-status">${getStatusText(game.status)}</span>
        </div>
        
        <div class="game-room-info">
          <div class="game-room-players">
            <span class="game-room-player">Игроков: ${game.count}/10</span>
          </div>
        </div>
        
        <div class="game-room-actions">
          <button class="join-room-btn" onclick="joinGameRoom('${game.id}')">
            Войти в комнату
          </button>
        </div>
      `;
      
      gamesList.appendChild(gameRoom);
    });
  } catch (error) {
    console.error('Ошибка загрузки игр:', error);
    gamesList.innerHTML = '<p>Ошибка при загрузке игр. Пожалуйста, попробуйте позже.</p>';
  }
}

// Функция для присоединения к комнате игры
async function joinGameRoom(gameId) {
  try {
    console.log(`Присоединяемся к игровой комнате: ${gameId}, пользователь: ${currentUser.id}`);
    
    const response = await fetch(`${API_URL}/games/${gameId}?userId=${currentUser.id}`);
    if (!response.ok) {
      throw new Error('Не удалось загрузить информацию об игре');
    }
    
    const gameData = await response.json();
    console.log('Получены данные игры:', gameData);
    
    // Проверяем, ответил ли пользователь на вопрос
    const answeredResponse = await fetch(`${API_URL}/games/${gameId}/check-answer?userId=${currentUser.id}`);
    const answeredData = await answeredResponse.json();
    const hasAnswered = answeredData.hasAnswered;
    console.log(`Пользователь уже ответил на вопрос: ${hasAnswered}`);
    
    // Если пользователь ответил, получаем его ответ
    let userAnswer = '';
    if (hasAnswered) {
      const userAnswerResponse = await fetch(`${API_URL}/games/${gameId}/user-answer?userId=${currentUser.id}`);
      if (userAnswerResponse.ok) {
        const userAnswerData = await userAnswerResponse.json();
        userAnswer = userAnswerData.answer || '';
        console.log(`Ответ пользователя: "${userAnswer}"`);
      }
    }
    
    // Сохраняем информацию о текущей игре глобально
    currentGame = {
      id: gameId,
      isCreator: gameData.isCreator,
      question: gameData.currentQuestion,
      status: gameData.status,
      participants: gameData.participants,
      answersCount: gameData.answers,
      userAnswer: userAnswer
    };
    
    const gamesList = document.getElementById('gamesList');
    if (!gamesList) return;
    
    gamesList.innerHTML = '';
    
    const gameRoom = document.createElement('div');
    gameRoom.className = 'game-room';
    
    const isCreator = gameData.isCreator;
    const answersCount = gameData.answers;
    const canStartVoting = isCreator && answersCount >= 3 && gameData.status === 'collecting_answers';
    
    gameRoom.innerHTML = `
      <div class="game-room-header">
        <h2 class="game-room-title">Комната #${gameId}</h2>
        <span class="game-room-status">${getStatusText(gameData.status)}</span>
      </div>
      
      <div class="question-box">
        <h3>Вопрос:</h3>
        <p class="question-text">${gameData.currentQuestion || 'Ожидание вопроса от создателя'}</p>
      </div>
      
      <div class="game-room-info">
        <div class="game-room-players">
          <span class="game-room-player">Игроков: ${gameData.participants}</span>
          <span class="game-room-player">Ответов: ${answersCount}</span>
        </div>
      </div>
      
      ${gameData.status === 'collecting_answers' ? `
        <div class="answer-section">
          ${!hasAnswered ? `
            <button id="roomAnswerBtn" class="answer-btn">
              Ответить на вопрос
            </button>
          ` : `
            <div class="user-answer-box">
              <p style="color: #2a9d8f; font-weight: bold; margin-bottom: 10px;">Ваш ответ принят!</p>
              <p style="color: #5a2d0c; font-style: italic;">"${userAnswer}"</p>
              <p style="margin-top: 10px; color: #457b9d;">Ожидайте начала голосования.</p>
            </div>
          `}
        </div>
      ` : ''}
      
      ${isCreator && gameData.status === 'collecting_answers' ? `
        <div class="creator-controls">
          <h3>Управление игрой</h3>
          ${canStartVoting ? `
            <button class="start-voting-btn" id="startVotingBtn">
              Начать голосование
            </button>
          ` : answersCount < 3 ? `
            <p style="color: #e63946; margin: 10px 0;">Для начала голосования нужно минимум 3 ответа (сейчас: ${answersCount})</p>
          ` : ''}
        </div>
      ` : ''}
      
      <div class="game-room-actions">
        ${gameData.status === 'voting' ? `
          <button class="join-room-btn" id="goToVotingBtn">
            Перейти к голосованию
          </button>
        ` : ''}
        
        ${gameData.status === 'results' ? `
          <button class="join-room-btn" id="viewResultsBtn">
            Посмотреть результаты
          </button>
        ` : ''}
        
        <button class="papyrus-button shimmer back-button" id="backToGamesBtn">
          Вернуться к списку игр
        </button>
      </div>
    `;
    
    gamesList.appendChild(gameRoom);
    
    // Добавляем обработчики событий для кнопок
    const roomAnswerBtn = document.getElementById('roomAnswerBtn');
    if (roomAnswerBtn) {
      roomAnswerBtn.addEventListener('click', () => showAnswerScreen(gameData.currentQuestion));
    }
    
    const startVotingBtn = document.getElementById('startVotingBtn');
    if (startVotingBtn) {
      startVotingBtn.addEventListener('click', () => startVoting(gameId));
    }
    
    const goToVotingBtn = document.getElementById('goToVotingBtn');
    if (goToVotingBtn) {
      goToVotingBtn.addEventListener('click', () => loadVotingOptions(gameId));
    }
    
    const viewResultsBtn = document.getElementById('viewResultsBtn');
    if (viewResultsBtn) {
      viewResultsBtn.addEventListener('click', () => loadResults(gameId));
    }
    
    const backToGamesBtn = document.getElementById('backToGamesBtn');
    if (backToGamesBtn) {
      backToGamesBtn.addEventListener('click', loadGames);
    }
    
    // Показываем экран игры
    showScreen('gameScreen');
    
    // Запускаем периодическую проверку статуса игры и обновление состояния комнаты
    stopRoomUpdates(); // Сначала останавливаем предыдущие обновления, если они есть
    startRoomUpdates(gameId); // Запускаем обновления для этой комнаты
  } catch (error) {
    console.error('Ошибка при загрузке комнаты игры:', error);
    showNotification('Не удалось загрузить информацию об игре', 'error');
  }
}

// Функция для получения текстового описания статуса игры
function getStatusText(status) {
  switch (status) {
    case 'collecting_answers':
      return 'Сбор ответов';
    case 'voting':
      return 'Идет голосование';
    case 'completed':
      return 'Игра завершена';
    default:
      return 'Статус неизвестен';
  }
}

// Функция для начала голосования (для создателя комнаты)
async function startVoting(gameId) {
  try {
    if (!currentGame.isCreator) {
      showNotification('Только создатель может начать голосование', 'warning');
      return;
    }
    
    const response = await fetch(`${API_URL}/games/${gameId}/startVoting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: currentUser.id
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Не удалось начать голосование');
    }
    
    showNotification('Голосование успешно началось!', 'success');
    
    // Обновляем страницу комнаты
    joinGameRoom(gameId);
  } catch (error) {
    console.error('Ошибка при запуске голосования:', error);
    showNotification(`Ошибка: ${error.message}`, 'error');
  }
}

// Функция для показа экрана ответа на вопрос
function showAnswerScreen(question) {
  if (!currentGame || !currentGame.id) {
    showNotification('Ошибка: информация об игре потеряна', 'error');
    return;
  }
  
  console.log(`Показываем экран ответа на вопрос: "${question}"`);
  
  const answerQuestionText = document.getElementById('answerQuestionText');
  if (answerQuestionText) {
    answerQuestionText.textContent = question;
  }
  
  // Очищаем поле ввода ответа перед показом
  const answerInput = document.getElementById('answerInput');
  if (answerInput) {
    answerInput.value = '';
  }
  
  showScreen('answerScreen');
}

// Загрузка вариантов для голосования
async function loadVotingOptions(gameId) {
  if (!gameId) {
    if (!currentGame || !currentGame.id) {
      console.error('Нет активной игры для загрузки вариантов голосования');
      return;
    }
    gameId = currentGame.id;
  }
  
  try {
    // Сначала проверяем, голосовал ли пользователь
    const voteCheckResponse = await fetch(`${API_URL}/games/${gameId}/check-vote?userId=${currentUser.id}`);
    const voteCheckData = await voteCheckResponse.json();
    
    if (voteCheckData.hasVoted) {
      showNotification('Вы уже проголосовали в этой игре. Ожидайте результатов.', 'info');
      return;
    }
    
    const response = await fetch(`${API_URL}/games/${gameId}/answers?userId=${currentUser.id}`);
    
    if (!response.ok) {
      showNotification('Не удалось загрузить варианты для голосования. Попробуйте позже.', 'error');
      return;
    }
    
    const data = await response.json();
    
    // Обновляем текст вопроса
    const questionText = document.getElementById('votingQuestionText');
    if (questionText) questionText.textContent = data.question;
    
    // Заполняем список вариантов
    const answerOptions = document.getElementById('answerOptions');
    if (answerOptions) {
      answerOptions.innerHTML = '';
      
      // Перемешиваем варианты ответов для честного голосования
      const shuffledAnswers = [...data.answers].sort(() => Math.random() - 0.5);
      
      shuffledAnswers.forEach(answer => {
        const option = document.createElement('div');
        option.className = 'answer-option';
        option.dataset.id = answer.id;
        
        // Показываем имя пользователя, если ответ не анонимный
        const usernameDisplay = answer.anonymous 
          ? '<div class="answer-username anonymous-user">Анонимный пользователь</div>'
          : `<div class="answer-username">${answer.username}</div>`;
          
        option.innerHTML = `
          <div class="answer-text">${answer.text}</div>
          ${usernameDisplay}
        `;
        option.onclick = function() {
          toggleVoteSelection(this);
        };
        answerOptions.appendChild(option);
      });
    }
    
    // Отображаем экран голосования
    showScreen('votingScreen');
    
    // Обновляем статус голосования
    const votingStatus = document.getElementById('votingStatus');
    if (votingStatus) {
      votingStatus.textContent = 'Выберите 2 самых смешных ответа';
    }
  } catch (error) {
    console.error('Ошибка при загрузке вариантов голосования:', error);
    showNotification('Произошла ошибка при загрузке вариантов. Попробуйте перезагрузить страницу.', 'error');
  }
}

// Обработка выбора ответа при голосовании
let selectedAnswers = [];

function toggleVoteSelection(element) {
  const answerId = element.getAttribute('data-id');
  
  if (element.classList.contains('selected')) {
    // Снимаем выбор
    element.classList.remove('selected');
    selectedAnswers = selectedAnswers.filter(id => id !== answerId);
  } else {
    // Проверяем, что выбрано не более 2 ответов
    if (selectedAnswers.length < 2) {
      element.classList.add('selected');
      selectedAnswers.push(answerId);
    } else {
      showNotification('Вы можете выбрать максимум 2 ответа', 'warning');
      return;
    }
  }
  
  // Обновляем статус голосования
  const votingStatus = document.getElementById('votingStatus');
  if (votingStatus) {
    votingStatus.textContent = `Выбрано ${selectedAnswers.length} из 2 ответов`;
  }
}

// Улучшенная функция для отправки голосов
async function submitVotes() {
  if (!currentGame || !currentGame.id) {
    showNotification('Ошибка: информация об игре отсутствует', 'error');
    return;
  }
  
  const selected = document.querySelectorAll('.answer-option.selected');
  
  if (selected.length !== 2) {
    showNotification('Пожалуйста, выберите ровно 2 ответа', 'warning');
    return;
  }
  
  const votedFor = Array.from(selected).map(el => el.dataset.id);
  
  try {
    const response = await fetch(`${API_URL}/games/${currentGame.id}/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: currentUser.id,
        votedFor: votedFor
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      showNotification(`Ошибка при голосовании: ${errorData.error}`, 'error');
      return;
    }
    
    const result = await response.json();
    
    showNotification('Ваш голос принят! Спасибо за участие.', 'success');
    
    // Если результаты уже готовы, показываем их
    if (result.resultsReady) {
      loadResults(currentGame.id);
    } else {
      // Иначе обновляем статус голосования
      const votingStatus = document.getElementById('votingStatus');
      if (votingStatus) {
        votingStatus.textContent = 'Ваш голос принят! Ожидаем, пока проголосуют все участники...';
        votingStatus.style.color = 'var(--accent-green)';
      }
      
      // Отключаем кнопку голосования
      const submitVotesBtn = document.getElementById('submitVotesBtn');
      if (submitVotesBtn) {
        submitVotesBtn.disabled = true;
        submitVotesBtn.style.opacity = '0.5';
      }
      
      // Отключаем выбор вариантов
      const options = document.querySelectorAll('.answer-option');
      options.forEach(option => {
        option.onclick = null;
        option.style.cursor = 'default';
      });
    }
  } catch (error) {
    console.error('Ошибка при отправке голосов:', error);
    showNotification('Произошла ошибка при отправке голосов. Попробуйте еще раз.', 'error');
  }
}

// Загрузка результатов голосования
async function loadResults(gameId) {
  if (!gameId) {
    if (!currentGame || !currentGame.id) {
      console.error('Нет информации о текущей игре');
      return;
    }
    gameId = currentGame.id;
  }
  
  try {
    const response = await fetch(`${API_URL}/games/${gameId}/results`);
    
    if (!response.ok) {
      throw new Error(`Ошибка HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    const resultsQuestionText = document.getElementById('resultsQuestionText');
    if (resultsQuestionText) {
      resultsQuestionText.textContent = data.question;
    }
    
    const resultsList = document.getElementById('resultsList');
    if (!resultsList) {
      console.error('Элемент для результатов не найден');
      return;
    }
    
    // Очищаем старые результаты
    resultsList.innerHTML = '';
    
    // Добавляем новые результаты
    data.results.forEach((result, index) => {
      const resultItem = document.createElement('div');
      resultItem.className = 'result-item';
      if (index === 0) resultItem.classList.add('winner');
      
      let medal = "";
      if (index === 0) medal = "🥇";
      else if (index === 1) medal = "🥈";
      else if (index === 2) medal = "🥉";
      
      // Отображаем имя пользователя, если ответ не анонимный
      const usernameDisplay = result.anonymous 
        ? '<strong>Анонимный пользователь</strong>'
        : `<strong>${result.username}</strong>`;
      
      resultItem.innerHTML = `
        <div class="medal">${medal}</div>
        <div class="answer-text">${usernameDisplay}: ${result.text}</div>
        <div class="vote-count">${result.votes} голос(ов)</div>
      `;
      
      resultsList.appendChild(resultItem);
    });
    
    showScreen('resultsScreen');
  } catch (error) {
    console.error('Ошибка при загрузке результатов голосования:', error);
    showNotification('Не удалось загрузить результаты голосования. Пожалуйста, попробуйте позже.', 'error');
  }
}

// Периодически проверяем статус игры
let statusCheckInterval = null;

function startStatusCheck() {
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
  }
  
  // Сначала запускаем немедленную проверку
  if (currentGame && currentGame.id) {
    checkGameStatus();
  }
  
  // Затем настраиваем периодическую проверку
  statusCheckInterval = setInterval(() => {
    if (currentGame && currentGame.id) {
      checkGameStatus();
    } else {
      // Если больше нет активной игры, останавливаем проверку
      clearInterval(statusCheckInterval);
      statusCheckInterval = null;
    }
  }, 5000); // Проверка каждые 5 секунд
  
  console.log('Запущена периодическая проверка статуса игры');
}

// Улучшенная функция проверки статуса игры
async function checkGameStatus() {
  if (!currentGame || !currentGame.id) {
    console.error('Нет активной игры для проверки статуса');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/games/${currentGame.id}?_=${Date.now()}`);
    
    if (!response.ok) {
      console.warn(`Ошибка при проверке статуса игры: ${response.status} ${response.statusText}`);
      return;
    }
    
    const gameData = await response.json();
    
    // Проверяем, изменился ли статус
    const statusChanged = gameData.status !== currentGame.status;
    
    // Обновляем локальный статус игры
    currentGame.status = gameData.status;
    
    console.log(`Статус игры ${currentGame.id}: ${gameData.status}, изменился: ${statusChanged}`);
    
    // Реагируем на изменение статуса
    if (statusChanged) {
      if (gameData.status === 'voting') {
        showNotification('Началось голосование! Переходим к выбору лучших ответов.', 'info');
        loadVotingOptions(currentGame.id);
      } else if (gameData.status === 'results') {
        showNotification('Голосование завершено! Переходим к результатам.', 'success');
        loadResults(currentGame.id);
      }
    }
  } catch (error) {
    console.error('Ошибка при проверке статуса игры:', error);
    
    // Дополнительно проверяем сетевое соединение
    if (!navigator.onLine) {
      showNotification('Отсутствует подключение к интернету. Проверьте ваше соединение.', 'error');
    }
  }
}

// Добавим функцию для проверки было ли уже отвечено на вопрос
async function checkIfAnswered(gameId) {
    try {
        const response = await fetch(`${API_URL}/games/${gameId}/check-answer?userId=${currentUser.id}`);
        
        if (!response.ok) {
            return false;
        }
        
        const data = await response.json();
        return data.hasAnswered;
    } catch (error) {
        console.error('Ошибка при проверке ответа:', error);
        return false;
    }
}

// Регистрация всех обработчиков событий для кнопок
document.addEventListener('DOMContentLoaded', function() {
  console.log('Инициализация приложения...');
  
  // Регистрация обработчиков для кнопок выбора имени
  const newNameBtn = document.getElementById('newNameBtn');
  if (newNameBtn) {
    newNameBtn.addEventListener('click', showNewNameForm);
  }
  
  const existingNameBtn = document.getElementById('existingNameBtn');
  if (existingNameBtn) {
    existingNameBtn.addEventListener('click', showExistingNames);
  }
  
  // Регистрация обработчиков для кнопок "Назад"
  const backButtons = [
    { id: 'backToNameChoiceBtn', action: showNameChoiceOptions },
    { id: 'backToNameChoiceFromExistingBtn', action: showNameChoiceOptions },
    { id: 'backToStartBtn', action: () => showScreen('startScreen') },
    { id: 'backToMainFromQuestionBtn', action: () => showScreen('gameScreen') },
    { id: 'backToMainFromAnswerBtn', action: () => showScreen('gameScreen') },
    { id: 'backToMainFromVotingBtn', action: () => showScreen('gameScreen') },
    { id: 'backToMainBtn', action: () => showScreen('gameScreen') }
  ];
  
  backButtons.forEach(button => {
    const element = document.getElementById(button.id);
    if (element) {
      element.addEventListener('click', button.action);
    }
  });
  
  // Регистрация обработчиков для функциональных кнопок
  const submitNameBtn = document.getElementById('submitNameBtn');
  if (submitNameBtn) {
    submitNameBtn.addEventListener('click', saveName);
  }
  
  const createGameBtn = document.getElementById('createGameBtn');
  if (createGameBtn) {
    createGameBtn.addEventListener('click', createNewGame);
  }
  
  const refreshGamesBtn = document.getElementById('refreshGamesBtn');
  if (refreshGamesBtn) {
    refreshGamesBtn.addEventListener('click', loadGames);
  }
  
  const submitQuestionBtn = document.getElementById('submitQuestionBtn');
  if (submitQuestionBtn) {
    submitQuestionBtn.addEventListener('click', saveQuestion);
  }
  
  const submitAnswerBtn = document.getElementById('submitAnswerBtn');
  if (submitAnswerBtn) {
    submitAnswerBtn.addEventListener('click', submitAnswer);
  }
  
  const submitVotesBtn = document.getElementById('submitVotesBtn');
  if (submitVotesBtn) {
    submitVotesBtn.addEventListener('click', submitVotes);
  }

  // Если мы внутри Telegram WebApp, готовим его
  if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.ready();
    // Настраиваем обработчик кнопки "Назад"
    window.Telegram.WebApp.BackButton.onClick(goBack);
  }
});

// Обработка ошибок
window.addEventListener('error', function(event) {
  console.error('Глобальная ошибка:', event.error || event.message);
});