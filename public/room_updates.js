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
    
    // Обновляем заголовок комнаты
    const roomTitle = document.getElementById('roomTitle');
    if (roomTitle) {
        roomTitle.textContent = `Комната игры #${gameData.id}`;
    }
    
    // Обновляем текст вопроса
    const roomQuestion = document.getElementById('roomQuestion');
    if (roomQuestion) {
        roomQuestion.textContent = gameData.currentQuestion || 'Вопрос загружается...';
    }
    
    if (participantsCounter) {
        participantsCounter.textContent = `Игроков: ${gameData.participants}`;
    }
    
    if (answersCounter) {
        answersCounter.textContent = `Ответов: ${gameData.answers}`;
    }
    
    // Обновляем статус игры
    const statusElement = document.getElementById('roomStatus');
    if (statusElement) {
        statusElement.textContent = getStatusText(gameData.status);
    }
    
    // Управление кнопками в комнате
    const answerButton = document.getElementById('answerButton');
    const viewAnswersButton = document.getElementById('viewAnswersButton');
    const startVotingButton = document.getElementById('startVotingButton');
    
    // Отображаем ответ пользователя, если он уже ответил
    const userAnswerDisplay = document.getElementById('userAnswerDisplay');
    if (userAnswerDisplay) {
        if (hasAnswered && currentGame.userAnswer) {
            userAnswerDisplay.style.display = 'block';
            userAnswerDisplay.innerHTML = `
                <div class="user-answer-box">
                    <p style="color: #2a9d8f; font-weight: bold; margin-bottom: 10px;">Ваш ответ принят!</p>
                    <p style="color: #5a2d0c; font-style: italic;">"${currentGame.userAnswer}"</p>
                    <p style="margin-top: 10px; color: #457b9d;">Ожидайте начала голосования.</p>
                </div>
            `;
            
            // Если пользователь уже ответил, скрываем кнопку ответа
            if (answerButton) {
                answerButton.style.display = 'none';
            }
        } else {
            userAnswerDisplay.style.display = 'none';
            
            // Если пользователь еще не ответил, показываем кнопку ответа
            if (answerButton && gameData.status === 'collecting_answers') {
                answerButton.style.display = 'block';
                
                // Добавляем обработчик для кнопки ответа, если его еще нет
                if (!answerButton.hasListener) {
                    answerButton.addEventListener('click', function() {
                        showAnswerScreen(gameData.currentQuestion);
                    });
                    answerButton.hasListener = true;
                }
            } else if (answerButton) {
                answerButton.style.display = 'none';
            }
        }
    }
    
    // Показываем кнопку начала голосования только создателю комнаты
    // и только в режиме сбора ответов, если есть хотя бы 3 ответа
    if (startVotingButton) {
        if (gameData.status === 'collecting_answers' && 
            gameData.isCreator && 
            gameData.answers >= 3) {
            startVotingButton.style.display = 'block';
            
            // Добавляем обработчик для кнопки начала голосования, если его еще нет
            if (!startVotingButton.hasListener) {
                startVotingButton.addEventListener('click', function() {
                    startVoting(gameData.id);
                });
                startVotingButton.hasListener = true;
            }
        } else {
            startVotingButton.style.display = 'none';
        }
    }
    
    // Кнопка просмотра ответов (для всех)
    if (viewAnswersButton) {
        if (gameData.status === 'voting') {
            viewAnswersButton.style.display = 'block';
            
            // Добавляем обработчик для кнопки просмотра ответов, если его еще нет
            if (!viewAnswersButton.hasListener) {
                viewAnswersButton.addEventListener('click', function() {
                    loadVotingOptions(gameData.id);
                });
                viewAnswersButton.hasListener = true;
            }
        } else {
            viewAnswersButton.style.display = 'none';
        }
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