// Глобальная инициализация API_URL
let API_URL = '/api'; // По умолчанию API находится на том же домене
let navigationHistory = []; // История навигации для кнопки "Назад"
let keyboardVisible = false; // Флаг для отслеживания видимости клавиатуры

// Глобальные переменные с начальными значениями
let currentUser = null;
let currentGame = null;

// Глобальные переменные для блокировки закрытия
let preventUnload = true;
let unloadTimer = null;

console.log("papyrus.js загружен");

// Функция тестирования соединения с сервером
async function testServerConnection() {
  try {
    console.log('Тестирование соединения с сервером...');
    const response = await fetch(`${API_URL}/ping`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Соединение с сервером установлено:', data);
      return true;
    } else {
      console.error('Ошибка соединения с сервером:', response.status);
      return false;
    }
  } catch (error) {
    console.error('Ошибка при проверке соединения:', error);
    return false;
  }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    console.log('Загрузка приложения...');
    
    // Инициализируем API_URL в зависимости от окружения
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Для локальной разработки
        const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
        API_URL = `${window.location.protocol}//${window.location.hostname}:${port}`;
    } else {
        // Для продакшена
        API_URL = '';
    }
    console.log('API_URL инициализирован:', API_URL);
    
    // Делаем API_URL доступным глобально
    window.API_URL = API_URL;
    
    // Инициализируем данные пользователя, используя Telegram ID если доступен
    const telegramId = getTelegramUserId();
    
    // Если есть Telegram ID, используем его, иначе создаем временного пользователя
    if (telegramId) {
        console.log(`Обнаружен пользователь Telegram с ID: ${telegramId}`);
        currentUser = {
            id: telegramId,
            name: getTelegramUserName() || 'Пользователь Telegram',
            anonymous: false
        };
        
        console.log('Данные пользователя из Telegram:', currentUser);
    } else {
        // Для отладки создаем тестового пользователя
        // В реальной версии это должен быть идентификатор сессии или другой механизм
        const randomId = 'user_' + Math.floor(Math.random() * 1000000);
                currentUser = {
            id: randomId,
            name: 'Гость_' + randomId.substr(-4),
                    anonymous: false
                };
        
        console.log('Создан временный пользователь:', currentUser);
    }
    
    // Делаем текущего пользователя доступным глобально
    window.currentUser = currentUser;
    
    // Инициализируем обработчики кнопок и событий
    initButtonHandlers();
    
    // Показываем стартовый экран
    showScreen('startScreen');
    
    // Проверяем, была ли предыдущая игра
    checkLastGame();
    
    console.log('Инициализация приложения завершена!');
});

// Функция проверки авторизации
function checkAuth() {
  try {
    const authData = localStorage.getItem('papaTrubokAuth');
    if (!authData) {
      console.log('Пользователь не авторизован, перенаправление на страницу регистрации');
      window.location.href = 'register.html';
      return false;
    }
    
    // Проверка валидности данных авторизации
    const parsedAuthData = JSON.parse(authData);
    if (!parsedAuthData || !parsedAuthData.userId || !parsedAuthData.method) {
      console.log('Данные авторизации недействительны, перенаправление на страницу регистрации');
      localStorage.removeItem('papaTrubokAuth');
      window.location.href = 'register.html';
      return false;
    }
    
    // Устанавливаем данные текущего пользователя из сохраненной авторизации
    if (parsedAuthData.userId) {
      // Используем глобальную переменную currentUser вместо window.currentUser
      currentUser = currentUser || {};
      currentUser.id = parsedAuthData.userId;
      if (parsedAuthData.name) {
        currentUser.name = parsedAuthData.name;
      }
      
      console.log('Авторизованный пользователь:', currentUser);
    }
    
    console.log('Пользователь авторизован:', parsedAuthData.method);
    return true;
  } catch (error) {
    console.error('Ошибка при проверке авторизации:', error);
    window.location.href = 'register.html';
    return false;
  }
}

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

// Использование Telegram ID пользователя
function getTelegramUserId() {
  if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
    return window.Telegram.WebApp.initDataUnsafe.user.id || Math.floor(Math.random() * 1000000);
  }
  return Math.floor(Math.random() * 1000000);
}

// Получение имени пользователя из Telegram
function getTelegramUserName() {
  try {
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
      const user = window.Telegram.WebApp.initDataUnsafe.user;
      return formatTelegramName(user);
    }
  } catch (error) {
    console.error('Ошибка при получении имени пользователя Telegram:', error);
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
    'answerScreen', 'votingScreen', 'resultsScreen', 'roomScreen'
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
      'answerScreen', 'votingScreen', 'resultsScreen', 'roomScreen'
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
    // Если истории нет, возвращаемся на начальный экран вместо выхода из приложения
    showScreen('startScreen');
  }
  
  // Добавляем новое состояние в историю браузера для предотвращения выхода из приложения
  window.history.pushState({ page: Date.now() }, "", window.location.href);
}

// Обработчик для начала приложения
window.startApp = function() {
  console.log("Вызвана функция startApp()");
  
  // Инициализация WebApp
  if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
  }
  
  // Переходим к экрану ввода имени
  showScreen('nameScreen');
  
  // Показываем опции выбора имени
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
  e.preventDefault(); // Всегда предотвращаем стандартное поведение кнопки назад
  
  // Обрабатываем нажатие кнопки "Назад"
  if (keyboardVisible) {
    hideKeyboard();
  } else {
    goBack(); // Наша собственная логика навигации назад
  }
  
  // Добавляем новое состояние в историю, чтобы предотвратить выход из приложения
  history.pushState({page: 'current'}, document.title, window.location.href);
  
  return false;
});

// Добавляем начальное состояние в историю при загрузке страницы
window.addEventListener('load', function() {
  history.pushState({page: 'initial'}, document.title, window.location.href);
});

