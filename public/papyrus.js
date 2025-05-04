// Базовый URL для API
const API_URL = window.location.origin + '/api';

// Имитация Telegram WebApp
const telegram = {
  initDataUnsafe: {
    user: {
      id: Math.floor(Math.random() * 1000000), // В реальном приложении это будет настоящий id
      first_name: 'Пользователь',
    }
  }
};

// В реальном приложении это будет window.Telegram.WebApp
window.Telegram = { WebApp: telegram };

// Глобальные переменные
let currentUser = {
  id: telegram.initDataUnsafe.user.id,
  name: ''
};
let currentGame = null;

// Элементы DOM
const startScreen = document.getElementById('startScreen');
const nameScreen = document.getElementById('nameScreen');
const gameScreen = document.getElementById('gameScreen');
const questionScreen = document.getElementById('questionScreen');
const answerScreen = document.getElementById('answerScreen');
const votingScreen = document.getElementById('votingScreen');
const resultsScreen = document.getElementById('resultsScreen');

const nameInput = document.getElementById('nameInput');
const questionInput = document.getElementById('questionInput');
const answerInput = document.getElementById('answerInput');
const gamesList = document.getElementById('gamesList');
const questionText = document.getElementById('questionText');
const answerOptions = document.getElementById('answerOptions');
const resultsList = document.getElementById('resultsList');

// Функции управления экранами
function showScreen(screen) {
  // Скрываем все экраны
  [startScreen, nameScreen, gameScreen, questionScreen, answerScreen, votingScreen, resultsScreen]
    .forEach(s => s.style.display = 'none');
  
  // Показываем нужный экран
  screen.style.display = 'block';
}

// Первый вход - требование указать имя
function startApp() {
  showScreen(nameScreen);
}

// Сохранение имени пользователя
function saveName() {
  const name = nameInput.value.trim();
  if (name.length < 3) {
    alert('Имя должно содержать минимум 3 символа');
    return;
  }
  
  currentUser.name = name;
  showMainMenu();
}

// Показ главного меню
function showMainMenu() {
  showScreen(gameScreen);
  loadGames();
}

