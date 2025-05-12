const express = require('express');
const router = express.Router();
const gameLogic = require('../gameLogic');
const shortid = require('shortid');

// Получение всех доступных игр
router.get('/', (req, res) => {
    try {
        const games = gameLogic.getAllGames();
        res.json(games);
    } catch (error) {
        console.error('Ошибка при получении списка игр:', error);
        res.status(500).json({ error: 'Ошибка сервера при получении списка игр' });
    }
});

// Создание новой игры
router.post('/', async (req, res) => {
    try {
        const { question, userId, userName } = req.body;
        
        if (!question || !userId || !userName) {
            return res.status(400).json({ error: 'Отсутствуют обязательные параметры' });
        }
        
        // Создаем новую игру
        const gameId = shortid.generate();
        const newGame = {
            id: gameId,
            status: 'collecting_answers',
            currentQuestion: question,
            creator: {
                id: userId,
                name: userName
            },
            participants: [{ 
                id: userId, 
                name: userName 
            }],
            answers: [],
            votes: [],
            results: [],
            createdAt: Date.now()
        };
        
        // Добавляем игру в массив
        gameLogic.addGame(newGame);
        
        // Сохраняем в JSON
        gameLogic.writeGames();
        
        // Оповещаем всех клиентов о новой игре
        if (req.app.io) {
            req.app.io.emit('gameUpdate', { type: 'gameCreated', gameId });
        }
        
        // Отправляем ID созданной игры
        res.status(201).json({ gameId });
    } catch (error) {
        console.error('Ошибка при создании игры:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Получение информации о конкретной игре
router.get('/:gameId', (req, res) => {
    try {
        const { gameId } = req.params;
        const { userId } = req.query;
        
        const game = gameLogic.getGame(gameId);
        
        if (!game) {
            return res.status(404).json({ error: 'Игра не найдена' });
        }
        
        // Дополнительная информация, является ли пользователь создателем
        const response = { 
            ...game,
            isCreator: game.creator.id === userId
        };
        
        res.json(response);
    } catch (error) {
        console.error('Ошибка при получении информации об игре:', error);
        res.status(500).json({ error: 'Ошибка сервера при получении информации об игре' });
    }
});

// Запуск игры (переход из статуса "waiting" в "collecting_answers")
router.post('/:gameId/start', (req, res) => {
    try {
        const { gameId } = req.params;
        const { creatorId } = req.body;
        
        if (!creatorId) {
            return res.status(400).json({ error: 'Требуется ID создателя' });
        }
        
        const game = gameLogic.startGame(gameId, creatorId);
        
        // Оповещаем всех участников о начале игры
        req.app.io.to(gameId).emit('gameUpdate', game);
        
        res.json(game);
    } catch (error) {
        console.error('Ошибка при запуске игры:', error);
        res.status(500).json({ error: error.message || 'Ошибка сервера при запуске игры' });
    }
});

// Установка вопроса для игры
router.post('/:gameId/question', (req, res) => {
    try {
        const { gameId } = req.params;
        const { creatorId, question } = req.body;
        
        if (!creatorId || !question) {
            return res.status(400).json({ error: 'Требуется ID создателя и вопрос' });
        }
        
        const game = gameLogic.setQuestion(gameId, creatorId, question);
        
        // Оповещаем всех участников о новом вопросе
        req.app.io.to(gameId).emit('gameUpdate', game);
        
        res.json(game);
    } catch (error) {
        console.error('Ошибка при установке вопроса:', error);
        res.status(500).json({ error: error.message || 'Ошибка сервера при установке вопроса' });
    }
});

// Отправка ответа на вопрос
router.post('/:gameId/answer', (req, res) => {
    try {
        const { gameId } = req.params;
        const { userId, answer, anonymous } = req.body;
        
        if (!userId || !answer) {
            return res.status(400).json({ error: 'Требуется ID пользователя и ответ' });
        }
        
        const game = gameLogic.submitAnswer(gameId, userId, answer, anonymous);
        
        // Оповещаем всех участников о новом ответе
        req.app.io.to(gameId).emit('newAnswer', {
            gameId,
            answers: game.answers.length
        });
        
        res.json(game);
    } catch (error) {
        console.error('Ошибка при отправке ответа:', error);
        res.status(500).json({ error: error.message || 'Ошибка сервера при отправке ответа' });
    }
});

// Начало голосования
router.post('/:gameId/start-voting', (req, res) => {
    try {
        const { gameId } = req.params;
        const { creatorId } = req.body;
        
        if (!creatorId) {
            return res.status(400).json({ error: 'Требуется ID создателя' });
        }
        
        const game = gameLogic.startVoting(gameId, creatorId);
        
        // Оповещаем всех участников о начале голосования
        req.app.io.to(gameId).emit('votingStarted', {
            gameId,
            answers: game.answers
        });
        
        res.json(game);
    } catch (error) {
        console.error('Ошибка при запуске голосования:', error);
        res.status(500).json({ error: error.message || 'Ошибка сервера при запуске голосования' });
    }
});

// Получение вариантов для голосования
router.get('/:gameId/voting-options', (req, res) => {
    try {
        const { gameId } = req.params;
        const { userId } = req.query;
        
        if (!userId) {
            return res.status(400).json({ error: 'Требуется ID пользователя' });
        }
        
        const game = gameLogic.getGame(gameId);
        
        if (!game) {
            return res.status(404).json({ error: 'Игра не найдена' });
        }
        
        if (game.status !== 'voting') {
            return res.status(400).json({ error: 'В данный момент голосование не проводится' });
        }
        
        // Проверяем, голосовал ли уже пользователь
        const hasVoted = game.votes.some(vote => vote.userId === userId);
        
        res.json({
            answers: game.answers,
            hasVoted
        });
    } catch (error) {
        console.error('Ошибка при получении вариантов для голосования:', error);
        res.status(500).json({ error: 'Ошибка сервера при получении вариантов для голосования' });
    }
});

// Отправка голоса
router.post('/:gameId/vote', (req, res) => {
    try {
        const { gameId } = req.params;
        const { userId, answerId } = req.body;
        
        if (!userId || !answerId) {
            return res.status(400).json({ error: 'Требуется ID пользователя и ID ответа' });
        }
        
        const game = gameLogic.submitVote(gameId, userId, answerId);
        
        // Оповещаем всех участников о новом голосе
        req.app.io.to(gameId).emit('votingUpdate', {
            gameId,
            votes: game.votes
        });
        
        // Если все проголосовали, оповещаем о результатах
        if (game.status === 'results') {
            req.app.io.to(gameId).emit('gameResults', {
                gameId,
                results: game.results
            });
        }
        
        res.json(game);
    } catch (error) {
        console.error('Ошибка при отправке голоса:', error);
        res.status(500).json({ error: error.message || 'Ошибка сервера при отправке голоса' });
    }
});

// Получение результатов
router.get('/:gameId/results', (req, res) => {
    try {
        const { gameId } = req.params;
        
        const game = gameLogic.getGame(gameId);
        
        if (!game) {
            return res.status(404).json({ error: 'Игра не найдена' });
        }
        
        if (game.status !== 'results') {
            return res.status(400).json({ error: 'Результаты еще не доступны' });
        }
        
        res.json({
            results: game.results
        });
    } catch (error) {
        console.error('Ошибка при получении результатов:', error);
        res.status(500).json({ error: 'Ошибка сервера при получении результатов' });
    }
});

// Получение статуса игры
router.get('/:gameId/status', (req, res) => {
    try {
        const { gameId } = req.params;
        
        const game = gameLogic.getGame(gameId);
        
        if (!game) {
            return res.status(404).json({ error: 'Игра не найдена' });
        }
        
        res.json({
            status: game.status
        });
    } catch (error) {
        console.error('Ошибка при получении статуса игры:', error);
        res.status(500).json({ error: 'Ошибка сервера при получении статуса игры' });
    }
});

// Проверка, ответил ли пользователь на вопрос
router.get('/:gameId/check-answer', (req, res) => {
    try {
        const { gameId } = req.params;
        const { userId } = req.query;
        
        if (!userId) {
            return res.status(400).json({ error: 'Требуется ID пользователя' });
        }
        
        const game = gameLogic.getGame(gameId);
        
        if (!game) {
            return res.status(404).json({ error: 'Игра не найдена' });
        }
        
        const hasAnswered = game.answers.some(answer => answer.userId === userId);
        
        res.json({
            hasAnswered
        });
    } catch (error) {
        console.error('Ошибка при проверке ответа:', error);
        res.status(500).json({ error: 'Ошибка сервера при проверке ответа' });
    }
});

module.exports = router; 