// Обработчик события перед закрытием страницы
window.addEventListener('beforeunload', function(event) {
  console.log('Страница закрывается...');
  
  // Если пользователь находится в игре, сохраняем информацию
  if (currentGame && currentGame.id) {
    console.log(`Сохраняем информацию о игре ${currentGame.id}...`);
    
    try {
      localStorage.setItem('papaTrubok_lastGame', JSON.stringify({
        gameId: currentGame.id,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Не удалось сохранить информацию о последней игре:', error);
    }
  }
});

// При загрузке страницы проверяем, была ли активная игра
function checkLastGame() {
  try {
    const lastGameInfo = localStorage.getItem('papaTrubok_lastGame');
    if (lastGameInfo) {
      const lastGame = JSON.parse(lastGameInfo);
      const currentTime = Date.now();
      
      // Если прошло меньше 30 минут с момента последней игры, предлагаем вернуться
      if (currentTime - lastGame.timestamp < 30 * 60 * 1000) {
        showNotification(`У вас есть активная игра. Хотите вернуться?`, 'info');
        
        // Создаем кнопку для возврата в игру
        const returnToGameBtn = document.createElement('button');
        returnToGameBtn.className = 'papyrus-button shimmer';
        returnToGameBtn.textContent = 'Вернуться в игру';
        returnToGameBtn.addEventListener('click', function() {
          if (currentUser && currentUser.name) {
            joinGameRoom(lastGame.gameId);
          } else {
            // Сохраняем ID игры, чтобы вернуться после ввода имени
            localStorage.setItem('papaTrubok_pendingGameId', lastGame.gameId);
            showScreen('nameScreen');
          }
        });
        
        // Добавляем кнопку в DOM
        const startButtons = document.querySelector('#startScreen .button-container');
        if (startButtons) {
          startButtons.prepend(returnToGameBtn);
        }
      } else {
        // Удаляем устаревшую информацию
        localStorage.removeItem('papaTrubok_lastGame');
      }
    }
  } catch (error) {
    console.error('Ошибка при проверке последней игры:', error);
  }
}

// Инициализация приложения при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM загружен, инициализируем приложение');
  
  // Проверяем авторизацию
  checkAuth();
  
  // Проверяем была ли активная игра
  checkLastGame();
  
  // Инициализация обработчиков кнопок
  initButtonHandlers();
  
  // Активно перехватываем события навигации по истории для предотвращения выхода из приложения
  window.history.pushState({page: 1}, "Папа Трубок", null);
  
  // Это основной обработчик, предотвращающий выход из приложения
  window.addEventListener('popstate', function(e) {
    // Всегда предотвращаем стандартное поведение
    e.preventDefault();
    
    // Наша собственная логика навигации
    if (keyboardVisible) {
      hideKeyboard();
    } else {
      goBack();
    }
    
    // Важно: добавляем новое состояние в историю, чтобы браузер не закрыл приложение
    window.history.pushState({page: Date.now()}, "Папа Трубок", null);
    return false;
  });
  
  // Для Telegram WebApp устанавливаем дополнительный обработчик
  if (window.Telegram && window.Telegram.WebApp) {
    // Инициализация Telegram WebApp
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
    
    // Устанавливаем обработчик кнопки "Назад" Telegram
    if (window.Telegram.WebApp.BackButton) {
      window.Telegram.WebApp.BackButton.onClick(function() {
        // Используем нашу кастомную логику возврата
        goBack();
      });
    }
  }
  
  // Добавляем блокировку hardware back button на Android
  document.addEventListener('backbutton', function(e) {
    console.log('Аппаратная кнопка "Назад" перехвачена');
    e.preventDefault();
    goBack();
    return false;
  }, false);
});

// Добавляем также обработку перед закрытием страницы
window.addEventListener('beforeunload', function(e) {
  // Отменяем стандартное поведение только если мы не на стартовом экране
  let currentScreenId = null;
  const screens = [
    'startScreen', 'nameScreen', 'gameScreen', 'questionScreen',
    'answerScreen', 'votingScreen', 'resultsScreen', 'roomScreen'
  ];
  
  for (const id of screens) {
    const screen = document.getElementById(id);
    if (screen && screen.style.display === 'block') {
      currentScreenId = id;
      break;
    }
  }
  
  if (currentScreenId && currentScreenId !== 'startScreen') {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
});

// Инициализация обработчиков кнопок
function initButtonHandlers() {
  console.log('Инициализация обработчиков всех кнопок приложения...');
  
  // Тестовая кнопка создания игры
  const testCreateGameBtn = document.getElementById('testCreateGameBtn');
  if (testCreateGameBtn) {
    console.log('Найдена кнопка testCreateGameBtn');
    testCreateGameBtn.addEventListener('click', function() {
      console.log('Нажата кнопка "Тест создания игры"');
      testCreateGame();
    });
  } else {
    console.warn('Кнопка testCreateGameBtn не найдена');
  }
  
  // Кнопка начала приложения
  const startAppBtn = document.getElementById('startAppBtn');
  if (startAppBtn) {
    console.log('Найдена кнопка startAppBtn');
    startAppBtn.addEventListener('click', function() {
      console.log('Нажата кнопка "Начать игру"');
      window.startApp();
    });
  } else {
    console.warn('Кнопка startAppBtn не найдена');
  }
  
  // Кнопка возврата на начальный экран
  const backToStartBtn = document.getElementById('backToStartBtn');
  if (backToStartBtn) {
    console.log('Найдена кнопка backToStartBtn');
    backToStartBtn.addEventListener('click', function() {
      console.log('Нажата кнопка "Вернуться в начало"');
      showScreen('startScreen');
    });
  } else {
    console.warn('Кнопка backToStartBtn не найдена');
  }
  
  // Кнопка возврата на форму выбора имени
  const backToNameChoiceBtn = document.getElementById('backToNameChoiceBtn');
  if (backToNameChoiceBtn) {
    console.log('Найдена кнопка backToNameChoiceBtn');
    backToNameChoiceBtn.addEventListener('click', function() {
      console.log('Нажата кнопка "Назад" в форме ввода нового имени');
      showNameChoiceOptions();
    });
  } else {
    console.warn('Кнопка backToNameChoiceBtn не найдена');
  }
  
  // Кнопка возврата из списка существующих имен
  const backToNameChoiceFromExistingBtn = document.getElementById('backToNameChoiceFromExistingBtn');
  if (backToNameChoiceFromExistingBtn) {
    console.log('Найдена кнопка backToNameChoiceFromExistingBtn');
    backToNameChoiceFromExistingBtn.addEventListener('click', function() {
      console.log('Нажата кнопка "Назад" в списке существующих имен');
      showNameChoiceOptions();
    });
  } else {
    console.warn('Кнопка backToNameChoiceFromExistingBtn не найдена');
  }
  
  // Кнопка сохранения имени
  const submitNameBtn = document.getElementById('submitNameBtn');
  if (submitNameBtn) {
    console.log('Найдена кнопка submitNameBtn');
    submitNameBtn.addEventListener('click', function() {
      console.log('Нажата кнопка "Сохранить имя"');
      saveName();
    });
  } else {
    console.warn('Кнопка submitNameBtn не найдена');
  }
  
  // Обработчик нажатия Enter в поле ввода имени
  const nameInput = document.getElementById('nameInput');
  if (nameInput) {
    console.log('Найдено поле ввода имени');
    nameInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        console.log('Нажат Enter в поле ввода имени');
        e.preventDefault();
        saveName();
      }
    });
  } else {
    console.warn('Поле ввода имени не найдено');
  }
  
  // Кнопка создания игры
  const createGameBtn = document.getElementById('createGameBtn');
  if (createGameBtn) {
    console.log('Найдена кнопка createGameBtn');
    createGameBtn.addEventListener('click', function() {
      console.log('Нажата кнопка "Создать новую игру"');
      if (!currentUser.name) {
        console.warn('Нет имени пользователя, перенаправляем на экран выбора имени');
        showNotification('Сначала нужно ввести имя', 'warning');
        showScreen('nameScreen');
        return;
      }
      showScreen('questionScreen');
    });
  } else {
    console.warn('Кнопка createGameBtn не найдена');
  }
  
  // Кнопка обновления списка игр
  const refreshGamesBtn = document.getElementById('refreshGamesBtn');
  if (refreshGamesBtn) {
    console.log('Найдена кнопка refreshGamesBtn');
    refreshGamesBtn.addEventListener('click', function() {
      console.log('Нажата кнопка "Обновить список игр"');
      showNotification('Обновляем список игр...', 'info');
      loadGames();
    });
  } else {
    console.warn('Кнопка refreshGamesBtn не найдена');
  }
  
  // Кнопка возврата к главному меню из экрана создания вопроса
  const backToMainFromQuestionBtn = document.getElementById('backToMainFromQuestionBtn');
  if (backToMainFromQuestionBtn) {
    console.log('Найдена кнопка backToMainFromQuestionBtn');
    backToMainFromQuestionBtn.addEventListener('click', function() {
      console.log('Нажата кнопка "Назад" на экране создания вопроса');
      showScreen('gameScreen');
    });
  } else {
    console.warn('Кнопка backToMainFromQuestionBtn не найдена');
  }
  
  // Обработчик для кнопки отправки вопроса
  const submitQuestionBtn = document.getElementById('submitQuestionBtn');
  if (submitQuestionBtn) {
    console.log('Найдена кнопка submitQuestionBtn');
    
    submitQuestionBtn.addEventListener('click', async function() {
      console.log('Нажата кнопка "Создать игру"');
      
      const questionInput = document.getElementById('questionInput');
      if (!questionInput || !questionInput.value.trim()) {
        console.warn('Не введен вопрос');
        showNotification('Пожалуйста, введите вопрос!', 'warning');
        return;
      }
      
      try {
        // Проверяем, есть ли данные о пользователе
        if (!currentUser || !currentUser.id || !currentUser.name) {
          console.error('Нет данных о пользователе', currentUser);
          showNotification('Пожалуйста, введите ваше имя!', 'warning');
          showScreen('nameScreen');
          return;
        }
        
        // Создаем игру на сервере
        const question = questionInput.value.trim();
        const creatorName = currentUser.name || 'Анонимный';
        
        console.log(`Создаем игру с вопросом: "${question}", создатель: ${creatorName} (ID: ${currentUser.id})`);
        
        // Отправляем запрос на создание игры
        submitQuestionBtn.disabled = true;
        submitQuestionBtn.textContent = 'Создание...';
        
        const apiUrl = window.API_URL || '';
        const requestData = {
          question: question,
          userId: currentUser.id,
          userName: creatorName
        };
        
        try {
          const response = await fetch(`${apiUrl}/api/games`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
          });
          
          if (!response.ok) {
            console.error(`Ошибка при создании игры, статус: ${response.status}`);
            const errorText = await response.text();
            console.error('Текст ошибки:', errorText);
            throw new Error(`Ошибка при создании игры: ${response.status}`);
          }
          
          const game = await response.json();
          console.log('Игра успешно создана, ответ сервера:', game);
          
          // Очищаем поле ввода
          questionInput.value = '';
          
          // Сохраняем ID игры в localStorage
          const gameId = game.gameId || game.id;
          if (gameId) {
            localStorage.setItem('papaTrubok_myGameId', gameId);
            // Переходим на страницу своей игры
            window.location.href = `game.html?id=${gameId}`;
            return;
          } else {
            console.error('Не удалось получить ID созданной игры');
            showNotification('Не удалось получить ID игры. Попробуйте обновить список игр.', 'warning');
            showScreen('gameScreen');
            loadGames();
          }
        } catch (error) {
          console.error('Ошибка при отправке запроса:', error);
          showNotification(`Не удалось создать игру: ${error.message}`, 'error');
          if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            showNotification('Проблема с сетью. Попробуйте позже или используйте тестовое создание игры.', 'warning');
          }
        } finally {
          submitQuestionBtn.disabled = false;
          submitQuestionBtn.textContent = 'Создать игру';
        }
      } catch (error) {
        console.error('Ошибка при создании игры:', error);
        showNotification('Не удалось создать игру. Попробуйте позже.', 'error');
        submitQuestionBtn.disabled = false;
        submitQuestionBtn.textContent = 'Создать игру';
      }
    });
  } else {
    console.warn('Кнопка submitQuestionBtn не найдена');
  }
  
  // Кнопка возврата к главному меню из экрана ответа
  const backToMainFromAnswerBtn = document.getElementById('backToMainFromAnswerBtn');
  if (backToMainFromAnswerBtn) {
    console.log('Найдена кнопка backToMainFromAnswerBtn');
    backToMainFromAnswerBtn.addEventListener('click', function() {
      console.log('Нажата кнопка "Назад" на экране ответа');
      showScreen('roomScreen');
    });
  } else {
    console.warn('Кнопка backToMainFromAnswerBtn не найдена');
  }
  
  // Обработчик нажатия Enter в поле ввода ответа
  const answerInput = document.getElementById('answerInput');
  if (answerInput) {
    console.log('Найдено поле ввода ответа');
    answerInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && e.ctrlKey) {
        console.log('Нажат Ctrl+Enter в поле ввода ответа');
        e.preventDefault();
        document.getElementById('submitAnswerBtn')?.click();
      }
    });
  } else {
    console.warn('Поле ввода ответа не найдено');
  }
  
  // Кнопка отправки ответа - правильно инициализируем обработчик
  const submitAnswerBtn = document.getElementById('submitAnswerBtn');
  if (submitAnswerBtn) {
    console.log('Найдена кнопка submitAnswerBtn');
    // Удаляем существующие обработчики, чтобы избежать дублирования
    submitAnswerBtn.removeEventListener('click', submitAnswer);
    // Добавляем обработчик
    submitAnswerBtn.addEventListener('click', function() {
      console.log('Нажата кнопка "Отправить ответ"');
      submitAnswer();
    });
  } else {
    console.warn('Кнопка submitAnswerBtn не найдена');
  }
  
  // Кнопка отправки голосов
  const submitVotesBtn = document.getElementById('submitVotesBtn');
  if (submitVotesBtn) {
    console.log('Найдена кнопка submitVotesBtn');
    submitVotesBtn.addEventListener('click', function() {
      console.log('Нажата кнопка "Проголосовать"');
      submitVotes();
    });
  } else {
    console.warn('Кнопка submitVotesBtn не найдена');
  }
  
  // Кнопка "Назад" на экране голосования
  const backToMainFromVotingBtn = document.getElementById('backToMainFromVotingBtn');
  if (backToMainFromVotingBtn) {
    console.log('Найдена кнопка backToMainFromVotingBtn');
    backToMainFromVotingBtn.addEventListener('click', function() {
      console.log('Нажата кнопка "Назад" на экране голосования');
      showScreen('roomScreen');
    });
  } else {
    console.warn('Кнопка backToMainFromVotingBtn не найдена');
  }
  
  // Кнопка "Назад" на экране результатов
  const backToMainBtn = document.getElementById('backToMainBtn');
  if (backToMainBtn) {
    console.log('Найдена кнопка backToMainBtn');
    backToMainBtn.addEventListener('click', function() {
      console.log('Нажата кнопка "Вернуться в меню" на экране результатов');
      showScreen('gameScreen');
      loadGames();
    });
  } else {
    console.warn('Кнопка backToMainBtn не найдена');
  }
  
  // Обработчики для комнаты игры
  const answerButton = document.getElementById('answerButton');
  if (answerButton) {
    console.log('Найдена кнопка answerButton');
    // Удаляем существующие обработчики, чтобы избежать дублирования
    answerButton.replaceWith(answerButton.cloneNode(true));
    // Получаем новую ссылку на элемент
    const newAnswerButton = document.getElementById('answerButton');
    if (newAnswerButton) {
      newAnswerButton.addEventListener('click', function() {
        console.log('Нажата кнопка "Ответить на вопрос"');
        if (currentGame && currentGame.currentQuestion) {
          showAnswerScreen(currentGame.currentQuestion);
        } else {
          showNotification('Ошибка загрузки вопроса', 'error');
        }
      });
      console.log('Добавлен обработчик для кнопки "Ответить на вопрос"');
    }
  }
  
  const startVotingButton = document.getElementById('startVotingButton');
  if (startVotingButton) {
    console.log('Найдена кнопка startVotingButton');
    startVotingButton.addEventListener('click', function() {
      console.log('Нажата кнопка "Начать голосование"');
      if (currentGame && currentGame.id) {
        startVoting(currentGame.id);
      } else {
        showNotification('Ошибка: Данные игры не найдены', 'error');
      }
    });
  }
  
  const viewAnswersButton = document.getElementById('viewAnswersButton');
  if (viewAnswersButton) {
    console.log('Найдена кнопка viewAnswersButton');
    viewAnswersButton.addEventListener('click', function() {
      console.log('Нажата кнопка "Просмотр ответов"');
      if (currentGame && currentGame.id) {
        loadVotingOptions(currentGame.id)
          .then(() => {
            showScreen('votingScreen');
          })
          .catch(error => {
            console.error('Ошибка при загрузке вариантов голосования:', error);
            showNotification('Не удалось загрузить варианты ответов', 'error');
          });
      } else {
        showNotification('Ошибка: Данные игры не найдены', 'error');
      }
    });
  }
  
  const leaveRoomButton = document.getElementById('leaveRoomButton');
  if (leaveRoomButton) {
    console.log('Найдена кнопка leaveRoomButton');
    leaveRoomButton.addEventListener('click', function() {
      console.log('Нажата кнопка "Покинуть комнату"');
      // Останавливаем обновление статуса комнаты
      stopRoomUpdates();
      
      // Очищаем данные текущей игры
      currentGame = null;
      
      // Возвращаемся на экран выбора игры
      showScreen('gameScreen');
      
      // Обновляем список игр
      loadGames();
    });
  }
  
  // Добавим обработчики для оставшихся кнопок
  // Добавляем обработчик событий для ввода в поле вопроса
  const questionInput = document.getElementById('questionInput');
  if (questionInput) {
    console.log('Найдено поле ввода вопроса');
    questionInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && e.ctrlKey) {
        console.log('Нажат Ctrl+Enter в поле ввода вопроса');
        e.preventDefault();
        document.getElementById('submitQuestionBtn')?.click();
      }
    });
  } else {
    console.warn('Поле ввода вопроса не найдено');
  }
  
  console.log('Инициализация обработчиков кнопок завершена');
}

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
  if (choiceButtons) {
    // Проверяем, есть ли ID пользователя, если нет - генерируем новый
    if (!currentUser || !currentUser.id) {
      currentUser = currentUser || {};
      currentUser.id = String(Date.now()) + Math.random().toString(36).substring(2, 8);
      console.log('Сгенерирован новый ID пользователя:', currentUser.id);
    }
    
    // Очищаем содержимое и создаем 3 основные кнопки
    choiceButtons.innerHTML = '';
    
    // 1. Кнопка "Создать новое имя"
    const newNameBtn = document.createElement('button');
    newNameBtn.className = 'papyrus-button shimmer';
    newNameBtn.textContent = 'Создать новое имя';
    newNameBtn.addEventListener('click', showNewNameForm);
    choiceButtons.appendChild(newNameBtn);
    
    // 2. Кнопка "Выбрать существующее имя"
    const existingNameBtn = document.createElement('button');
    existingNameBtn.className = 'papyrus-button shimmer';
    existingNameBtn.textContent = 'Выбрать сохранённое имя';
    existingNameBtn.addEventListener('click', showExistingNames);
    
    // Проверяем наличие сохраненных имен
    const savedNames = getSavedNames(currentUser.id);
    console.log(`Найдено ${savedNames.length} сохраненных имен для пользователя ${currentUser.id}`);
    
    if (savedNames.length === 0) {
      existingNameBtn.classList.add('disabled');
      existingNameBtn.disabled = true;
      existingNameBtn.title = 'Нет сохраненных имен';
    }
    
    choiceButtons.appendChild(existingNameBtn);
    
    // 3. Кнопка "Войти с ником из Telegram"
    const telegramName = getTelegramUserName();
    if (telegramName) {
      const telegramNameBtn = document.createElement('button');
      telegramNameBtn.className = 'papyrus-button shimmer telegram-button';
      telegramNameBtn.textContent = `Войти с ником из Telegram: ${telegramName}`;
      telegramNameBtn.addEventListener('click', function() {
        currentUser.name = telegramName;
        currentUser.anonymous = false;
        
        // Сохраняем в список имен для этого пользователя
        const savedNames = getSavedNames(currentUser.id);
        if (!savedNames.includes(telegramName)) {
          savedNames.push(telegramName);
          saveNamesToStorage(currentUser.id, savedNames);
        }
        
        // Обновляем данные авторизации
        try {
          localStorage.setItem('papaTrubokAuth', JSON.stringify({
            userId: currentUser.id,
            name: telegramName,
            method: 'telegram',
            timestamp: Date.now()
          }));
        } catch (error) {
          console.error('Ошибка при обновлении имени в данных авторизации:', error);
        }
        
        showScreen('gameScreen');
        showNotification(`Используем ник из Telegram: ${telegramName}`, 'success');
        loadGames();
      });
      choiceButtons.appendChild(telegramNameBtn);
    } else {
      console.log('Имя из Telegram недоступно');
    }
    
    choiceButtons.style.display = 'block';
  }
}

