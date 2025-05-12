const { v4: uuidv4 } = require('uuid');
const shortid = require('shortid');
const fs = require('fs');

class GameLogic {
    constructor() {
        this.games = new Map();
    }

    createGame(creatorId, creatorName) {
        const gameId = uuidv4();
        const game = {
            id: gameId,
            creator: {
                id: creatorId,
                name: creatorName
            },
            status: 'waiting', // waiting, collecting_answers, voting, results
            participants: [],
            currentQuestion: null,
            answers: [],
            votes: [],
            createdAt: new Date().toISOString(),
            settings: {
                maxPlayers: 10,
                minAnswersToStartVoting: 3,
                votingDuration: 300, // 5 минут в секундах
                isAnonymous: false
            }
        };

        this.games.set(gameId, game);
        return game;
    }

    addGame(game) {
        if (!game || !game.id) {
            throw new Error('Некорректные данные игры');
        }
        this.games.set(game.id, game);
        return game;
    }

    writeGames() {
        try {
            const gamesArray = Array.from(this.games.values());
            fs.writeFileSync('games.json', JSON.stringify(gamesArray, null, 2), 'utf8');
            console.log(`Сохранено ${gamesArray.length} игр в games.json`);
        } catch (error) {
            console.error('Ошибка при сохранении игр в JSON:', error);
        }
    }

    joinGame(gameId, userId, userName) {
        const game = this.games.get(gameId);
        if (!game) {
            throw new Error('Игра не найдена');
        }

        if (game.status !== 'waiting') {
            throw new Error('Нельзя присоединиться к игре в процессе');
        }

        if (game.participants.length >= game.settings.maxPlayers) {
            throw new Error('Комната заполнена');
        }

        if (game.participants.some(p => p.id === userId)) {
            throw new Error('Вы уже в этой игре');
        }

        game.participants.push({
            id: userId,
            name: userName,
            joinedAt: new Date().toISOString()
        });

        return game;
    }

    startGame(gameId, creatorId) {
        const game = this.games.get(gameId);
        if (!game) {
            throw new Error('Игра не найдена');
        }

        if (game.creator.id !== creatorId) {
            throw new Error('Только создатель может начать игру');
        }

        if (game.status !== 'waiting') {
            throw new Error('Игра уже начата');
        }

        if (game.participants.length < 2) {
            throw new Error('Нужно минимум 2 игрока для начала игры');
        }

        game.status = 'collecting_answers';
        return game;
    }

    setQuestion(gameId, creatorId, question) {
        const game = this.games.get(gameId);
        if (!game) {
            throw new Error('Игра не найдена');
        }

        if (game.creator.id !== creatorId) {
            throw new Error('Только создатель может задать вопрос');
        }

        if (game.status !== 'collecting_answers') {
            throw new Error('Нельзя задать вопрос в текущем статусе игры');
        }

        game.currentQuestion = question;
        return game;
    }

    submitAnswer(gameId, userId, answer, anonymous = false) {
        const game = this.games.get(gameId);
        
        if (!game) {
            throw new Error('Игра не найдена');
        }
        
        if (game.status !== 'collecting_answers') {
            throw new Error('В данный момент нельзя отправлять ответы');
        }
        
        // Проверяем, не ответил ли уже пользователь
        const existingAnswer = game.answers.find(a => a.userId === userId);
        if (existingAnswer) {
            throw new Error('Вы уже ответили на этот вопрос');
        }
        
        // Добавляем ответ
        const participant = game.participants.find(p => p.id === userId);
        if (!participant) {
            throw new Error('Вы не являетесь участником этой игры');
        }
        
        game.answers.push({
            id: shortid.generate(),
            userId: userId,
            userName: participant.name,
            text: answer,
            anonymous: anonymous,
            timestamp: Date.now()
        });
        
        // Сохраняем изменения
        this.writeGames();
        
        // Если собрано 10 ответов, автоматически начинаем голосование
        if (game.answers.length >= 10) {
            try {
                this.startVoting(gameId, game.creator.id);
            } catch (error) {
                console.error('Ошибка при автоматическом запуске голосования:', error);
            }
        }
        
        return game;
    }

