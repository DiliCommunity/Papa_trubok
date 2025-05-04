const { Telegraf, Scenes, session } = require('telegraf');
const dotenv = require('dotenv');
const fs = require('fs');
const { Markup } = require('telegraf');
const gameManager = require('./gameManager');
const userManager = require('./userManager');
const nameScene = require('./scenes/nameScene');
const answerScene = require('./scenes/answerScene');
const customQuestionScene = require('./scenes/customQuestionScene');

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// Очищаем все данные при запуске бота
fs.writeFileSync('games.json', '{}', 'utf8');
fs.writeFileSync('users.json', '{}', 'utf8');

gameManager.loadGames();
userManager.loadUsers();
const games = gameManager.getGames();

// ВАЖНО: Инициализация сессии и сцен должна происходить ДО обработчиков команд
// Создаем stage со всеми сценами заранее

// Инициализируем stage и добавляем все сцены
const stage = new Scenes.Stage([nameScene, answerScene, customQuestionScene]);

// Обязательно добавляем middleware ДО регистрации обработчиков команд
bot.use(session());
bot.use(stage.middleware());

// Константы
const MAX_ANSWERS = 10; // Максимальное количество ответов для автозапуска голосования

// Настройка команд для меню Telegram
bot.telegram.setMyCommands([
  { command: 'start', description: 'Запустить бота' },
  { command: 'newgame', description: 'Начать новую игру' },
  { command: 'help', description: 'Показать правила игры' }
]);

// Добавим функцию для создания стилизованных сообщений
function createStyledMessage(title, content, emoji = '📝') {
  return `<b>🔸🔹🔸 ${emoji} ${title} ${emoji} 🔸🔹🔸</b>\n\n${content}`;
}

// Сохранение данных игры в CSV-файл
function saveGameStats(game) {
  const filename = `game_${Date.now()}.csv`;
  let csvContent = "Раунд,Вопрос,Игрок,Ответ,Голосов\n";
  
  game.rounds.forEach((round, roundIndex) => {
    round.results.forEach(result => {
      csvContent += `${roundIndex + 1},"${round.question}",${result.userId},"${result.answer}",${result.votes}\n`;
    });
  });
  
  fs.writeFileSync(filename, csvContent, 'utf8');
  return filename;
}

// В начало файла добавьте эту функцию очистки
async function clearChatHistory(bot) {
  try {
    console.log('Очистка данных предыдущих сессий...');
    
    // Очищаем данные через менеджеры
    gameManager.clearAllGames();
    userManager.clearAllUsers();
    
    console.log('Данные очищены, бот готов к работе с чистого листа');
    return true;
  } catch (error) {
    console.error('Ошибка при очистке данных:', error);
    return false;
  }
}

// Обработчик команды start
bot.command('start', async (ctx) => {
  try {
    // Опционально: можно попытаться удалить предыдущие сообщения
    // Это не всегда работает из-за ограничений API Telegram
    
    // Отправляем приветственное сообщение
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

// Показ правил
bot.action('show_rules', (ctx) => {
  const rulesMessage = createStyledMessage('ПРАВИЛА ИГРЫ', 
    `1️⃣ Каждому участнику задаётся один и тот же вопрос\n` +
    `2️⃣ Каждый участник отправляет боту личное сообщение со своим самым смешным ответом\n` +
    `3️⃣ Голосование начнётся когда:\n` +
    `   ◾ Наберётся ${MAX_ANSWERS} ответов (автоматически)\n` +
    `   ◾ ИЛИ создатель игры нажмёт кнопку начала голосования\n` +
    `4️⃣ В голосовании каждый выбирает 2 самых смешных ответа (кроме своего)\n` +
    `5️⃣ Побеждает участник с наибольшим количеством голосов\n`, '📜');
  
  ctx.editMessageText(rulesMessage, { 
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('◀️ Назад', 'back_to_main')],
    ])
  });
});

// Возврат к главному меню
bot.action('back_to_main', (ctx) => {
  ctx.editMessageText(
    createStyledMessage('ДОБРО ПОЖАЛОВАТЬ', 'Я бот для игры в смешные вопросы PapaTrubok. Чтобы начать, нажмите кнопку ниже!', '🎭'),
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Старт', 'start_game')]
      ])
    }
  );
});

