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

// Устанавливаем URL для мини-приложения, если не задан
if (!process.env.WEB_APP_URL) {
  // Для локальной разработки используем localhost, для продакшена домен приложения
  process.env.WEB_APP_URL = process.env.NODE_ENV === 'production' 
    ? 'https://papatrubok.onrender.com'
    : 'http://localhost:3000';
  console.log(`WEB_APP_URL установлен как: ${process.env.WEB_APP_URL}`);
}

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

// Обработчик для callback кнопок
bot.on('callback_query', async (ctx) => {
  try {
    const callbackData = ctx.callbackQuery.data;
    console.log('Получен callback:', callbackData);
    
    // Кнопка старта
    if (callbackData === 'start_game') {
      // Получаем URL приложения для веб-приложения
      const webAppUrl = process.env.WEB_APP_URL || 'https://t.me/PapaTrubokBot/app';
      
      await ctx.answerCbQuery('Загружаем игру...');
      await ctx.reply(
        createStyledMessage('ЗАПУСК ИГРЫ', 'Нажмите кнопку ниже, чтобы открыть мини-приложение PapaTrubok.', '🚀'),
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎮 Играть в PapaTrubok', web_app: { url: webAppUrl } }]
            ]
          }
        }
      );
    }
    // Кнопка начала голосования из уведомления о присоединении игрока
    else if (callbackData.startsWith('start_game_now_')) {
      const gameId = callbackData.replace('start_game_now_', '');
      const games = gameManager.getGames();
      const game = games[gameId];
      
      if (!game) {
        await ctx.answerCbQuery('Ошибка: игра не найдена');
        return;
      }
      
      if (game.initiator != ctx.from.id.toString()) {
        await ctx.answerCbQuery('Только создатель игры может начать голосование');
        return;
      }
      
      const answersCount = Object.keys(game.answers || {}).length;
      if (answersCount < 2) {
        await ctx.answerCbQuery('Нужно минимум 2 ответа для голосования');
        return;
      }
      
      game.status = 'voting';
      gameManager.setGame(gameId, game);
      
      // Удаляем все напоминания для этой игры
      const reminders = gameManager.getReminders();
      Object.keys(reminders).forEach(reminderId => {
        if (reminders[reminderId].gameId === gameId) {
          console.log(`Удаляем напоминание ${reminderId} для игры ${gameId}, так как голосование уже начато через бота`);
          gameManager.deleteReminder(reminderId);
        }
      });
      
      // Получаем URL приложения для кнопки
      const webAppUrl = process.env.WEB_APP_URL || 'https://t.me/PapaTrubokBot/app';
      
      // Уведомляем участников о начале голосования
      if (Array.isArray(game.participants)) {
        game.participants.forEach(participantId => {
          try {
            // Проверяем ID участника перед отправкой уведомления
            if (participantId && typeof participantId === 'string' && participantId.length > 0) {
              bot.telegram.sendMessage(
                participantId,
                `🎯 Голосование началось!\n\nСоздатель игры начал голосование по вопросу:\n"${game.currentQuestion}"\n\nОткройте мини-приложение, чтобы проголосовать!`,
                {
                  parse_mode: 'HTML',
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: 'Открыть голосование', web_app: { url: webAppUrl } }]
                    ]
                  }
                }
              ).catch(error => {
                console.warn(`Не удалось отправить уведомление участнику ${participantId}:`, error.message);
              });
            }
          } catch (e) {
            console.error(`Не удалось отправить уведомление участнику ${participantId}:`, e);
          }
        });
      }
      
      await ctx.answerCbQuery('Голосование успешно запущено!');
      await ctx.reply('🎯 Голосование успешно запущено! Все участники получили уведомления.');
    }
  } catch (error) {
    console.error('Ошибка при обработке callback_query:', error);
    ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте снова.');
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

// Периодически проверяем статус игр
let statusCheckInterval = null;

function startStatusCheck() {
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
  }
  
  statusCheckInterval = setInterval(() => {
    if (currentGame && currentGame.id) {
      checkGameStatus();
    }
  }, 5000); // Проверка каждые 5 секунд
}

