// Обновленная функция отправки ответа
async function submitAnswer() {
    if (!currentGame || !currentGame.id) {
        showNotification('Ошибка: игра не найдена', 'error');
        return;
    }

    const answerInput = document.getElementById('answerInput');
    const answer = answerInput.value.trim();

    if (!answer) {
        showNotification('Пожалуйста, введите ответ', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/games/${currentGame.id}/answer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.id,
                answer: answer,
                username: currentUser.name,
                anonymous: currentUser.anonymous
            })
        });

        if (!response.ok) {
            throw new Error('Ошибка при отправке ответа');
        }

        const data = await response.json();
        
        // Сохраняем ответ пользователя в currentGame
        if (!currentGame.userAnswer) {
            currentGame.userAnswer = answer;
        }
        
        showNotification('Ваш ответ успешно отправлен! Ожидайте голосования.', 'success');
        answerInput.value = '';
        
        // Возвращаемся в комнату игры и отображаем ответ пользователя
        joinGameRoom(currentGame.id);
    } catch (error) {
        console.error('Ошибка при отправке ответа:', error);
        showNotification('Произошла ошибка при отправке ответа', 'error');
    }
} 