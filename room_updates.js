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
    const response = await fetch(`${API_URL}/games/${gameId}?userId=${currentUser.id}`);
    if (!response.ok) {
      throw new Error('Не удалось загрузить информацию об игре');
    }
    
    const gameData = await response.json();
    
    // Проверяем, ответил ли пользователь на вопрос
    const answeredResponse = await fetch(`${API_URL}/games/${gameId}/check-answer?userId=${currentUser.id}`);
    const answeredData = await answeredResponse.json();
    const hasAnswered = answeredData.hasAnswered;
    
    const gamesList = document.getElementById('gamesList');
    if (!gamesList) return;
    
    gamesList.innerHTML = '';
    
    const gameRoom = document.createElement('div');
    gameRoom.className = 'game-room';
    
    const isCreator = gameData.isCreator;
    const answersCount = gameData.answers;
    
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
      
      <div class="game-room-actions">
        ${gameData.status === 'collecting_answers' && !hasAnswered ? `
          <button class="answer-btn" onclick="joinGame('${gameId}'); showAnswerScreen('${gameData.currentQuestion}');">
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
        
        <button class="viewer-btn" onclick="joinGame('${gameId}')">
          ${gameData.status === 'collecting_answers' ? 'Присоединиться как зритель' : 'Присоединиться к игре'}
        </button>
        
        <button class="papyrus-button shimmer back-button" onclick="loadGames()">
          Вернуться к списку игр
        </button>
      </div>
    `;
    
    gamesList.appendChild(gameRoom);
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
        
        showNotification('Ваш ответ успешно отправлен! Ожидайте голосования.', 'success');
        answerInput.value = '';
        
        // Возвращаемся в комнату игры
        joinGameRoom(currentGame.id);
    } catch (error) {
        console.error('Ошибка при отправке ответа:', error);
        showNotification('Произошла ошибка при отправке ответа', 'error');
    }
} 