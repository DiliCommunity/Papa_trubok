// Глобальные переменные
let currentUser = null;
let currentGame = null;
const socket = io();
const API_URL = ''; // Корневой URL API, можно оставить пустым, если на том же домене

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    // Проверяем авторизацию
    checkAuth();
    
    // Инициализируем обработчики событий
    initEventListeners();
    
    // Загружаем список игр
    loadGames();
});

// Проверка авторизации
async function checkAuth() {
    try {
        const response = await fetch(`${API_URL}/api/auth/check`);
        const data = await response.json();
        
        if (data.authenticated) {
            currentUser = data.user;
            document.getElementById('userName').textContent = currentUser.name;
        } else {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        showNotification('Ошибка авторизации', 'error');
    }
}

// Инициализация обработчиков событий
function initEventListeners() {
    // Кнопка выхода
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Кнопка создания игры
    document.getElementById('createGameBtn').addEventListener('click', handleCreateGame);
    
    // Кнопки фильтрации
    document.querySelectorAll('.filter-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            filterRooms(button.dataset.filter);
        });
    });
    
    // Сортировка
    document.getElementById('sortRooms').addEventListener('change', (e) => {
        sortRooms(e.target.value);
    });
    
    // Обработчики для экрана ответа
    document.getElementById('submitAnswerBtn').addEventListener('click', submitAnswer);
    document.getElementById('cancelAnswerBtn').addEventListener('click', () => {
        showScreen('gameScreen');
    });
}

// Обработка выхода
async function handleLogout() {
    try {
        await fetch(`${API_URL}/api/auth/logout`, { method: 'POST' });
        window.location.href = '/login';
    } catch (error) {
        console.error('Ошибка при выходе:', error);
        showNotification('Ошибка при выходе', 'error');
    }
}

// Создание новой игры
async function handleCreateGame() {
    try {
        const response = await fetch(`${API_URL}/api/games`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                creatorId: currentUser.id,
                creatorName: currentUser.name
            })
        });
        
        if (!response.ok) {
            throw new Error('Ошибка при создании игры');
        }
        
        const game = await response.json();
        joinGameRoom(game.id);
    } catch (error) {
        console.error('Ошибка при создании игры:', error);
        showNotification('Не удалось создать игру', 'error');
    }
}

// Показ экрана
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
}

// Показ уведомления
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Загрузка списка игр
async function loadGames() {
    const gamesList = document.getElementById('gamesList');
    if (!gamesList) return;
  
    try {
        gamesList.innerHTML = '<p>Загрузка списка игр...</p>';
    
        const response = await fetch(`${API_URL}/api/games`);
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
            gameRoom.dataset.gameId = game.id;
      
            gameRoom.innerHTML = `
                <div class="game-room-header">
                    <h2 class="game-room-title">Комната: ${game.name || `#${game.id}`}</h2>
                    <span class="game-room-status status-${game.status}">${getStatusText(game.status)}</span>
                </div>
            
                <div class="game-room-info">
                    <div class="game-room-players">
                        <span class="game-room-player">Игроков: ${game.participants ? game.participants.length : 0}/10</span>
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

        // Показываем экран списка игр
        showScreen('gamesScreen');
    } catch (error) {
        console.error('Ошибка загрузки игр:', error);
        gamesList.innerHTML = '<p>Ошибка при загрузке игр. Пожалуйста, попробуйте позже.</p>';
    }
}

// Функция для присоединения к комнате игры
async function joinGameRoom(gameId) {
    try {
        // Получаем информацию об игре
        const response = await fetch(`${API_URL}/api/games/${gameId}?userId=${currentUser.id}`);
        if (!response.ok) {
            throw new Error('Не удалось загрузить информацию об игре');
        }
    
        const gameData = await response.json();
    
        // Проверяем, ответил ли пользователь на вопрос
        const answeredResponse = await fetch(`${API_URL}/api/games/${gameId}/check-answer?userId=${currentUser.id}`);
        const answeredData = await answeredResponse.json();
        const hasAnswered = answeredData.hasAnswered;
    
        // Сохраняем данные о текущей игре глобально
        currentGame = {
            id: gameId,
            isCreator: gameData.creator.id === currentUser.id,
            question: gameData.currentQuestion,
            status: gameData.status,
            participants: gameData.participants.length,
            answersCount: gameData.answers.length
        };
    
        // Обновляем интерфейс
        updateGameRoom(gameData);
    
        // Показываем экран с информацией о комнате
        showScreen('gameScreen');
    
        // Запускаем периодическую проверку статуса игры
        startStatusCheck();
    } catch (error) {
        console.error('Ошибка при загрузке комнаты игры:', error);
        showNotification('Не удалось загрузить информацию об игре', 'error');
    }
}

