const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const gameManager = require('./gameManager');
const userManager = require('./userManager');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');
const shortid = require('shortid');

// Загружаем переменные окружения
dotenv.config();

// Создаем модуль db с проверкой на существование
let db;
try {
  db = require('./db');
  console.log('Модуль db.js успешно загружен');
} catch (e) {
  console.warn('Модуль db.js не найден, используется встроенная заглушка');
  // Заглушка для модуля db
  db = {
    saveUser: (userId, userData) => userData,
    getUser: (userId) => null,
    getAllUsers: () => ({}),
    saveGame: (gameId, gameData) => gameData,
    getGame: (gameId) => null,
    getAllGames: () => ({}),
    deleteGame: () => true,
    deleteUser: () => true,
    get: (collection) => ({
      find: () => ({
        value: () => null,
        assign: () => ({ write: () => {} })
      }),
      push: () => ({ write: () => {} }),
      filter: () => ({
        size: () => ({
          value: () => 0
        })
      })
    })
  };
}

// Создаем заглушку для модуля io, если он отсутствует
let io;
try {
  io = require('./io');
  console.log('Модуль io.js успешно загружен');
} catch (e) {
  console.warn('Модуль io.js не найден, используется встроенная заглушка');
  // Заглушка для модуля io
  io = {
    initConnection: () => ({}),
    closeConnection: () => true,
    on: () => {},
    emit: () => {},
    sendTo: () => true,
    broadcast: () => 0,
    to: () => ({
      emit: () => {}
    })
  };
}

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

