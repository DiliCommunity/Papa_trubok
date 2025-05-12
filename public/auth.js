// auth.js - Функции для авторизации и управления пользователями

// Глобальная переменная для хранения информации об аутентифицированном пользователе
let authUser = null;

// Константы для методов аутентификации
const AUTH_METHODS = {
    TELEGRAM: 'telegram',
    GOOGLE: 'google',
    NONE: 'none'
};

// Инициализация системы аутентификации
document.addEventListener('DOMContentLoaded', function() {
    console.log('Инициализация системы аутентификации');
    
    // Проверяем сохраненные данные аутентификации
    checkSavedAuth();
    
    // Инициализируем обработчики кнопок авторизации
    initAuthButtons();
});

// Проверка сохраненной аутентификации
function checkSavedAuth() {
    try {
        const savedAuth = localStorage.getItem('papaTrubokAuth');
        if (savedAuth) {
            const authData = JSON.parse(savedAuth);
            if (validateAuthData(authData)) {
                console.log('Найдены сохраненные данные аутентификации:', authData.method);
                authUser = authData;
                completeAuth(authData);
                return true;
            }
        }
    } catch (error) {
        console.error('Ошибка при загрузке данных аутентификации:', error);
        clearAuth();
    }
    
    return false;
}

// Валидация данных аутентификации
function validateAuthData(authData) {
    return authData && 
           authData.userId && 
           authData.method && 
           (authData.expiresAt > Date.now() || authData.method === AUTH_METHODS.TELEGRAM);
}

// Инициализация обработчиков кнопок авторизации
function initAuthButtons() {
    // Telegram авторизация
    const telegramLoginBtn = document.getElementById('telegramLoginBtn');
    if (telegramLoginBtn) {
        telegramLoginBtn.addEventListener('click', function() {
            if (window.Telegram && window.Telegram.WebApp) {
                // Если мы внутри Telegram WebApp, используем данные оттуда
                handleTelegramAuth();
            } else {
                // Иначе показываем уведомление о необходимости использовать Telegram
                showNotification('Для входа через Telegram откройте приложение в Telegram', 'warning');
            }
        });
    }
    
    // Google авторизация через кнопку
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', function() {
            // Используем Google Identity Services для авторизации
            if (window.google && window.google.accounts) {
                window.google.accounts.id.prompt();
            } else {
                showNotification('Не удалось загрузить Google API. Попробуйте позже.', 'error');
            }
        });
    }
    
    // Кнопка пропуска авторизации
    const skipAuthBtn = document.getElementById('skipAuthBtn');
    if (skipAuthBtn) {
        skipAuthBtn.addEventListener('click', function() {
            // Создаем гостевую сессию
            const guestUser = {
                userId: 'guest_' + Date.now(),
                name: '',
                method: AUTH_METHODS.NONE,
                isGuest: true
            };
            
            completeAuth(guestUser);
            showNotification('Вы продолжили как гость', 'info');
        });
    }
}

// Обработка авторизации через Telegram
function handleTelegramAuth() {
    try {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
            console.log('Получены данные пользователя Telegram');
            
            const telegramUser = window.Telegram.WebApp.initDataUnsafe.user;
            const authData = {
                userId: telegramUser.id.toString(),
                username: telegramUser.username || '',
                firstName: telegramUser.first_name || '',
                lastName: telegramUser.last_name || '',
                name: formatTelegramName(telegramUser),
                photo: telegramUser.photo_url || '',
                method: AUTH_METHODS.TELEGRAM,
                authTime: Date.now()
            };
            
            // Регистрация пользователя на сервере
            registerUserWithServer(authData)
                .then(() => {
                    saveAuthData(authData);
                    completeAuth(authData);
                    showNotification('Вы успешно вошли через Telegram', 'success');
                })
                .catch(error => {
                    console.error('Ошибка при регистрации пользователя:', error);
                    showNotification('Не удалось завершить авторизацию', 'error');
                });
        } else {
            showNotification('Не удалось получить данные пользователя Telegram', 'error');
        }
    } catch (error) {
        console.error('Ошибка при авторизации через Telegram:', error);
        showNotification('Произошла ошибка при авторизации', 'error');
    }
}

// Форматирование имени пользователя Telegram
function formatTelegramName(user) {
    // Создаем базовое имя
    let name = '';
    if (user.username) {
        name = user.username;
    } else {
        name = user.first_name || '';
        if (user.last_name) {
            name += ' ' + user.last_name;
        }
    }
    
    name = name.trim() || 'Пользователь Telegram';
    
    // Добавляем уникальный идентификатор - последние 4 символа ID
    const userId = user.id.toString();
    const userIdSuffix = userId.slice(-4);
    
    // Проверяем, не содержит ли имя уже числовой суффикс в формате #XXXX
    const suffixRegex = /#\d{4}$/;
    if (!suffixRegex.test(name)) {
        name = `${name}#${userIdSuffix}`;
    }
    
    return name;
}