// Показать экран ответа
function showAnswerScreen(question) {
    document.getElementById('currentQuestion').textContent = question;
    document.getElementById('answerInput').value = '';
    showScreen('answerScreen');
}

// Отправка ответа
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
        const response = await fetch(`${API_URL}/api/games/${currentGame.id}/answer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.id,
                answer: answer,
                username: currentUser.name,
                anonymous: currentUser.anonymous || false
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

// Начало голосования
async function startVoting(gameId) {
    try {
        const response = await fetch(`${API_URL}/api/games/${gameId}/start-voting`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                creatorId: currentUser.id
            })
        });

        if (!response.ok) {
            throw new Error('Ошибка при запуске голосования');
        }

        const data = await response.json();
        showNotification('Голосование началось!', 'success');
        
        // Обновляем информацию о комнате
        joinGameRoom(gameId);
    } catch (error) {
        console.error('Ошибка при запуске голосования:', error);
        showNotification('Не удалось начать голосование', 'error');
    }
}

// Загрузка вариантов для голосования
async function loadVotingOptions(gameId) {
    try {
        const response = await fetch(`${API_URL}/api/games/${gameId}/voting-options?userId=${currentUser.id}`);
        if (!response.ok) {
            throw new Error('Не удалось загрузить варианты для голосования');
        }

        const data = await response.json();
        const votingOptions = document.getElementById('votingOptions');
        
        if (!votingOptions) return;
        
        votingOptions.innerHTML = '';
        
        // Проверяем, голосовал ли уже пользователь
        const hasVoted = data.hasVoted;
        
        if (hasVoted) {
            votingOptions.innerHTML = '<p>Вы уже проголосовали. Ожидайте результатов.</p>';
            showScreen('votingScreen');
            return;
        }
        
        data.answers.forEach(answer => {
            // Не показываем ответ самого пользователя
            if (answer.userId === currentUser.id) return;
            
            const option = document.createElement('div');
            option.className = 'voting-option';
            option.dataset.answerId = answer.id;
            
            option.innerHTML = `
                <div class="option-author">${answer.isAnonymous ? 'Аноним' : answer.userName}</div>
                <div class="option-text">${answer.answer}</div>
            `;
            
            option.addEventListener('click', () => {
                document.querySelectorAll('.voting-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                option.classList.add('selected');
            });
            
            votingOptions.appendChild(option);
        });
        
        // Добавляем кнопку голосования
        const voteBtn = document.createElement('button');
        voteBtn.className = 'vote-btn';
        voteBtn.textContent = 'Проголосовать';
        voteBtn.addEventListener('click', submitVote);
        
        votingOptions.appendChild(voteBtn);
        
        showScreen('votingScreen');
    } catch (error) {
        console.error('Ошибка при загрузке вариантов для голосования:', error);
        showNotification('Не удалось загрузить варианты для голосования', 'error');
    }
}

// Отправка голоса
async function submitVote() {
    const selectedOption = document.querySelector('.voting-option.selected');
    
    if (!selectedOption) {
        showNotification('Пожалуйста, выберите ответ для голосования', 'warning');
        return;
    }
    
    const answerId = selectedOption.dataset.answerId;
    
    try {
        const response = await fetch(`${API_URL}/api/games/${currentGame.id}/vote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.id,
                answerId: answerId
            })
        });
        
        if (!response.ok) {
            throw new Error('Ошибка при отправке голоса');
        }
        
        const data = await response.json();
        
        showNotification('Ваш голос принят!', 'success');
        
        // Возвращаемся в комнату игры
        joinGameRoom(currentGame.id);
    } catch (error) {
        console.error('Ошибка при отправке голоса:', error);
        showNotification('Произошла ошибка при голосовании', 'error');
    }
}

// Загрузка результатов
async function loadResults(gameId) {
    try {
        const response = await fetch(`${API_URL}/api/games/${gameId}/results`);
        if (!response.ok) {
            throw new Error('Не удалось загрузить результаты');
        }
        
        const data = await response.json();
        const resultsList = document.getElementById('resultsList');
        
        if (!resultsList) return;
        
        resultsList.innerHTML = '';
        
        if (data.results.length === 0) {
            resultsList.innerHTML = '<p>Результаты еще не доступны</p>';
            showScreen('resultsScreen');
            return;
        }
        
        // Сортируем по количеству голосов
        const sortedResults = [...data.results].sort((a, b) => b.votes - a.votes);
        
        sortedResults.forEach((result, index) => {
            const resultItem = document.createElement('div');
            resultItem.className = `result-item ${index === 0 ? 'winner' : ''}`;
            
            resultItem.innerHTML = `
                <div class="result-header">
                    <div class="result-name">${result.isAnonymous ? 'Аноним' : result.userName}</div>
                    <div class="result-votes">${result.votes} голосов</div>
                </div>
                <div class="result-answer">${result.answer}</div>
            `;
            
            resultsList.appendChild(resultItem);
        });
        
        // Добавляем кнопку "Назад"
        const backBtn = document.createElement('button');
        backBtn.className = 'back-button';
        backBtn.textContent = 'Вернуться к списку игр';
        backBtn.addEventListener('click', loadGames);
        
        resultsList.appendChild(backBtn);
        
        showScreen('resultsScreen');
    } catch (error) {
        console.error('Ошибка при загрузке результатов:', error);
        showNotification('Не удалось загрузить результаты', 'error');
    }
}

