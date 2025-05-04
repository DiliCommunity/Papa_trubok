const { Scenes, Markup } = require('telegraf');
const userManager = require('../userManager');

const nameScene = new Scenes.BaseScene('name_scene');
nameScene.enter((ctx) => {
  ctx.reply('Введите ваше прикольное имя для игры (например: КосмоЖираф, ЧокнутыйПончик и т.д.)');
});

nameScene.on('text', (ctx) => {
  const funnyName = ctx.message.text.trim();
  if (!funnyName || funnyName.length < 3) {
    return ctx.reply('Пожалуйста, введите имя длиной не менее 3 символов.');
  }
  if (funnyName.length > 20) {
    return ctx.reply('Имя слишком длинное. Пожалуйста, сократите его до 20 символов.');
  }
  userManager.setUser(ctx.from.id, { funnyName });
  ctx.reply(
    `Имя принято: ${funnyName}\nТеперь вы можете присоединиться к игре или создать новую.`,
    Markup.inlineKeyboard([
      [Markup.button.callback('🎮 Создать игру', 'create_new_game')],
      [Markup.button.callback('🎲 Присоединиться к игре', 'join_game')]
    ])
  );
  return ctx.scene.leave();
});

module.exports = nameScene; 