// room_updates.js - Функции для обновления состояния комнаты в реальном времени

// Интервал обновления состояния комнаты (в миллисекундах)
const ROOM_UPDATE_INTERVAL = 5000; // 5 секунд

// Идентификатор интервала обновления
let roomUpdateInterval = null;

// Функция для запуска периодического обновления состояния комнаты
function startRoomUpdates(gameId) {
    // Сначала останавливаем предыдущие обновления, если они были
    stopRoomUpdates();
    
    // Сразу получаем обновление
    updateRoomState(gameId);
    
    // Запускаем периодическое обновление
    roomUpdateInterval = setInterval(() => {
        updateRoomState(gameId);
    }, ROOM_UPDATE_INTERVAL);
    
    console.log(`Запущено периодическое обновление состояния комнаты #${gameId}`);
}

// Функция для остановки периодического обновления состояния комнаты
function stopRoomUpdates() {
    if (roomUpdateInterval) {
        clearInterval(roomUpdateInterval);
        roomUpdateInterval = null;
        console.log("Остановлено периодическое обновление состояния комнаты");
    }
}

// Функция для обновления состояния комнаты
async function updateRoomState(gameId) {
    if (!gameId || !currentUser || !currentUser.id) {
        console.warn("Невозможно обновить состояние комнаты: отсутствует ID игры или пользователя");
        return;
    }
    
    try {
        // Получаем актуальную информацию о комнате
        const response = await fetch(`${API_URL}/games/${gameId}?userId=${currentUser.id}`);
        if (!response.ok) {
            throw new Error(`Ошибка получения данных комнаты: ${response.status}`);
        }
        
        const gameData = await response.json();
        
        // Проверяем, изменился ли статус игры
        const statusChanged = !currentGame || currentGame.status !== gameData.status;
        
        // Обновляем информацию о текущей игре
        currentGame = {
            ...currentGame,
            status: gameData.status,
            answersCount: gameData.answers,
            participants: gameData.participants
        };
        
        // Проверяем, ответил ли пользователь на вопрос
        const answeredResponse = await fetch(`${API_URL}/games/${gameId}/check-answer?userId=${currentUser.id}`);
        const answeredData = await answeredResponse.json();
        const hasAnswered = answeredData.hasAnswered;
        
        // Получаем ответ пользователя, если он уже ответил
        if (hasAnswered && !currentGame.userAnswer) {
            const userAnswerResponse = await fetch(`${API_URL}/games/${gameId}/user-answer?userId=${currentUser.id}`);
            if (userAnswerResponse.ok) {
                const userAnswerData = await userAnswerResponse.json();
                currentGame.userAnswer = userAnswerData.answer || '';
            }
        }
        
        // Обновляем отображение комнаты
        updateRoomUI(gameData, hasAnswered);
        
        // Если статус игры изменился, показываем уведомление и возможно переходим на другой экран
        if (statusChanged) {
            handleStatusChange(gameData.status, gameId);
        }
    } catch (error) {
        console.error("Ошибка при обновлении состояния комнаты:", error);
    }
}

// Функция для обновления UI комнаты
function updateRoomUI(gameData, hasAnswered) {
    // Обновляем счетчики
    const participantsCounter = document.querySelector('.game-room-player:first-child');
    const answersCounter = document.querySelector('.game-room-player:last-child');
    
    if (participantsCounter) {
        participantsCounter.textContent = `Игроков: ${gameData.participants}`;
    }
    
    if (answersCounter) {
        answersCounter.textContent = `Ответов: ${gameData.answers}`;
    }
    
    // Обновляем статус игры
    const statusElement = document.querySelector('.game-room-status');
    if (statusElement) {
        statusElement.textContent = getStatusText(gameData.status);
    }
    
    // Обновляем секцию ответа на вопрос
    const answerSection = document.querySelector('.answer-section');
    if (answerSection && gameData.status === 'collecting_answers') {
        if (hasAnswered) {
            // Пользователь уже ответил, показываем его ответ
            answerSection.innerHTML = `
                <div class="user-answer-box">
                    <p style="color: #2a9d8f; font-weight: bold; margin-bottom: 10px;">Ваш ответ принят!</p>
                    <p style="color: #5a2d0c; font-style: italic;">"${currentGame.userAnswer}"</p>
                    <p style="margin-top: 10px; color: #457b9d;">Ожидайте начала голосования.</p>
                </div>
            `;
        } else {
            // Пользователь еще не ответил, показываем кнопку
            answerSection.innerHTML = `
                <button id="roomAnswerBtn" class="answer-btn">
                    Ответить на вопрос
                </button>
            `;
            
            // Добавляем обработчик для кнопки
            const roomAnswerBtn = document.getElementById('roomAnswerBtn');
            if (roomAnswerBtn) {
                roomAnswerBtn.addEventListener('click', () => showAnswerScreen(gameData.currentQuestion));
            }
        }
    } else if (answerSection && gameData.status !== 'collecting_answers') {
        // Если игра не в режиме сбора ответов, скрываем секцию ответа
        answerSection.style.display = 'none';
    }
    
    // Обновляем кнопки действий в зависимости от статуса игры
    updateActionButtons(gameData);
}

// Функция для обновления кнопок действий
function updateActionButtons(gameData) {
    const actionsContainer = document.querySelector('.game-room-actions');
    if (!actionsContainer) return;
    
    // Очищаем текущие кнопки
    actionsContainer.innerHTML = '';
    
    // Добавляем кнопки в зависимости от статуса игры
    if (gameData.status === 'voting') {
        const votingBtn = document.createElement('button');
        votingBtn.className = 'join-room-btn';
        votingBtn.id = 'goToVotingBtn';
        votingBtn.textContent = 'Перейти к голосованию';
        votingBtn.addEventListener('click', () => loadVotingOptions(gameData.id));
        actionsContainer.appendChild(votingBtn);
    } else if (gameData.status === 'results') {
        const resultsBtn = document.createElement('button');
        resultsBtn.className = 'join-room-btn';
        resultsBtn.id = 'viewResultsBtn';
        resultsBtn.textContent = 'Посмотреть результаты';
        resultsBtn.addEventListener('click', () => loadResults(gameData.id));
        actionsContainer.appendChild(resultsBtn);
    }
    
    // Всегда добавляем кнопку возврата к списку игр
    const backBtn = document.createElement('button');
    backBtn.className = 'papyrus-button shimmer back-button';
    backBtn.id = 'backToGamesBtn';
    backBtn.textContent = 'Вернуться к списку игр';
    backBtn.addEventListener('click', loadGames);
    actionsContainer.appendChild(backBtn);
}

// Функция обработки изменения статуса игры
function handleStatusChange(newStatus, gameId) {
    switch (newStatus) {
        case 'voting':
            showNotification('Началось голосование! Теперь вы можете выбрать лучшие ответы.', 'info');
            // Если игра перешла в режим голосования, показываем экран голосования
            setTimeout(() => loadVotingOptions(gameId), 1500);
            break;
        
        case 'results':
            showNotification('Голосование завершено! Результаты доступны.', 'success');
            // Если игра перешла в режим результатов, показываем экран с результатами
            setTimeout(() => loadResults(gameId), 1500);
            break;
    }
}

// Подписка на события загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    console.log('Инициализация модуля обновления комнаты');
}); 