// Функция для показа формы ввода нового имени (нужно добавить в код)
function showNewNameForm() {
  // Скрываем кнопки выбора
  const choiceButtons = document.getElementById('nameChoiceButtons');
  if (choiceButtons) {
    choiceButtons.style.display = 'none';
  }
  
  // Показываем форму ввода нового имени
  const newNameSection = document.getElementById('newNameSection');
  if (newNameSection) {
    newNameSection.style.display = 'block';
    
    // Очищаем поле ввода
    const nameInput = document.getElementById('nameInput');
    if (nameInput) {
      nameInput.value = '';
      // Устанавливаем фокус на поле ввода
      setTimeout(() => nameInput.focus(), 100);
    }
  }
}

// Функция для сохранения имени пользователя
function saveName() {
  const nameInput = document.getElementById('nameInput');
  if (!nameInput || !nameInput.value.trim()) {
    showNotification('Пожалуйста, введите имя!', 'warning');
    return;
  }
  
  let name = nameInput.value.trim();
  
  // Проверяем, есть ли у пользователя ID, если нет - генерируем новый
  if (!currentUser.id) {
    currentUser.id = String(Date.now()) + Math.random().toString(36).substring(2, 8);
  }
  
  // Добавляем часть ID пользователя к имени, чтобы сделать его уникальным
  // Берем последние 4 символа из ID пользователя
  const userIdSuffix = currentUser.id.slice(-4);
  
  // Проверяем, не содержит ли имя уже числовой суффикс в формате #XXXX
  const suffixRegex = /#\d{4}$/;
  if (!suffixRegex.test(name)) {
    // Если суффикса нет, добавляем его
    name = `${name}#${userIdSuffix}`;
  }
  
  console.log(`Сохраняем уникальное имя "${name}" для пользователя ${currentUser.id}`);
  
  // Сохраняем имя пользователя
  currentUser.name = name;
  currentUser.anonymous = false;
  
  // Добавляем имя в список сохраненных для этого пользователя
  const savedNames = getSavedNames(currentUser.id);
  if (!savedNames.includes(name)) {
    savedNames.push(name);
    saveNamesToStorage(currentUser.id, savedNames);
  }
  
  // Обновляем имя в данных авторизации
  try {
    const authData = localStorage.getItem('papaTrubokAuth');
    if (authData) {
      const parsedAuthData = JSON.parse(authData);
      if (parsedAuthData && parsedAuthData.userId === currentUser.id) {
        parsedAuthData.name = name;
        localStorage.setItem('papaTrubokAuth', JSON.stringify(parsedAuthData));
        console.log('Обновлены данные авторизации с новым именем:', name);
      }
    } else {
      // Если нет данных авторизации, создаем новые
      const newAuthData = {
        userId: currentUser.id,
        name: name,
        method: 'manual',
        timestamp: Date.now()
      };
      localStorage.setItem('papaTrubokAuth', JSON.stringify(newAuthData));
      console.log('Созданы новые данные авторизации:', newAuthData);
    }
  } catch (error) {
    console.error('Ошибка при обновлении имени в данных авторизации:', error);
  }
  
  // Переходим на экран игр
  showScreen('gameScreen');
  showNotification(`Имя "${name}" сохранено!`, 'success');
  
  // Загружаем список игр
  loadGames();
}