// Функция проверки и отправки напоминаний
function checkReminders() {
  const overdueReminders = gameManager.getOverdueReminders();
  
  if (overdueReminders.length === 0) {
    return;
  }
  
  console.log(`Найдено ${overdueReminders.length} просроченных напоминаний`);
  
  overdueReminders.forEach(async (reminder) => {
    try {
      const games = gameManager.getGames();
      const game = games[reminder.gameId];
      
      if (!game) {
        console.log(`Игра ${reminder.gameId} не найдена, удаляем напоминание ${reminder.id}`);
        gameManager.deleteReminder(reminder.id);
        return;
      }
      
      // Проверяем, что игра все еще находится в состоянии сбора ответов или ожидания участников
      if (game.status !== 'waiting_players' && game.status !== 'collecting_answers') {
        console.log(`Игра ${reminder.gameId} уже не в статусе ожидания (${game.status}), удаляем напоминание ${reminder.id}`);
        gameManager.deleteReminder(reminder.id);
        return;
      }
      
      // Получаем URL приложения для кнопки
      const webAppUrl = process.env.WEB_APP_URL || 'https://t.me/PapaTrubokBot/app';
      
      // Отправляем уведомление о возможности начать голосование
      await bot.telegram.sendMessage(
        reminder.userId,
        createStyledMessage('НАПОМИНАНИЕ О ГОЛОСОВАНИИ', 
          `Прошло 12 часов с момента создания вашей игры!\n\n` +
          `Вопрос: "${game.currentQuestion}"\n\n` +
          `Текущее количество участников: ${game.participants.length}\n` +
          `Текущее количество ответов: ${Object.keys(game.answers || {}).length}\n\n` +
          `Вы можете начать голосование сейчас или подождать еще участников.`, '⏰'),
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Начать голосование', callback_data: `start_game_now_${reminder.gameId}` }],
              [{ text: 'Открыть игру', web_app: { url: webAppUrl } }]
            ]
          }
        }
      );
      
      console.log(`Отправлено напоминание для игры ${reminder.gameId} пользователю ${reminder.userId}`);
      
      // Помечаем напоминание как отправленное
      gameManager.markReminderAsNotified(reminder.id);
    } catch (error) {
      console.error(`Ошибка при отправке напоминания ${reminder.id}:`, error);
    }
  });
}

// Запускаем проверку напоминаний каждые 5 минут
setInterval(checkReminders, 5 * 60 * 1000);

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
  
  // Добавляем напоминание о голосовании через 12 часов
  const reminderId = gameManager.addVotingReminder(gameId, userId);
  console.log(`Создано напоминание ${reminderId} для игры ${gameId}`);
  
  console.log(`Игра ${gameId} успешно создана. Статус: ${newGame.status}, active: ${newGame.active}`);
  
  res.status(201).json({ gameId, status: 'success' });
});

// Присоединиться к игре
app.post('/api/games/:gameId/join', (req, res) => {
  const gameId = req.params.gameId;
  const { userId, userName, anonymous } = req.body;
  
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
  userManager.setUser(userId, { 
    funnyName: userName,
    anonymous: !!anonymous // Сохраняем флаг анонимности
  });
  
  // Добавляем в игру
  if (!game.participants.includes(userId)) {
    game.participants.push(userId);
    
    if (!game.participantData) game.participantData = {};
    
    game.participantData[userId] = {
      username: userName,
      anonymous: !!anonymous, // Сохраняем флаг анонимности
      joinTime: new Date().toISOString()
    };
    
    // Если у игры есть вопрос, переводим её в статус сбора ответов
    if (game.currentQuestion && game.status === 'waiting_players') {
      game.status = 'collecting_answers';
      console.log(`Игра ${gameId} переведена в статус сбора ответов`);
    }
    
    gameManager.setGame(gameId, game);

    // Отправляем уведомление создателю игры
    try {
      // Проверяем ID создателя перед отправкой уведомления
      if (game.initiator && typeof game.initiator === 'string' && game.initiator.length > 0) {
        // Формируем сообщение о присоединении игрока
        let playerName = anonymous ? 'Анонимный игрок' : userName;
        
        // Если набралось 3 или более игроков, предлагаем начать игру
        const participantCount = game.participants.length;
        
        bot.telegram.sendMessage(
          game.initiator,
          `🎮 Новый игрок присоединился!\n\n${playerName} вошел в игру.\nВсего игроков: ${participantCount}/10`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Начать игру сейчас', callback_data: `start_game_now_${gameId}` }]
              ]
            }
          }
        ).catch(error => {
          // Логируем ошибку, но не прерываем выполнение
          console.warn(`Не удалось отправить уведомление создателю игры (ID: ${game.initiator}):`, error.message);
        });
        
        // Если это третий игрок, создаем напоминание о голосовании через 12 часов для создателя
        if (participantCount === 3) {
          const reminderId = gameManager.addVotingReminder(gameId, game.initiator);
          console.log(`Создано напоминание ${reminderId} для игры ${gameId} после присоединения 3-го игрока`);
        }
      } else {
        console.warn(`Невалидный ID создателя игры: ${game.initiator}`);
      }
    } catch (e) {
      console.error('Не удалось отправить уведомление создателю игры:', e);
    }
  }
  
  res.json({ status: 'success', gameId, question: game.currentQuestion, status: game.status });
});