// Обработчик успешной авторизации через Google
function handleGoogleSignIn(response) {
    try {
        console.log('Получен ответ от Google Sign-In');
        
        // Декодируем JWT токен для получения информации о пользователе
        const payload = parseJwt(response.credential);
        
        if (payload && payload.sub) {
            const authData = {
                userId: 'google_' + payload.sub,
                email: payload.email || '',
                name: payload.name || '',
                firstName: payload.given_name || '',
                lastName: payload.family_name || '',
                photo: payload.picture || '',
                method: AUTH_METHODS.GOOGLE,
                authTime: Date.now(),
                expiresAt: Date.now() + (3600 * 1000) // Токен действителен 1 час
            };
            
            // Регистрация пользователя на сервере
            registerUserWithServer(authData)
                .then(() => {
                    saveAuthData(authData);
                    completeAuth(authData);
                    showNotification('Вы успешно вошли через Google', 'success');
                })
                .catch(error => {
                    console.error('Ошибка при регистрации пользователя:', error);
                    showNotification('Не удалось завершить авторизацию', 'error');
                });
        } else {
            showNotification('Не удалось получить данные пользователя Google', 'error');
        }
    } catch (error) {
        console.error('Ошибка при обработке Google Sign-In:', error);
        showNotification('Произошла ошибка при авторизации', 'error');
    }
}

// Парсинг JWT токена
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('Ошибка при парсинге JWT:', error);
        return null;
    }
}

// Сохранение данных аутентификации
function saveAuthData(authData) {
    try {
        localStorage.setItem('papaTrubokAuth', JSON.stringify(authData));
        console.log('Данные аутентификации сохранены');
    } catch (error) {
        console.error('Ошибка при сохранении данных аутентификации:', error);
    }
}

// Очистка данных аутентификации
function clearAuth() {
    try {
        localStorage.removeItem('papaTrubokAuth');
        authUser = null;
        console.log('Данные аутентификации очищены');
    } catch (error) {
        console.error('Ошибка при очистке данных аутентификации:', error);
    }
}

// Выход из аккаунта
function logout() {
    clearAuth();
    showNotification('Вы вышли из аккаунта', 'info');
    // Возвращаемся на экран авторизации
    showScreen('authScreen');
}

// Завершение процесса авторизации
function completeAuth(authData) {
    // Сохраняем данные авторизации глобально
    authUser = authData;
    
    // Заполняем данные текущего пользователя
    if (window.currentUser) {
        window.currentUser.id = authData.userId;
        if (authData.name) {
            window.currentUser.name = authData.name;
        }
    }
    
    // Обновляем интерфейс с учетом авторизации
    updateUIAfterAuth(authData);
    
    // Переходим к экрану с правилами игры вместо экрана ввода имени
    showScreen('startScreen');
}

// Обновление интерфейса после авторизации
function updateUIAfterAuth(authData) {
    // Добавляем информацию о пользователе в шапку (если нужно)
    const userInfoElement = document.getElementById('userInfo');
    if (userInfoElement) {
        let userInfoHTML = '';
        
        if (authData.isGuest) {
            userInfoHTML = '<span class="user-info-guest">Гостевой режим</span>';
        } else {
            userInfoHTML = `
                <div class="user-info-authenticated">
                    ${authData.photo ? `<img src="${authData.photo}" alt="Фото профиля" class="user-avatar">` : ''}
                    <span class="user-name">${authData.name || 'Пользователь'}</span>
                </div>
            `;
        }
        
        userInfoElement.innerHTML = userInfoHTML;
    }
}

// Регистрация пользователя на сервере
async function registerUserWithServer(authData) {
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: authData.userId,
                name: authData.name,
                method: authData.method,
                metadata: {
                    firstName: authData.firstName,
                    lastName: authData.lastName,
                    email: authData.email,
                    photo: authData.photo
                }
            })
        });
        
        if (!response.ok) {
            // Если ошибка 404, значит API для регистрации еще не реализовано, просто продолжаем
            if (response.status === 404) {
                console.warn('API для регистрации не реализовано, продолжаем без серверной регистрации');
                return;
            }
            
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Пользователь успешно зарегистрирован:', data);
    } catch (error) {
        console.error('Ошибка при регистрации пользователя:', error);
        // Пока API не реализовано, не прерываем процесс авторизации
        if (error.message && !error.message.includes('404')) {
            throw error;
        }
    }
} 