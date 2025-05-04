const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const gameManager = require('./gameManager');
const userManager = require('./userManager');
const path = require('path');
const dotenv = require('dotenv');
const { Telegraf, Scenes, session } = require('telegraf');
const { Markup } = require('telegraf');
const fs = require('fs');

// Загружаем переменные окружения
dotenv.config();

// Переменная окружения для определения среды
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
console.log(`Запуск в режиме: ${process.env.NODE_ENV}`);

const app = express();
const PORT = process.env.PORT || 3000;

// Подключаем бота для отправки уведомлений
const bot = new Telegraf(process.env.BOT_TOKEN);

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Загружаем данные
gameManager.loadGames();
userManager.loadUsers();

// Сцены
const nameScene = require('./scenes/nameScene');
const answerScene = require('./scenes/answerScene');
const customQuestionScene = require('./scenes/customQuestionScene');

// Инициализация сцен
const stage = new Scenes.Stage([nameScene, answerScene, customQuestionScene]);
bot.use(session());
bot.use(stage.middleware());

// --- КОНСТАНТЫ И ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
const MAX_ANSWERS = 10;

// Функция для правильного завершения игры
function finishGame(gameId) {
  const games = gameManager.getGames();
  const game = games[gameId];
  
  if (!game) return;
  
  // Игра завершена, но оставляем для просмотра результатов
  game.active = false;
  game.status = 'results';
  
  // Сохраняем
  gameManager.setGame(gameId, game);
  
  console.log(`Игра ${gameId} завершена, результаты доступны`);
}

function createStyledMessage(title, content, emoji = '📝') {
  return `<b>🔸🔹🔸 ${emoji} ${title} ${emoji} 🔸🔹🔸</b>\n\n${content}`;
}

// --- ОБРАБОТЧИКИ КОМАНД И CALLBACK'ОВ ---

bot.command('start', async (ctx) => {
  try {
    await ctx.reply(
      createStyledMessage('ДОБРО ПОЖАЛОВАТЬ', 'Я бот для игры в смешные вопросы PapaTrubok. Чтобы начать, нажмите кнопку ниже!', '🎭'),
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🚀 Старт', 'start_game')]
        ])
      }
    );
  } catch (error) {
    console.error('Ошибка при обработке команды start:', error);
    ctx.reply('Произошла ошибка. Пожалуйста, попробуйте снова ввести /start');
  }
});

// API эндпоинты

// Получить доступные игры
app.get('/api/games', (req, res) => {
  const games = gameManager.getGames();
  console.log('Всего игр в системе:', Object.keys(games).length); // Отладка
  
  const activeGames = Object.entries(games)
    .filter(([id, game]) => {
      console.log(`Игра ${id}:`, game.active, game.status); // Отладка
      return game.active && 
            (game.status === 'waiting_players' || game.status === 'collecting_answers');
    })
    .map(([id, game]) => ({
      id,
      name: game.initiatorName,
      count: game.participants.length,
      hasQuestion: !!game.currentQuestion,
      status: game.status
    }));
  
  console.log('Активные игры:', activeGames.length); // Отладка
  res.json(activeGames);
});

// Получить данные игры
app.get('/api/games/:gameId', (req, res) => {
  const gameId = req.params.gameId;
  const games = gameManager.getGames();
  const game = games[gameId];
  
  if (!game) {
    return res.status(404).json({ error: 'Игра не найдена' });
  }
  
  res.json({
    id: gameId,
    initiatorName: game.initiatorName,
    status: game.status,
    participants: game.participants.length,
    currentQuestion: game.currentQuestion,
    answers: Object.keys(game.answers || {}).length,
    maxAnswers: 10
  });
});

// Создать новую игру
app.post('/api/games', (req, res) => {
  const { userId, userName, question } = req.body;
  
  if (!userId || !userName || !question) {
    return res.status(400).json({ error: 'Не хватает данных' });
  }
  
  console.log(`Создание игры от ${userName} (${userId}): "${question}"`);
  
  // Сохраняем пользователя
  userManager.setUser(userId, { funnyName: userName });
  
  // Создаем новую игру
  const gameId = Date.now().toString();
  const newGame = {
    active: true,
    initiator: userId,
    initiatorName: userName,
    currentQuestion: question,
    answers: {},
    votes: {},
    votingActive: false,
    totalScores: {},
    status: 'waiting_players',
    rounds: [],
    participants: [userId],
    participantData: {
      [userId]: {
        username: userName,
        joinTime: new Date().toISOString()
      }
    },
    createdAt: new Date().toISOString(),
    isCustomQuestion: true
  };
  
  gameManager.setGame(gameId, newGame);
  
  console.log(`Игра ${gameId} успешно создана. Статус: ${newGame.status}, active: ${newGame.active}`);
  
  res.status(201).json({ gameId, status: 'success' });
});

