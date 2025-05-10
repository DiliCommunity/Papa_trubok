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
    // Получаем информацию об игре
    const response = await fetch(`${API_URL}/games/${gameId}?userId=${currentUser.id}`);
    if (!response.ok) {
      throw new Error('Не удалось загрузить информацию об игре');
    }
    
    const gameData = await response.json();
    
    // Проверяем, ответил ли пользователь на вопрос
    const answeredResponse = await fetch(`${API_URL}/games/${gameId}/check-answer?userId=${currentUser.id}`);
    const answeredData = await answeredResponse.json();
    const hasAnswered = answeredData.hasAnswered;
    
    // Сохраняем данные о текущей игре глобально
    currentGame = {
      id: gameId,
      isCreator: gameData.isCreator,
      question: gameData.currentQuestion,
      status: gameData.status,
      participants: gameData.participants,
      answersCount: gameData.answers
    };
    
    // Обновляем интерфейс
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
      
      ${isCreator && gameData.status === 'collecting_answers' ? `
        <div class="creator-controls">
            <h3>Управление игрой</h3>
            ${canStartVoting ? `
                <button class="start-voting-btn" onclick="startVoting('${gameId}')">
                    Начать голосование
                </button>
            ` : answersCount < 3 ? `
                <p style="color: #e63946; margin: 10px 0;">Для начала голосования нужно минимум 3 ответа (сейчас: ${answersCount})</p>
            ` : ''}
        </div>
      ` : ''}
      
      <div class="game-room-actions">
        ${gameData.status === 'collecting_answers' && !hasAnswered && !isCreator ? `
          <button class="answer-btn" onclick="showAnswerScreen('${gameData.currentQuestion}')">
            Ответить на вопрос
          </button>
        ` : ''}
        
        ${gameData.status === 'collecting_answers' && hasAnswered ? `
          <p class="status-text">Ваш ответ принят. Ожидайте голосования.</p>
        ` : ''}
        
        ${gameData.status === 'voting' ? `
          <button class="join-room-btn" onclick="loadVotingOptions('${gameId}')">
            Перейти к голосованию
          </button>
        ` : ''}
        
        ${gameData.status === 'results' ? `
          <button class="join-room-btn" onclick="loadResults('${gameId}')">
            Посмотреть результаты
          </button>
        ` : ''}
        
        <button class="papyrus-button shimmer back-button" onclick="loadGames()">
          Вернуться к списку игр
        </button>
      </div>
    `;
    
    gamesList.appendChild(gameRoom);
    
    // Показываем экран с информацией о комнате
    showScreen('gameScreen');
    
    // Запускаем периодическую проверку статуса игры
    startStatusCheck();
  } catch (error) {
    console.error('Ошибка при загрузке комнаты игры:', error);
    showNotification('Не удалось загрузить информацию об игре', 'error');
  }
}

// Обновленная функция отправки ответа
async function submitAnswer() {
    if (!currentGame || !currentGame.id) {
        showNotification('Ошибка: игра не найдена', 'error');
        return;
    }

    const answerInput = document.getElementById('answerInput');
    const answer = answerInput.value.trim();

    if (!answer) {
        showNotification('Пожалуйста, введите ответ', 'warning');
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
                answer: answer,
                username: currentUser.name,
                anonymous: currentUser.anonymous
            })
        });

        if (!response.ok) {
            throw new Error('Ошибка при отправке ответа');
        }

        const data = await response.json();
        
        // Сохраняем ответ пользователя в currentGame
        if (!currentGame.userAnswer) {
            currentGame.userAnswer = answer;
        }
        
        showNotification('Ваш ответ успешно отправлен! Ожидайте голосования.', 'success');
        answerInput.value = '';
        
        // Возвращаемся в комнату игры
        joinGameRoom(currentGame.id);
    } catch (error) {
        console.error('Ошибка при отправке ответа:', error);
        showNotification('Произошла ошибка при отправке ответа', 'error');
    }
}

// Функция для обновления видимости комнаты
function updateRoomVisibility(gameId, isVisible) {
    const gameRoom = document.querySelector(`.game-room[data-game-id="${gameId}"]`);
    if (gameRoom) {
        gameRoom.style.display = isVisible ? 'block' : 'none';
    }
}

// Функция для фильтрации комнат
function filterRooms(filter) {
    const gameRooms = document.querySelectorAll('.game-room');
    gameRooms.forEach(room => {
        const status = room.querySelector('.game-room-status').textContent;
        const players = parseInt(room.querySelector('.game-room-player').textContent.match(/\d+/)[0]);
        
        let isVisible = true;
        
        switch (filter) {
            case 'waiting':
                isVisible = status.includes('Ожидание');
                break;
            case 'in_progress':
                isVisible = status.includes('В процессе');
                break;
            case 'full':
                isVisible = players >= 10;
                break;
            case 'empty':
                isVisible = players === 0;
                break;
            case 'available':
                isVisible = players < 10 && status.includes('Ожидание');
                break;
        }
        
        updateRoomVisibility(room.dataset.gameId, isVisible);
    });
}

// Функция для сортировки комнат
function sortRooms(sortBy) {
    const gamesList = document.getElementById('gamesList');
    const gameRooms = Array.from(gamesList.querySelectorAll('.game-room'));
    
    gameRooms.sort((a, b) => {
        switch (sortBy) {
            case 'players_asc':
                return parseInt(a.querySelector('.game-room-player').textContent.match(/\d+/)[0]) -
                       parseInt(b.querySelector('.game-room-player').textContent.match(/\d+/)[0]);
            case 'players_desc':
                return parseInt(b.querySelector('.game-room-player').textContent.match(/\d+/)[0]) -
                       parseInt(a.querySelector('.game-room-player').textContent.match(/\d+/)[0]);
            case 'name_asc':
                return a.querySelector('.game-room-title').textContent.localeCompare(
                    b.querySelector('.game-room-title').textContent
                );
            case 'name_desc':
                return b.querySelector('.game-room-title').textContent.localeCompare(
                    a.querySelector('.game-room-title').textContent
                );
            case 'status':
                return a.querySelector('.game-room-status').textContent.localeCompare(
                    b.querySelector('.game-room-status').textContent
                );
        }
    });
    
    // Очищаем список и добавляем отсортированные комнаты
    gamesList.innerHTML = '';
    gameRooms.forEach(room => gamesList.appendChild(room));
}

// Добавляем обработчики событий для фильтров и сортировки
document.addEventListener('DOMContentLoaded', () => {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const sortSelect = document.querySelector('#sortRooms');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            filterRooms(button.dataset.filter);
        });
    });
    
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            sortRooms(sortSelect.value);
        });
    }
});

// Функция для обновления статуса комнаты
function updateRoomStatus(gameId, status) {
    const gameRoom = document.querySelector(`.game-room[data-game-id="${gameId}"]`);
    if (gameRoom) {
        const statusElement = gameRoom.querySelector('.game-room-status');
        if (statusElement) {
            statusElement.textContent = getStatusText(status);
            statusElement.className = `game-room-status status-${status}`;
        }
    }
}

// Функция для обновления количества игроков
function updateRoomPlayers(gameId, count) {
    const gameRoom = document.querySelector(`.game-room[data-game-id="${gameId}"]`);
    if (gameRoom) {
        const playersElement = gameRoom.querySelector('.game-room-player');
        if (playersElement) {
            playersElement.textContent = `Игроков: ${count}/10`;
        }
    }
} 