// Функция для получения сохраненных имен конкретного пользователя
function getSavedNames(userId) {
  if (!userId && currentUser) {
    userId = currentUser.id;
  }
  
  if (!userId) {
    console.warn('Не удалось определить ID пользователя для загрузки имен');
    return [];
  }
  
  try {
    const savedNamesKey = `papaTrubok_savedNames_${userId}`;
    const savedNamesJson = localStorage.getItem(savedNamesKey);
    if (savedNamesJson) {
      const savedNames = JSON.parse(savedNamesJson);
      if (Array.isArray(savedNames)) {
        return savedNames;
      }
    }
  } catch (error) {
    console.error('Ошибка при загрузке сохраненных имен:', error);
  }
  
  return [];
}

// Функция для сохранения имен в локальное хранилище для конкретного пользователя
function saveNamesToStorage(userId, names) {
  if (!userId && currentUser) {
    userId = currentUser.id;
  }
  
  if (!userId) {
    console.warn('Не удалось определить ID пользователя для сохранения имен');
    return false;
  }
  
  try {
    const savedNamesKey = `papaTrubok_savedNames_${userId}`;
    localStorage.setItem(savedNamesKey, JSON.stringify(names));
    console.log(`Сохранено ${names.length} имен для пользователя ${userId}`);
    return true;
  } catch (error) {
    console.error('Ошибка при сохранении имен:', error);
    return false;
  }
}

// Функция для отображения списка существующих имен
function showExistingNames() {
  const nameChoiceButtons = document.getElementById('nameChoiceButtons');
  const existingNameSection = document.getElementById('existingNameSection');
  const savedNamesList = document.getElementById('savedNamesList');
  
  if (nameChoiceButtons) nameChoiceButtons.style.display = 'none';
  
  if (existingNameSection && savedNamesList) {
    existingNameSection.style.display = 'block';
    
    // Получаем сохраненные имена для текущего пользователя
    const savedNames = getSavedNames(currentUser.id);
    
    // Если нет сохраненных имен
    if (savedNames.length === 0) {
      savedNamesList.innerHTML = '<p class="no-games">У вас нет сохраненных имен</p>';
      return;
    }
    
    // Заполняем список имен
    let namesHtml = '';
    
    savedNames.forEach(name => {
      namesHtml += `
        <div class="game-item">
          <div class="game-info">
            <h3>${name}</h3>
          </div>
          <div class="game-actions">
            <button class="papyrus-button small-btn use-name-btn" data-name="${name}">Выбрать</button>
            <button class="papyrus-button small-btn delete-name-btn" data-name="${name}">Удалить</button>
          </div>
        </div>
      `;
    });
    
    savedNamesList.innerHTML = namesHtml;
    
    // Добавляем обработчики для кнопок
    const useNameBtns = savedNamesList.querySelectorAll('.use-name-btn');
    useNameBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        const name = this.getAttribute('data-name');
        selectExistingName(name);
      });
    });
    
    const deleteNameBtns = savedNamesList.querySelectorAll('.delete-name-btn');
    deleteNameBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        const name = this.getAttribute('data-name');
        deleteExistingName(name);
      });
    });
  }
}

// Функция для выбора существующего имени
function selectExistingName(name) {
  if (!name || !currentUser.id) {
    showNotification('Ошибка при выборе имени', 'error');
    return;
  }
  
  // Проверяем наличие суффикса и добавляем его, если нужно
  let uniqueName = name;
  const suffixRegex = /#\d{4}$/;
  if (!suffixRegex.test(uniqueName)) {
    // Если суффикса нет, добавляем его
    const userIdSuffix = currentUser.id.slice(-4);
    uniqueName = `${uniqueName}#${userIdSuffix}`;
  }
  
  // Обновляем имя пользователя
  currentUser.name = uniqueName;
  currentUser.anonymous = false;
  
  // Обновляем данные авторизации
  try {
    const authData = localStorage.getItem('papaTrubokAuth');
    if (authData) {
      const parsedAuthData = JSON.parse(authData);
      parsedAuthData.name = uniqueName;
      localStorage.setItem('papaTrubokAuth', JSON.stringify(parsedAuthData));
    } else {
      // Если нет данных авторизации, создаем новые
      localStorage.setItem('papaTrubokAuth', JSON.stringify({
        userId: currentUser.id,
        name: uniqueName,
        method: 'manual',
        timestamp: Date.now()
      }));
    }
  } catch (error) {
    console.error('Ошибка при обновлении имени в данных авторизации:', error);
  }
  
  showScreen('gameScreen');
  showNotification(`Выбрано имя: ${uniqueName}`, 'success');
  loadGames();
}

// Функция для удаления имени из списка сохраненных
function deleteExistingName(name) {
  if (!currentUser.id) {
    showNotification('Ошибка: ID пользователя не определен', 'error');
    return;
  }
  
  // Получаем текущий список имен для данного пользователя
  const savedNames = getSavedNames(currentUser.id);
  
  // Удаляем имя из списка
  const updatedNames = savedNames.filter(savedName => savedName !== name);
  
  // Сохраняем обновленный список
  saveNamesToStorage(currentUser.id, updatedNames);
  
  // Обновляем список отображаемых имен
  showExistingNames();
  showNotification(`Имя "${name}" удалено`, 'info');
}

