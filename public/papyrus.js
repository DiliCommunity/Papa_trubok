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
  name: ''
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
  
  showScreen('nameScreen');
  
  // Показываем главный выбор имен при загрузке экрана
  showNameChoiceOptions();
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
});

// Функция для отображения опций выбора имени
function showNameChoiceOptions() {
  // Скрываем все секции ввода имени
  const sections = ['newNameSection', 'existingNameSection'];
  sections.forEach(id => {
    const section = document.getElementById(id);
    if (section) section.style.display = 'none';
  });
  
  // Показываем главные кнопки выбора
  const choiceButtons = document.getElementById('nameChoiceButtons');
  if (choiceButtons) choiceButtons.style.display = 'block';
  
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
    savedNames.forEach(name => {
      html += `
        <div class="game-item">
          <h3>${name}</h3>
          <button class="papyrus-button shimmer" onclick="selectExistingName('${name}')">Выбрать</button>
        </div>
      `;
    });
    savedNamesList.innerHTML = html;
  }
}

// Функция для выбора существующего имени
function selectExistingName(name) {
  console.log(`Выбрано имя: ${name}`);
  currentUser.name = name;
  showScreen('gameScreen');
  showNotification(`Добро пожаловать, ${name}!`, 'success');
  
  // Реальная загрузка списка игр с сервера
  loadGames();
}

// Получение сохраненных имен из localStorage
function getSavedNames() {
  // Получаем имена из локального хранилища
  let savedNames = localStorage.getItem('papaTrubokSavedNames');
  
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

// Сохранение имен в localStorage
function saveNamesToStorage(names) {
  if (Array.isArray(names)) {
    localStorage.setItem('papaTrubokSavedNames', JSON.stringify(names));
  }
}

// Сохранение имени пользователя
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
  
  console.log(`Сохраняем имя: ${name}`);
  currentUser.name = name;
  
  // Сохраняем имя в локальное хранилище
  const savedNames = getSavedNames();
  if (!savedNames.includes(name)) {
    savedNames.push(name);
    saveNamesToStorage(savedNames);
  }
  
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
    
    let html = '';
    games.forEach(game => {
      html += `
        <div class="game-item">
          <h3>Комната: ${game.name}</h3>
          <p>Участников: ${game.count}/10</p>
          <p>Статус: ${getStatusText(game.status)}</p>
          <button class="papyrus-button shimmer" onclick="joinGame('${game.id}')">Присоединиться</button>
        </div>
      `;
    });
    
    gamesList.innerHTML = html;
  } catch (error) {
    console.error('Ошибка загрузки игр:', error);
    gamesList.innerHTML = '<p>Ошибка при загрузке игр. Пожалуйста, попробуйте позже.</p>';
  }
}

// Перевод статуса игры в читаемый текст
function getStatusText(status) {
  switch(status) {
    case 'waiting_players': return 'Ожидание участников';
    case 'collecting_answers': return 'Сбор ответов';
    case 'voting': return 'Голосование';
    case 'results': return 'Результаты';
    default: return 'Неизвестный статус';
  }
}

// Функция создания новой игры
function createNewGame() {
  console.log("Вызвана функция createNewGame()");
  showScreen('questionScreen');
}

