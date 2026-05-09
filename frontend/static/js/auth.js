// Конфигурация API
// При работе через Docker используем относительный путь (nginx проксирует /api/)
// При локальной разработке можно использовать 'http://localhost:8000/api'
const API_BASE_URL = '/api';

// Який інтерфейс показуємо після логіну: 'desktop' | 'mobile'.
// Зберігається в localStorage під ключем 'preferMobile' ('1' = мобільна).
function landingPage() {
    return localStorage.getItem('preferMobile') === '1' ? 'mobile.html' : 'dashboard.html';
}

function isMobileViewport() {
    return window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
}

// Проверка авторизации при загрузке
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (token) {
        window.location.href = landingPage();
        return;
    }

    // Инициализация формы входа
    const loginForm = document.getElementById('login-form');
    const loginBtn = document.getElementById('login-btn');
    const errorMessage = document.getElementById('error-message');

    // Инициализация кнопки показа пароля
    initPasswordToggle();
    initLoginModeSwitch();

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            showToast('Будь ласка, заповніть всі поля', 'error');
            return;
        }

        // Показываем загрузку
        loginBtn.disabled = true;
        loginBtn.querySelector('.btn-text').classList.add('hidden');
        loginBtn.querySelector('.btn-loader').classList.remove('hidden');
        errorMessage.classList.add('hidden');

        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Помилка входу');
            }

            const data = await response.json();

            // Сохраняем токен
            localStorage.setItem('token', data.access_token);

            window.location.href = landingPage();

        } catch (error) {
            console.error('Помилка входу:', error);
            showToast(error.message, 'error');
        } finally {
            // Убираем загрузку
            loginBtn.disabled = false;
            loginBtn.querySelector('.btn-text').classList.remove('hidden');
            loginBtn.querySelector('.btn-loader').classList.add('hidden');
        }
    });
});

function initLoginModeSwitch() {
    const desktopRadio = document.getElementById('login-mode-desktop');
    const mobileRadio = document.getElementById('login-mode-mobile');
    if (!desktopRadio || !mobileRadio) return;

    // Стартова позиція: збережений вибір, або автодетект мобільного
    const stored = localStorage.getItem('preferMobile');
    const wantMobile = stored === '1' || (stored === null && isMobileViewport());
    if (wantMobile) {
        mobileRadio.checked = true;
    } else {
        desktopRadio.checked = true;
    }

    const apply = () => {
        const useMobile = mobileRadio.checked;
        localStorage.setItem('preferMobile', useMobile ? '1' : '0');
    };
    desktopRadio.addEventListener('change', apply);
    mobileRadio.addEventListener('change', apply);
    // одразу зберігаємо стартовий вибір (автодетект)
    apply();
}

function initPasswordToggle() {
    const passwordInput = document.getElementById('password');
    const passwordToggle = document.getElementById('password-toggle');
    const eyeOpen = passwordToggle.querySelector('.eye-open');
    const eyeClosed = passwordToggle.querySelector('.eye-closed');

    passwordToggle.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);

        // Переключаем иконки
        if (type === 'text') {
            eyeOpen.classList.add('hidden');
            eyeClosed.classList.remove('hidden');
            passwordToggle.setAttribute('aria-label', 'Приховати пароль');
        } else {
            eyeOpen.classList.remove('hidden');
            eyeClosed.classList.add('hidden');
            passwordToggle.setAttribute('aria-label', 'Показати пароль');
        }
    });
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) {
        return;
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-title">${type === 'error' ? 'Помилка' : type === 'success' ? 'Успішно' : 'Повідомлення'}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
    `;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 200);
    }, 3200);
}

function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
