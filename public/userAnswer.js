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

// Отправка ответа на вопрос
async function submitAnswer() {
  // Получаем текст ответа
  const answerInput = document.getElementById('answerInput');
  if (!answerInput) {
    showNotification('Ошибка: поле для ввода ответа не найдено', 'error');
    return;
  }
  
  const answer = answerInput.value.trim();
  if (answer.length < 2) {
    showNotification('Ответ должен содержать минимум 2 символа', 'warning');
    return;
  }
  
  // Проверяем, что есть информация о текущей игре и пользователе
  if (!window.currentGame || !window.currentGame.id) {
    showNotification('Ошибка: информация об игре отсутствует', 'error');
    return;
  }
  
  if (!window.currentUser || !window.currentUser.id) {
    showNotification('Ошибка: информация о пользователе отсутствует', 'error');
    return;
  }
  
  try {
    console.log(`Отправка ответа: ${answer}`);
    
    // Отключаем кнопку отправки на время запроса
    const submitBtn = document.getElementById('submitAnswerBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Отправка...';
    }
    
    // Проверка наличия API_URL
    const apiUrl = window.API_URL || '';
    console.log(`Используемый API_URL: ${apiUrl}`);
    
    const response = await fetch(`${apiUrl}/api/games/${window.currentGame.id}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: window.currentUser.id,
        answer: answer,
        username: window.currentUser.name,
        anonymous: window.currentUser.anonymous || false // Учитываем анонимный режим
      })
    });
    
    // Восстанавливаем кнопку
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Отправить ответ';
    }
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Ошибка при отправке ответа: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Ответ успешно отправлен:', result);
    
    // Сохраняем ответ пользователя в текущей игре
    window.currentGame.userAnswer = answer;
    
    // Показываем уведомление об успехе
    showNotification('Ваш ответ успешно отправлен!', 'success');
    
    // Возвращаемся к экрану комнаты
    showScreen('roomScreen');
    
    // Обновляем отображение ответа пользователя в комнате
    const userAnswerDisplay = document.getElementById('userAnswerDisplay');
    if (userAnswerDisplay) {
      userAnswerDisplay.style.display = 'block';
      userAnswerDisplay.innerHTML = `
        <div class="user-answer-box">
          <p style="color: #2a9d8f; font-weight: bold; margin-bottom: 10px;">Ваш ответ принят!</p>
          <p style="color: #5a2d0c; font-style: italic;">"${answer}"</p>
          <p style="margin-top: 10px; color: #457b9d;">Ожидайте начала голосования.</p>
        </div>
      `;
    }
    
    // Скрываем кнопку ответа
    const answerButton = document.getElementById('answerButton');
    if (answerButton) {
      answerButton.style.display = 'none';
    }
    
    // Обновляем счетчик ответов
    const roomAnswersCount = document.getElementById('roomAnswersCount');
    if (roomAnswersCount && result.answersCount) {
      roomAnswersCount.textContent = result.answersCount;
    }
    
    // Обновляем информацию о комнате
    if (typeof window.updateRoomInfo === 'function') {
      window.updateRoomInfo();
    }
    
  } catch (error) {
    console.error('Ошибка при отправке ответа:', error);
    showNotification(`Ошибка: ${error.message}`, 'error');
  }
}

// При загрузке страницы добавляем обработчик для кнопки отправки ответа
document.addEventListener('DOMContentLoaded', function() {
  const submitAnswerBtn = document.getElementById('submitAnswerBtn');
  if (submitAnswerBtn) {
    submitAnswerBtn.addEventListener('click', submitAnswer);
    console.log('Обработчик для кнопки отправки ответа добавлен');
  } else {
    console.warn('Кнопка submitAnswerBtn не найдена!');
  }
  
  // Проверим и исправим обработчик кнопки ответа
  const answerButton = document.getElementById('answerButton');
  if (answerButton && !answerButton.hasAttribute('data-has-handler')) {
    answerButton.addEventListener('click', function() {
      console.log('Нажата кнопка "Ответить на вопрос"');
      if (window.currentGame && window.currentGame.currentQuestion) {
        showAnswerScreen(window.currentGame.currentQuestion);
      } else {
        showNotification('Ошибка: вопрос не найден', 'error');
      }
    });
    answerButton.setAttribute('data-has-handler', 'true');
    console.log('Обработчик для кнопки "Ответить на вопрос" добавлен');
  }
});

// Обработчик события кнопки ответа
document.addEventListener('DOMContentLoaded', () => {
    console.log("Инициализация обработчиков userAnswer.js");
    
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
            showScreen('roomScreen');
        });
    } else {
        console.warn("Кнопка backToMainFromAnswerBtn не найдена!");
    }
}); 