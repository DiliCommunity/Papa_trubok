// Глобальные переменные
let currentUser = null;
let currentGame = null;
const socket = io();

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
        const response = await fetch('/api/auth/check');
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
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    } catch (error) {
        console.error('Ошибка при выходе:', error);
        showNotification('Ошибка при выходе', 'error');
    }
}

// Создание новой игры
async function handleCreateGame() {
    try {
        const response = await fetch('/api/games', {
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
                <span class="game-room-player">Игроков: ${gameData.participants.length}/10</span>
                <span class="game-room-player">Ответов: ${gameData.answers.length}</span>
            </div>
        </div>
        
        ${renderGameActions(gameData)}
    `;
}

// Рендеринг действий в зависимости от статуса игры
function renderGameActions(gameData) {
    const isCreator = gameData.creator.id === currentUser.id;
    const hasAnswered = gameData.answers.some(a => a.userId === currentUser.id);
    
    let actions = '';
    
    if (isCreator) {
        if (gameData.status === 'collecting_answers') {
            actions += `
                <div class="creator-controls">
                    <h3>Управление игрой</h3>
                    ${gameData.answers.length >= 3 ? `
                        <button class="start-voting-btn" onclick="startVoting('${gameData.id}')">
                            Начать голосование
                        </button>
                    ` : `
                        <p class="waiting-text">Ожидание ответов (минимум 3)</p>
                    `}
                </div>
            `;
        }
    } else {
        if (gameData.status === 'collecting_answers' && !hasAnswered) {
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