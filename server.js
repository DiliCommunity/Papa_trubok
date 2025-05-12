// Импортируем необходимые модули
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const gameLogic = require('./gameLogic');

// Импортируем маршрутизаторы
const gamesRouter = require('./routes/games');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Делаем io доступным для маршрутизаторов
app.io = io;

// Маршрут для проверки работоспособности сервера
app.get('/api/ping', (req, res) => {
  console.log('Получен запрос на /api/ping');
  res.json({ status: 'ok', message: 'Сервер работает', timestamp: new Date().toISOString() });
});

// Импортируем маршрутизаторы
app.use('/api/games', gamesRouter);

// Обработка сокет-соединений
io.on('connection', (socket) => {
    console.log('Новое соединение:', socket.id);
    
    // Присоединение к комнате игры
    socket.on('joinGame', (gameId) => {
        console.log(`Пользователь ${socket.id} присоединился к игре ${gameId}`);
        socket.join(gameId);
    });
    
    // Покидание комнаты игры
    socket.on('leaveGame', (gameId) => {
        console.log(`Пользователь ${socket.id} покинул игру ${gameId}`);
        socket.leave(gameId);
    });
    
    // Отключение
    socket.on('disconnect', () => {
        console.log('Пользователь отключился:', socket.id);
    });
});

// Аутентификация (упрощенная для примера)
app.post('/api/auth/login', (req, res) => {
    const { username } = req.body;
    
    if (!username || username.trim() === '') {
        return res.status(400).json({ error: 'Требуется имя пользователя' });
    }
    
    // Генерируем случайный ID для демонстрации
    const userId = Math.random().toString(36).substring(2, 15);
    
    res.cookie('userId', userId, { httpOnly: true });
    res.cookie('username', username, { httpOnly: true });
    
    res.json({
        success: true,
        user: {
            id: userId,
            name: username
        }
    });
});

app.get('/api/auth/check', (req, res) => {
    const userId = req.cookies.userId;
    const username = req.cookies.username;
    
    if (!userId || !username) {
        return res.json({ authenticated: false });
    }
    
    res.json({
        authenticated: true,
        user: {
            id: userId,
            name: username
        }
    });
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('userId');
    res.clearCookie('username');
    
    res.json({ success: true });
});

// Обработка корневого маршрута
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Страница для входа
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Маршрут для всех остальных запросов (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Загружаем игры при запуске
// gameLogic.loadGames();  // Закомментируем эту строку, так как метод не существует

// Запускаем сервер
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
}); 