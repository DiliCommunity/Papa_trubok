const { Scenes, Markup } = require('telegraf');
const gameManager = require('../gameManager');

// Добавляем константу и вспомогательную функцию
const MAX_ANSWERS = 10;

function createStyledMessage(title, content, emoji = '📝') {
  return `<b>🔸🔹🔸 ${emoji} ${title} ${emoji} 🔸🔹🔸</b>\n\n${content}`;
}

const customQuestionScene = new Scenes.BaseScene('custom_question_scene');

customQuestionScene.enter((ctx) => {
  ctx.reply(
    'Введите ваш собственный вопрос для участников игры:',
    Markup.inlineKeyboard([[Markup.button.callback('Отмена', 'cancel_custom_question')]])
  );
});

customQuestionScene.action('cancel_custom_question', (ctx) => {
  ctx.reply('Ввод вопроса отменен');
  return ctx.scene.leave();
});

customQuestionScene.on('text', async (ctx) => {
  const customQuestion = ctx.message.text;
  const gameId = ctx.scene.state?.gameId;
  
  console.log(`Получен вопрос: "${customQuestion}", gameId: ${gameId}`); // Для отладки
  
  const games = gameManager.getGames();
  
  if (!games[gameId]) {
    console.error(`Ошибка: игра с ID ${gameId} не найдена при создании вопроса`);
    return ctx.reply('Ошибка: игра не найдена', {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Назад в меню', 'start_game')]
      ])
    });
  }
  
  const game = games[gameId];
  console.log(`Игра найдена, статус: ${game.status}, инициатор: ${game.initiatorName}`);
  
  game.currentQuestion = customQuestion;
  game.question = customQuestion;
  game.isCustomQuestion = true;
  
  // ВАЖНО: оставляем статус 'waiting_players', чтобы другие могли присоединиться
  // НЕ МЕНЯЕМ game.status = 'collecting_answers';
  
  // Сохраняем обновленные данные игры
  gameManager.setGame(gameId, game);
  
  // Проверяем, что игра обновилась правильно
  const updatedGames = gameManager.getGames();
  console.log(`После обновления: игра ${gameId} имеет статус ${updatedGames[gameId]?.status} и вопрос "${updatedGames[gameId]?.currentQuestion}"`);
  
  // Отвечаем создателю
  ctx.reply(
    createStyledMessage('ВОПРОС СОЗДАН', 
      `Вы создали вопрос:\n\n"${customQuestion}"\n\n` +
      `Участников: ${game.participants.length}/${MAX_ANSWERS}\n\n` +
      `Ожидайте, пока другие игроки присоединятся к комнате.`, '✅'),
    { 
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✏️ Ответить на вопрос', `provide_answer_${gameId}`)],
        [Markup.button.callback('⏳ Ждать новых участников', `wait_for_answers_${gameId}`)]
      ])
    }
  );
  
  return ctx.scene.leave();
});

module.exports = customQuestionScene;