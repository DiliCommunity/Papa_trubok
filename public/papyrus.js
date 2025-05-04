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
let currentGame = null;

// Простые функции для базовой работы
function showScreen(screenId) {
  // Получаем все экраны
  const screens = [
    'startScreen', 'nameScreen', 'gameScreen', 'questionScreen',
    'answerScreen', 'votingScreen', 'resultsScreen'
  ];
  
  console.log(`Показываем экран: ${screenId}`);
  
  // Скрываем дебаг-панель при переключении экранов
  const debugPanel = document.getElementById('debugPanel');
  if (debugPanel && debugPanel.style.display === 'block') {
    debugPanel.style.display = 'none';
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

// Обработчик для начала приложения
window.startApp = function() {
  console.log("Вызвана функция startApp()");
  
  // Скрываем дебаг-панель, если она открыта
  const debugPanel = document.getElementById('debugPanel');
  if (debugPanel) {
    debugPanel.style.display = 'none';
  }
  
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
    return;
  }
  
  const question = questionInput.value.trim();
  if (question.length < 5) {
    alert('Вопрос должен содержать минимум 5 символов');
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
      
      alert('Игра успешно создана! Ожидайте подключения участников.');
      
      // Переходим в режим ответа на свой вопрос
      showAnswerScreen(question);
    } else {
      alert('Ошибка при создании игры: ' + (data.error || 'Неизвестная ошибка'));
    }
  } catch (error) {
    console.error('Ошибка создания игры:', error);
    alert('Произошла ошибка при создании игры. Пожалуйста, попробуйте еще раз.');
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
    alert('Сначала нужно задать имя!');
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
    
    if (data.question) {
      showAnswerScreen(data.question);
    } else {
      alert('Вы присоединились к игре! Ожидайте, пока создатель выберет вопрос.');
      showScreen('gameScreen');
    }
  } catch (error) {
    console.error('Ошибка присоединения к игре:', error);
    alert('Произошла ошибка при присоединении к игре. Пожалуйста, попробуйте еще раз.');
  }
}

// Отправка ответа на вопрос
async function submitAnswer() {
  if (!currentGame || !currentGame.id) {
    alert('Ошибка: информация об игре отсутствует');
    return;
  }
  
  const answerInput = document.getElementById('answerInput');
  if (!answerInput) {
    console.error('Элемент ввода ответа не найден!');
    return;
  }
  
  const answer = answerInput.value.trim();
  if (answer.length < 1) {
    alert('Введите ваш ответ');
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
    
    alert(`Ваш ответ принят! Осталось ответов до голосования: ${data.remainingToVoting}`);
    
    // Если это создатель игры, показываем ему доп. опции
    if (currentGame.isCreator) {
      showCreatorOptions();
    } else {
      showScreen('gameScreen');
    }
  } catch (error) {
    console.error('Ошибка отправки ответа:', error);
    alert('Произошла ошибка при отправке ответа. Пожалуйста, попробуйте еще раз.');
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
    alert('Только создатель игры может начать голосование');
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
    
    alert('Голосование успешно запущено!');
    currentGame.status = 'voting';
    loadVotingOptions();
  } catch (error) {
    console.error('Ошибка запуска голосования:', error);
    alert('Произошла ошибка при запуске голосования. Пожалуйста, попробуйте еще раз.');
  }
}