// Загрузка списка доступных игр
async function loadGames() {
  try {
    const response = await fetch(`${API_URL}/games`);
    const games = await response.json();
    
    gamesList.innerHTML = '';
    
    if (games.length === 0) {
      gamesList.innerHTML = '<p>Нет доступных игр. Создайте новую!</p>';
      return;
    }
    
    games.forEach(game => {
      const gameItem = document.createElement('div');
      gameItem.className = 'game-item';
      gameItem.innerHTML = `
        <h3>Комната: ${game.name}</h3>
        <p>Участников: ${game.count}/10</p>
        <p>Статус: ${getStatusText(game.status)}</p>
        <button class="papyrus-button shimmer" onclick="joinGame('${game.id}')">Присоединиться</button>
      `;
      gamesList.appendChild(gameItem);
    });
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

// Создание новой игры
function createNewGame() {
  showScreen(questionScreen);
}

// Сохранение вопроса и создание игры
async function saveQuestion() {
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
    
    const data = await response.json();
    
    if (data.status === 'success') {
      currentGame = {
        id: data.gameId,
        isCreator: true,
        question: question
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

// Присоединение к игре
async function joinGame(gameId) {
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
    
    const data = await response.json();
    
    if (response.ok) {
      currentGame = {
        id: gameId,
        isCreator: false,
        question: data.question
      };
      
      if (data.question) {
        showAnswerScreen(data.question);
      } else {
        alert('Вы присоединились к игре! Ожидайте, пока создатель выберет вопрос.');
        showMainMenu();
      }
    } else {
      alert('Ошибка при присоединении к игре: ' + (data.error || 'Неизвестная ошибка'));
    }
  } catch (error) {
    console.error('Ошибка присоединения к игре:', error);
    alert('Произошла ошибка при присоединении к игре. Пожалуйста, попробуйте еще раз.');
  }
}

// Показ экрана ответа на вопрос
function showAnswerScreen(question) {
  showScreen(answerScreen);
  document.getElementById('answerQuestionText').textContent = question;
}

// Отправка ответа на вопрос
async function submitAnswer() {
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
    
    const data = await response.json();
    
    if (response.ok) {
      alert(`Ваш ответ принят! Осталось ответов до голосования: ${data.remainingToVoting}`);
      
      // Если это создатель игры, показываем ему доп. опции
      if (currentGame.isCreator) {
        showCreatorOptions();
      } else {
        showMainMenu();
      }
    } else {
      alert('Ошибка при отправке ответа: ' + (data.error || 'Неизвестная ошибка'));
    }
  } catch (error) {
    console.error('Ошибка отправки ответа:', error);
    alert('Произошла ошибка при отправке ответа. Пожалуйста, попробуйте еще раз.');
  }
}

// Показ опций для создателя игры
function showCreatorOptions() {
  showScreen(gameScreen);
  gamesList.innerHTML = `
    <div class="creator-options">
      <h2>Вы создатель игры</h2>
      <p>Вопрос: "${currentGame.question}"</p>
      <button class="papyrus-button shimmer" onclick="startVoting()">Начать голосование</button>
      <button class="papyrus-button shimmer" onclick="showMainMenu()">Вернуться к списку игр</button>
    </div>
  `;
}

// Запуск голосования
async function startVoting() {
  if (!currentGame.isCreator) {
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
    
    const data = await response.json();
    
    if (response.ok) {
      alert('Голосование успешно запущено!');
      loadVotingOptions();
    } else {
      alert('Ошибка при запуске голосования: ' + (data.error || 'Неизвестная ошибка'));
    }
  } catch (error) {
    console.error('Ошибка запуска голосования:', error);
    alert('Произошла ошибка при запуске голосования. Пожалуйста, попробуйте еще раз.');
  }
}

// Загрузка вариантов для голосования
async function loadVotingOptions() {
  try {
    const response = await fetch(`${API_URL}/games/${currentGame.id}/answers?userId=${currentUser.id}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Ошибка загрузки вариантов для голосования');
    }
    
    const data = await response.json();
    
    if (data.answers && data.answers.length > 0) {
      showScreen(votingScreen);
      
      document.getElementById('votingQuestionText').textContent = data.question;
      
      // Очищаем старые варианты
      answerOptions.innerHTML = '';
      
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
      
      document.getElementById('votingStatus').textContent = 'Выберите 2 самых смешных ответа (кроме своего)';
    } else {
      alert('Нет доступных вариантов для голосования.');
      showMainMenu();
    }
  } catch (error) {
    console.error('Ошибка загрузки вариантов:', error);
    alert('Произошла ошибка при загрузке вариантов для голосования: ' + error.message);
    showMainMenu();
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
  document.getElementById('votingStatus').textContent = 
    `Выбрано ${selectedAnswers.length} из 2 ответов`;
}

// Отправка голосов
async function submitVotes() {
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
    
    const data = await response.json();
    
    if (response.ok) {
      alert('Ваши голоса учтены!');
      
      if (data.resultsReady) {
        loadResults();
      } else {
        alert('Ожидайте, пока все участники проголосуют.');
        showMainMenu();
      }
    } else {
      alert('Ошибка при отправке голосов: ' + (data.error || 'Неизвестная ошибка'));
    }
  } catch (error) {
    console.error('Ошибка отправки голосов:', error);
    alert('Произошла ошибка при отправке голосов. Пожалуйста, попробуйте еще раз.');
  }
}

// Загрузка результатов голосования
async function loadResults() {
  try {
    const response = await fetch(`${API_URL}/games/${currentGame.id}/results`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Ошибка загрузки результатов');
    }
    
    const data = await response.json();
    
    showScreen(resultsScreen);
    
    document.getElementById('resultsQuestionText').textContent = data.question;
    
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
  } catch (error) {
    console.error('Ошибка загрузки результатов:', error);
    alert('Произошла ошибка при загрузке результатов: ' + error.message);
    showMainMenu();
  }
}

// Инициализация приложения при загрузке
document.addEventListener('DOMContentLoaded', function() {
  // Добавляем обработчики событий для кнопок
  document.getElementById('submitNameBtn').addEventListener('click', saveName);
  document.getElementById('createGameBtn').addEventListener('click', createNewGame);
  document.getElementById('submitQuestionBtn').addEventListener('click', saveQuestion);
  document.getElementById('submitAnswerBtn').addEventListener('click', submitAnswer);
  document.getElementById('submitVotesBtn').addEventListener('click', submitVotes);
  document.getElementById('backToMainBtn').addEventListener('click', showMainMenu);
  document.getElementById('refreshGamesBtn').addEventListener('click', loadGames);
  
  // Добавляем обработчики для полей ввода (отправка по Enter)
  nameInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') saveName();
  });
  
  questionInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') saveQuestion();
  });
  
  answerInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') submitAnswer();
  });
  
  // Автоматическая проверка обновлений состояния игры
  setInterval(checkGameStatus, 10000); // Каждые 10 секунд
  
  // Запускаем приложение
  startApp();
});

// Проверка статуса игры
async function checkGameStatus() {
  if (!currentGame) return;
  
  try {
    const response = await fetch(`${API_URL}/games/${currentGame.id}`);
    if (!response.ok) return;
    
    const game = await response.json();
    
    // Если статус игры изменился, обновляем интерфейс
    if (game.status === 'voting' && currentGame.status !== 'voting') {
      alert('Началось голосование!');
      loadVotingOptions();
    } else if (game.status === 'results' && currentGame.status !== 'results') {
      alert('Голосование завершено! Загружаем результаты...');
      loadResults();
    }
    
    // Обновляем локальное состояние
    currentGame.status = game.status;
    
  } catch (error) {
    console.error('Ошибка при проверке статуса игры:', error);
  }
}

// Функция для использования в Telegram Mini App
function initTelegramMiniApp() {
  // Если это Telegram Mini App, используем реальные данные пользователя
  if (window.Telegram && window.Telegram.WebApp) {
    const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
    if (tgUser) {
      currentUser.id = tgUser.id;
      currentUser.name = tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : '');
      
      // Если у пользователя есть имя из Telegram, используем его
      if (currentUser.name) {
        nameInput.value = currentUser.name;
      }
    }
    
    // Настраиваем интерфейс под Telegram
    document.body.classList.add('telegram-theme');
    
    // Настраиваем кнопку "назад" для Telegram
    window.Telegram.WebApp.BackButton.onClick(() => {
      // Логика возврата назад в зависимости от текущего экрана
      if (questionScreen.style.display === 'block') {
        showMainMenu();
      } else if (answerScreen.style.display === 'block') {
        showMainMenu();
      } else if (votingScreen.style.display === 'block') {
        showMainMenu();
      } else {
        window.Telegram.WebApp.close();
      }
    });
  }
}

// Функция полного сброса игры
function resetGame() {
  currentGame = null;
  selectedAnswers = [];
  
  // Очищаем поля ввода
  nameInput.value = '';
  questionInput.value = '';
  answerInput.value = '';
  
  // Сбрасываем отображение
  showScreen(startScreen);
}

// Автоматически запускаем интеграцию с Telegram, если приложение открыто в Telegram
if (window.Telegram && window.Telegram.WebApp) {
  initTelegramMiniApp();
}

// Обработка ошибок для повышения стабильности работы
window.addEventListener('error', function(event) {
  console.error('Ошибка в приложении:', event.error || event.message);
  alert(`Произошла ошибка: ${event.message}. Пожалуйста, перезагрузите страницу.`);
});