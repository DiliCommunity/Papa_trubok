// Глобальная инициализация API_URL
let API_URL = '/api'; // По умолчанию API находится на том же домене
let navigationHistory = []; // История навигации для кнопки "Назад"
let keyboardVisible = false; // Флаг для отслеживания видимости клавиатуры

// Глобальные переменные с начальными значениями
let currentUser = null;
let currentGame = null;

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
        API_URL = `${window.location.protocol}//${window.location.hostname}:${port}/api`;
    } else {
        // Для продакшена
        API_URL = '/api';
    }
    console.log('API_URL инициализирован:', API_URL);
    
    // Инициализируем данные пользователя, используя Telegram ID если доступен
    const telegramId = getTelegramUserId();
    if (telegramId) {
        currentUser = {
            id: telegramId,
            name: getTelegramUserName() || '',
            anonymous: false
        };
        
        // Сохраняем Telegram данные в локальное хранилище, если их там еще нет
        try {
            const authData = localStorage.getItem('papaTrubokAuth');
            if (!authData) {
                const newAuthData = {
                    userId: telegramId,
                    name: currentUser.name,
                    method: 'telegram',
                    timestamp: Date.now()
                };
                localStorage.setItem('papaTrubokAuth', JSON.stringify(newAuthData));
                console.log('Сохранены данные авторизации из Telegram:', newAuthData);
            }
        } catch (error) {
            console.error('Ошибка при сохранении данных Telegram:', error);
        }
    } else {
        // Проверяем наличие сохраненных данных
        const authData = localStorage.getItem('papaTrubokAuth');
        if (authData) {
            try {
                const parsedAuthData = JSON.parse(authData);
                currentUser = {
                    id: parsedAuthData.userId,
                    name: parsedAuthData.name || '',
                    anonymous: false
                };
                console.log('Загружены данные пользователя из хранилища:', currentUser);
            } catch (error) {
                console.error('Ошибка при загрузке данных пользователя:', error);
                currentUser = { 
                    id: String(Date.now()) + Math.random().toString(36).substring(2, 8), 
                    name: '', 
                    anonymous: false 
                };
            }
        } else {
            // Создаем нового пользователя с уникальным ID
            currentUser = { 
                id: String(Date.now()) + Math.random().toString(36).substring(2, 8), 
                name: '', 
                anonymous: false 
            };
        }
    }
    
    console.log('Инициализирован пользователь:', currentUser);
    
    // Проверяем соединение с сервером
    testServerConnection();
    
    // Проверяем данные аутентификации
    checkAuth();
    
    // Инициализируем обработчики кнопок
    initButtonHandlers();
    
    // Проверяем, была ли последняя игра
    checkLastGame();
    
    // Если в URL есть параметр gameId, пытаемся присоединиться к игре
    const urlParams = new URLSearchParams(window.location.search);
    const gameIdFromUrl = urlParams.get('gameId');
    if (gameIdFromUrl) {
        console.log('Найден gameId в URL:', gameIdFromUrl);
        currentGame = { id: gameIdFromUrl };
        joinGameRoom(gameIdFromUrl);
    } else {
        // Иначе загружаем список игр
        loadGames();
    }
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
    
    // Если доступен, включаем подтверждение закрытия
    if (typeof window.Telegram.WebApp.enableClosingConfirmation === 'function') {
      window.Telegram.WebApp.enableClosingConfirmation();
    }
    
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
  
  // Кнопка создания игры с введенным вопросом
  const submitQuestionBtn = document.getElementById('submitQuestionBtn');
  if (submitQuestionBtn) {
    console.log('Найдена кнопка submitQuestionBtn');
    submitQuestionBtn.addEventListener('click', async function() {
      console.log('Нажата кнопка "Создать игру" на экране вопроса');
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
        
        // Отладочный вывод для диагностики
        console.log('API_URL:', API_URL);
        
        const requestData = {
          question: question,
          userId: currentUser.id,
          userName: creatorName
        };
        
        console.log('Отправляем запрос на создание игры...');
        console.log('Данные запроса:', JSON.stringify(requestData));
        
        // Добавляем обработку ошибок сети и блокировку повторных нажатий
        try {
          const response = await fetch(`${API_URL}/games`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
          });
          
          console.log('Получен ответ от сервера:', response.status);
          
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
          
          // Переходим в созданную игру
          currentGame = {
            id: game.gameId || game.id,
            status: 'collecting_answers',
            isCreator: true,
            currentQuestion: question
          };
          
          console.log('Данные игры для перехода:', currentGame);
          
          // Показываем уведомление о создании игры
          showNotification('Игра успешно создана!', 'success');
          
          // Иногда сервер может возвращать id вместо gameId, проверяем оба варианта
          const gameId = game.gameId || game.id;
          if (gameId) {
            console.log('Переходим в игру с ID:', gameId);
            joinGameRoom(gameId);
          } else {
            console.error('Не удалось получить ID созданной игры');
            showNotification('Не удалось получить ID игры. Попробуйте обновить список игр.', 'warning');
            showScreen('gameScreen');
            loadGames();
          }
        } catch (error) {
          console.error('Ошибка при отправке запроса:', error);
          showNotification(`Не удалось создать игру: ${error.message}`, 'error');
          // В случае ошибки сети, предлагаем тестовое создание игры
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
  
  // Кнопка отправки ответа
  const submitAnswerBtn = document.getElementById('submitAnswerBtn');
  if (submitAnswerBtn) {
    console.log('Найдена кнопка submitAnswerBtn');
    submitAnswerBtn.addEventListener('click', submitAnswer);
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
    answerButton.addEventListener('click', function() {
      console.log('Нажата кнопка "Ответить на вопрос"');
      if (currentGame && currentGame.currentQuestion) {
        showAnswerScreen(currentGame.currentQuestion);
      } else {
        showNotification('Ошибка загрузки вопроса', 'error');
      }
    });
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
    
    // Получаем имя из данных авторизации
    let authName = '';
    try {
      const authData = localStorage.getItem('papaTrubokAuth');
      if (authData) {
        const parsedAuthData = JSON.parse(authData);
        if (parsedAuthData && parsedAuthData.name && parsedAuthData.userId === currentUser.id) {
          authName = parsedAuthData.name;
        }
      }
    } catch (error) {
      console.error('Ошибка при получении имени из данных авторизации:', error);
    }
    
    // Создаем HTML для кнопок
    choiceButtons.innerHTML = '';
    
    // Добавляем кнопку использования имени из авторизации, если оно есть
    if (authName) {
      const authNameBtn = document.createElement('button');
      authNameBtn.className = 'papyrus-button shimmer';
      authNameBtn.textContent = `Использовать имя: ${authName}`;
      authNameBtn.addEventListener('click', function() {
        currentUser.name = authName;
        currentUser.anonymous = false;
        showScreen('gameScreen');
        showNotification(`Используем имя: ${authName}`, 'success');
        loadGames();
      });
      choiceButtons.appendChild(authNameBtn);
    }
    
    // Добавляем кнопку использования ника из Telegram, если он доступен
    const telegramName = getTelegramUserName();
    if (telegramName && (!authName || telegramName !== authName)) {
      const telegramNameBtn = document.createElement('button');
      telegramNameBtn.className = 'papyrus-button shimmer telegram-button';
      telegramNameBtn.textContent = `Использовать ник из Telegram: ${telegramName}`;
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
          const authData = localStorage.getItem('papaTrubokAuth');
          if (authData) {
            const parsedAuthData = JSON.parse(authData);
            parsedAuthData.name = telegramName;
            parsedAuthData.userId = currentUser.id;
            localStorage.setItem('papaTrubokAuth', JSON.stringify(parsedAuthData));
          } else {
            // Если данных авторизации нет, создаем новые
            localStorage.setItem('papaTrubokAuth', JSON.stringify({
              userId: currentUser.id,
              name: telegramName,
              method: 'telegram',
              timestamp: Date.now()
            }));
          }
        } catch (error) {
          console.error('Ошибка при обновлении имени в данных авторизации:', error);
        }
        
        showScreen('gameScreen');
        showNotification(`Используем ник из Telegram: ${telegramName}`, 'success');
        loadGames();
      });
      choiceButtons.appendChild(telegramNameBtn);
    }
    
    // Кнопка "Придумать другое имя"
    const newNameBtn = document.createElement('button');
    newNameBtn.className = 'papyrus-button shimmer';
    newNameBtn.textContent = 'Придумать другое имя';
    newNameBtn.addEventListener('click', showNewNameForm);
    choiceButtons.appendChild(newNameBtn);
    
    // Получаем сохраненные имена для текущего пользователя
    const savedNames = getSavedNames(currentUser.id);
    console.log(`Найдено ${savedNames.length} сохраненных имен для пользователя ${currentUser.id}`);
    
    // Кнопка "Использовать сохраненное имя" - активна только если есть сохраненные имена
    const existingNameBtn = document.createElement('button');
    existingNameBtn.className = 'papyrus-button shimmer';
    existingNameBtn.textContent = 'Использовать сохранённое имя';
    existingNameBtn.addEventListener('click', showExistingNames);
    
    // Проверяем наличие сохраненных имен
    if (savedNames.length === 0) {
      existingNameBtn.classList.add('disabled');
      existingNameBtn.disabled = true;
      existingNameBtn.title = 'Нет сохраненных имен';
    }
    
    choiceButtons.appendChild(existingNameBtn);
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
    
    const response = await fetch(`${API_URL}/games`);
    if (!response.ok) {
      throw new Error(`Ошибка загрузки списка игр: ${response.status}`);
    }
    
    const games = await response.json();
    console.log('Получен список игр:', games);
    
    if (!games || games.length === 0) {
      gamesList.innerHTML = '<p class="no-games">Нет доступных игр. Создайте новую!</p>';
      return;
    }
    
    let gamesHtml = '';
    
    games.forEach(game => {
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
  console.log(`Присоединяемся к комнате ${gameId}`);
  
  if (!currentUser || !currentUser.id) {
    console.warn('Не установлен ID пользователя');
    showNotification('Сначала нужно авторизоваться', 'warning');
    showScreen('nameScreen');
    return;
  }
  
  if (!currentUser.name) {
    console.warn('Не установлено имя пользователя');
    showNotification('Сначала нужно ввести имя', 'warning');
    showScreen('nameScreen');
    return;
  }
  
  // Показываем индикатор загрузки
  showNotification('Подключаемся к комнате...', 'info');
  
  try {
    console.log(`Отправляем запрос на присоединение к комнате ${gameId}`);
    console.log('Данные запроса:', JSON.stringify({
      userId: currentUser.id,
      userName: currentUser.name
    }));
    
    // Сначала получаем информацию о комнате
    const infoResponse = await fetch(`${API_URL}/games/${gameId}?userId=${currentUser.id}`);
    
    if (!infoResponse.ok) {
      console.error(`Ошибка при получении информации о комнате, статус: ${infoResponse.status}`);
      throw new Error(`Ошибка при получении информации о комнате: ${infoResponse.status}`);
    }
    
    const roomInfo = await infoResponse.json();
    console.log('Получена информация о комнате:', roomInfo);
    
    // Отправляем запрос на присоединение к комнате
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
      console.error(`Ошибка при присоединении к комнате, статус: ${response.status}`);
      const errorText = await response.text();
      console.error('Ошибка:', errorText);
      throw new Error(`Ошибка при присоединении к комнате: ${response.status}`);
    }
    
    const gameData = await response.json();
    console.log('Данные игры после присоединения:', gameData);
    
    // Объединяем данные из обоих запросов
    const combinedData = {
      ...roomInfo,
      ...gameData
    };
    
    // Сохраняем данные текущей игры
    currentGame = {
      id: gameId,
      status: combinedData.status || 'collecting_answers',
      currentQuestion: combinedData.currentQuestion || 'Вопрос не указан',
      isCreator: combinedData.isCreator || false,
      initiatorName: combinedData.initiatorName || 'Неизвестно',
      answersCount: typeof combinedData.answers === 'number' ? combinedData.answers : (combinedData.answers ? combinedData.answers.length : 0),
      participants: combinedData.participants || []
    };
    
    console.log('Текущая игра установлена:', currentGame);
    
    // Присоединяемся к комнате через сокет, если поддерживается
    if (window.socket) {
      console.log('Присоединяемся к комнате через сокет');
      window.socket.emit('joinGame', gameId);
    }
    
    // Показываем экран комнаты
    showScreen('roomScreen');
    
    // Обновляем интерфейс комнаты
    updateRoomInfo();
    
    // Проверяем, ответил ли пользователь на вопрос
    const hasAnswered = await checkUserAnswerStatus(gameId);
    
    // Показываем кнопку "Ответить на вопрос", если вопрос есть и пользователь еще не ответил
    const answerButton = document.getElementById('answerButton');
    if (answerButton && currentGame.currentQuestion && 
        (currentGame.status === 'collecting_answers' || currentGame.status === 'waiting_players') && 
        !hasAnswered) {
      answerButton.style.display = 'block';
      
      // Делаем кнопку заметной с анимацией
      answerButton.classList.add('highlight-button');
      setTimeout(() => {
        answerButton.classList.remove('highlight-button');
      }, 2000);
    }
    
    // Запускаем периодическое обновление статуса комнаты
    startRoomUpdates(gameId);
    
    // Обновляем кнопку Ответа на вопрос
    if (gameData.question && answerButton) {
      answerButton.textContent = `Ответить на вопрос: "${gameData.question.substring(0, 30)}${gameData.question.length > 30 ? '...' : ''}"`;
    }
    
    showNotification('Вы успешно вошли в комнату!', 'success');
  } catch (error) {
    console.error('Ошибка при присоединении к комнате:', error);
    showNotification('Ошибка при присоединении к комнате. Попробуйте позже.', 'error');
    showScreen('gameScreen'); // Возвращаемся на экран списка игр
  }
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
    const response = await fetch(`${API_URL}/games/${currentGame.id}/user-answer?userId=${currentUser.id}`);
    
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
    
    const response = await fetch(`${API_URL}/games/${gameId}/start-voting`, {
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
    
    const response = await fetch(`${API_URL}/games`, {
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
    showNotification(`Тестовая игра создана! ID: ${result.gameId}`, "success");
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