// Обработчик для возврата назад
function goBack() {
  console.log("Вызвана функция goBack()");
  
  // В зависимости от текущего экрана определяем куда вернуться
  const currentScreen = document.querySelector('div[style="display: block;"');
  if (!currentScreen) {
    showScreen('startScreen');
    return;
  }
  
  switch (currentScreen.id) {
    case 'nameScreen':
      showScreen('startScreen');
      break;
    case 'questionScreen':
    case 'answerScreen':
    case 'votingScreen':
      showScreen('gameScreen');
      break;
    default:
      showScreen('startScreen');
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

// Проверка статуса игры
async function checkGameStatus() {
  if (!currentGame || !currentGame.id) return;
  
  try {
    const response = await fetch(`${API_URL}/games/${currentGame.id}`);
    if (!response.ok) return;
    
    const game = await response.json();
    
    // Обновляем статус игры
    if (game.status !== currentGame.status) {
      currentGame.status = game.status;
      
      // Реагируем на изменение статуса
      if (game.status === 'voting') {
        alert('Началось голосование!');
        loadVotingOptions();
      } else if (game.status === 'results') {
        alert('Голосование завершено! Загружаем результаты...');
        loadResults();
      }
    }
  } catch (error) {
    // Скрываем периодические ошибки проверки статуса
    // console.error('Ошибка при проверке статуса игры:', error);
  }
}

// Загрузка вариантов для голосования
async function loadVotingOptions() {
  if (!currentGame || !currentGame.id) {
    console.error('Нет информации о текущей игре');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/games/${currentGame.id}/answers?userId=${currentUser.id}`);
    
    if (!response.ok) {
      throw new Error(`Ошибка HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.answers && data.answers.length > 0) {
      const votingQuestionText = document.getElementById('votingQuestionText');
      if (votingQuestionText) {
        votingQuestionText.textContent = data.question;
      }
      
      const answerOptions = document.getElementById('answerOptions');
      if (!answerOptions) {
        console.error('Элемент для вариантов ответов не найден');
        return;
      }
      
      // Очищаем старые варианты
      answerOptions.innerHTML = '';
      selectedAnswers = []; // Сбрасываем выбранные ответы
      
      // Добавляем новые варианты
      data.answers.forEach(answer => {
        const answerOption = document.createElement('div');
        answerOption.className = 'answer-option';
        answerOption.setAttribute('data-id', answer.id);
        answerOption.innerHTML = `
          <strong>${answer.username}:</strong> ${answer.text}
        `;
        answerOption.addEventListener('click', function() {
          toggleVoteSelection(this);
        });
        
        answerOptions.appendChild(answerOption);
      });
      
      const votingStatus = document.getElementById('votingStatus');
      if (votingStatus) {
        votingStatus.textContent = 'Выберите 2 самых смешных ответа (кроме своего)';
      }
      
      showScreen('votingScreen');
    } else {
      alert('Нет доступных вариантов для голосования.');
      showScreen('gameScreen');
    }
  } catch (error) {
    console.error('Ошибка загрузки вариантов:', error);
    alert('Произошла ошибка при загрузке вариантов для голосования: ' + error.message);
    showScreen('gameScreen');
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
      alert('Вы можете выбрать максимум 2 ответа');
      return;
    }
  }
  
  // Обновляем статус голосования
  const votingStatus = document.getElementById('votingStatus');
  if (votingStatus) {
    votingStatus.textContent = `Выбрано ${selectedAnswers.length} из 2 ответов`;
  }
}

// Отправка голосов
async function submitVotes() {
  if (!currentGame || !currentGame.id) {
    alert('Информация об игре отсутствует');
    return;
  }
  
  if (selectedAnswers.length === 0) {
    alert('Выберите хотя бы один ответ');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/games/${currentGame.id}/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: currentUser.id,
        votedFor: selectedAnswers
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    alert('Ваши голоса учтены!');
    
    if (data.resultsReady) {
      currentGame.status = 'results';
      loadResults();
    } else {
      alert('Ожидайте, пока все участники проголосуют.');
      showScreen('gameScreen');
    }
  } catch (error) {
    console.error('Ошибка отправки голосов:', error);
    alert('Произошла ошибка при отправке голосов. Пожалуйста, попробуйте еще раз.');
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
    alert('Произошла ошибка при загрузке результатов: ' + error.message);
    showScreen('gameScreen');
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
      'refreshGamesBtn': loadGames,
      'submitQuestionBtn': saveQuestion,
      'submitAnswerBtn': submitAnswer,
      'submitVotesBtn': submitVotes,
      'backToMainFromQuestionBtn': goBack,
      'backToMainFromAnswerBtn': goBack,
      'backToMainFromVotingBtn': goBack,
      'backToMainBtn': () => showScreen('gameScreen')
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
    
    // Добавляем обработчик для поля вопроса
    const questionInput = document.getElementById('questionInput');
    if (questionInput) {
      questionInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          saveQuestion();
        }
      });
    }
    
    // Добавляем обработчик для поля ответа
    const answerInput = document.getElementById('answerInput');
    if (answerInput) {
      answerInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          submitAnswer();
        }
      });
    }
    
    // Запускаем проверку статуса игры
    startStatusCheck();
    
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