// Настройка имени
bot.action('set_funny_name', (ctx) => {
  ctx.scene.enter('name_scene');
});

// Обработчик для присоединения к игре
bot.action('join_game', (ctx) => {
  const userId = ctx.from.id;
  const userGames = userManager.getUsers();
  const games = gameManager.getGames();
  
  if (!userGames[userId] || !userGames[userId].funnyName) {
    return ctx.answerCbQuery('Сначала придумайте себе прикольное имя!', { show_alert: true });
  }
  
  // Выводим все игры для отладки
  console.log('Все игры в системе:', Object.keys(games).map(id => ({
    id,
    status: games[id].status,
    active: games[id].active,
    initiator: games[id].initiatorName,
    participants: games[id].participants?.length || 0
  })));
  
  // Ищем все активные игры (с менее строгой фильтрацией)
  const activeGames = Object.entries(games)
    .filter(([id, game]) => game.active && (game.status === 'waiting_players' || game.status === 'collecting_answers'))
    .map(([id, game]) => ({
      id,
      name: game.initiatorName,
      count: game.participants.length,
      hasQuestion: !!game.currentQuestion
    }));
  
  console.log('Доступные игры:', activeGames); // Для отладки
  
  if (activeGames.length === 0) {
    return ctx.answerCbQuery('Нет активных игр. Создайте новую!', { show_alert: true });
  }
  
  const roomButtons = activeGames.map(g =>
    [Markup.button.callback(`${g.hasQuestion ? '✅' : '⏳'} Комната: ${g.name} (${g.count}/${MAX_ANSWERS})`, `join_room_${g.id}`)]
  );
  
  ctx.editMessageText(
    createStyledMessage('ВЫБЕРИТЕ КОМНАТУ', 'Выберите комнату для присоединения:', '🏛️'),
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        ...roomButtons,
        [Markup.button.callback('◀️ Назад', 'back_to_main')]
      ])
    }
  );
});