// Сохранение вопроса и создание игры
async function saveQuestion() {
  const questionInput = document.getElementById('questionInput');
  if (!questionInput) {
    console.error('Элемент ввода вопроса не найден!');
    showNotification('Ошибка приложения. Попробуйте обновить страницу.', 'error');
    return;
  }
  
  const question = questionInput.value.trim();
  if (question.length < 5) {
    showNotification('Вопрос должен содержать минимум 5 символов', 'warning');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/games`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: currentUser.id,
        userName: currentUser.name,
        question: question
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'success') {
      currentGame = {
        id: data.gameId,
        isCreator: true,
        question: question,
        status: 'waiting_players'
      };
      
      showNotification('Игра успешно создана! Ожидайте подключения участников.', 'success');
      
      // Переходим в режим ответа на свой вопрос
      showAnswerScreen(question);
    } else {
      showNotification('Ошибка при создании игры: ' + (data.error || 'Неизвестная ошибка'), 'error');
    }
  } catch (error) {
    console.error('Ошибка создания игры:', error);
    showNotification('Произошла ошибка при создании игры. Пожалуйста, попробуйте еще раз.', 'error');
  }
}

// Показ экрана ответа на вопрос
function showAnswerScreen(question) {
  const answerQuestionText = document.getElementById('answerQuestionText');
  if (answerQuestionText) {
    answerQuestionText.textContent = question;
  }
  showScreen('answerScreen');
}

// Присоединение к игре
async function joinGame(gameId) {
  if (!currentUser.name) {
    showNotification('Сначала нужно задать имя!', 'warning');
    showScreen('nameScreen');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/games/${gameId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: currentUser.id,
        userName: currentUser.name
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    currentGame = {
      id: gameId,
      isCreator: false,
      question: data.question,
      status: data.status || 'waiting_players'
    };
    
    console.log(`Присоединились к игре, статус: ${currentGame.status}, вопрос: ${currentGame.question ? 'есть' : 'нет'}`);
    
    if (data.question) {
      if (currentGame.status === 'collecting_answers' || currentGame.status === 'waiting_players') {
        showAnswerScreen(data.question);
      } else if (currentGame.status === 'voting') {
        showNotification('В этой игре уже идет голосование!', 'info');
        loadVotingOptions();
      } else if (currentGame.status === 'results') {
        showNotification('Эта игра уже завершена. Вы можете посмотреть результаты.', 'info');
        loadResults();
      }
    } else {
      showNotification('Вы присоединились к игре! Ожидайте, пока создатель выберет вопрос.', 'success');
      showScreen('gameScreen');
    }
  } catch (error) {
    console.error('Ошибка присоединения к игре:', error);
    showNotification('Произошла ошибка при присоединении к игре. Пожалуйста, попробуйте еще раз.', 'error');
  }
}

// Отправка ответа на вопрос
async function submitAnswer() {
  if (!currentGame || !currentGame.id) {
    showNotification('Ошибка: информация об игре отсутствует', 'error');
    return;
  }
  
  const answerInput = document.getElementById('answerInput');
  if (!answerInput) {
    console.error('Элемент ввода ответа не найден!');
    showNotification('Произошла ошибка. Попробуйте обновить страницу.', 'error');
    return;
  }
  
  const answer = answerInput.value.trim();
  if (answer.length < 1) {
    showNotification('Пожалуйста, введите ваш ответ', 'warning');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/games/${currentGame.id}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: currentUser.id,
        answer: answer
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    showNotification(`Ваш ответ принят! Осталось ответов до голосования: ${data.remainingToVoting}`, 'success');
    
    // Если это создатель игры, показываем ему доп. опции
    if (currentGame.isCreator) {
      showCreatorOptions();
    } else {
      showScreen('gameScreen');
    }
  } catch (error) {
    console.error('Ошибка отправки ответа:', error);
    showNotification('Произошла ошибка при отправке ответа. Пожалуйста, попробуйте еще раз.', 'error');
  }
}

// Показ опций для создателя игры
function showCreatorOptions() {
  const gamesList = document.getElementById('gamesList');
  if (gamesList && currentGame) {
    showScreen('gameScreen');
    gamesList.innerHTML = `
      <div class="creator-options">
        <h2>Вы создатель игры</h2>
        <p>Вопрос: "${currentGame.question}"</p>
        <button class="papyrus-button shimmer" onclick="startVoting()">Начать голосование</button>
        <button class="papyrus-button shimmer" onclick="loadGames()">Вернуться к списку игр</button>
      </div>
    `;
  }
}

// Запуск голосования
async function startVoting() {
  if (!currentGame || !currentGame.id || !currentGame.isCreator) {
    showNotification('Только создатель игры может начать голосование', 'warning');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/games/${currentGame.id}/startVoting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: currentUser.id
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    showNotification('Голосование успешно запущено!', 'success');
    currentGame.status = 'voting';
    loadVotingOptions();
  } catch (error) {
    console.error('Ошибка запуска голосования:', error);
    showNotification('Произошла ошибка при запуске голосования. Пожалуйста, попробуйте еще раз.', 'error');
  }
}

// Периодически проверяем статус игры
let statusCheckInterval = null;

function startStatusCheck() {
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
  }
  
  statusCheckInterval = setInterval(() => {
    if (currentGame && currentGame.id) {
      checkGameStatus();
    }
  }, 5000); // Проверка каждые 5 секунд
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
    
    // Обновляем локальный статус игры
    currentGame.status = gameData.status;
    
    console.log(`Статус игры ${currentGame.id}: ${gameData.status}`);
    
    // Реагируем на изменение статуса
    if (gameData.status === 'voting' && document.getElementById('answerScreen').style.display === 'block') {
      showNotification('Началось голосование! Переходим к выбору лучших ответов.', 'info');
      loadVotingOptions();
    } else if (gameData.status === 'results' && document.getElementById('votingScreen').style.display === 'block') {
      showNotification('Голосование завершено! Переходим к результатам.', 'success');
      loadResults();
    }
  } catch (error) {
    console.error('Ошибка при проверке статуса игры:', error);
    
    // Дополнительно проверяем сетевое соединение
    if (!navigator.onLine) {
      showNotification('Отсутствует подключение к интернету. Проверьте ваше соединение.', 'error');
    }
  }
}

// Загрузка вариантов для голосования
async function loadVotingOptions() {
  if (!currentGame || !currentGame.id) {
    console.error('Нет активной игры для загрузки вариантов голосования');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/games/${currentGame.id}/answers?userId=${currentUser.id}`);
    
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
        option.innerHTML = `
          <div class="answer-text">${answer.text}</div>
          <div class="answer-username">${answer.username}</div>
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
      const error = await response.json();
      showNotification(`Ошибка при голосовании: ${error.error}`, 'error');
      return;
    }
    
    const result = await response.json();
    
    showNotification('Ваш голос принят! Спасибо за участие.', 'success');
    
    // Если результаты уже готовы, показываем их
    if (result.resultsReady) {
      loadResults();
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
async function loadResults() {
  if (!currentGame || !currentGame.id) {
    console.error('Нет информации о текущей игре');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/games/${currentGame.id}/results`);
    
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
      
      resultItem.innerHTML = `
        <div class="medal">${medal}</div>
        <div class="answer-text"><strong>${result.username}:</strong> ${result.text}</div>
        <div class="vote-count">${result.votes} голос(ов)</div>
      `;
      
      resultsList.appendChild(resultItem);
    });
    
    showScreen('resultsScreen');
  } catch (error) {
    console.error('Ошибка загрузки результатов:', error);
    showNotification('Произошла ошибка при загрузке результатов: ' + error.message, 'error');
    showScreen('gameScreen');
  }
}

// Инициализация при загрузке страницы
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