// Присоединиться к игре
app.post('/api/games/:gameId/join', (req, res) => {
  const gameId = req.params.gameId;
  const { userId, userName } = req.body;
  
  if (!userId || !userName) {
    return res.status(400).json({ error: 'Не хватает данных' });
  }
  
  const games = gameManager.getGames();
  const game = games[gameId];
  
  if (!game) {
    return res.status(404).json({ error: 'Игра не найдена' });
  }
  
  if (!game.active) {
    return res.status(400).json({ error: 'Эта игра уже не активна' });
  }
  
  // Сохраняем пользователя
  userManager.setUser(userId, { funnyName: userName });
  
  // Добавляем в игру
  if (!game.participants.includes(userId)) {
    game.participants.push(userId);
    
    if (!game.participantData) game.participantData = {};
    
    game.participantData[userId] = {
      username: userName,
      joinTime: new Date().toISOString()
    };
    
    gameManager.setGame(gameId, game);

    // Отправляем уведомление создателю игры
    try {
      bot.telegram.sendMessage(
        game.initiator,
        `🎮 Новый игрок присоединился!\n\n${userName} вошел в игру.\nВсего игроков: ${game.participants.length}/10`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Начать игру сейчас', callback_data: `start_game_now_${gameId}` }]
            ]
          }
        }
      );
    } catch (e) {
      console.error('Не удалось отправить уведомление создателю игры:', e);
    }
  }
  
  res.json({ status: 'success', gameId, question: game.currentQuestion });
});

// Отправить ответ на вопрос
app.post('/api/games/:gameId/answer', (req, res) => {
  const gameId = req.params.gameId;
  const { userId, answer } = req.body;
  
  if (!userId || !answer) {
    return res.status(400).json({ error: 'Не хватает данных' });
  }
  
  const games = gameManager.getGames();
  const game = games[gameId];
  const users = userManager.getUsers();
  
  if (!game) {
    return res.status(404).json({ error: 'Игра не найдена' });
  }
  
  if (!game.participants.includes(userId)) {
    return res.status(403).json({ error: 'Вы не участник этой игры' });
  }
  
  if (game.status !== 'collecting_answers' && game.status !== 'waiting_players') {
    return res.status(400).json({ error: 'Игра не принимает ответы' });
  }
  
  if (!game.answers) game.answers = {};
  
  game.answers[userId] = {
    text: answer,
    username: users[userId].funnyName,
    timestamp: new Date().toISOString()
  };
  
  // Если набрали 10 ответов, переходим к голосованию
  const answersCount = Object.keys(game.answers).length;
  if (answersCount >= 10) {
    game.status = 'voting';
    
    // Уведомляем участников о начале голосования
    game.participants.forEach(participantId => {
      try {
        bot.telegram.sendMessage(
          participantId,
          `🎯 Голосование началось!\n\nУже набралось 10 ответов на вопрос:\n"${game.currentQuestion}"\n\nОткройте мини-приложение, чтобы проголосовать!`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Открыть голосование', web_app: { url: 'https://ваш-домен.com' } }]
              ]
            }
          }
        );
      } catch (e) {
        console.error(`Не удалось отправить уведомление участнику ${participantId}:`, e);
      }
    });
  }
  
  gameManager.setGame(gameId, game);
  
  res.json({ 
    status: 'success', 
    answersCount,
    remainingToVoting: Math.max(0, 10 - answersCount)
  });
});

