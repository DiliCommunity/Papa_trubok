const { Scenes, Markup } = require('telegraf');
const gameManager = require('../gameManager');
const userManager = require('../userManager');

const answerScene = new Scenes.BaseScene('answer_scene');

// Добавляем вспомогательную функцию для стилизованных сообщений
function createStyledMessage(title, content, emoji = '📝') {
  return `<b>🔸🔹🔸 ${emoji} ${title} ${emoji} 🔸🔹🔸</b>\n\n${content}`;
}

// Константа для максимального количества ответов
const MAX_ANSWERS = 10;

answerScene.enter((ctx) => {
  console.log('Вошли в сцену ответа с данными:', ctx.scene.state); // Для отладки
  
  // Проверяем, есть ли gameId в контексте сцены или в session
  const gameId = ctx.scene.state?.gameId || ctx.session?.gameId;
  
  if (!gameId) {
    console.error('Ошибка: gameId не найден в контексте сцены или сессии'); // Для отладки
    ctx.reply(
      createStyledMessage('ОШИБКА', 'Не удалось получить информацию об игре. Попробуйте еще раз.', '❌'),
      { 
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🚀 Вернуться в меню', 'start_game')]
        ])
      }
    );
    return ctx.scene.leave();
  }

  // Сохраняем gameId в сессии для безопасности
  if (!ctx.session) ctx.session = {};
  ctx.session.gameId = gameId;
  
  // Получаем данные игры
  const games = gameManager.getGames();
  const game = games[gameId];
  
  if (!game) {
    console.error('Ошибка: игра не найдена с ID:', gameId); // Для отладки
    ctx.reply(
      createStyledMessage('ОШИБКА', 'Игра не найдена. Возможно, она была удалена.', '❌'),
      { 
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🚀 Вернуться в меню', 'start_game')]
        ])
      }
    );
    return ctx.scene.leave();
  }

  // Запрашиваем ответ на вопрос
  ctx.reply(
    createStyledMessage('ВВЕДИТЕ ОТВЕТ', 
      `<b>Вопрос:</b> "${game.currentQuestion}"\n\n` +
      `Введите ваш смешной ответ:`, '✏️'),
    { 
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[Markup.button.callback('Отмена', 'cancel_answer')]])
    }
  );
});

answerScene.action('cancel_answer', (ctx) => {
  ctx.reply('Ввод ответа отменен');
  return ctx.scene.leave();
});

answerScene.on('text', (ctx) => {
  const answer = ctx.message.text;
  // Получаем gameId из сцены или сессии (для страховки)
  const gameId = ctx.scene.state?.gameId || ctx.session?.gameId;
  
  if (!gameId) {
    console.error('Ошибка: gameId не найден при обработке ответа'); // Для отладки
    ctx.reply(
      createStyledMessage('ОШИБКА', 'Информация об игре потеряна. Пожалуйста, вернитесь в меню.', '❌'),
      { 
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🚀 Вернуться в меню', 'start_game')]
        ])
      }
    );
    return ctx.scene.leave();
  }
  
  const games = gameManager.getGames();
  
  if (!games[gameId]) {
    ctx.reply(
      createStyledMessage('ОШИБКА', 'Игра не найдена или была удалена.', '❌'),
      { 
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🚀 Вернуться в меню', 'start_game')]
        ])
      }
    );
    return ctx.scene.leave();
  }
  
  const game = games[gameId];
  const userId = ctx.from.id;
  const users = userManager.getUsers();
  const funnyName = users[userId]?.funnyName || 'Неизвестный';
  
  // Инициализируем объект answers, если его нет
  if (!game.answers) game.answers = {};
  
  // Сохраняем ответ
  game.answers[userId] = {
    text: answer,
    username: funnyName,
    timestamp: new Date().toISOString()
  };
  
  // Меняем статус игры на collecting_answers, если был waiting_players
  if (game.status === 'waiting_players') {
    game.status = 'collecting_answers';
  }
  
  // Сохраняем обновленную игру
  gameManager.setGame(gameId, game);
  
  // Считаем количество ответов
  const answersCount = Object.keys(game.answers).length;
  
  // Сообщение игроку об успешном сохранении ответа
  ctx.reply(
    createStyledMessage('ОТВЕТ ПРИНЯТ', 
      `Ваш ответ: "${answer}" успешно принят!\n\n` +
      `<b>Всего ответов:</b> ${answersCount}/${MAX_ANSWERS}\n\n` +
      `Ожидайте начала голосования.`, '✅'),
    { parse_mode: 'HTML' }
  );
  
  // Уведомление создателю игры (если отвечает не он сам)
  if (userId !== game.initiator) {
    ctx.telegram.sendMessage(
      game.initiator,
      createStyledMessage('НОВЫЙ ОТВЕТ', 
        `Игрок ${funnyName} ответил на вопрос!\n\n` +
        `<b>Всего ответов:</b> ${answersCount}/${MAX_ANSWERS}\n\n` +
        `${MAX_ANSWERS - answersCount > 0 ? `Осталось получить: ${MAX_ANSWERS - answersCount} ответов` : 'Все игроки ответили!'}`, '📝'),
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🗳️ Начать голосование', `start_voting_${gameId}`)]
        ])
      }
    );
  }
  
  // Если получены все возможные ответы, предлагаем начать голосование
  if (answersCount >= MAX_ANSWERS) {
    ctx.telegram.sendMessage(
      game.initiator,
      createStyledMessage('ВСЕ ОТВЕТЫ ПОЛУЧЕНЫ', 
        `Все ${MAX_ANSWERS} игроков ответили на вопрос!\n\n` +
        `Вы можете начать голосование.`, '🎉'),
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🗳️ Начать голосование', `start_voting_${gameId}`)]
        ])
      }
    );
  }
  
  return ctx.scene.leave();
});

module.exports = answerScene;