// Отправить ответ на вопрос
app.post('/api/games/:gameId/answer', (req, res) => {
  const gameId = req.params.gameId;
  const { userId, answer, anonymous } = req.body;
  
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
  
  // Проверяем настройки анонимности из данных пользователя
  const isAnonymous = anonymous !== undefined ? !!anonymous : !!users[userId].anonymous;
  
  game.answers[userId] = {
    text: answer,
    username: users[userId].funnyName,
    anonymous: isAnonymous, // Сохраняем флаг анонимности
    timestamp: new Date().toISOString()
  };
  
  // Если набрали 10 ответов, переходим к голосованию
  const answersCount = Object.keys(game.answers).length;
  
  // Если это третий ответ в игре и у нас минимум 3 участника, создаем напоминание
  if (answersCount === 3 && game.participants.length >= 3) {
    // Создаем напоминание о голосовании через 12 часов для создателя
    const reminderId = gameManager.addVotingReminder(gameId, game.initiator);
    console.log(`Создано напоминание ${reminderId} для игры ${gameId} после получения 3 ответов`);
  }
  
  if (answersCount >= 10) {
    game.status = 'voting';
    
    // Удаляем все напоминания для этой игры, так как голосование запускается автоматически
    const reminders = gameManager.getReminders();
    Object.keys(reminders).forEach(reminderId => {
      if (reminders[reminderId].gameId === gameId) {
        console.log(`Удаляем напоминание ${reminderId} для игры ${gameId}, так как голосование запускается автоматически`);
        gameManager.deleteReminder(reminderId);
      }
    });
    
    // Уведомляем участников о начале голосования
    if (Array.isArray(game.participants)) {
      game.participants.forEach(participantId => {
        try {
          // Проверяем ID участника перед отправкой уведомления
          if (participantId && typeof participantId === 'string' && participantId.length > 0) {
            // Получаем URL приложения для кнопки
            const webAppUrl = process.env.WEB_APP_URL || 'https://t.me/PapaTrubokBot/app';
            
            bot.telegram.sendMessage(
              participantId,
              `🎯 Голосование началось!\n\nУже набралось 10 ответов на вопрос:\n"${game.currentQuestion}"\n\nОткройте мини-приложение, чтобы проголосовать!`,
              {
                parse_mode: 'HTML',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: 'Открыть голосование', web_app: { url: webAppUrl } }]
                  ]
                }
              }
            ).catch(error => {
              console.warn(`Не удалось отправить уведомление участнику ${participantId}:`, error.message);
            });
          }
        } catch (e) {
          console.error(`Не удалось отправить уведомление участнику ${participantId}:`, e);
        }
      });
    } else {
      console.warn(`Отсутствует список участников для уведомления о начале автоматического голосования в игре ${gameId}`);
    }
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
  
  // Удаляем все напоминания для этой игры
  const reminders = gameManager.getReminders();
  Object.keys(reminders).forEach(reminderId => {
    if (reminders[reminderId].gameId === gameId) {
      console.log(`Удаляем напоминание ${reminderId} для игры ${gameId}, так как голосование уже начато`);
      gameManager.deleteReminder(reminderId);
    }
  });
  
  // Уведомляем участников о начале голосования
  if (Array.isArray(game.participants)) {
    game.participants.forEach(participantId => {
      try {
        // Проверяем ID участника перед отправкой уведомления
        if (participantId && typeof participantId === 'string' && participantId.length > 0) {
          // Получаем URL для веб-приложения
          const webAppUrl = process.env.WEB_APP_URL || 'https://t.me/PapaTrubokBot/app';
          
          bot.telegram.sendMessage(
            participantId,
            `🎯 Голосование началось!\n\nСоздатель игры начал голосование по вопросу:\n"${game.currentQuestion}"\n\nОткройте мини-приложение, чтобы проголосовать!`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [{ text: 'Открыть голосование', web_app: { url: webAppUrl } }]
                ]
              }
            }
          ).catch(error => {
            console.warn(`Не удалось отправить уведомление участнику ${participantId}:`, error.message);
          });
        }
      } catch (e) {
        console.error(`Не удалось отправить уведомление участнику ${participantId}:`, e);
      }
    });
  } else {
    console.warn(`Отсутствует список участников для уведомления о начале голосования в игре ${gameId}`);
  }
  
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
      username: ans.username,
      anonymous: !!ans.anonymous // Передаем флаг анонимности
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
  
  // Добавляем информацию о анонимности для результатов
  const results = game.lastResults || [];
  
  res.json({
    question: game.currentQuestion,
    results: results
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
      anonymous: !!answer.anonymous, // Добавляем флаг анонимности
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
    
    // Отображаем имя пользователя, если ответ не анонимный
    const displayName = result.anonymous ? 'Анонимный пользователь' : result.username;
    
    resultText += `${medal}${displayName}: "${result.text}" - ${result.votes} голос(ов)\n`;
  });
  
  resultText += '\nСпасибо всем за участие! 👏';
  
  // Получаем URL приложения для кнопки
  const webAppUrl = process.env.WEB_APP_URL || 'https://t.me/PapaTrubokBot/app';
  
  // Отправляем уведомление всем участникам
  if (Array.isArray(game.participants)) {
    game.participants.forEach(participantId => {
      try {
        // Проверяем ID участника перед отправкой уведомления
        if (participantId && typeof participantId === 'string' && participantId.length > 0) {
          bot.telegram.sendMessage(
            participantId,
            resultText,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [{ text: 'Посмотреть подробности', web_app: { url: webAppUrl } }]
                ]
              }
            }
          ).catch(error => {
            console.warn(`Не удалось отправить результаты участнику ${participantId}:`, error.message);
          });
        }
      } catch (e) {
        console.error(`Не удалось отправить результаты участнику ${participantId}:`, e);
      }
    });
  } else {
    console.warn(`Отсутствует список участников для уведомления о результатах игры ${gameId}`);
  }
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