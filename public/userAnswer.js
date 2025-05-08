// Функция для отображения экрана отправки ответа
function showAnswerScreen(question) {
  const answerQuestionText = document.getElementById('answerQuestionText');
  if (answerQuestionText) {
    answerQuestionText.textContent = question || '';
  }
  
  // Очищаем поле ввода перед показом
  const answerInput = document.getElementById('answerInput');
  if (answerInput) {
    answerInput.value = '';
  }
  
  showScreen('answerScreen');
}

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
                anonymous: false // Всегда устанавливаем анонимность в false, так как эта функция удалена
            })
        });

        if (!response.ok) {
            throw new Error('Ошибка при отправке ответа');
        }

        const data = await response.json();
        
        // Сохраняем ответ пользователя в currentGame
        currentGame.userAnswer = answer;
        
        showNotification('Ваш ответ успешно отправлен! Ожидайте голосования.', 'success');
        answerInput.value = '';
        
        // Возвращаемся в комнату игры
        showScreen('gameScreen');
        joinGameRoom(currentGame.id);
    } catch (error) {
        console.error('Ошибка при отправке ответа:', error);
        showNotification('Произошла ошибка при отправке ответа', 'error');
    }
}

// Обработчик события кнопки ответа
document.addEventListener('DOMContentLoaded', () => {
    const submitAnswerBtn = document.getElementById('submitAnswerBtn');
    if (submitAnswerBtn) {
        submitAnswerBtn.addEventListener('click', submitAnswer);
    }
    
    // Обработчик нажатия Enter в поле ввода ответа
    const answerInput = document.getElementById('answerInput');
    if (answerInput) {
        answerInput.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                submitAnswer();
            }
        });
    }
    
    // Обработчик кнопки возврата
    const backFromAnswerBtn = document.getElementById('backFromAnswerBtn');
    if (backFromAnswerBtn) {
        backFromAnswerBtn.addEventListener('click', () => {
            showScreen('gameScreen');
        });
    }
}); 