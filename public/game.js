// game.js — логика для одной игры (комнаты)

let API_URL = window.API_URL || '/api';
let currentUser = window.currentUser || null;
let currentGame = null;

// Получаем ID игры из query-параметра или localStorage
function getGameId() {
    const params = new URLSearchParams(window.location.search);
    let id = params.get('id');
    if (!id) {
        id = localStorage.getItem('papaTrubok_myGameId');
    }
    return id;
}

// Загрузка своей игры
async function loadMyGame() {
    const gameId = getGameId();
    if (!gameId) {
        showNotification('Игра не найдена', 'error');
        window.location.href = 'papyrus.html';
        return;
    }
    try {
        const res = await fetch(`${API_URL}/api/games/${gameId}?userId=${currentUser.id}`);
        if (!res.ok) throw new Error('Ошибка загрузки игры');
        const game = await res.json();
        currentGame = game;
        renderGameRoom(game);
        checkUserAnswerStatus(gameId);
    } catch (e) {
        showNotification('Ошибка загрузки игры', 'error');
        window.location.href = 'papyrus.html';
    }
}

// Рендер комнаты
function renderGameRoom(game) {
    document.getElementById('gameRoomTitle').textContent = `Комната #${game.id.substring(0,6)}`;
    document.getElementById('gameRoomStatus').textContent = getStatusText(game.status);
    document.getElementById('gameQuestionText').textContent = game.currentQuestion || 'Вопрос не задан';
    document.getElementById('gameRoomPlayers').textContent = `Игроков: ${(game.participants||[]).length}/10`;
    document.getElementById('gameRoomAnswers').textContent = `Ответов: ${(game.answers||[]).length}`;
    renderGameActions(game);
}

// Кнопки и действия
function renderGameActions(game) {
    const actions = document.getElementById('gameActions');
    actions.innerHTML = '';
    // Если вопрос не задан — форма для вопроса
    if (game.isCreator && !game.currentQuestion) {
        actions.innerHTML = `
            <textarea id="questionInput" class="answer-input" placeholder="Введите вопрос..."></textarea>
            <button id="setQuestionBtn" class="papyrus-button shimmer">Задать вопрос</button>
        `;
        document.getElementById('setQuestionBtn').onclick = setQuestion;
    } else if (game.currentQuestion && game.status === 'collecting_answers') {
        // Кнопка ответить на вопрос
        const hasAnswered = game.answers.some(a => a.userId === currentUser.id);
        actions.innerHTML = `
            <button id="answerButton" class="papyrus-button shimmer" ${hasAnswered ? 'disabled' : ''}>${hasAnswered ? 'Ответ принят' : 'Ответить на вопрос'}</button>
            ${game.isCreator && (game.answers.length >= 3) ? '<button id="startVotingButton" class="papyrus-button shimmer">Начать голосование</button>' : ''}
        `;
        document.getElementById('answerButton').onclick = function() {
            if (!hasAnswered) showAnswerForm();
        };
        if (game.isCreator && (game.answers.length >= 3)) {
            document.getElementById('startVotingButton').onclick = startVoting;
        }
    } else if (game.status === 'voting') {
        actions.innerHTML = `<button class="papyrus-button shimmer" onclick="window.location.href='papyrus.html'">Перейти к голосованию</button>`;
    } else if (game.status === 'results') {
        actions.innerHTML = `<button class="papyrus-button shimmer" onclick="window.location.href='papyrus.html'">Посмотреть результаты</button>`;
    }
}

// Форма ответа
function showAnswerForm() {
    const actions = document.getElementById('gameActions');
    actions.innerHTML = `
        <textarea id="answerInput" class="answer-input" placeholder="Ваш ответ..."></textarea>
        <button id="submitAnswerBtn" class="papyrus-button shimmer">Отправить ответ</button>
    `;
    document.getElementById('submitAnswerBtn').onclick = submitAnswer;
}

// Отправка вопроса
async function setQuestion() {
    const input = document.getElementById('questionInput');
    const question = input.value.trim();
    if (!question) return showNotification('Введите вопрос!', 'warning');
    try {
        const res = await fetch(`${API_URL}/api/games/${currentGame.id}/question`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({creatorId: currentUser.id, question})
        });
        if (!res.ok) throw new Error('Ошибка');
        showNotification('Вопрос задан!', 'success');
        loadMyGame();
    } catch {
        showNotification('Ошибка при отправке вопроса', 'error');
    }
}

// Отправка ответа
async function submitAnswer() {
    const input = document.getElementById('answerInput');
    const answer = input.value.trim();
    if (!answer) return showNotification('Введите ответ!', 'warning');
    try {
        const res = await fetch(`${API_URL}/api/games/${currentGame.id}/answer`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({userId: currentUser.id, answer})
        });
        if (!res.ok) throw new Error('Ошибка');
        showNotification('Ответ сохранён!', 'success');
        loadMyGame();
    } catch {
        showNotification('Ошибка при отправке ответа', 'error');
    }
}

// Проверка, ответил ли пользователь
async function checkUserAnswerStatus(gameId) {
    try {
        const res = await fetch(`${API_URL}/api/games/${gameId}/check-answer?userId=${currentUser.id}`);
        if (!res.ok) return false;
        const data = await res.json();
        return data.hasAnswered;
    } catch { return false; }
}

// Получение статуса
function getStatusText(status) {
    switch (status) {
        case 'waiting': return 'Ожидание игроков';
        case 'collecting_answers': return 'Сбор ответов';
        case 'voting': return 'Голосование';
        case 'results': return 'Результаты';
        default: return status;
    }
}

// Уведомления
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `papyrus-notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// Функция для старта голосования (только для создателя)
async function startVoting() {
    try {
        const res = await fetch(`${API_URL}/api/games/${currentGame.id}/start-voting`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({creatorId: currentUser.id})
        });
        if (!res.ok) throw new Error('Ошибка');
        showNotification('Голосование началось!', 'success');
        loadMyGame();
    } catch {
        showNotification('Ошибка при запуске голосования', 'error');
    }
}

// Инициализация
window.addEventListener('DOMContentLoaded', loadMyGame); 