// Модификация обработчика присоединения к комнате
bot.action(/join_room_(\d+)/, (ctx) => {
  const userId = ctx.from.id;
  const userGames = userManager.getUsers();
  const games = gameManager.getGames();
  const gameId = ctx.match[1];
  
  if (!games[gameId]) {
    return ctx.answerCbQuery('Эта игра не найдена.', { show_alert: true });
  }
  
  if (!games[gameId].active) {
    return ctx.answerCbQuery('Эта игра уже не активна.', { show_alert: true });
  }
  
  // Разрешаем присоединяться, даже если игра в режиме сбора ответов
  if (games[gameId].status !== 'waiting_players' && games[gameId].status !== 'collecting_answers') {
    return ctx.answerCbQuery('Эта комната сейчас недоступна для входа.', { show_alert: true });
  }
  
  const game = games[gameId];
  
  if (game.participants.includes(userId)) {
    return ctx.answerCbQuery('Вы уже присоединились к этой игре!', { show_alert: true });
  }
  
  // Добавляем игрока в список участников
  game.participants.push(userId);
  
  // Инициализируем participantData, если его нет
  if (!game.participantData) game.participantData = {};
  
  // Добавляем данные об игроке
  game.participantData[userId] = {
    username: userGames[userId].funnyName,
    joinTime: new Date().toISOString()
  };
  
  // Сохраняем изменения
  gameManager.setGame(gameId, game);

  // Показываем вопрос, если он уже есть
  let joinMsg = `Отлично, ${userGames[userId].funnyName}! Вы присоединились к игре.\n\n` +
    `Количество игроков: ${game.participants.length}/${MAX_ANSWERS}\n\n` +
    `Ожидайте начала игры, как только наберется ${MAX_ANSWERS} игроков или создатель игры решит начать.`;
  
  if (game.currentQuestion) {
    joinMsg += `\n\n<b>Вопрос от создателя:</b>\n"${game.currentQuestion}"`;
  }
  
  ctx.editMessageText(
    createStyledMessage('ВЫ ПРИСОЕДИНИЛИСЬ К ИГРЕ', joinMsg, '🎮'),
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(
        game.currentQuestion && game.status === 'collecting_answers'
          ? [[Markup.button.callback('✏️ Ответить на вопрос', `provide_answer_${gameId}`)]]
          : []
      )
    }
  );
  
  // Уведомление админу
  ctx.telegram.sendMessage(
    game.initiator,
    createStyledMessage('НОВЫЙ УЧАСТНИК',
      `${userGames[userId].funnyName} присоединился к игре!\n\n` +
      `<b>Игроков:</b> ${game.participants.length}/${MAX_ANSWERS}\n` +
      `<b>Осталось:</b> ${MAX_ANSWERS - game.participants.length} игроков`, '👥'),
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✏️ Ответить на свой вопрос', `provide_answer_${gameId}`)],
        [Markup.button.callback('🚀 Начать игру сейчас', `start_game_now_${gameId}`)]
      ])
    }
  );
  
  // Если достигли максимального количества игроков, автоматически начинаем игру
  if (game.participants.length >= MAX_ANSWERS) {
    // Меняем статус на collecting_answers
    game.status = 'collecting_answers';
    gameManager.setGame(gameId, game);
    
    // Отправляем уведомление всем участникам
    game.participants.forEach(participantId => {
      if (participantId !== userId) { // Текущий пользователь уже получил сообщение
        ctx.telegram.sendMessage(
          participantId,
          createStyledMessage('ИГРА НАЧАЛАСЬ', 
            `Набралось ${MAX_ANSWERS} участников! Игра автоматически началась.\n\n` +
            `<b>Вопрос:</b> "${game.currentQuestion}"`, '🚀'),
          { 
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('✏️ Ответить на вопрос', `provide_answer_${gameId}`)]
            ])
          }
        );
      }
    });
    
    // Уведомляем создателя игры
    ctx.telegram.sendMessage(
      game.initiator,
      createStyledMessage('ИГРА НАЧАЛАСЬ',
        `Набралось ${MAX_ANSWERS} участников! Игра автоматически началась.\n\n` +
        `<b>Вопрос:</b> "${game.currentQuestion}"`, '🚀'),
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✏️ Ответить на свой вопрос', `provide_answer_${gameId}`)],
          [Markup.button.callback('🗳️ Начать голосование', `start_voting_${gameId}`)]
        ])
      }
    );
  }
  
  ctx.answerCbQuery('Вы успешно присоединились к игре!');
});

// Создание новой игры через инлайн-кнопку
bot.action('create_new_game', (ctx) => {
  const userId = ctx.from.id;
  const userGames = userManager.getUsers();
  const games = gameManager.getGames();
  
  if (!userGames[userId] || !userGames[userId].funnyName) {
    return ctx.answerCbQuery('Сначала придумайте себе прикольное имя!', { show_alert: true });
  }
  
  // Создаем новую игру
  const gameId = Date.now().toString();
  const newGame = {
    active: true,
    initiator: userId,
    initiatorName: userGames[userId].funnyName,
    answers: {},
    votes: {},
    votingActive: false,
    totalScores: {},
    status: 'waiting_players', // важный статус для видимости игры
    rounds: [],
    participants: [userId],
    participantData: {
      [userId]: {
        username: userGames[userId].funnyName,
        joinTime: new Date().toISOString()
      }
    },
    createdAt: new Date().toISOString(),
    isCustomQuestion: true
  };
  
  // Сохраняем игру перед входом в сцену
  gameManager.setGame(gameId, newGame);
  
  // Теперь входим в сцену с вопросом
  ctx.scene.enter('custom_question_scene', { gameId });
  ctx.answerCbQuery('Игра успешно создана!');
});

