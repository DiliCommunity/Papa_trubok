// room_updates.js - Функции для обновления состояния комнаты в реальном времени

// Интервал обновления состояния комнаты (в миллисекундах)
const ROOM_UPDATE_INTERVAL = 5000; // 5 секунд

// Идентификатор интервала обновления
let roomUpdateInterval = null;

// Функция для запуска периодического обновления состояния комнаты
function startRoomUpdates(gameId) {
    console.log(`Запуск обновления для комнаты ${gameId}`);
    
    // Сначала останавливаем предыдущие обновления, если были
    if (roomUpdateInterval) {
        clearInterval(roomUpdateInterval);
    }
    
    // Выполняем первое обновление немедленно
    updateRoomStatus(gameId);
    
    // Затем настраиваем периодические обновления
    roomUpdateInterval = setInterval(() => {
        updateRoomStatus(gameId);
    }, ROOM_UPDATE_INTERVAL);
}

// Функция для остановки периодического обновления состояния комнаты
function stopRoomUpdates() {
    if (roomUpdateInterval) {
        clearInterval(roomUpdateInterval);
        roomUpdateInterval = null;
        console.log('Обновления комнаты остановлены');
    }
}

// Функция для обновления состояния комнаты
async function updateRoomStatus(gameId) {
    if (!gameId) {
        console.error('Не указан ID игры для обновления');
        return;
    }
    
    try {
        console.log(`Обновление статуса комнаты ${gameId}...`);
        
        const response = await fetch(`${API_URL}/games/${gameId}?_=${Date.now()}`);
        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        
        const gameData = await response.json();
        console.log('Получены данные игры:', gameData);
        
        // Если текущая игра не установлена, инициализируем её
        if (!window.currentGame) {
            window.currentGame = {
                id: gameId
            };
        }
        
        // Проверяем изменение статуса
        const statusChanged = window.currentGame.status !== gameData.status;
        const previousStatus = window.currentGame.status;
        
        // Обновляем данные текущей игры
        window.currentGame.status = gameData.status;
        window.currentGame.currentQuestion = gameData.currentQuestion;
        window.currentGame.isCreator = gameData.isCreator;
        window.currentGame.initiatorName = gameData.initiatorName;
        window.currentGame.answersCount = gameData.answers;
        
        // Обновляем отображение информации в комнате
        updateRoomUI(gameData);
        
        // Реагируем на изменение статуса
        if (statusChanged) {
            console.log(`Статус игры изменился: ${previousStatus} -> ${gameData.status}`);
            
            if (gameData.status === 'voting') {
                showNotification('Голосование началось! Выберите лучшие ответы.', 'info');
                loadVotingOptions(gameId);
            } else if (gameData.status === 'results') {
                showNotification('Голосование завершено! Просмотрите результаты.', 'success');
                loadResults(gameId);
            }
        }
    } catch (error) {
        console.error('Ошибка при обновлении статуса комнаты:', error);
    }
}

// Функция для обновления UI комнаты
function updateRoomUI(gameData) {
    // Заполняем информацию о комнате
    const roomTitle = document.getElementById('roomTitle');
    if (roomTitle) {
        roomTitle.textContent = `Комната игры #${gameData.id}`;
    }
    
    const roomQuestion = document.getElementById('roomQuestion');
    if (roomQuestion) {
        roomQuestion.textContent = gameData.currentQuestion || 'Вопрос загружается...';
    }
    
    const roomStatus = document.getElementById('roomStatus');
    if (roomStatus) {
        roomStatus.textContent = getStatusText(gameData.status);
    }
    
    const roomAnswersCount = document.getElementById('roomAnswersCount');
    if (roomAnswersCount) {
        roomAnswersCount.textContent = gameData.answers;
    }
    
    // Обновляем кнопки в комнате в зависимости от статуса
    updateRoomButtons(gameData);
}

