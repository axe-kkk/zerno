// ════════════════════════════════════════════════════════════════
// core.js — спільні утиліти, які використовуються в усіх розділах
// dashboard.js. Завантажується ПЕРЕД dashboard.js як classic-script;
// усі top-level `const`/`function` видимі для dashboard.js через
// єдиний script realm браузера.
// ════════════════════════════════════════════════════════════════


// ── API ──────────────────────────────────────────────────────────
// При работе через Docker используем относительный путь (nginx проксирует /api/)
// При локальной разработке можно использовать 'http://localhost:8000/api'
const API_BASE_URL = '/api';

function apiFetch(path, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        'Authorization': `Bearer ${token}`
    };

    return fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
        cache: 'no-store'
    });
}

function apiFetchBlob(path) {
    const token = localStorage.getItem('token');
    return fetch(`${API_BASE_URL}${path}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        },
        cache: 'no-store'
    });
}

/** Тригерить браузерне завантаження blob-відповіді як файлу. */
async function downloadBlob(response, filename) {
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}


// ── HTML / icons ─────────────────────────────────────────────────
// SVG Icons for table action buttons
const ICONS = {
    view: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
    delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
    cancel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
    operation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    activate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    renew: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
    balance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    adjust: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
    price: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    reserve: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>',
    pay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
    voucher: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h4M6 14h8"/><circle cx="18" cy="12" r="2"/></svg>',
};

function iconBtn(iconName, tooltip, cls = 'btn-icon-secondary') {
    return `<button class="btn-icon ${cls}" title="${tooltip}">${ICONS[iconName]}</button>`;
}

/** Текст мітки відсутніх даних (для <option> тощо, де HTML недоступний) */
const EMPTY_VALUE_UA = 'Пусто';

/** HTML-мітка «даних немає / не вказано» */
function emptyValueHtml() {
    return `<span class="empty-value" lang="uk">${EMPTY_VALUE_UA}</span>`;
}

function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}


// ── Notifications / form messages ────────────────────────────────
function setFormMessage(elementId, message, isError) {
    const target = document.getElementById(elementId);
    if (!target) {
        return;
    }
    target.textContent = message;
    target.classList.toggle('error', isError);
    target.classList.toggle('success', !isError);
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


// ── Formatting ───────────────────────────────────────────────────
function formatCurrency(amount, currency) {
    return new Intl.NumberFormat('uk-UA', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function formatAmount(amount) {
    return new Intl.NumberFormat('uk-UA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function formatWeight(value) {
    return new Intl.NumberFormat('uk-UA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

function formatDate(value) {
    const date = new Date(value);
    return date.toLocaleString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateOnly(value) {
    const date = new Date(value);
    return date.toLocaleDateString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

/** Календарна дата без часу (локально), для порівнянь */
function toLocalDateOnly(value) {
    const d = new Date(value);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function todayLocalDateOnly() {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function formatDateDisplay(isoDate) {
    const [year, month, day] = isoDate.split('-');
    return `${day}.${month}.${year}`;
}

function formatDateInput(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

function parseDateInput(value, label) {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(trimmed);
    if (!match) {
        showToast(`Некоректна ${label}. Формат: дд.мм.рррр`, 'error');
        return undefined;
    }
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    const date = new Date(year, month - 1, day);
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        showToast(`Некоректна ${label}. Перевірте дату`, 'error');
        return undefined;
    }
    const paddedMonth = String(month).padStart(2, '0');
    const paddedDay = String(day).padStart(2, '0');
    return `${year}-${paddedMonth}-${paddedDay}`;
}


// ── Tables / skeletons ───────────────────────────────────────────
/**
 * Заповнити tbody таблиці плейсхолдер-скелетонами під час першого завантаження.
 * Викликається лише до приходу даних: коли реальний рендер замінить tbody —
 * скелетони підуть разом з ним.
 */
function showTableSkeleton(tbody, columnCount, rows = 5) {
    if (!tbody || !columnCount) return;
    const widths = ['85%', '60%', '70%', '55%', '90%', '45%'];
    const cells = Array.from({ length: columnCount }, (_, i) =>
        `<td><span class="skeleton" style="width:${widths[i % widths.length]};"></span></td>`
    ).join('');
    tbody.innerHTML = Array(rows).fill(`<tr class="skeleton-row">${cells}</tr>`).join('');
}

/** Один прохід по всіх .data-table — заповнюємо їх скелетонами. */
function showAllTableSkeletons() {
    document.querySelectorAll('.data-table').forEach(table => {
        const tbody = table.querySelector('tbody');
        if (!tbody || tbody.children.length > 0) return;
        const colCount = table.querySelectorAll('thead th').length;
        if (colCount > 0) showTableSkeleton(tbody, colCount, 5);
    });
}


// ── Form validation UI helpers ───────────────────────────────────
function clearFormMessage(elementId) {
    const msg = document.getElementById(elementId);
    if (!msg) return;
    msg.textContent = '';
    msg.classList.remove('error', 'success');
}

/** formRoot: <form> або контейнер з полями */
function formClearFieldHighlights(formRoot) {
    if (!formRoot) return;
    const sel = '.form-field.has-field-error, .fc-payment-money__field.has-field-error, .fc-section.has-field-error, .fcp-section.has-field-error, tr.contract-item-row.has-field-error, .grain-pay-card.has-field-error';
    formRoot.querySelectorAll(sel).forEach(el => el.classList.remove('has-field-error'));
}

function formMarkFieldHighlights(formRoot, elementIds) {
    if (!formRoot || !elementIds || !elementIds.length) return;
    elementIds.forEach((id) => {
        const el = document.getElementById(id);
        if (!el || !formRoot.contains(el)) return;
        let wrap = el.closest('.form-field');
        if (!wrap) wrap = el.closest('.fc-payment-money__field');
        if (!wrap && el.matches?.('.fc-section, .fcp-section')) wrap = el;
        if (!wrap) wrap = el.closest('.fc-section') || el.closest('.fcp-section');
        if (!wrap) wrap = el.closest('.grain-pay-card');
        if (wrap) wrap.classList.add('has-field-error');
    });
}

function formBindInvalidHighlightClearing(formRoot) {
    if (!formRoot || formRoot.dataset.invalidHighlightClearBound) return;
    formRoot.dataset.invalidHighlightClearBound = '1';
    const onFieldChange = (e) => {
        const field = e.target?.closest?.('.form-field');
        if (field && formRoot.contains(field)) field.classList.remove('has-field-error');
        const pm = e.target?.closest?.('.fc-payment-money__field');
        if (pm && formRoot.contains(pm)) pm.classList.remove('has-field-error');
        const sec = e.target?.closest?.('.fc-section, .fcp-section');
        if (sec && formRoot.contains(sec)) sec.classList.remove('has-field-error');
        const row = e.target?.closest?.('tr.contract-item-row');
        if (row && formRoot.contains(row)) row.classList.remove('has-field-error');
        const card = e.target?.closest?.('.grain-pay-card');
        if (card && formRoot.contains(card)) card.classList.remove('has-field-error');
    };
    formRoot.addEventListener('input', onFieldChange, true);
    formRoot.addEventListener('change', onFieldChange, true);
}

function clearFormValidationState(formRoot, messageId) {
    formClearFieldHighlights(formRoot);
    if (messageId) clearFormMessage(messageId);
}

/**
 * Показати текст помилки біля кнопки та підсвітити поля (і додаткові елементи extraErrorHosts).
 * @param {HTMLElement} formRoot
 * @param {string|null} messageId
 * @param {string} message
 * @param {string[]} fieldIds
 * @param {HTMLElement[]} [extraErrorHosts]
 */
function formShowValidationError(formRoot, messageId, message, fieldIds = [], extraErrorHosts = []) {
    if (!formRoot) {
        if (messageId) setFormMessage(messageId, message, true);
        return;
    }
    formClearFieldHighlights(formRoot);
    if (messageId) setFormMessage(messageId, message, true);
    formMarkFieldHighlights(formRoot, fieldIds);
    (extraErrorHosts || []).forEach((host) => {
        if (host && formRoot.contains(host)) host.classList.add('has-field-error');
    });
    const firstId = fieldIds.length ? fieldIds[0] : null;
    const first = firstId ? document.getElementById(firstId) : null;
    if (first && formRoot.contains(first)) {
        first.focus();
    } else if (extraErrorHosts && extraErrorHosts[0] && formRoot.contains(extraErrorHosts[0])) {
        const focusable = extraErrorHosts[0].querySelector('input, select, textarea, button');
        focusable?.focus();
    }
}


// ── Період завантаження для журнальних таблиць ─────────────────
// Спільний патерн: вантажимо за останні N днів (default 90), показуємо
// підказку «Показано X карток за останні N дн.» + кнопка «Завантажити всю історію».
// Юзер може перемкнути в обидва боки одним кліком.
//
// Використання:
//   const period = createPeriodState(90);
//   ...
//   function loadXxx() {
//     const params = period.toQuery();
//     fetch(`/xxx${params}`).then(r => r.json()).then(rows => {
//       xxxCache = rows;
//       renderXxxTable(rows);
//       renderPeriodHint('xxx-period-hint', rows.length, period, loadXxx);
//     });
//   }
function createPeriodState(defaultDays) {
    let days = defaultDays;
    return {
        get days() { return days; },
        set days(v) { days = v; },
        toQuery() {
            if (!days || !Number.isFinite(days)) return '';
            const d = new Date();
            d.setDate(d.getDate() - days);
            return `?start_date=${d.toISOString().slice(0, 10)}`;
        },
        toQueryParams(extra) {
            const p = new URLSearchParams(extra || {});
            if (days && Number.isFinite(days)) {
                const d = new Date();
                d.setDate(d.getDate() - days);
                p.set('start_date', d.toISOString().slice(0, 10));
            }
            const s = p.toString();
            return s ? `?${s}` : '';
        },
    };
}

function renderPeriodHint(hintId, count, period, reload, labelNoun = 'записів') {
    const hint = document.getElementById(hintId);
    if (!hint) return;
    if (period.days) {
        hint.innerHTML = `Показано <strong>${count}</strong> ${labelNoun} за останні ${period.days} дн. <button type="button" class="link-btn" data-period-toggle="all">Завантажити всю історію</button>`;
        hint.querySelector('[data-period-toggle="all"]')?.addEventListener('click', async () => {
            period.days = null;
            hint.textContent = 'Завантаження…';
            await reload();
        });
    } else {
        hint.innerHTML = `Показано <strong>${count}</strong> ${labelNoun} за весь час. <button type="button" class="link-btn" data-period-toggle="recent">Лише останні 3 міс</button>`;
        hint.querySelector('[data-period-toggle="recent"]')?.addEventListener('click', async () => {
            period.days = 90;
            hint.textContent = 'Завантаження…';
            await reload();
        });
    }
}


// ── In-memory API cache ─────────────────────────────────────────
// Простий патерн: кешуємо GET-відповіді за URL із TTL 2 хв.
// Mutations викликають invalidateApiCache('/prefix/') щоб скинути.
const __apiCache = new Map();  // url → { data, total, fetchedAt }
const API_CACHE_TTL_MS = 2 * 60 * 1000;

async function apiFetchCached(path, opts = {}) {
    const { force = false, ttl = API_CACHE_TTL_MS } = opts;
    const now = Date.now();
    const cached = __apiCache.get(path);
    if (!force && cached && (now - cached.fetchedAt) < ttl) {
        return { data: cached.data, total: cached.total, fromCache: true };
    }
    const response = await apiFetch(path);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const total = parseInt(response.headers.get('X-Total-Count') || '', 10);
    const entry = { data, total: Number.isFinite(total) ? total : null, fetchedAt: now };
    __apiCache.set(path, entry);
    return { data, total: entry.total, fromCache: false };
}

function invalidateApiCache(prefix) {
    if (!prefix) {
        __apiCache.clear();
        return;
    }
    for (const key of Array.from(__apiCache.keys())) {
        if (key.includes(prefix)) __apiCache.delete(key);
    }
}


// ── Пагінація з "Load more" для журнальних таблиць ─────────────
// Підтримує стан: { offset, pageSize, total, period }.
// Юзер може клацнути «Завантажити ще N» — наступна сторінка дописується у cache.
function createPaginatedState({ pageSize = 100, periodDays = 90 } = {}) {
    return {
        period: createPeriodState(periodDays),
        offset: 0,
        pageSize,
        total: null,    // null = не знаємо (ще не зробили fetch)
        items: [],      // накопичений буфер сторінок
        reset() {
            this.offset = 0;
            this.total = null;
            this.items = [];
        },
        hasMore() {
            return this.total != null && this.items.length < this.total;
        },
        toQuery() {
            return this.period.toQueryParams({
                limit: String(this.pageSize),
                offset: String(this.offset),
            });
        },
    };
}

function renderPagedHint(hintId, state, reloadFn, labelNoun = 'записів') {
    const hint = document.getElementById(hintId);
    if (!hint) return;
    const shown = state.items.length;
    const total = state.total ?? shown;
    const periodLabel = state.period.days
        ? `за останні ${state.period.days} дн.`
        : 'за весь час';
    let html = `Показано <strong>${shown}</strong> з ${total} ${labelNoun} ${periodLabel}.`;
    if (state.hasMore()) {
        const more = Math.min(state.pageSize, total - shown);
        html += ` <button type="button" class="link-btn" data-pg="more">Завантажити ще ${more}</button>`;
    }
    const otherLabel = state.period.days ? 'Завантажити всю історію' : 'Лише останні 3 міс';
    html += ` <button type="button" class="link-btn" data-pg="toggle">${otherLabel}</button>`;
    hint.innerHTML = html;
    hint.querySelector('[data-pg="more"]')?.addEventListener('click', async () => {
        state.offset += state.pageSize;
        await reloadFn({ append: true });
    });
    hint.querySelector('[data-pg="toggle"]')?.addEventListener('click', async () => {
        state.period.days = state.period.days ? null : 90;
        state.reset();
        await reloadFn({ append: false });
    });
}

// ── Глобальний прапор «модалка відкрита» ───────────────────────
// Шукаємо .modal без класу .hidden — якщо є хоч одна, body отримує
// .has-open-modal. Це дозволяє CSS-правилам паузити дорогі анімації
// (skeleton-shimmer) у фоні, інакше вони змушують браузер repaint'ити
// під blur-overlay'єм і scroll всередині модалки лагає на проді.
(function watchOpenModals() {
    const update = () => {
        const anyOpen = document.querySelector('.modal:not(.hidden)') !== null;
        document.body.classList.toggle('has-open-modal', anyOpen);
    };
    const startObserver = () => {
        update();
        const obs = new MutationObserver(() => update());
        obs.observe(document.body, {
            attributes: true,
            attributeFilter: ['class'],
            subtree: true,
        });
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserver, { once: true });
    } else {
        startObserver();
    }
})();