// Обновленная функция выбора вопросов с пунктом "Задать свой вопрос"
bot.action(/select_questions_menu_(\d+)/, async (ctx) => {
  const userId = ctx.from.id;
  const gameId = ctx.match[1];
  
  if (!games[gameId] || games[gameId].initiator !== userId) {
    return ctx.answerCbQuery('Вы не являетесь создателем этой игры.', { show_alert: true });
  }
  
  const game = games[gameId];
  
  // Отправляем создателю игры красивую клавиатуру с вопросами
  try {
    // Ограничим количество вопросов для отображения
    const questionButtons = questions.slice(0, 5).map((q, index) => {
      const shortQuestion = q.length > 40 ? q.substring(0, 37) + '...' : q;
      return [Markup.button.callback(`${index + 1}. ${shortQuestion}`, `select_question_${gameId}_${index}`)];
    });
    
    // Добавляем кнопку "Задать свой вопрос"
    questionButtons.push([Markup.button.callback('✍️ 6. Задать свой вопрос', `custom_question_${gameId}`)]);
    
    ctx.editMessageText(
      createStyledMessage('ВЫБОР ВОПРОСА', 
        `Выберите вопрос для этого раунда:\n\n` +
        `Участников в игре: ${game.participants.length}/${MAX_ANSWERS}`, '❓'),
      { 
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          ...questionButtons,
          [Markup.button.callback('◀️ Назад', `admin_menu_${gameId}`)]
        ])
      }
    );
  } catch (error) {
    console.error('Ошибка выбора вопроса:', error);
    ctx.answerCbQuery('Ошибка при загрузке вопросов!', { show_alert: true });
  }
});

// Исправляем обработчик создания вопроса, чтобы игра оставалась в статусе waiting_players
bot.action(/custom_question_(\d+)/, (ctx) => {
  const userId = ctx.from.id;
  const gameId = ctx.match[1];
  const games = gameManager.getGames();
  
  if (!games[gameId] || games[gameId].initiator !== userId) {
    return ctx.answerCbQuery('Вы не являетесь создателем этой игры.', { show_alert: true });
  }
  
  // Сохраняем gameId в контексте сцены
  ctx.scene.state = { gameId: gameId };
  console.log(`Входим в сцену вопроса с данными:`, ctx.scene.state); // Для отладки
  
  // Отвечаем на callback query, чтобы не было "часов" ожидания
  ctx.answerCbQuery();
  
  // Входим в сцену ввода собственного вопроса
  ctx.scene.enter('custom_question_scene');
});

// Исправляем обработчик кнопки "Ответить на вопрос"
bot.action(/provide_answer_(\d+)/, async (ctx) => {
  const userId = ctx.from.id;
  const gameId = ctx.match[1];
  const games = gameManager.getGames();
  const game = games[gameId];

  console.log(`Нажатие кнопки "Ответить на вопрос": userId=${userId}, gameId=${gameId}`); // Для отладки

  if (!game) {
    return ctx.answerCbQuery('Игра не найдена. Возможно, она была удалена.', { show_alert: true });
  }

  // Проверка действительно ли пользователь является участником игры
  if (!game.participants.includes(userId)) {
    return ctx.answerCbQuery('Вы не являетесь участником этой игры.', { show_alert: true });
  }

  // Проверяем, что у игры есть вопрос
  if (!game.currentQuestion) {
    return ctx.answerCbQuery('Для этой игры еще не выбран вопрос.', { show_alert: true });
  }

  // Проверяем, что игра принимает ответы
  if (game.status !== 'collecting_answers' && game.status !== 'waiting_players') {
    return ctx.answerCbQuery('Эта игра не принимает ответы в данный момент.', { show_alert: true });
  }

  // Проверяем, что пользователь не отвечал ранее
  if (game.answers && game.answers[userId]) {
    return ctx.answerCbQuery('Вы уже ответили на этот вопрос.', { show_alert: true });
  }
  
  // Отвечаем на callback query, чтобы не было "часов" ожидания
  await ctx.answerCbQuery();

  // Инициализируем сессию, если она не существует
  if (!ctx.session) ctx.session = {};
  
  // Сохраняем gameId и в сессии и в контексте сцены для надежности
  ctx.session.gameId = gameId;
  ctx.scene.state = { gameId: gameId };
  
  console.log(`Перед входом в сцену: state=${JSON.stringify(ctx.scene.state)}, session=${JSON.stringify(ctx.session)}`); // Для отладки

  // Входим в сцену ответа
  return ctx.scene.enter('answer_scene');
});