// Загрузка списка доступных игр
async function loadGames() {
  const gamesList = document.getElementById('gamesList');
  if (!gamesList) return;
  
  try {
    console.log('Загружаем список игр...');
    gamesList.innerHTML = '<p>Загрузка списка игр...</p>';
    
    const apiUrl = window.API_URL || '';
    const response = await fetch(`${apiUrl}/api/games`);
    if (!response.ok) {
      throw new Error(`Ошибка загрузки списка игр: ${response.status}`);
    }
    
    const games = await response.json();
    console.log('Получен список игр:', games);
    
    // Проверяем, есть ли у пользователя своя игра
    const myGameId = localStorage.getItem('papaTrubok_myGameId');
    let myGame = null;
    if (myGameId) {
      myGame = games.find(g => g.id === myGameId);
    }
    if (myGame) {
      // Показываем только свою игру
      let statusClass = 'status-waiting';
      if (myGame.status === 'collecting_answers') statusClass = 'status-collecting';
      else if (myGame.status === 'voting') statusClass = 'status-voting';
      else if (myGame.status === 'results') statusClass = 'status-results';
      const shortId = myGame.id.substring(0, 6);
      const questionText = myGame.hasQuestion ? 'Вопрос уже загружен' : 'Ожидание вопроса...';
      gamesList.innerHTML = `
        <div class="game-item">
          <div class="game-info">
            <h3>Ваша игра #${shortId}</h3>
            <p class="game-creator">Создатель: ${myGame.name || 'Вы'}</p>
            <p class="game-question">${questionText}</p>
            <div class="game-stats">
              <span class="game-stat">Участники: ${myGame.count || 0}</span>
              <span class="game-status ${statusClass}">${getStatusText(myGame.status)}</span>
            </div>
          </div>
          <div class="game-actions">
            <button class="papyrus-button shimmer join-game-btn" onclick="window.location.href='game.html?id=${myGame.id}'">
              Перейти в свою комнату
            </button>
          </div>
        </div>
      `;
      return;
    }
    
    if (!games || games.length === 0) {
      gamesList.innerHTML = '<p class="no-games">Нет доступных игр. Создайте новую!</p>';
      return;
    }
    
    // Создаем Map для отслеживания уникальных комнат по id
    const uniqueGames = new Map();
    
    // Добавляем только уникальные игры в Map
    games.forEach(game => {
      if (!uniqueGames.has(game.id)) {
        uniqueGames.set(game.id, game);
      }
    });
    
    console.log(`Уникальных игр: ${uniqueGames.size} из ${games.length}`);
    
    let gamesHtml = '';
    
    // Используем уникальные игры для отображения
    uniqueGames.forEach(game => {
      // Определяем класс статуса
      let statusClass = 'status-waiting';
      if (game.status === 'collecting_answers') statusClass = 'status-collecting';
      else if (game.status === 'voting') statusClass = 'status-voting';
      else if (game.status === 'results') statusClass = 'status-results';
      
      // Получаем сокращенный ID игры для отображения
      const shortId = game.id.substring(0, 6);
      
      // Отображаем вопрос игры, если он есть
      const questionText = game.hasQuestion ? 'Вопрос уже загружен' : 'Ожидание вопроса...';
      
      gamesHtml += `
        <div class="game-item">
          <div class="game-info">
            <h3>Игра #${shortId}</h3>
            <p class="game-creator">Создатель: ${game.name || 'Неизвестно'}</p>
            <p class="game-question">${questionText}</p>
            <div class="game-stats">
              <span class="game-stat">Участники: ${game.count || 0}</span>
              <span class="game-status ${statusClass}">${getStatusText(game.status)}</span>
            </div>
          </div>
          <div class="game-actions">
            <button class="papyrus-button shimmer join-game-btn" onclick="joinGameRoom('${game.id}')">
              Войти в комнату
            </button>
          </div>
        </div>
      `;
    });
    
    gamesList.innerHTML = gamesHtml;
  } catch (error) {
    console.error('Ошибка при загрузке игр:', error);
    gamesList.innerHTML = '<p class="error-message">Ошибка при загрузке игр. Попробуйте позже.</p>';
  }
}

// Функция для присоединения к конкретной комнате
async function joinGameRoom(gameId) {
  if (!gameId) return;
  // Мгновенный переход без подтверждений
  window.location.href = `game.html?id=${gameId}`;
}

// Функция для обновления информации о комнате
function updateRoomInfo() {
  if (!currentGame || !currentGame.id) {
    console.warn('Не установлен ID текущей игры');
    return;
  }
  
  console.log('Обновление информации о комнате:', currentGame);
  
  // Заполняем заголовок комнаты
  const roomTitle = document.getElementById('roomTitle');
  if (roomTitle) {
    roomTitle.textContent = `Комната игры #${currentGame.id.substring(0, 6)}`;
  }
  
  // Заполняем вопрос
  const roomQuestion = document.getElementById('roomQuestion');
  if (roomQuestion) {
    roomQuestion.textContent = currentGame.currentQuestion || 'Ожидание вопроса...';
  }
  
  // Заполняем статус
  const roomStatus = document.getElementById('roomStatus');
  if (roomStatus) {
    roomStatus.textContent = getStatusText(currentGame.status || 'waiting_players');
  }
  
  // Заполняем количество ответов
  const roomAnswersCount = document.getElementById('roomAnswersCount');
  if (roomAnswersCount) {
    roomAnswersCount.textContent = currentGame.answersCount || 0;
  }
  
  // Заполняем информацию о создателе
  const roomCreator = document.getElementById('roomCreator');
  if (roomCreator) {
    roomCreator.textContent = currentGame.initiatorName || 'Неизвестно';
  }
  
  // Показываем/скрываем кнопки в зависимости от статуса игры и роли пользователя
  updateRoomButtons();
  
  // Проверяем ответ пользователя
  updateUserAnswerDisplay();
}

// Обновляем кнопки в комнате
function updateRoomButtons() {
  if (!currentGame) return;
  
  const answerButton = document.getElementById('answerButton');
  const viewAnswersButton = document.getElementById('viewAnswersButton');
  const startVotingButton = document.getElementById('startVotingButton');
  
  // Получаем статус комнаты
  const status = currentGame.status || 'waiting_players';
  
  // Определяем видимость кнопки ответа
  if (answerButton) {
    if (status === 'collecting_answers' || status === 'waiting_players') {
      // Проверяем, ответил ли уже пользователь
      checkUserAnswerStatus(currentGame.id).then(hasAnswered => {
        answerButton.style.display = hasAnswered ? 'none' : 'block';
      });
    } else {
      answerButton.style.display = 'none';
    }
  }
  
  // Определяем видимость кнопки просмотра ответов
  if (viewAnswersButton) {
    viewAnswersButton.style.display = (status === 'voting') ? 'block' : 'none';
  }
  
  // Определяем видимость кнопки начала голосования (только для создателя)
  if (startVotingButton) {
    const isCreator = currentGame.isCreator;
    const hasMinAnswers = (currentGame.answersCount || 0) >= 3;
    const canStartVoting = isCreator && hasMinAnswers && status === 'collecting_answers';
    
    startVotingButton.style.display = canStartVoting ? 'block' : 'none';
  }
}

// Функция для проверки статуса ответа пользователя
async function checkUserAnswerStatus(gameId) {
  try {
    console.log(`Проверяем, ответил ли пользователь ${currentUser.id} на вопрос в игре ${gameId}`);
    const hasAnswered = await checkIfAnswered(gameId);
    console.log(`Результат проверки ответа: ${hasAnswered ? 'Уже ответил' : 'Еще не ответил'}`);
    
    const answerButton = document.getElementById('answerButton');
    const userAnswerDisplay = document.getElementById('userAnswerDisplay');
    
    if (hasAnswered) {
      console.log('Пользователь уже ответил, обновляем отображение');
      
      // Скрываем кнопку ответа
      if (answerButton) {
        answerButton.style.display = 'none';
      }
      
      // Запрашиваем и отображаем ответ пользователя
      updateUserAnswerDisplay();
    } else {
      console.log('Пользователь еще не ответил');
      
      // Показываем кнопку ответа только если статус "сбор ответов"
      if (answerButton) {
        answerButton.style.display = currentGame.status === 'collecting_answers' ? 'block' : 'none';
      }
      
      // Скрываем блок с ответом пользователя
      if (userAnswerDisplay) {
        userAnswerDisplay.style.display = 'none';
      }
    }
  } catch (error) {
    console.error('Ошибка при проверке статуса ответа пользователя:', error);
  }
}