// Периодическая проверка статуса игры
function startStatusCheck() {
    if (window.statusCheckInterval) {
        clearInterval(window.statusCheckInterval);
    }
    
    window.statusCheckInterval = setInterval(() => {
        if (currentGame && currentGame.id) {
            fetchGameStatus(currentGame.id);
        } else {
            clearInterval(window.statusCheckInterval);
        }
    }, 5000); // Каждые 5 секунд
}

// Получение текущего статуса игры
async function fetchGameStatus(gameId) {
    try {
        const response = await fetch(`${API_URL}/api/games/${gameId}/status`);
        if (!response.ok) {
            throw new Error('Не удалось получить статус игры');
        }
        
        const data = await response.json();
        
        // Если статус изменился
        if (currentGame.status !== data.status) {
            currentGame.status = data.status;
            
            // Обновляем интерфейс в зависимости от статуса
            if (data.status === 'voting') {
                showNotification('Началось голосование!', 'info');
                loadVotingOptions(gameId);
            } else if (data.status === 'results') {
                showNotification('Игра завершена! Доступны результаты.', 'info');
                loadResults(gameId);
            } else {
                joinGameRoom(gameId);
            }
        }
    } catch (error) {
        console.error('Ошибка при получении статуса игры:', error);
    }
}

// Обработка сокет-событий
socket.on('gameUpdate', (gameData) => {
    if (currentGame && currentGame.id === gameData.id) {
        updateGameRoom(gameData);
    }
    loadGames(); // Обновляем список игр
});

socket.on('newAnswer', (data) => {
    if (currentGame && currentGame.id === data.gameId) {
        updateAnswersList(data.answers);
    }
});

socket.on('votingStarted', (data) => {
    if (currentGame && currentGame.id === data.gameId) {
        showVotingScreen(data.answers);
    }
});

socket.on('votingUpdate', (data) => {
    if (currentGame && currentGame.id === data.gameId) {
        updateVotingResults(data.votes);
    }
});

socket.on('gameResults', (data) => {
    if (currentGame && currentGame.id === data.gameId) {
        showResultsScreen(data.results);
    }
});

// Обновление информации о комнате
function updateGameRoom(gameData) {
    const gameRoom = document.getElementById('gameRoom');
    if (!gameRoom) return;
    
    gameRoom.innerHTML = `
        <div class="game-room-header">
            <h2 class="game-room-title">Комната #${gameData.id}</h2>
            <span class="game-room-status status-${gameData.status}">${getStatusText(gameData.status)}</span>
        </div>
        
        <div class="question-box">
            <h3>Вопрос:</h3>
            <p class="question-text">${gameData.currentQuestion || 'Ожидание вопроса от создателя'}</p>
        </div>
        
        <div class="game-room-info">
            <div class="game-room-players">
                <span class="game-room-player">Игроков: ${gameData.participants ? gameData.participants.length : 0}/10</span>
                <span class="game-room-player">Ответов: ${gameData.answers ? gameData.answers.length : 0}</span>
            </div>
        </div>
        
        ${renderGameActions(gameData)}
    `;
}