// Обработчик выбора стандартного вопроса
bot.action(/select_question_(\d+)_(\d+)/, (ctx) => {
  const userId = ctx.from.id;
  const gameId = ctx.match[1];
  const questionIndex = parseInt(ctx.match[2], 10);

  if (!games[gameId] || games[gameId].initiator !== userId) {
    return ctx.answerCbQuery('Вы не являетесь создателем этой игры.', { show_alert: true });
  }

  const game = games[gameId];
  game.currentQuestionIndex = questionIndex;
  game.currentQuestion = questions[questionIndex];
  game.question = questions[questionIndex];
  game.isCustomQuestion = false;

  ctx.editMessageText(
    createStyledMessage('ВОПРОС ВЫБРАН', 
      `Вопрос для раунда:\n\n"${game.currentQuestion}"\n\n` +
      `Участников: ${game.participants.length}/${MAX_ANSWERS}\n` +
      `Вы можете начать игру сейчас или подождать ещё игроков.`, '✅'),
    { 
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Начать игру сейчас', `start_game_now_${gameId}`)],
        [Markup.button.callback('⏳ Ждать ещё участников', `wait_more_players_${gameId}`)]
      ])
    }
  );
});

// Функция для начала игры
function startGame(gameId) {
  const games = gameManager.getGames();
  const game = games[gameId];
  
  if (!game || game.status !== 'waiting_players') {
    return false;
  }
  
  if (game.participants.length < 2) {
    // Сообщаем создателю, что нужно минимум 2 игрока
    bot.telegram.sendMessage(
      game.initiator,
      'Для начала игры нужно минимум 2 участника!',
      {
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🚀 Старт', 'start_game')]
        ])
      }
    );
    return false;
  }
  
  // Проверяем, что вопрос выбран
  if (!game.currentQuestion) {
    // Выбираем случайный вопрос, если не выбран
    const randomIndex = Math.floor(Math.random() * questions.length);
    game.currentQuestionIndex = randomIndex;
    game.currentQuestion = questions[randomIndex];
    game.question = questions[randomIndex];
  }
  
  game.status = 'collecting_answers';
  game.answers = {};
  game.votes = {};
  
  // Отправляем вопрос всем участникам
  game.participants.forEach(userId => {
    bot.telegram.sendMessage(
      userId,
      createStyledMessage('ИГРА НАЧАЛАСЬ', 
        `<b>Вопрос раунда:</b>\n\n` +
        `"${game.currentQuestion}"\n\n` +
        `Отправьте ваш самый смешной ответ, нажав на кнопку ниже:`, '🎮'),
      { 
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✏️ Ответить на вопрос', `provide_answer_${gameId}`)]
        ])
      }
    );
  });
  
  return true;
}

// Функция преобразования статуса игры в читаемый текст
function getGameStatusText(status) {
  switch(status) {
    case 'waiting_players': return 'Ожидание участников';
    case 'collecting_answers': return 'Сбор ответов';
    case 'voting': return 'Голосование';
    default: return 'Неизвестный статус';
  }
}

