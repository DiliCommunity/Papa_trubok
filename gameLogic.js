const { v4: uuidv4 } = require('uuid');

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

    submitAnswer(gameId, userId, answer, isAnonymous = false) {
        const game = this.games.get(gameId);
        if (!game) {
            throw new Error('Игра не найдена');
        }

        if (game.status !== 'collecting_answers') {
            throw new Error('Сейчас нельзя отправить ответ');
        }

        if (!game.currentQuestion) {
            throw new Error('Вопрос еще не задан');
        }

        const player = game.participants.find(p => p.id === userId);
        if (!player) {
            throw new Error('Вы не участвуете в этой игре');
        }

        // Проверяем, не ответил ли уже игрок
        if (game.answers.some(a => a.userId === userId)) {
            throw new Error('Вы уже отправили ответ');
        }

        game.answers.push({
            userId,
            userName: isAnonymous ? 'Аноним' : player.name,
            answer,
            submittedAt: new Date().toISOString(),
            isAnonymous
        });

        return game;
    }

    startVoting(gameId, creatorId) {
        const game = this.games.get(gameId);
        if (!game) {
            throw new Error('Игра не найдена');
        }

        if (game.creator.id !== creatorId) {
            throw new Error('Только создатель может начать голосование');
        }

        if (game.status !== 'collecting_answers') {
            throw new Error('Нельзя начать голосование в текущем статусе игры');
        }

        if (game.answers.length < game.settings.minAnswersToStartVoting) {
            throw new Error(`Нужно минимум ${game.settings.minAnswersToStartVoting} ответов для начала голосования`);
        }

        game.status = 'voting';
        game.votingStartedAt = new Date().toISOString();
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
}

module.exports = new GameLogic(); 