// Рендеринг действий в зависимости от статуса игры
function renderGameActions(gameData) {
    const isCreator = gameData.creator && gameData.creator.id === currentUser.id;
    const hasAnswered = gameData.answers && gameData.answers.some(a => a.userId === currentUser.id);
    
    let actions = '';
    
    if (isCreator) {
        if (gameData.status === 'waiting') {
            actions += `
                <div class="creator-controls">
                    <h3>Управление игрой</h3>
                    <button class="start-game-btn" onclick="startGame('${gameData.id}')">
                        Начать игру
                    </button>
                </div>
            `;
        } else if (gameData.status === 'collecting_answers') {
            if (!gameData.currentQuestion) {
                actions += `
                    <div class="creator-controls">
                        <h3>Управление игрой</h3>
                        <div class="question-form">
                            <textarea id="questionInput" placeholder="Введите вопрос..."></textarea>
                            <button class="set-question-btn" onclick="setQuestion('${gameData.id}')">
                                Задать вопрос
                            </button>
                        </div>
                    </div>
                `;
            } else {
                actions += `
                    <div class="creator-controls">
                        <h3>Управление игрой</h3>
                        ${gameData.answers && gameData.answers.length >= 3 ? `
                            <button class="start-voting-btn" onclick="startVoting('${gameData.id}')">
                                Начать голосование
                            </button>
                        ` : `
                            <p class="waiting-text">Ожидание ответов (минимум 3)</p>
                        `}
                    </div>
                `;
            }
        }
    } else {
        if (gameData.status === 'collecting_answers' && gameData.currentQuestion && !hasAnswered) {
            actions += `
                <button class="answer-btn" onclick="showAnswerScreen('${gameData.currentQuestion}')">
                    Ответить на вопрос
                </button>
            `;
        } else if (gameData.status === 'collecting_answers' && hasAnswered) {
            actions += `
                <p class="status-text">Ваш ответ принят. Ожидайте голосования.</p>
            `;
        }
    }
    
    if (gameData.status === 'voting') {
        actions += `
            <button class="join-room-btn" onclick="loadVotingOptions('${gameData.id}')">
                Перейти к голосованию
            </button>
        `;
    }
    
    if (gameData.status === 'results') {
        actions += `
            <button class="join-room-btn" onclick="loadResults('${gameData.id}')">
                Посмотреть результаты
            </button>
        `;
    }
    
    actions += `
        <button class="back-button" onclick="loadGames()">
            Вернуться к списку игр
        </button>
    `;
    
    return `<div class="game-room-actions">${actions}</div>`;
}

// Начать игру
async function startGame(gameId) {
    try {
        const response = await fetch(`${API_URL}/api/games/${gameId}/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                creatorId: currentUser.id
            })
        });
        
        if (!response.ok) {
            throw new Error('Ошибка при запуске игры');
        }
        
        const data = await response.json();
        showNotification('Игра начата!', 'success');
        
        // Обновляем информацию о комнате
        joinGameRoom(gameId);
    } catch (error) {
        console.error('Ошибка при запуске игры:', error);
        showNotification('Не удалось начать игру', 'error');
    }
}

// Задать вопрос
async function setQuestion(gameId) {
    const questionInput = document.getElementById('questionInput');
    const question = questionInput.value.trim();
    
    if (!question) {
        showNotification('Пожалуйста, введите вопрос', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/games/${gameId}/question`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                creatorId: currentUser.id,
                question: question
            })
        });
        
        if (!response.ok) {
            throw new Error('Ошибка при задании вопроса');
        }
        
        const data = await response.json();
        showNotification('Вопрос задан!', 'success');
        
        // Обновляем информацию о комнате
        joinGameRoom(gameId);
    } catch (error) {
        console.error('Ошибка при задании вопроса:', error);
        showNotification('Не удалось задать вопрос', 'error');
    }
}

// Получение текста статуса
function getStatusText(status) {
    const statusTexts = {
        'waiting': 'Ожидание игроков',
        'collecting_answers': 'Сбор ответов',
        'voting': 'Голосование',
        'results': 'Результаты'
    };
    return statusTexts[status] || status;
}

// Обновление списка ответов
function updateAnswersList(answers) {
    if (!currentGame) return;
    
    currentGame.answersCount = answers.length;
    
    const gameRoom = document.getElementById('gameRoom');
    if (!gameRoom) return;
    
    const answersCount = gameRoom.querySelector('.game-room-player:nth-child(2)');
    if (answersCount) {
        answersCount.textContent = `Ответов: ${answers.length}`;
    }
    
    // Если создатель и достаточно ответов, обновляем кнопку "Начать голосование"
    if (currentGame.isCreator && answers.length >= 3) {
        const creatorControls = gameRoom.querySelector('.creator-controls');
        if (creatorControls) {
            creatorControls.innerHTML = `
                <h3>Управление игрой</h3>
                <button class="start-voting-btn" onclick="startVoting('${currentGame.id}')">
                    Начать голосование
                </button>
            `;
        }
    }
}

// Обновление результатов голосования
function updateVotingResults(votes) {
    // Реализация по необходимости
}

// Показ экрана голосования
function showVotingScreen(answers) {
    loadVotingOptions(currentGame.id);
}

// Показ экрана результатов
function showResultsScreen(results) {
    loadResults(currentGame.id);
}

// Экспорт функций для использования в HTML
window.joinGameRoom = joinGameRoom;
window.showAnswerScreen = showAnswerScreen;
window.submitAnswer = submitAnswer;
window.startVoting = startVoting;
window.loadVotingOptions = loadVotingOptions;
window.loadResults = loadResults;
window.loadGames = loadGames;
window.filterRooms = filterRooms;
window.sortRooms = sortRooms;
window.startGame = startGame;
window.setQuestion = setQuestion; 