// Подключаем бота для отправки уведомлений, если есть токен
let bot = null;
try {
  if (process.env.BOT_TOKEN) {
    const { Telegraf, Scenes, session } = require('telegraf');
    const { Markup } = require('telegraf');
    bot = new Telegraf(process.env.BOT_TOKEN);
    
    // Сцены
    let nameScene, answerScene, customQuestionScene;
    try {
      nameScene = require('./scenes/nameScene');
      answerScene = require('./scenes/answerScene');
      customQuestionScene = require('./scenes/customQuestionScene');

      // Инициализация сцен
      const stage = new Scenes.Stage([nameScene, answerScene, customQuestionScene]);
      bot.use(session());
      bot.use(stage.middleware());
      
      // Команда старт
      bot.command('start', async (ctx) => {
        try {
          await ctx.reply(
            `🎭 ДОБРО ПОЖАЛОВАТЬ 🎭\n\nЯ бот для игры в смешные вопросы PapaTrubok. Чтобы начать, нажмите кнопку ниже!`,
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
      
      // Запускаем бота
      bot.launch().then(() => {
        console.log('Бот успешно запущен!');
      }).catch(err => {
        console.error('Ошибка при запуске бота:', err);
        bot = null; // Сбрасываем бота в случае ошибки
      });
    } catch (err) {
      console.error('Ошибка при инициализации сцен бота:', err);
      bot = null;
    }
  } else {
    console.warn('BOT_TOKEN не задан, функциональность бота отключена');
  }
} catch (e) {
  console.error('Не удалось инициализировать бота:', e);
  bot = null;
}

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Проверяем наличие директории public
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  console.log(`Статические файлы будут обслуживаться из директории: ${publicDir}`);
  app.use(express.static(publicDir));
} else {
  console.warn(`Директория статических файлов не найдена по пути: ${publicDir}`);
  
  // Проверяем альтернативные пути
  const altPaths = [
    path.join(process.cwd(), 'public'),
    path.join(process.cwd(), 'src', 'public')
  ];
  
  let found = false;
  for (const altPath of altPaths) {
    if (fs.existsSync(altPath)) {
      console.log(`Найдена альтернативная директория статических файлов: ${altPath}`);
      app.use(express.static(altPath));
      found = true;
      break;
    }
  }
  
  if (!found) {
    console.error('Не удалось найти директорию со статическими файлами!');
  }
}

// Загружаем данные
gameManager.loadGames();
userManager.loadUsers();

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

// Функция для отправки сообщения через бота (с проверкой на наличие бота)
function sendTelegramMessage(userId, text, options = {}) {
  if (!bot) {
    console.log(`Сообщение не отправлено (бот не инициализирован): ${text}`);
    return Promise.resolve();
  }
  
  return bot.telegram.sendMessage(userId, text, options)
    .catch(error => {
      console.warn(`Не удалось отправить сообщение пользователю ${userId}:`, error.message);
    });
}

// --- ОБРАБОТЧИКИ КОМАНД И CALLBACK'ОВ ---

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
      if (answersCount < 3) {
        await ctx.answerCbQuery('Нужно минимум 3 ответа для голосования');
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
              sendTelegramMessage(
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
              );
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
  const userId = req.query.userId;
  const games = gameManager.getGames();
  const game = games[gameId];
  
  if (!game) {
    return res.status(404).json({ error: 'Игра не найдена' });
  }
  
  // Проверяем, является ли пользователь создателем игры
  const isCreator = userId && game.initiator === userId;
  
  res.json({
    id: gameId,
    initiatorName: game.initiatorName,
    status: game.status,
    participants: game.participants.length,
    currentQuestion: game.currentQuestion,
    answers: Object.keys(game.answers || {}).length,
    maxAnswers: 10,
    isCreator: isCreator
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
      sendTelegramMessage(
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
  
  // Проверяем является ли пользователь создателем
  const isCreator = game.initiator === userId;
  
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
    
    // Отправляем уведомление создателю игры, если текущий пользователь не создатель
    if (!isCreator) {
      try {
        // Проверяем ID создателя перед отправкой уведомления
        if (game.initiator && typeof game.initiator === 'string' && game.initiator.length > 0) {
          // Формируем сообщение о присоединении игрока
          let playerName = anonymous ? 'Анонимный игрок' : userName;
          
          // Если набралось 3 или более игроков, предлагаем начать игру
          const participantCount = game.participants.length;
          
          sendTelegramMessage(
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
          );
          
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
  }
  
  res.json({ 
    status: 'success', 
    gameId, 
    question: game.currentQuestion, 
    status: game.status,
    isCreator: isCreator
  });
});

// Обработчик для регистрации пользователя
app.post('/api/auth/register', (req, res) => {
  try {
    const { userId, name, method, metadata } = req.body;
    
    if (!userId || !method) {
      return res.status(400).json({ 
        status: 'error', 
        error: 'userId и method обязательны для регистрации' 
      });
    }
    
    // Создаем или обновляем запись о пользователе в базе данных
    db.get('users')
      .push({
        id: userId,
        name: name || 'Пользователь',
        method,
        metadata: metadata || {},
        registeredAt: Date.now(),
        lastLoginAt: Date.now()
      })
      .write();
    
    return res.json({ 
      status: 'success', 
      message: 'Пользователь успешно зарегистрирован'
    });
  } catch (error) {
    console.error('Ошибка при регистрации пользователя:', error);
    return res.status(500).json({ 
      status: 'error', 
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Обновляем обработчик отправки ответа, чтобы отслеживать, кто уже ответил
app.post('/api/games/:gameId/answer', (req, res) => {
  try {
    const gameId = req.params.gameId;
    const { userId, answer, username, anonymous } = req.body;
    
    // Проверяем наличие обязательных полей
    if (!userId || !answer) {
      return res.status(400).json({ 
        status: 'error', 
        error: 'Не указан ID пользователя или ответ' 
      });
    }
    
    // Получаем игру из базы данных
    const game = db.get('games').find({ id: gameId }).value();
    
    if (!game) {
      return res.status(404).json({ 
        status: 'error', 
        error: 'Игра не найдена' 
      });
    }
    
    // Проверяем, что игра находится в фазе сбора ответов
    if (game.status !== 'collecting_answers') {
      return res.status(400).json({ 
        status: 'error', 
        error: 'Игра не находится в фазе сбора ответов' 
      });
    }
    
    // Проверяем, не отвечал ли уже пользователь
    const existingAnswer = db.get('answers')
      .find({ gameId: gameId, userId: userId })
      .value();
    
    if (existingAnswer) {
      return res.status(400).json({ 
        status: 'error', 
        error: 'Вы уже ответили на этот вопрос' 
      });
    }
    
    // Сохраняем ответ
    const answerId = shortid.generate();
    const newAnswer = {
      id: answerId,
      gameId: gameId,
      userId: userId,
        text: answer,
      username: username || 'Анонимный участник',
      anonymous: anonymous === true,
      timestamp: Date.now(),
      votes: 0
    };
    
    db.get('answers')
      .push(newAnswer)
      .write();
    
    // Обновляем количество ответов в игре
    const answersCount = db.get('answers')
      .filter({ gameId: gameId })
      .size()
      .value();
    
    // Если достигнуто 10 ответов, автоматически запускаем голосование
    if (answersCount >= 10 && game.status === 'collecting_answers') {
      db.get('games')
        .find({ id: gameId })
        .assign({ status: 'voting', updatedAt: Date.now() })
        .write();
      
      // Уведомляем всех участников о начале голосования
      io.to(gameId).emit('statusChanged', { 
        gameId: gameId, 
        status: 'voting',
        message: 'Собрано 10 ответов! Начинаем голосование.'
      });
    }
    
    return res.json({ 
        status: 'success',
      message: 'Ответ успешно отправлен',
      answerId: answerId,
      answersCount: answersCount
    });
  } catch (error) {
    console.error('Ошибка при отправке ответа:', error);
    return res.status(500).json({ 
      status: 'error', 
      error: 'Внутренняя ошибка сервера' 
    });
  }
});

// Новый метод для проверки, ответил ли пользователь на вопрос
app.get('/api/games/:gameId/check-answer', (req, res) => {
  try {
    const gameId = req.params.gameId;
    const userId = req.query.userId;
    
    if (!gameId || !userId) {
      return res.status(400).json({
        status: 'error',
        error: 'Не указан ID игры или пользователя'
      });
    }
    
    // Проверяем, есть ли ответ от этого пользователя
    const existingAnswer = db.get('answers')
      .find({ gameId: gameId, userId: userId })
      .value();
    
    return res.json({
      status: 'success',
      hasAnswered: !!existingAnswer
    });
  } catch (error) {
    console.error('Ошибка при проверке ответа пользователя:', error);
    return res.status(500).json({
      status: 'error',
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Маршрут для начала голосования
app.post('/api/games/:gameId/startVoting', (req, res) => {
  const gameId = req.params.gameId;
  const { userId } = req.body;
  
  if (!gameId || !userId) {
    return res.status(400).json({ error: 'Не указан ID игры или пользователя' });
  }
  
  const games = gameManager.getGames();
  const game = games[gameId];
  
  if (!game) {
    return res.status(404).json({ error: 'Игра не найдена' });
  }
  
  // Проверяем, является ли пользователь создателем игры
  if (game.initiator !== userId) {
    return res.status(403).json({ error: 'Только создатель игры может начать голосование' });
  }
  
  // Проверяем статус игры
  if (game.status !== 'collecting_answers') {
    return res.status(400).json({ error: 'Голосование можно начать только в режиме сбора ответов' });
  }
  
  // Проверяем, есть ли минимальное количество ответов
  const answersCount = Object.keys(game.answers || {}).length;
  if (answersCount < 3) {
    return res.status(400).json({ error: 'Для начала голосования требуется минимум 3 ответа' });
  }
  
  // Начинаем голосование
  game.status = 'voting';
  gameManager.setGame(gameId, game);
  
  // Удаляем все напоминания для этой игры
  const reminders = gameManager.getReminders();
  Object.keys(reminders).forEach(reminderId => {
    if (reminders[reminderId].gameId === gameId) {
      console.log(`Удаляем напоминание ${reminderId} для игры ${gameId}, так как голосование уже начато через API`);
      gameManager.deleteReminder(reminderId);
    }
  });
  
  console.log(`Голосование начато для игры ${gameId} пользователем ${userId}`);
  
  // Пытаемся отправить уведомления участникам через бота
  try {
    if (Array.isArray(game.participants)) {
      const webAppUrl = process.env.WEB_APP_URL || 'https://t.me/PapaTrubokBot/app';
      
      game.participants.forEach(participantId => {
        if (participantId && typeof participantId === 'string' && participantId.length > 0) {
          try {
            sendTelegramMessage(
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
            );
          } catch (e) {
            console.error(`Не удалось отправить уведомление участнику ${participantId}:`, e);
          }
        }
      });
    }
  } catch (notifyError) {
    console.error('Ошибка при отправке уведомлений участникам:', notifyError);
    // Продолжаем работу даже при ошибке отправки уведомлений
  }
  
  return res.json({ success: true, message: 'Голосование успешно начато' });
});

// Маршрут для голосования
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
    game.votes[uid] && game.votes[uid].length > 0 || uid === userId);
    
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
          sendTelegramMessage(
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
          );
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
  const htmlPath = path.join(__dirname, 'public', 'papyrus.html');
  
  if (fs.existsSync(htmlPath)) {
    console.log(`Отправка файла: ${htmlPath}`);
    res.sendFile(htmlPath);
  } else {
    console.warn(`Файл не найден: ${htmlPath}`);
    
    // Проверяем альтернативные пути
    const altPaths = [
      path.join(process.cwd(), 'public', 'papyrus.html'),
      path.join(process.cwd(), 'src', 'public', 'papyrus.html')
    ];
    
    for (const altPath of altPaths) {
      if (fs.existsSync(altPath)) {
        console.log(`Найден альтернативный путь к HTML: ${altPath}`);
        return res.sendFile(altPath);
      }
    }
    
    // Если файл не найден, отправляем сообщение об ошибке
    res.status(404).send(`
      <html>
        <head>
          <title>Ошибка 404 - Файл не найден</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
            h1 { color: #FF5722; }
            pre { background: #f4f4f4; padding: 15px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h1>Ошибка 404 - Файл не найден</h1>
          <p>Не удалось найти файл papyrus.html.</p>
          <p>Текущая директория: ${__dirname}</p>
          <p>Проверенные пути:</p>
          <pre>${htmlPath}\n${altPaths.join('\n')}</pre>
        </body>
      </html>
    `);
  }
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

// Обработка завершения
if (bot) {
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

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

// Проверка, голосовал ли пользователь в игре
app.get('/api/games/:gameId/check-vote', (req, res) => {
  const gameId = req.params.gameId;
  const userId = req.query.userId;
  
  if (!userId) {
    return res.status(400).json({ error: 'Не указан ID пользователя' });
  }
  
  const games = gameManager.getGames();
  const game = games[gameId];
  
  if (!game) {
    return res.status(404).json({ error: 'Игра не найдена' });
  }
  
  const hasVoted = game.votes && game.votes[userId];
  
  res.json({ hasVoted: !!hasVoted });
});

// Новый метод для получения количества ответов в игре
app.get('/api/games/:gameId/answers-count', (req, res) => {
  try {
    const gameId = req.params.gameId;
    
    if (!gameId) {
      return res.status(400).json({
        status: 'error',
        error: 'Не указан ID игры'
      });
    }
    
    // Получаем количество ответов для данной игры
    const answersCount = db.get('answers')
      .filter({ gameId: gameId })
      .size()
      .value();
    
    return res.json({
      status: 'success',
      count: answersCount
    });
  } catch (error) {
    console.error('Ошибка при получении количества ответов:', error);
    return res.status(500).json({
      status: 'error',
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Маршрут для получения ответа пользователя
app.get('/api/games/:gameId/user-answer', (req, res) => {
  const gameId = req.params.gameId;
  const userId = req.query.userId;
  
  if (!gameId || !userId) {
    return res.status(400).json({ error: 'Не указан ID игры или пользователя' });
  }
  
  const games = gameManager.getGames();
  const game = games[gameId];
  
  if (!game) {
    return res.status(404).json({ error: 'Игра не найдена' });
  }
  
  // Проверяем, есть ли ответ пользователя
  const userAnswer = game.answers && game.answers[userId];
  
  if (!userAnswer) {
    return res.status(404).json({ error: 'Ответ не найден' });
  }
  
  return res.json({ answer: userAnswer.text });
});

// Маршрут для получения ответов для голосования
app.get('/api/games/:gameId/answers', (req, res) => {
  const gameId = req.params.gameId;
  const userId = req.query.userId;
  
  if (!gameId || !userId) {
    return res.status(400).json({ error: 'Не указан ID игры или пользователя' });
  }
  
  const games = gameManager.getGames();
  const game = games[gameId];
  
  if (!game) {
    return res.status(404).json({ error: 'Игра не найдена' });
  }
  
  // Проверяем статус игры
  if (game.status !== 'voting') {
    return res.status(400).json({ error: 'Получить ответы для голосования можно только в режиме голосования' });
  }
  
  const answersData = [];
  
  // Формируем список ответов
  if (game.answers) {
    for (const [answerId, answer] of Object.entries(game.answers)) {
      // Пропускаем ответ текущего пользователя
      if (answerId === userId) continue;
      
      answersData.push({
        id: answerId,
        text: answer.text,
        username: answer.username || 'Анонимный участник',
        anonymous: answer.anonymous || false
      });
    }
  }
  
  return res.json({
    success: true,
    question: game.currentQuestion,
    answers: answersData
  });
}); 