// Начать голосование (только для создателя)
app.post('/api/games/:gameId/startVoting', (req, res) => {
  const gameId = req.params.gameId;
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'Не хватает данных' });
  }
  
  const games = gameManager.getGames();
  const game = games[gameId];
  
  if (!game) {
    return res.status(404).json({ error: 'Игра не найдена' });
  }
  
  if (game.initiator != userId) {
    return res.status(403).json({ error: 'Только создатель может начать голосование' });
  }
  
  const answersCount = Object.keys(game.answers || {}).length;
  if (answersCount < 2) {
    return res.status(400).json({ error: 'Нужно минимум 2 ответа для голосования' });
  }
  
  game.status = 'voting';
  gameManager.setGame(gameId, game);
  
  // Уведомляем участников о начале голосования
  game.participants.forEach(participantId => {
    try {
      bot.telegram.sendMessage(
        participantId,
        `🎯 Голосование началось!\n\nСоздатель игры начал голосование по вопросу:\n"${game.currentQuestion}"\n\nОткройте мини-приложение, чтобы проголосовать!`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Открыть голосование', web_app: { url: 'https://ваш-домен.com' } }]
            ]
          }
        }
      );
    } catch (e) {
      console.error(`Не удалось отправить уведомление участнику ${participantId}:`, e);
    }
  });
  
  res.json({ status: 'success' });
});

// Получить ответы для голосования
app.get('/api/games/:gameId/answers', (req, res) => {
  const gameId = req.params.gameId;
  const userId = req.query.userId;
  
  if (!userId) {
    return res.status(400).json({ error: 'Не хватает данных' });
  }
  
  const games = gameManager.getGames();
  const game = games[gameId];
  
  if (!game) {
    return res.status(404).json({ error: 'Игра не найдена' });
  }
  
  if (game.status !== 'voting') {
    return res.status(400).json({ error: 'Игра не в режиме голосования' });
  }
  
  // Получаем все ответы, кроме ответа пользователя
  const answers = Object.entries(game.answers || {})
    .filter(([uid]) => uid !== userId.toString())
    .map(([uid, ans]) => ({
      id: uid,
      text: ans.text,
      username: ans.username
    }));
    
  res.json({ answers, question: game.currentQuestion });
});

// Отправить голоса
app.post('/api/games/:gameId/vote', (req, res) => {
  const gameId = req.params.gameId;
  const { userId, votedFor } = req.body;
  
  if (!userId || !votedFor || !Array.isArray(votedFor) || votedFor.length > 2) {
    return res.status(400).json({ error: 'Неверные данные голосования' });
  }
  
  const games = gameManager.getGames();
  const game = games[gameId];
  
  if (!game) {
    return res.status(404).json({ error: 'Игра не найдена' });
  }
  
  if (game.status !== 'voting') {
    return res.status(400).json({ error: 'Голосование не активно' });
  }
  
  // Проверка, что пользователь не голосует за свой ответ
  if (votedFor.includes(userId.toString())) {
    return res.status(400).json({ error: 'Нельзя голосовать за свой ответ' });
  }
  
  // Сохраняем голоса
  if (!game.votes) game.votes = {};
  game.votes[userId] = votedFor;
  
  gameManager.setGame(gameId, game);
  
  // Проверяем, все ли проголосовали
  const allVoted = game.participants.every(uid => 
    game.votes[uid] && game.votes[uid].length > 0);
    
  if (allVoted) {
    // Подсчитываем результаты
    calculateResults(gameId);
    res.json({ status: 'success', resultsReady: true });
    
    // Уведомляем участников о результатах
    notifyAboutResults(gameId);
  } else {
    res.json({ status: 'success', resultsReady: false });
  }
});

// Получить результаты голосования
app.get('/api/games/:gameId/results', (req, res) => {
  const gameId = req.params.gameId;
  const games = gameManager.getGames();
  const game = games[gameId];
  
  if (!game) {
    return res.status(404).json({ error: 'Игра не найдена' });
  }
  
  if (game.status !== 'results') {
    return res.status(400).json({ error: 'Результаты еще не готовы' });
  }
  
  res.json({
    question: game.currentQuestion,
    results: game.lastResults || []
  });
});

// Функция подсчета результатов
function calculateResults(gameId) {
  const games = gameManager.getGames();
  const game = games[gameId];
  
  if (!game) return;
  
  game.status = 'results';
  
  // Подсчитываем голоса
  const votes = {};
  Object.values(game.votes || {}).forEach(userVotes => {
    userVotes.forEach(votedFor => {
      votes[votedFor] = (votes[votedFor] || 0) + 1;
    });
  });
  
  // Сортируем результаты 
  const sortedResults = Object.entries(game.answers || {})
    .map(([userId, answer]) => ({
      userId,
      username: answer.username,
      text: answer.text,
      votes: votes[userId] || 0
    }))
    .sort((a, b) => b.votes - a.votes);
  
  // Сохраняем результаты
  game.lastResults = sortedResults;
  
  // Сохраняем результаты раунда
  if (!game.rounds) game.rounds = [];
  game.rounds.push({
    question: game.currentQuestion,
    results: sortedResults,
    completedAt: new Date().toISOString()
  });
  
  // Обновляем общий счет
  if (!game.totalScores) game.totalScores = {};
  sortedResults.forEach(result => {
    game.totalScores[result.userId] = (game.totalScores[result.userId] || 0) + result.votes;
  });
  
  gameManager.setGame(gameId, game);
  
  // Планируем завершение игры через 30 минут
  setTimeout(() => finishGame(gameId), 30 * 60 * 1000);
}