// Обновление кнопок комнаты
async function updateRoomButtons(gameData) {
    const answerButton = document.getElementById('answerButton');
    const viewAnswersButton = document.getElementById('viewAnswersButton');
    const startVotingButton = document.getElementById('startVotingButton');
    
    // Проверяем, ответил ли пользователь на вопрос
    const hasAnswered = await checkIfAlreadyAnswered(gameData.id);
    
    // Отображаем кнопку ответа только если пользователь еще не ответил и статус "сбор ответов"
    if (answerButton) {
        if (gameData.status === 'collecting_answers' && !hasAnswered) {
            answerButton.style.display = 'block';
            
            // Добавляем обработчик события для кнопки, если его нет
            if (!answerButton.hasAttribute('data-has-handler')) {
                answerButton.addEventListener('click', function() {
                    if (window.currentGame && window.currentGame.currentQuestion) {
                        showAnswerScreen(window.currentGame.currentQuestion);
                    } else {
                        showNotification('Ошибка: вопрос не найден', 'error');
                    }
                });
                answerButton.setAttribute('data-has-handler', 'true');
            }
        } else {
            answerButton.style.display = 'none';
        }
    }
    
    // Отображаем кнопку начала голосования только создателю, когда есть хотя бы 3 ответа
    if (startVotingButton) {
        if (gameData.status === 'collecting_answers' && gameData.isCreator && gameData.answers >= 3) {
            startVotingButton.style.display = 'block';
            
            // Добавляем обработчик события для кнопки, если его нет
            if (!startVotingButton.hasAttribute('data-has-handler')) {
                startVotingButton.addEventListener('click', function() {
                    if (window.currentGame && window.currentGame.id) {
                        startVoting(window.currentGame.id);
                    } else {
                        showNotification('Ошибка: игра не найдена', 'error');
                    }
                });
                startVotingButton.setAttribute('data-has-handler', 'true');
            }
        } else {
            startVotingButton.style.display = 'none';
        }
    }
    
    // Отображаем кнопку просмотра ответов только когда статус "голосование"
    if (viewAnswersButton) {
        if (gameData.status === 'voting') {
            viewAnswersButton.style.display = 'block';
            
            // Добавляем обработчик события для кнопки, если его нет
            if (!viewAnswersButton.hasAttribute('data-has-handler')) {
                viewAnswersButton.addEventListener('click', function() {
                    if (window.currentGame && window.currentGame.id) {
                        loadVotingOptions(window.currentGame.id);
                    } else {
                        showNotification('Ошибка: игра не найдена', 'error');
                    }
                });
                viewAnswersButton.setAttribute('data-has-handler', 'true');
            }
        } else {
            viewAnswersButton.style.display = 'none';
        }
    }
    
    // Если пользователь уже ответил, показываем его ответ
    const userAnswerDisplay = document.getElementById('userAnswerDisplay');
    if (userAnswerDisplay) {
        if (hasAnswered) {
            try {
                // Получаем ответ пользователя
                const userAnswerResponse = await fetch(`${API_URL}/games/${gameData.id}/user-answer?userId=${currentUser.id}`);
                if (userAnswerResponse.ok) {
                    const userAnswerData = await userAnswerResponse.json();
                    window.currentGame.userAnswer = userAnswerData.answer;
                    
                    userAnswerDisplay.style.display = 'block';
                    userAnswerDisplay.innerHTML = `
                        <div class="user-answer-box">
                            <p style="color: #2a9d8f; font-weight: bold; margin-bottom: 10px;">Ваш ответ принят!</p>
                            <p style="color: #5a2d0c; font-style: italic;">"${window.currentGame.userAnswer}"</p>
                            <p style="margin-top: 10px; color: #457b9d;">Ожидайте начала голосования.</p>
                        </div>
                    `;
                }
            } catch (error) {
                console.error('Ошибка при получении ответа пользователя:', error);
            }
        } else {
            userAnswerDisplay.style.display = 'none';
        }
    }
}

// Проверка, ответил ли пользователь на вопрос
async function checkIfAlreadyAnswered(gameId) {
    try {
        const response = await fetch(`${API_URL}/games/${gameId}/check-answer?userId=${currentUser.id}`);
        if (!response.ok) {
            return false;
        }
        
        const data = await response.json();
        return data.hasAnswered;
    } catch (error) {
        console.error('Ошибка при проверке наличия ответа:', error);
        return false;
    }
}

// Подписка на события загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    console.log('Инициализация модуля обновления комнаты');
}); 