// Исправляем обработчик для кнопки "Начать голосование"
bot.action(/start_voting_(\d+)/, (ctx) => {
  const userId = ctx.from.id;
  const gameId = ctx.match[1];
  const games = gameManager.getGames();
  const game = games[gameId];

  if (!game) {
    return ctx.answerCbQuery('Игра не найдена.', { show_alert: true });
  }

  if (game.initiator !== userId) {
    return ctx.answerCbQuery('Только создатель игры может начать голосование.', { show_alert: true });
  }

  const answersCount = Object.keys(game.answers || {}).length;
  
  if (answersCount < 2) {
    return ctx.answerCbQuery('Нужно минимум 2 ответа, чтобы начать голосование!', { show_alert: true });
  }

  // Меняем статус игры на голосование
  game.status = 'voting';
  game.votes = {};
  gameManager.setGame(gameId, game);

  // Формируем список ответов для голосования (без своего)
  game.participants.forEach(participantId => {
    // Получаем все ответы, кроме ответа этого участника
    const answers = Object.entries(game.answers || {})
      .filter(([uid]) => uid !== participantId.toString())
      .map(([uid, ans]) => ({
        uid,
        text: ans.text,
        username: ans.username
      }));

    if (answers.length === 0) return; // Нет доступных ответов для голосования

    // Кнопки для голосования (можно выбрать 2)
    const voteButtons = answers.map(ans =>
      [Markup.button.callback(`${ans.username}: ${ans.text}`, `vote_${gameId}_${ans.uid}`)]
    );

    // Отправляем сообщение с кнопками для голосования
    ctx.telegram.sendMessage(
      participantId,
      createStyledMessage('ГОЛОСОВАНИЕ НАЧАЛОСЬ', 
        `<b>Вопрос:</b> "${game.currentQuestion}"\n\n` +
        `Выберите 2 самых смешных ответа (кроме своего). Ваш ответ не отображается в списке.`, '🗳️'),
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(voteButtons)
      }
    );
  });

  // Подтверждаем создателю, что голосование началось
  ctx.editMessageText(
    createStyledMessage('ГОЛОСОВАНИЕ ЗАПУЩЕНО', 
      `Голосование успешно запущено!\n\n` +
      `<b>Вопрос:</b> "${game.currentQuestion}"\n\n` +
      `<b>Ответов:</b> ${answersCount}\n` +
      `<b>Участников:</b> ${game.participants.length}\n\n` +
      `Ожидайте, пока все участники проголосуют. Результаты будут объявлены автоматически.`, '🗳️'),
    { 
      parse_mode: 'HTML' 
    }
  );

  ctx.answerCbQuery('Голосование успешно запущено!');
});

// Улучшаем обработку голосов
bot.action(/vote_(\d+)_(\d+)/, (ctx) => {
  const userId = ctx.from.id;
  const gameId = ctx.match[1];
  const votedForId = ctx.match[2];
  const games = gameManager.getGames();
  const game = games[gameId];

  if (!game) {
    return ctx.answerCbQuery('Эта игра больше не существует.', { show_alert: true });
  }

  if (game.status !== 'voting') {
    return ctx.answerCbQuery('Голосование не активно.', { show_alert: true });
  }

  // Проверка, что пользователь не голосует за свой ответ
  if (votedForId === userId.toString()) {
    return ctx.answerCbQuery('Вы не можете голосовать за свой ответ!', { show_alert: true });
  }

  // Инициализируем массив голосов, если его нет
  if (!game.votes) game.votes = {};
  if (!game.votes[userId]) game.votes[userId] = [];

  // Проверка, что пользователь не голосовал за этот ответ
  if (game.votes[userId].includes(votedForId)) {
    return ctx.answerCbQuery('Вы уже проголосовали за этот ответ.', { show_alert: true });
  }

  // Проверка, что не превышен лимит в 2 голоса
  if (game.votes[userId].length >= 2) {
    return ctx.answerCbQuery('Вы уже выбрали максимум 2 ответа.', { show_alert: true });
  }

  // Добавляем голос
  game.votes[userId].push(votedForId);
  gameManager.setGame(gameId, game);

  // Сообщаем, что голос засчитан
  const votesGiven = game.votes[userId].length;
  const votesLeft = 2 - votesGiven;
  const msg = votesLeft > 0 
    ? `Голос засчитан! Вы можете выбрать еще ${votesLeft} ответ(а).` 
    : 'Голосование завершено! Спасибо за ваш выбор.';
  
  ctx.answerCbQuery(msg);

  // Если это был последний голос пользователя
  if (votesGiven === 2) {
    // Обновляем сообщение, чтобы убрать кнопки
    ctx.editMessageText(
      createStyledMessage('ГОЛОСОВАНИЕ ЗАВЕРШЕНО', 
        `Спасибо за ваши голоса! Ожидайте результатов голосования.`, '✅'),
      { parse_mode: 'HTML' }
    );
    
    // Уведомление администратору о голосе
    ctx.telegram.sendMessage(
      game.initiator,
      createStyledMessage('ИНФОРМАЦИЯ О ГОЛОСОВАНИИ', 
        `Участник ${userManager.getUsers()[userId]?.funnyName || 'Неизвестный'} проголосовал.\n\n` +
        `Проголосовало участников: ${Object.keys(game.votes).length}/${game.participants.length}`, '📊'),
      { parse_mode: 'HTML' }
    );
  }

  // Проверяем, все ли проголосовали
  const participants = game.participants.filter(uid => 
    game.answers && Object.keys(game.answers).includes(uid.toString()));
  
  const allVoted = participants.every(uid => 
    game.votes[uid] && game.votes[uid].length === 2);
  
  if (allVoted && participants.length >= 2) {
    // Все участники проголосовали, подсчитываем результаты
    finishVoting(gameId);
  }
});