// Функция для обновления отображения ответа пользователя
async function updateUserAnswerDisplay() {
  if (!currentGame || !currentGame.id) {
    console.error('Нет данных о текущей игре для обновления ответа пользователя');
    return;
  }

  const userAnswerDisplay = document.getElementById('userAnswerDisplay');
  if (!userAnswerDisplay) {
    console.error('Не найден элемент для отображения ответа пользователя');
    return;
  }
  
  try {
    console.log(`Запрашиваем ответ пользователя ${currentUser.id} для игры ${currentGame.id}`);
    const apiUrl = window.API_URL || '';
    const response = await fetch(`${apiUrl}/api/games/${currentGame.id}/user-answer?userId=${currentUser.id}`);
    
    if (!response.ok) {
      throw new Error(`Ошибка при получении ответа пользователя: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Получен ответ пользователя:', data);
    
    if (data && data.answer) {
      currentGame.userAnswer = data.answer;
      
      userAnswerDisplay.style.display = 'block';
      userAnswerDisplay.innerHTML = `
        <div class="user-answer-box">
          <p style="color: #2a9d8f; font-weight: bold; margin-bottom: 10px;">Ваш ответ принят!</p>
          <p style="color: #5a2d0c; font-style: italic;">"${currentGame.userAnswer}"</p>
          <p style="margin-top: 10px; color: #457b9d;">
            ${currentGame.status === 'collecting_answers' ? 'Ожидайте начала голосования.' : 
              currentGame.status === 'voting' ? 'Идет голосование. Не забудьте проголосовать!' : 
              'Голосование завершено. Проверьте результаты!'}
          </p>
        </div>
      `;
    } else {
      console.warn('Не получен ответ пользователя');
      userAnswerDisplay.style.display = 'none';
    }
  } catch (error) {
    console.error('Ошибка при обновлении отображения ответа пользователя:', error);
    userAnswerDisplay.style.display = 'none';
  }
}

// Экспортируем функцию в глобальную область видимости
window.updateUserAnswerDisplay = updateUserAnswerDisplay;

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
  console.log(`Начало голосования для игры ${gameId}`);
  
  if (!currentUser || !currentUser.id) {
    console.error('Нет данных о пользователе для начала голосования');
    showNotification('Ошибка: Данные пользователя не найдены', 'error');
    return;
  }
  
  try {
    showNotification('Запуск голосования...', 'info');
    
    const apiUrl = window.API_URL || '';
    const response = await fetch(`${apiUrl}/api/games/${gameId}/start-voting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        creatorId: currentUser.id
      })
    });
    
    if (!response.ok) {
      console.error(`Ошибка при запуске голосования, статус: ${response.status}`);
      try {
        const errorData = await response.json();
        console.error('Данные ошибки:', errorData);
        throw new Error(errorData.error || `Ошибка HTTP: ${response.status}`);
      } catch (jsonError) {
        console.error('Не удалось разобрать ответ как JSON:', jsonError);
        throw new Error(`Ошибка HTTP: ${response.status}`);
      }
    }
    
    const data = await response.json();
    console.log('Голосование успешно запущено:', data);
    
    showNotification('Голосование запущено!', 'success');
    
    // Обновляем статус текущей игры
    currentGame.status = 'voting';
    
    // Обновляем информацию о комнате
    updateRoomInfo();
    
    // Загружаем варианты для голосования и переходим на экран голосования
    await loadVotingOptions(gameId);
    showScreen('votingScreen');
  } catch (error) {
    console.error('Ошибка при запуске голосования:', error);
    showNotification(`Не удалось запустить голосование: ${error.message}`, 'error');
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

// Функция для загрузки вариантов голосования
async function loadVotingOptions(gameId) {
  console.log(`Загрузка вариантов для голосования в игре ${gameId}`);
  
  if (!currentUser || !currentUser.id) {
    console.error('Нет данных о пользователе для загрузки вариантов голосования');
    showNotification('Ошибка: Данные пользователя не найдены', 'error');
      return;
  }
  
  try {
    // Получаем варианты для голосования
    const apiUrl = window.API_URL || '';
    const response = await fetch(`${apiUrl}/api/games/${gameId}/voting-options?userId=${currentUser.id}`);
    
    if (!response.ok) {
      console.error(`Ошибка при загрузке вариантов для голосования, статус: ${response.status}`);
      throw new Error(`Ошибка при загрузке вариантов для голосования: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Получены варианты для голосования:', data);
    
    // Получаем список ответов и проверяем, голосовал ли пользователь
    const answers = data.answers || [];
    const hasVoted = data.hasVoted || false;
    
    // Получаем элемент для отображения вопроса и вариантов
    const votingQuestionText = document.getElementById('votingQuestionText');
    const answerOptions = document.getElementById('answerOptions');
    const votingStatus = document.getElementById('votingStatus');
    const submitVotesBtn = document.getElementById('submitVotesBtn');
    
    // Если элементы найдены, обновляем их содержимое
    if (votingQuestionText) {
      votingQuestionText.textContent = currentGame.currentQuestion || '';
    }
    
    if (answerOptions) {
      answerOptions.innerHTML = '';
      
      if (answers.length === 0) {
        answerOptions.innerHTML = '<p>Нет вариантов для голосования</p>';
      } else {
        // Создаем элементы для вариантов голосования
        answers.forEach(answer => {
          // Пропускаем свой ответ, за него нельзя голосовать
          if (answer.userId === currentUser.id) return;
          
          // Создаем элемент для варианта
        const option = document.createElement('div');
        option.className = 'answer-option';
          option.dataset.answerId = answer.id;
          
          // Заполняем содержимое варианта
        option.innerHTML = `
            <p class="answer-text">${answer.text}</p>
            <span class="answer-author">${answer.anonymous ? 'Анонимный игрок' : answer.userName}</span>
        `;
          
          // Добавляем обработчик клика для выбора варианта
          option.addEventListener('click', function() {
          toggleVoteSelection(this);
          });
          
          // Добавляем вариант в контейнер
        answerOptions.appendChild(option);
      });
      }
    }
    
    // Обновляем статус голосования
    if (votingStatus) {
      if (hasVoted) {
        votingStatus.textContent = 'Вы уже проголосовали. Ожидайте завершения голосования.';
        if (submitVotesBtn) submitVotesBtn.style.display = 'none';
      } else {
        votingStatus.textContent = 'Выберите до 2-х самых смешных ответов (не свой).';
        if (submitVotesBtn) submitVotesBtn.style.display = 'block';
      }
    }
    
    // Показываем экран голосования
    showScreen('votingScreen');
  } catch (error) {
    console.error('Ошибка при загрузке вариантов для голосования:', error);
    showNotification(`Не удалось загрузить варианты для голосования: ${error.message}`, 'error');
    
    // Возвращаемся к экрану комнаты
    showScreen('roomScreen');
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
  console.log('Отправка голосов...');
  
  // Получаем все выбранные ответы
  const selectedOptions = document.querySelectorAll('.answer-option.selected');
  
  // Проверяем количество выбранных ответов
  if (selectedOptions.length === 0) {
    showNotification('Выберите хотя бы один ответ', 'warning');
    return;
  }
  
  // Проверяем максимальное количество голосов
  if (selectedOptions.length > 2) {
    showNotification('Вы можете выбрать не более 2 ответов', 'warning');
    return;
  }
  
  // Проверяем наличие информации о текущей игре
  if (!currentGame || !currentGame.id) {
    showNotification('Ошибка: Информация об игре потеряна', 'error');
    return;
  }
  
  // Блокируем кнопку голосования на время отправки
  const submitVotesBtn = document.getElementById('submitVotesBtn');
  if (submitVotesBtn) {
    submitVotesBtn.disabled = true;
    submitVotesBtn.textContent = 'Отправка голосов...';
  }
  
  try {
    // Собираем ID выбранных ответов
    const selectedAnswerIds = Array.from(selectedOptions).map(option => option.dataset.answerId);
    console.log('Выбранные ответы:', selectedAnswerIds);
    
    // Отправляем запрос на сохранение голосов
    const apiUrl = window.API_URL || '';
    const response = await fetch(`${apiUrl}/api/games/${currentGame.id}/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: currentUser.id,
        answerIds: selectedAnswerIds
      })
    });
    
    if (!response.ok) {
      console.error(`Ошибка при отправке голосов, статус: ${response.status}`);
      const errorText = await response.text();
      console.error('Текст ошибки:', errorText);
      throw new Error(`Ошибка при отправке голосов: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Голосование успешно отправлено:', data);
    
    // Показываем уведомление об успехе
    showNotification('Ваш голос принят! Ожидайте результатов.', 'success');
    
    // Возвращаемся к экрану комнаты
    showScreen('roomScreen');
    
    // Обновляем статус комнаты
    if (typeof updateRoomInfo === 'function') {
      updateRoomInfo();
    }
  } catch (error) {
    console.error('Ошибка при отправке голосов:', error);
    showNotification(`Не удалось отправить голос: ${error.message}`, 'error');
  } finally {
    // Восстанавливаем кнопку
    if (submitVotesBtn) {
      submitVotesBtn.disabled = false;
      submitVotesBtn.textContent = 'Проголосовать';
    }
  }
}

// Загрузка результатов голосования
async function loadResults(gameId) {
  console.log(`Загрузка результатов для игры ${gameId}`);
  
  if (!gameId && currentGame && currentGame.id) {
    gameId = currentGame.id;
  }
  
  if (!gameId) {
    console.error('Не указан ID игры для загрузки результатов');
    showNotification('Ошибка: Не указан ID игры', 'error');
      return;
  }
  
  try {
    // Отображаем уведомление о загрузке
    showNotification('Загрузка результатов...', 'info');
    
    // Запрашиваем результаты с сервера
    const apiUrl = window.API_URL || '';
    const response = await fetch(`${apiUrl}/api/games/${gameId}/results`);
    
    if (!response.ok) {
      console.error(`Ошибка при загрузке результатов, статус: ${response.status}`);
      throw new Error(`Ошибка при загрузке результатов: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Получены результаты:', data);
    
    // Обновляем элементы интерфейса
    const resultsList = document.getElementById('resultsList');
    const resultsQuestionText = document.getElementById('resultsQuestionText');
    
    if (resultsQuestionText) {
      resultsQuestionText.textContent = currentGame.currentQuestion || data.question || '';
    }
    
    if (resultsList) {
    resultsList.innerHTML = '';
    
      if (!data.results || data.results.length === 0) {
        resultsList.innerHTML = '<p>Результаты еще не доступны</p>';
      } else {
        // Сортируем результаты по количеству голосов (по убыванию)
        const sortedResults = [...data.results].sort((a, b) => b.votes - a.votes);
        
        // Отображаем результаты
        sortedResults.forEach((result, index) => {
      const resultItem = document.createElement('div');
          resultItem.className = `result-item ${index === 0 ? 'winner' : ''}`;
          
          // Определяем медаль для призовых мест
          let medal = '';
          if (index === 0) medal = '🥇';
          else if (index === 1) medal = '🥈';
          else if (index === 2) medal = '🥉';
          
          // Выделяем свой ответ
          const isOwn = result.userId === currentUser.id;
      
      resultItem.innerHTML = `
            <div class="result-header">
              <div class="result-place">${medal} ${index + 1}</div>
              <div class="result-name ${isOwn ? 'own-result' : ''}">${result.anonymous ? 'Анонимный игрок' : result.userName} ${isOwn ? '(ваш ответ)' : ''}</div>
              <div class="result-votes">${result.votes} ${result.votes === 1 ? 'голос' : result.votes < 5 ? 'голоса' : 'голосов'}</div>
            </div>
            <div class="result-answer">${result.answer}</div>
      `;
      
      resultsList.appendChild(resultItem);
    });
    
        // Добавляем кнопку возврата
        const backButton = document.createElement('button');
        backButton.className = 'papyrus-button shimmer';
        backButton.textContent = 'Вернуться к списку игр';
        backButton.onclick = () => {
          showScreen('gameScreen');
          loadGames();
        };
        
        resultsList.appendChild(backButton);
      }
    }
    
    // Показываем экран результатов
    showScreen('resultsScreen');
  } catch (error) {
    console.error('Ошибка при загрузке результатов:', error);
    showNotification(`Не удалось загрузить результаты: ${error.message}`, 'error');
    
    // Возвращаемся к комнате или списку игр
    if (currentGame && currentGame.id) {
      showScreen('roomScreen');
    } else {
      showScreen('gameScreen');
      loadGames();
    }
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
    console.log(`Проверяем ответ для пользователя ${currentUser.id} в игре ${gameId}`);
    const apiUrl = window.API_URL || '';
    const response = await fetch(`${apiUrl}/api/games/${gameId}/check-answer?userId=${currentUser.id}`);
    
    if (!response.ok) {
      console.error(`Ошибка при проверке ответа, статус: ${response.status}`);
      return false;
    }
    
    const data = await response.json();
    console.log('Результат проверки ответа:', data);
    return data.hasAnswered;
  } catch (error) {
    console.error('Ошибка при проверке наличия ответа:', error);
    return false;
  }
}

// Добавим также улучшенную инициализацию для startRoomUpdates
function startRoomUpdates(gameId) {
  console.log(`Запускаем периодические обновления для комнаты ${gameId}`);
  
  // Запускаем проверку статуса
  startStatusCheck();
  
  // Проверяем, есть ли в текущей игре ID
  if (!gameId && currentGame && currentGame.id) {
    gameId = currentGame.id;
  }
  
  if (!gameId) {
    console.error('Нет ID игры для обновлений комнаты');
    return;
  }
  
  // Устанавливаем таймер для периодического обновления информации о комнате
  setTimeout(() => {
    checkIfAnswered(gameId).then(hasAnswered => {
      console.log(`Проверка на наличие ответа пользователя: ${hasAnswered ? 'Уже ответил' : 'Еще не ответил'}`);
      
      const answerButton = document.getElementById('answerButton');
      const userAnswerDisplay = document.getElementById('userAnswerDisplay');
      
      if (answerButton && userAnswerDisplay) {
        if (hasAnswered) {
          console.log('Пользователь уже ответил, скрываем кнопку ответа');
          answerButton.style.display = 'none';
          
          // Запрашиваем ответ пользователя
          fetch(`${API_URL}/games/${gameId}/user-answer?userId=${currentUser.id}`)
            .then(response => response.json())
            .then(data => {
              console.log('Получен ответ пользователя:', data.answer);
              currentGame.userAnswer = data.answer;
              
              userAnswerDisplay.style.display = 'block';
              userAnswerDisplay.innerHTML = `
                <div class="user-answer-box">
                  <p style="color: #2a9d8f; font-weight: bold; margin-bottom: 10px;">Ваш ответ принят!</p>
                  <p style="color: #5a2d0c; font-style: italic;">"${currentGame.userAnswer}"</p>
                  <p style="margin-top: 10px; color: #457b9d;">Ожидайте начала голосования.</p>
                </div>
              `;
            })
            .catch(error => {
              console.error('Ошибка при получении ответа пользователя:', error);
            });
        } else {
          console.log('Пользователь еще не ответил, показываем кнопку ответа');
          if (currentGame && currentGame.status === 'collecting_answers') {
            answerButton.style.display = 'block';
          } else {
            answerButton.style.display = 'none';
          }
          userAnswerDisplay.style.display = 'none';
        }
      }
    });
  }, 1000);
}

// Функция для тестирования создания игры напрямую
async function testCreateGame() {
  console.log("Тестируем создание игры...");
  
  if (!currentUser || !currentUser.id || !currentUser.name) {
    console.error("Нельзя создать игру без имени пользователя");
    showNotification("Сначала введите имя", "error");
    return false;
  }
  
  try {
    const testQuestion = "Тестовый вопрос для проверки создания игры";
    console.log(`Отправляем тестовый запрос на создание игры с вопросом: ${testQuestion}`);
    
    const apiUrl = window.API_URL || '';
    const response = await fetch(`${apiUrl}/api/games`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        question: testQuestion,
        userId: currentUser.id,
        userName: currentUser.name
      })
    });
    
    if (!response.ok) {
      console.error(`Ошибка при тестовом создании игры, статус: ${response.status}`);
      const errorText = await response.text();
      console.error('Текст ошибки:', errorText);
      showNotification(`Ошибка создания тестовой игры: ${response.status}`, "error");
      return false;
    }
    
    const result = await response.json();
    console.log("Игра успешно создана, результат:", result);
    showNotification(`Тестовая игра создана! ID: ${result.gameId || result.id}`, "success");
    
    // Присоединяемся к созданной игре
    const gameId = result.gameId || result.id;
    if (gameId) {
      joinGameRoom(gameId);
    }
    
    return true;
  } catch (error) {
    console.error("Ошибка при тестировании создания игры:", error);
    showNotification(`Ошибка: ${error.message}`, "error");
    return false;
  }
}