    startVoting(gameId, userId) {
        const game = this.games.get(gameId);
        
        if (!game) {
            throw new Error('Игра не найдена');
        }
        
        if (game.status !== 'collecting_answers') {
            throw new Error('Игра не находится в фазе сбора ответов');
        }
        
        if (game.creator.id !== userId) {
            throw new Error('Только создатель игры может запустить голосование');
        }
        
        if (game.answers.length < 3) {
            throw new Error('Для начала голосования нужно минимум 3 ответа');
        }
        
        // Меняем статус игры на голосование
        game.status = 'voting';
        game.votingStartedAt = Date.now();
        
        // Сохраняем изменения
        this.writeGames();
        
        return game;
    }

    submitVote(gameId, userId, answerId) {
        const game = this.games.get(gameId);
        if (!game) {
            throw new Error('Игра не найдена');
        }

        if (game.status !== 'voting') {
            throw new Error('Сейчас нельзя голосовать');
        }

        const player = game.participants.find(p => p.id === userId);
        if (!player) {
            throw new Error('Вы не участвуете в этой игре');
        }

        // Проверяем, не голосовал ли уже игрок
        if (game.votes.some(v => v.userId === userId)) {
            throw new Error('Вы уже проголосовали');
        }

        // Проверяем существование ответа
        const answer = game.answers.find(a => a.id === answerId);
        if (!answer) {
            throw new Error('Ответ не найден');
        }

        game.votes.push({
            userId,
            answerId,
            votedAt: new Date().toISOString()
        });

        // Проверяем, все ли проголосовали
        if (game.votes.length === game.participants.length) {
            this.calculateResults(gameId);
        }

        return game;
    }

    calculateResults(gameId) {
        const game = this.games.get(gameId);
        if (!game) {
            throw new Error('Игра не найдена');
        }

        // Подсчитываем голоса для каждого ответа
        const voteCounts = new Map();
        game.votes.forEach(vote => {
            const count = voteCounts.get(vote.answerId) || 0;
            voteCounts.set(vote.answerId, count + 1);
        });

        // Сортируем ответы по количеству голосов
        const results = game.answers.map(answer => ({
            ...answer,
            votes: voteCounts.get(answer.id) || 0
        })).sort((a, b) => b.votes - a.votes);

        game.results = results;
        game.status = 'results';
        return game;
    }

    getGame(gameId) {
        return this.games.get(gameId);
    }

    getAllGames() {
        return Array.from(this.games.values());
    }

    deleteGame(gameId) {
        return this.games.delete(gameId);
    }

    // Проверка, ответил ли пользователь на вопрос
    hasUserAnswered(gameId, userId) {
        const game = this.games.get(gameId);
        
        if (!game) {
            throw new Error('Игра не найдена');
        }
        
        return game.answers.some(a => a.userId === userId);
    }

    // Получение ответа пользователя
    getUserAnswer(gameId, userId) {
        const game = this.games.get(gameId);
        
        if (!game) {
            throw new Error('Игра не найдена');
        }
        
        const answer = game.answers.find(a => a.userId === userId);
        return answer ? answer.text : null;
    }

    // Загрузка всех игр из JSON
    loadGames() {
        try {
            const data = fs.readFileSync('games.json', 'utf8');
            const games = JSON.parse(data);
            
            // Преобразуем массив в Map
            this.games.clear();
            games.forEach(game => {
                this.games.set(game.id, game);
            });
            
            console.log(`Загружено ${this.games.size} игр из games.json`);
        } catch (error) {
            console.error('Ошибка при загрузке игр из JSON:', error);
            // Если файл не существует или имеет неверный формат, создаем новый
            this.writeGames();
        }
    }
}

module.exports = new GameLogic(); 