// Функция уведомления о результатах
function notifyAboutResults(gameId) {
  const games = gameManager.getGames();
  const game = games[gameId];
  
  if (!game || !game.lastResults) return;
  
  // Формируем текст с результатами
  let resultText = `🏆 РЕЗУЛЬТАТЫ ГОЛОСОВАНИЯ\n\nВопрос: "${game.currentQuestion}"\n\n`;
  
  game.lastResults.forEach((result, index) => {
    let medal = '';
    if (index === 0) medal = '🥇 ';
    else if (index === 1) medal = '🥈 ';
    else if (index === 2) medal = '🥉 ';
    
    resultText += `${medal}${result.username}: "${result.text}" - ${result.votes} голос(ов)\n`;
  });
  
  resultText += '\nСпасибо всем за участие! 👏';
  
  // Отправляем уведомление всем участникам
  game.participants.forEach(participantId => {
    try {
      bot.telegram.sendMessage(
        participantId,
        resultText,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Посмотреть подробности', web_app: { url: 'https://ваш-домен.com' } }]
            ]
          }
        }
      );
    } catch (e) {
      console.error(`Не удалось отправить результаты участнику ${participantId}:`, e);
    }
  });
}

// Эндпоинт для проверки доступности сервера (для UptimeRobot)
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Обработка запроса к корню
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'papyrus.html'));
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('Ошибка API:', err);
  res.status(500).json({
    error: 'Внутренняя ошибка сервера',
    message: process.env.NODE_ENV === 'production' ? null : err.message
  });
});

// Очистка старых игр раз в час
setInterval(() => {
  const games = gameManager.getGames();
  const now = new Date();
  let cleaned = 0;
  
  Object.keys(games).forEach(gameId => {
    const game = games[gameId];
    if (game.createdAt) {
      const createdAt = new Date(game.createdAt);
      const ageInHours = (now - createdAt) / (1000 * 60 * 60);
      
      if (ageInHours > 24) { // Игра старше 24 часов
        gameManager.deleteGame(gameId);
        cleaned++;
      }
    }
  });
  
  if (cleaned > 0) {
    console.log(`Очищено ${cleaned} старых игр`);
  }
}, 1000 * 60 * 60); // Каждый час

// --- ЗАПУСК БОТА ---
(async () => {
  try {
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Запустить бота' },
      { command: 'newgame', description: 'Начать новую игру' },
      { command: 'help', description: 'Показать правила игры' }
    ]);
    await bot.launch();
    console.log('Бот успешно запущен!');
  } catch (err) {
    console.error('Ошибка при запуске бота:', err);
  }
})();

// Обработка завершения
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Запуск сервера
app.listen(PORT, () => {
  console.log(`API сервер запущен на порту ${PORT}`);
  console.log(`Веб-интерфейс доступен по адресу http://localhost:${PORT}/`);
});

// Диагностические эндпоинты
app.get('/api/debug/games', (req, res) => {
  const games = gameManager.getGames();
  
  // Для безопасности возвращаем только общую информацию
  const summary = Object.entries(games).map(([id, game]) => ({
    id,
    active: game.active,
    status: game.status,
    participants: game.participants?.length || 0,
    hasQuestion: !!game.currentQuestion,
    answers: Object.keys(game.answers || {}).length,
    votes: Object.keys(game.votes || {}).length,
    createdAt: game.createdAt
  }));
  
  res.json({
    totalGames: Object.keys(games).length,
    activeGames: summary.filter(g => g.active).length,
    games: summary
  });
});

app.get('/api/debug/users', (req, res) => {
  const users = userManager.getUsers();
  
  // Для безопасности возвращаем только общую информацию
  const summary = Object.entries(users).map(([id, user]) => ({
    id,
    funnyName: user.funnyName
  }));
  
  res.json({
    totalUsers: Object.keys(users).length,
    users: summary
  });
}); 