// Обработчик для кнопки "Старт"
bot.action('start_game', (ctx) => {
  ctx.reply(
    createStyledMessage('НАЧНИТЕ ИГРУ', 'Придумайте себе прикольное имя и выберите действие!', '🎲'),
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✨ Придумать прикольное имя', 'set_funny_name')],
        [Markup.button.callback('🎮 Создать игру', 'create_new_game')],
        [Markup.button.callback('🎲 Присоединиться к игре', 'join_game')]
      ])
    }
  );
});

// Обработчик кнопки "Ждать новых участников"
bot.action(/wait_for_answers_(\d+)/, (ctx) => {
  const userId = ctx.from.id;
  const gameId = ctx.match[1];
  const games = gameManager.getGames();
  
  if (!games[gameId] || games[gameId].initiator !== userId) {
    return ctx.answerCbQuery('Вы не являетесь создателем этой игры.', { show_alert: true });
  }
  
  const game = games[gameId];
  
  // Сообщаем админу, что он успешно перешел в режим ожидания игроков
  ctx.editMessageText(
    createStyledMessage('ОЖИДАНИЕ УЧАСТНИКОВ', 
      `Ваш вопрос: "${game.currentQuestion}"\n\n` +
      `Ожидаем присоединения участников.\n` +
      `Текущее количество: ${game.participants.length}/${MAX_ANSWERS}\n\n` +
      `Вы получите уведомление, когда кто-то присоединится.`, '⏳'),
    { 
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✏️ Ответить на вопрос', `provide_answer_${gameId}`)],
        [Markup.button.callback('🚀 Начать игру сейчас', `start_game_now_${gameId}`)]
      ])
    }
  );
  
  ctx.answerCbQuery('Режим ожидания включен');
});

// Обработчик кнопки "Начать игру сейчас"
bot.action(/start_game_now_(\d+)/, (ctx) => {
  const userId = ctx.from.id;
  const gameId = ctx.match[1];
  const games = gameManager.getGames();
  
  if (!games[gameId] || games[gameId].initiator !== userId) {
    return ctx.answerCbQuery('Вы не являетесь создателем этой игры.', { show_alert: true });
  }
  
  const game = games[gameId];
  
  // Проверяем минимальное количество участников
  if (game.participants.length < 2) {
    return ctx.answerCbQuery('Для начала игры нужно минимум 2 участника!', { show_alert: true });
  }
  
  // Меняем статус игры на сбор ответов
  game.status = 'collecting_answers';
  gameManager.setGame(gameId, game);
  
  // Отправляем вопрос всем участникам
  game.participants.forEach(participantId => {
    if (!game.answers || !game.answers[participantId]) { // Если участник еще не ответил
      bot.telegram.sendMessage(
        participantId,
        createStyledMessage('ИГРА НАЧАЛАСЬ', 
          `<b>Вопрос раунда:</b>\n\n` +
          `"${game.currentQuestion}"\n\n` +
          `Отправьте ваш самый смешной ответ, нажав на кнопку ниже:`, '🎮'),
        { 
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✏️ Ответить на вопрос', `provide_answer_${gameId}`)]
          ])
        }
      );
    }
  });
  
  ctx.editMessageText(
    createStyledMessage('ИГРА НАЧАЛАСЬ', 
      `Игра началась! Вы отправили вопрос всем участникам.\n\n` +
      `Вопрос: "${game.currentQuestion}"\n\n` +
      `Участников: ${game.participants.length}`, '🚀'),
    { 
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✏️ Ответить на вопрос', `provide_answer_${gameId}`)],
        [Markup.button.callback('🗳️ Начать голосование', `start_voting_${gameId}`)]
      ])
    }
  );
  
  ctx.answerCbQuery('Игра началась!');
});