// Функция для отправки ответа
async function submitAnswer() {
  console.log('Отправка ответа...');
  
  const answerInput = document.getElementById('answerInput');
  if (!answerInput || !answerInput.value.trim()) {
    console.warn('Не введен ответ');
    showNotification('Пожалуйста, введите ответ!', 'warning');
    return;
  }
  
  if (!currentGame || !currentGame.id) {
    console.error('Нет данных о текущей игре');
    showNotification('Ошибка: Данные игры не найдены', 'error');
    return;
  }

  // Блокируем кнопку отправки ответа
  const submitAnswerBtn = document.getElementById('submitAnswerBtn');
  if (submitAnswerBtn) {
    submitAnswerBtn.disabled = true;
    submitAnswerBtn.textContent = 'Отправка...';
  }
  
  try {
    console.log(`Отправляем ответ для игры ${currentGame.id}`);
    console.log('Данные запроса:', JSON.stringify({
      userId: currentUser.id,
      answer: answerInput.value.trim(),
      anonymous: false
    }));
    
    const response = await fetch(`${API_URL}/games/${currentGame.id}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: currentUser.id,
        answer: answerInput.value.trim(),
        anonymous: false
      })
    });
    
    if (!response.ok) {
      console.error(`Ошибка при отправке ответа, статус: ${response.status}`);
      try {
        const errorData = await response.json();
        console.error('Данные ошибки:', errorData);
        throw new Error(errorData.error || `Ошибка HTTP: ${response.status}`);
      } catch (jsonError) {
        console.error('Не удалось разобрать ответ как JSON:', jsonError);
        throw new Error(`Ошибка HTTP: ${response.status}`);
      }
    }
    
    const data = await response.json();
    console.log('Ответ успешно отправлен:', data);
    
    showNotification('Ваш ответ принят!', 'success');
    
    // Сохраняем ответ в объекте текущей игры
    currentGame.userAnswer = answerInput.value.trim();
    
    // Очищаем поле ввода
    answerInput.value = '';
    
    // Возвращаемся в комнату
    showScreen('roomScreen');
    
    // Делаем небольшую задержку перед обновлением интерфейса комнаты
    setTimeout(() => {
      // Обновляем информацию о комнате
      updateRoomInfo();
      
      // Принудительно обновляем отображение ответа пользователя
      updateUserAnswerDisplay();
      
      // Обновляем статус кнопок
      updateRoomButtons();
    }, 500);
  } catch (error) {
    console.error('Ошибка при отправке ответа:', error);
    showNotification(`Не удалось отправить ответ: ${error.message}`, 'error');
  } finally {
    // Разблокируем кнопку отправки ответа
    if (submitAnswerBtn) {
      submitAnswerBtn.disabled = false;
      submitAnswerBtn.textContent = 'Отправить ответ';
    }
  }
}

// Функция для остановки обновления статуса комнаты
function stopRoomUpdates() {
  if (window.roomUpdateInterval) {
    console.log('Останавливаем обновление статуса комнаты');
    clearInterval(window.roomUpdateInterval);
    window.roomUpdateInterval = null;
  }
}

function formatTelegramName(user) {
  if (!currentUser || !currentUser.id) {
    // Если нет ID пользователя, сначала генерируем его
    currentUser = currentUser || {};
    currentUser.id = String(Date.now()) + Math.random().toString(36).substring(2, 8);
  }
  
  // Получаем имя из профиля Telegram
  let name = '';
  if (user.username) {
    name = user.username;
  } else {
    name = user.first_name || '';
    if (user.last_name) {
      name += ' ' + user.last_name;
    }
  }
  
  name = name.trim() || 'Пользователь Telegram';
  
  // Добавляем уникальный идентификатор
  const userIdSuffix = currentUser.id.slice(-4);
  const suffixRegex = /#\d{4}$/;
  if (!suffixRegex.test(name)) {
    name = `${name}#${userIdSuffix}`;
  }
  
  return name;
}

// Добавляем функцию для безопасного перехода между страницами
function safePageTransition(url) {
    console.log(`Безопасный переход на страницу: ${url}`);
    
    // Сохраняем текущее состояние, если это необходимо
    if (currentGame && currentGame.id) {
        localStorage.setItem('papaTrubok_lastGameId', currentGame.id);
    }
    
    // Переход на новую страницу
    window.location.href = url;
}

// Модифицируем функцию joinGameRoom
function joinGameRoom(gameId) {
    if (!gameId) return;
    
    // Используем безопасный переход
    safePageTransition(`game.html?id=${gameId}`);
}

// Улучшаем обработку истории браузера
window.addEventListener('popstate', function(e) {
    e.preventDefault();
    
    // Проверяем, есть ли сохраненный ID игры
    const savedGameId = localStorage.getItem('papaTrubok_lastGameId');
    
    if (savedGameId) {
        // Если есть сохраненный ID, переходим к нему
        window.location.href = `game.html?id=${savedGameId}`;
    } else {
        // Стандартная логика возврата
        goBack();
    }
    
    // Добавляем новое состояние, чтобы предотвратить выход
    window.history.pushState({page: Date.now()}, "Папа Трубок", window.location.href);
    
    return false;
});

// Улучшаем обработку beforeunload
window.addEventListener('beforeunload', function(e) {
    // Сохраняем состояние игры перед уходом
    if (currentGame && currentGame.id) {
        localStorage.setItem('papaTrubok_lastGameId', currentGame.id);
    }
    
    // Отменяем стандартное поведение
    e.preventDefault();
    e.returnValue = '';
});

// Добавляем функцию для восстановления состояния игры
function restoreGameState() {
    const savedGameId = localStorage.getItem('papaTrubok_lastGameId');
    
    if (savedGameId) {
        console.log(`Восстановление состояния игры: ${savedGameId}`);
        joinGameRoom(savedGameId);
    }
}

// Функция для полной блокировки закрытия страницы
function blockPageUnload() {
    console.log('Активирована блокировка закрытия страницы');
    
    // Блокируем все стандартные события закрытия
    window.onbeforeunload = function(e) {
        e.preventDefault();
        e.returnValue = '';
        return '';
    };

    // Блокируем аппаратную кнопку "Назад"
    window.history.pushState(null, null, window.location.href);
    window.onpopstate = function() {
        window.history.pushState(null, null, window.location.href);
    };

    // Перехватываем все события закрытия
    window.addEventListener('beforeunload', function(e) {
        if (preventUnload) {
            e.preventDefault();
            e.returnValue = '';
            return '';
        }
    }, { capture: true });

    // Дополнительная блокировка для мобильных устройств
    document.addEventListener('backbutton', function(e) {
        e.preventDefault();
        return false;
    }, false);
}

// Функция для безопасного перехода
function safePageTransition(url) {
    console.log(`Безопасный переход на страницу: ${url}`);
    
    // Временно разрешаем переход
    preventUnload = false;
    
    // Сохраняем состояние игры
    if (currentGame && currentGame.id) {
        localStorage.setItem('papaTrubok_lastGameId', currentGame.id);
    }
    
    // Переход на новую страницу
    window.location.href = url;
}

// Модифицируем существующие функции
function joinGameRoom(gameId) {
    if (!gameId) return;
    safePageTransition(`game.html?id=${gameId}`);
}

// Инициализируем блокировку при загрузке
document.addEventListener('DOMContentLoaded', function() {
    blockPageUnload();
    
    // Восстанавливаем состояние игры
    const savedGameId = localStorage.getItem('papaTrubok_lastGameId');
    if (savedGameId) {
        console.log(`Найден сохраненный ID игры: ${savedGameId}`);
        joinGameRoom(savedGameId);
    }
});

// Перехватываем все попытки закрытия
window.addEventListener('unload', function(e) {
    if (preventUnload) {
        e.preventDefault();
        return '';
    }
}, { capture: true });

// Блокируем контекстное меню закрытия
document.oncontextmenu = function(e) {
    e.preventDefault();
    return false;
};

// Модифицируем функции сохранения состояния

// Сохранение текущего пользователя
async function saveCurrentUser() {
    if (currentUser && currentUser.id) {
        try {
            await saveUserToIndexedDB(currentUser);
            console.log('Текущий пользователь сохранен в IndexedDB');
        } catch (error) {
            console.error('Ошибка сохранения пользователя:', error);
        }
    }
}

// Восстановление пользователя
async function restoreCurrentUser() {
    try {
        // Пытаемся восстановить пользователя из IndexedDB
        const savedUser = await getUserFromIndexedDB(currentUser.id);
        if (savedUser) {
            currentUser = savedUser;
            console.log('Пользователь восстановлен из IndexedDB');
            return true;
        }
    } catch (error) {
        console.error('Ошибка восстановления пользователя:', error);
    }
    return false;
}

// Сохранение состояния игры
async function saveGameStateToStorage() {
    if (currentGame && currentGame.id) {
        try {
            await saveGameStateToIndexedDB(currentGame.id, currentGame);
            console.log('Состояние игры сохранено в IndexedDB');
        } catch (error) {
            console.error('Ошибка сохранения состояния игры:', error);
        }
    }
}

// Восстановление состояния игры
async function restoreGameStateFromStorage() {
    try {
        const savedGameId = localStorage.getItem('papaTrubok_lastGameId');
        if (savedGameId) {
            const gameData = await getGameStateFromIndexedDB(savedGameId);
            if (gameData) {
                currentGame = gameData;
                console.log('Состояние игры восстановлено из IndexedDB');
                return true;
            }
        }
    } catch (error) {
        console.error('Ошибка восстановления состояния игры:', error);
    }
    return false;
}

// Сохранение состояния приложения
async function saveAppStateToStorage(key, value) {
    try {
        await saveAppStateToIndexedDB(key, value);
        console.log(`Состояние приложения для ключа "${key}" сохранено`);
    } catch (error) {
        console.error(`Ошибка сохранения состояния приложения для ключа "${key}":`, error);
    }
}

// Восстановление состояния приложения
async function restoreAppStateFromStorage(key) {
    try {
        const value = await getAppStateFromIndexedDB(key);
        if (value !== null) {
            console.log(`Состояние приложения для ключа "${key}" восстановлено`);
            return value;
        }
    } catch (error) {
        console.error(`Ошибка восстановления состояния приложения для ключа "${key}":`, error);
    }
    return null;
}

// Модифицируем существующие обработчики событий для использования IndexedDB

// При создании игры
async function createGame() {
    // Существующая логика создания игры
    // ...

    // После создания игры сохраняем состояние
    await saveGameStateToStorage();
}

// При входе в игру
async function joinGameRoom(gameId) {
    // Существующая логика входа в игру
    // ...

    // Сохраняем состояние игры
    await saveGameStateToStorage();
}

// При загрузке страницы
document.addEventListener('DOMContentLoaded', async function() {
    // Блокируем возможность случайного выхода
    window.addEventListener('beforeunload', function(e) {
        if (window.preventUnload) {
            e.preventDefault();
            e.returnValue = '';
            return '';
        }
    });

    // Восстанавливаем состояние приложения
    await restoreApplicationState();

    // Пытаемся восстановить состояние пользователя
    await restoreCurrentUser();

    // Пытаемся восстановить состояние игры
    await restoreGameStateFromStorage();

    // Продолжаем стандартную инициализацию
    initializeApplication();
    setupEventListeners();
    loadInitialContent();
});

// Глобальные переменные для навигации и предотвращения выхода
window.preventUnload = true;
window.navigationHistory = [];

// Улучшенная функция безопасного перехода
function safePageTransition(url, options = {}) {
    const {
        saveHistory = true,
        clearPreviousState = false,
        additionalData = null
    } = options;

    console.log(`Безопасный переход: ${url}`);
    
    // Сохраняем текущее состояние игры
    if (currentGame && currentGame.id) {
        saveGameStateToIndexedDB(currentGame.id, currentGame);
    }

    // Сохраняем пользовательские данные
    if (currentUser && currentUser.id) {
        saveUserToIndexedDB(currentUser);
    }

    // Сохраняем дополнительные данные
    if (additionalData) {
        saveAppStateToIndexedDB('transitionData', additionalData);
    }

    // Очищаем предыдущее состояние, если требуется
    if (clearPreviousState) {
        localStorage.clear();
    }

    // Сохраняем маршрут
    if (saveHistory) {
        window.navigationHistory.push(url);
    }
}

// Заглушка для восстановления состояния приложения
async function restoreApplicationState() {
    console.log('Восстановление состояния приложения');
    try {
        // Здесь можно добавить логику восстановления состояния
        // Например, восстановление из localStorage или IndexedDB
        const savedState = localStorage.getItem('papaTrubok_appState');
        if (savedState) {
            const parsedState = JSON.parse(savedState);
            // Применяем сохраненное состояние
            console.log('Восстановлено состояние приложения:', parsedState);
        }
    } catch (error) {
        console.error('Ошибка при восстановлении состояния приложения:', error);
    }
}

// Заглушка для инициализации приложения
function initializeApplication() {
    console.log('Инициализация приложения');
    // Здесь можно добавить начальную настройку приложения
    // Например, установка начальных параметров, загрузка конфигурации
}

// Заглушка для настройки обработчиков событий
function setupEventListeners() {
    console.log('Настройка обработчиков событий');
    // Здесь можно добавить глобальные обработчики событий
    // Например, обработка клавиш, resize, online/offline и т.д.
}

// Заглушка для загрузки начального контента
function loadInitialContent() {
    console.log('Загрузка начального контента');
    // Здесь можно добавить логику первоначальной загрузки данных
    // Например, загрузка списка игр, проверка авторизации и т.д.
    loadGames(); // Используем существующую функцию
}