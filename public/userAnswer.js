// Функция для отображения экрана отправки ответа
function showAnswerScreen(question) {
  console.log("Показываем экран ответа на вопрос:", question);
  
  if (!question) {
    showNotification('Ошибка: вопрос не указан', 'error');
    return;
  }
  
  const answerQuestionText = document.getElementById('answerQuestionText');
  if (answerQuestionText) {
    answerQuestionText.textContent = question || '';
  }
  
  // Очищаем поле ввода перед показом
  const answerInput = document.getElementById('answerInput');
  if (answerInput) {
    answerInput.value = '';
    // Устанавливаем фокус на поле ввода
    setTimeout(() => {
      answerInput.focus();
    }, 300);
  }
  
  showScreen('answerScreen');
}

// Обновленная функция отправки ответа
async function submitAnswer() {
    console.log("Попытка отправки ответа");
    
    if (!currentGame || !currentGame.id) {
        console.error("Нет активной игры для отправки ответа");
        showNotification('Ошибка: игра не найдена', 'error');
        return;
    }

    console.log(`Отправляем ответ для игры ${currentGame.id}`);
    
    const answerInput = document.getElementById('answerInput');
    if (!answerInput) {
        console.error("Элемент ввода ответа не найден");
        showNotification('Ошибка: элемент ввода не найден', 'error');
        return;
    }
    
    const answer = answerInput.value.trim();
    if (!answer) {
        console.log("Пустой ответ");
        showNotification('Пожалуйста, введите ответ', 'warning');
        return;
    }

    try {
        console.log(`Отправляем ответ на сервер: "${answer}"`);
        
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
            const errorText = await response.text();
            console.error(`Ошибка HTTP: ${response.status}, ${errorText}`);
            throw new Error(`Ошибка при отправке ответа: ${response.status}`);
        }

        const data = await response.json();
        console.log("Ответ успешно отправлен, ответ сервера:", data);
        
        // Сохраняем ответ пользователя в currentGame
        currentGame.userAnswer = answer;
        
        showNotification('Ваш ответ успешно отправлен! Ожидайте голосования.', 'success');
        answerInput.value = '';
        
        // Возвращаемся в комнату игры
        showScreen('gameScreen');
        joinGameRoom(currentGame.id);
    } catch (error) {
        console.error('Ошибка при отправке ответа:', error);
        showNotification(`Произошла ошибка при отправке ответа: ${error.message}`, 'error');
    }
}

// Обработчик события кнопки ответа
document.addEventListener('DOMContentLoaded', () => {
    console.log("Инициализация обработчиков userAnswer.js");
    
    const submitAnswerBtn = document.getElementById('submitAnswerBtn');
    if (submitAnswerBtn) {
        console.log("Найдена кнопка submitAnswerBtn, добавляем обработчик");
        submitAnswerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("Нажата кнопка отправки ответа");
            submitAnswer();
        });
    } else {
        console.warn("Кнопка submitAnswerBtn не найдена!");
    }
    
    // Обработчик нажатия Enter в поле ввода ответа
    const answerInput = document.getElementById('answerInput');
    if (answerInput) {
        console.log("Найдено поле answerInput, добавляем обработчик Enter");
        answerInput.addEventListener('keyup', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                console.log("Нажат Enter в поле ответа");
                submitAnswer();
            }
        });
    } else {
        console.warn("Поле answerInput не найдено!");
    }
    
    // Обработчик кнопки возврата
    const backToMainFromAnswerBtn = document.getElementById('backToMainFromAnswerBtn');
    if (backToMainFromAnswerBtn) {
        console.log("Найдена кнопка backToMainFromAnswerBtn, добавляем обработчик");
        backToMainFromAnswerBtn.addEventListener('click', () => {
            console.log("Нажата кнопка возврата из экрана ответа");
            showScreen('gameScreen');
        });
    } else {
        console.warn("Кнопка backToMainFromAnswerBtn не найдена!");
    }
}); 