// Инициализация бота с очисткой истории при запуске
(async () => {
  try {
    // Очистка данных перед запуском
    await clearChatHistory(bot);
    
    // Настройка меню команд для Telegram
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Запустить бота' },
      { command: 'newgame', description: 'Начать новую игру' },
      { command: 'help', description: 'Показать правила игры' }
    ]);
    
    if (process.env.NODE_ENV === 'production') {
      // Запуск через вебхук в продакшене
      const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://имя-вашего-проекта.onrender.com/webhook';
      await bot.telegram.setWebhook(WEBHOOK_URL);
      console.log(`Бот запущен в режиме webhook: ${WEBHOOK_URL}`);
    } else {
      // Локальный режим polling
      await bot.launch();
      console.log('Бот запущен в режиме long polling');
    }
  } catch (err) {
    console.error('Ошибка при запуске бота:', err);
  }
})();

// Обработка завершения
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Проверяем игры, которые готовы к запуску голосования
setInterval(() => {
  const games = gameManager.getGames();
  Object.keys(games).forEach(gameId => {
    const game = games[gameId];
    if (game.shouldStartVoting) {
      // Сбрасываем флаг
      game.shouldStartVoting = false;
      gameManager.setGame(gameId, game);
      // Запускаем голосование
      startVoting(gameId);
    }
  });
}, 5000); // Проверяем каждые 5 секунд

// Улучшаем подсчет результатов голосования
function finishVoting(gameId) {
  const games = gameManager.getGames();
  const game = games[gameId];
  
  if (!game || game.status !== 'voting') {
    return; // Игра уже не в режиме голосования
  }

  // Меняем статус игры
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
  
  // Формируем сообщение с результатами
  let resultMessage = `<b>Вопрос:</b> "${game.currentQuestion}"\n\n`;
  resultMessage += '<b>🏆 РЕЗУЛЬТАТЫ ГОЛОСОВАНИЯ:</b>\n\n';
  
  sortedResults.forEach((result, index) => {
    let medal = "";
    if (index === 0) medal = "🥇 ";
    else if (index === 1) medal = "🥈 ";
    else if (index === 2) medal = "🥉 ";
    
    resultMessage += `${medal}<b>${result.username}</b>: "${result.text}" - <b>${result.votes}</b> голос(ов)\n`;
  });
  
  resultMessage += '\nСпасибо всем за участие! 👏';
  
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
  
  // Завершаем игру
  game.active = false;
  gameManager.setGame(gameId, game);
  
  // Отправляем результаты всем участникам
  game.participants.forEach(userId => {
    bot.telegram.sendMessage(
      userId,
      createStyledMessage('РЕЗУЛЬТАТЫ ГОЛОСОВАНИЯ', resultMessage, '🏆'),
      { 
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🚀 Вернуться в меню', 'start_game')]
        ])
      }
    );
  });
}

// Добавьте функцию для очистки данных конкретного пользователя
bot.command('reset', async (ctx) => {
  const userId = ctx.from.id;
  
  // Удаляем данные пользователя
  const users = userManager.getUsers();
  if (users[userId]) {
    delete users[userId];
    userManager.saveUsers();
  }
  
  // Удаляем пользователя из всех игр
  const games = gameManager.getGames();
  Object.keys(games).forEach(gameId => {
    const game = games[gameId];
    if (game.participants && game.participants.includes(userId)) {
      game.participants = game.participants.filter(id => id !== userId);
      if (game.participantData && game.participantData[userId]) {
        delete game.participantData[userId];
      }
      if (game.answers && game.answers[userId]) {
        delete game.answers[userId];
      }
      if (game.votes && game.votes[userId]) {
        delete game.votes[userId];
      }
      gameManager.setGame(gameId, game);
    }
  });
  
  // Отправляем сообщение о сбросе
  await ctx.reply('Ваши данные сброшены. Используйте /start для начала работы с ботом.');
});