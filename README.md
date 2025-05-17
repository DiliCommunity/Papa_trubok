# Papa Trubok 🎲

## Описание проекта
Papa Trubok - интерактивная игра с механикой голосования и анонимных ответов на вопросы.

## Технологии
- Node.js
- Express.js
- Socket.IO
- Telegram Web App API

## Установка
1. Клонируйте репозиторий
2. Установите зависимости: `npm install`
3. Запустите сервер: `npm start`

## Переменные окружения
- `PORT`: Порт для запуска сервера (по умолчанию 3001)
- `TELEGRAM_BOT_TOKEN`: Токен вашего Telegram бота
- `TELEGRAM_BOT_USERNAME`: Имя пользователя бота

## Структура проекта
```
papa-trubok/
├── src/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   └── middleware/
├── public/
│   ├── css/
│   └── js/
├── server.js
└── package.json
```

## Лицензия
ISC
