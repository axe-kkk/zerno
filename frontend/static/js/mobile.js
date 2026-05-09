// ZERNO MOBILE — урізана мобільна версія: дашборд, каса, склад
// Використовує ті самі JWT-токени що й десктопна версія.

const API_BASE_URL = '/api';

let currentUser = null;
let isSuperAdmin = false;
let canEditMoney = false; // super_admin або manager (каса + ціни)
let culturesCache = [];
let purchaseStockCache = [];

// ── Auth & API helpers ─────────────────────────────────────────────
function apiFetch(path, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        'Authorization': `Bearer ${token}`
    };
    return fetch(`${API_BASE_URL}${path}`, { ...options, headers, cache: 'no-store' });
}

async function apiJson(path, options) {
    const response = await apiFetch(path, options);
    if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = 'login.html';
        throw new Error('unauthorized');
    }
    if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    if (response.status === 204) return null;
    return response.json();
}

// ── DOM helpers ─────────────────────────────────────────────────────
function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatNumber(value, fractionDigits = 2) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0.00';
    return num.toLocaleString('uk-UA', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    });
}

function formatKg(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || Math.abs(num) < 0.005) return '—';
    return formatNumber(num);
}

function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}.${mm} ${hh}:${min}`;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('m-toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `m-toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 220);
    }, 3000);
}

// ── Init ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    initNavigation();
    initStockTabs();
    initLogout();
    initRefresh();
    initCashModal();
    initPriceModal();

    bootstrap().catch((err) => {
        console.error('Помилка ініціалізації:', err);
        showToast('Не вдалося завантажити дані', 'error');
    });
});

async function bootstrap() {
    try {
        currentUser = await apiJson('/users/me');
        isSuperAdmin = currentUser?.role === 'super_admin';
        canEditMoney = isSuperAdmin || currentUser?.role === 'manager';
        if (!canEditMoney) {
            document.body.classList.add('m-not-admin');
        }
    } catch (err) {
        if (err.message === 'unauthorized') return;
        console.warn('users/me failed:', err);
    }

    await loadDashboard();
    // Каса і склад вантажаться при першому переході на вкладку.
}

// ── Navigation ──────────────────────────────────────────────────────
const PAGE_TITLES = {
    dashboard: 'Дашборд',
    cash: 'Каса',
    stock: 'Склад',
};

const loadedPages = new Set(['dashboard']);

function initNavigation() {
    const navItems = document.querySelectorAll('.m-nav-item');
    navItems.forEach((item) => {
        item.addEventListener('click', () => {
            const target = item.dataset.nav;
            if (!target) return;
            switchPage(target);
        });
    });
}

function switchPage(target) {
    document.querySelectorAll('.m-nav-item').forEach((el) => {
        el.classList.toggle('active', el.dataset.nav === target);
    });
    document.querySelectorAll('.m-page').forEach((el) => {
        el.classList.toggle('hidden', el.dataset.page !== target);
    });
    const titleEl = document.getElementById('m-page-title');
    if (titleEl) titleEl.textContent = PAGE_TITLES[target] || 'Облік зерна';

    document.getElementById('m-main')?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });

    if (!loadedPages.has(target)) {
        loadedPages.add(target);
        if (target === 'cash') loadCash().catch((e) => console.error(e));
        if (target === 'stock') loadStock().catch((e) => console.error(e));
    } else if (target === 'cash') {
        // Каса — балансы могли змінитися; підвантажимо тихо.
        loadCash().catch((e) => console.error(e));
    }
}

function initRefresh() {
    document.getElementById('m-refresh-btn')?.addEventListener('click', () => {
        const active = document.querySelector('.m-nav-item.active')?.dataset.nav || 'dashboard';
        if (active === 'dashboard') loadDashboard();
        else if (active === 'cash') loadCash();
        else if (active === 'stock') loadStock();
    });
}

function initLogout() {
    document.getElementById('m-logout-btn')?.addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = 'login.html';
    });
}

// ── Dashboard ───────────────────────────────────────────────────────
async function loadDashboard() {
    try {
        const data = await apiJson('/dashboard/period-report');
        renderCashStrip(data.cash_balances);
        renderMovements(data.movements || []);
        renderSettlements(data.farmer_settlements || []);
        renderDebts(data.debts || []);
    } catch (err) {
        if (err.message === 'unauthorized') return;
        showToast('Помилка завантаження дашборду', 'error');
        console.error(err);
    }
}

function renderCashStrip(balances) {
    const b = balances || {};
    const ids = [
        ['m-cash-uah', b.uah],
        ['m-cash-usd', b.usd],
        ['m-cash-eur', b.eur],
        ['m-cash-uah-2', b.uah],
        ['m-cash-usd-2', b.usd],
        ['m-cash-eur-2', b.eur],
    ];
    ids.forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = formatNumber(val ?? 0);
    });
}

function detailRow(label, valueHtml) {
    return `<div class="m-detail-row"><span class="m-detail-label">${label}</span><span class="m-detail-value">${valueHtml}</span></div>`;
}

function detailKg(label, value) {
    return detailRow(label, formatKg(value));
}

const CHEVRON_SVG = '<svg class="m-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

function renderMovements(rows) {
    const list = document.getElementById('m-movements-list');
    if (!list) return;
    const visible = rows.filter((r) =>
        (r.received_total_kg || 0) > 0 ||
        (r.shipped_total_kg || 0) > 0 ||
        (r.issued_via_contracts_kg || 0) > 0 ||
        (r.lease_payments_kg || 0) > 0 ||
        (r.transfer_to_people_kg || 0) > 0 ||
        (r.losses_kg || 0) > 0 ||
        (r.balance_kg || 0) > 0
    );
    if (!visible.length) {
        list.innerHTML = '<div class="m-empty">Немає руху по складу</div>';
        return;
    }
    list.innerHTML = visible.map((r) => `
        <details class="m-detail">
            <summary class="m-detail-summary">
                <div class="m-row-title">${escapeHtml(r.culture_name)}</div>
                <div class="m-row-balance">${formatKg(r.balance_kg)} кг</div>
                ${CHEVRON_SVG}
            </summary>
            <div class="m-detail-body">
                <div class="m-detail-section">
                    <div class="m-detail-section-title">Прихід</div>
                    ${detailKg('Від фермерів', r.received_from_farmers_kg)}
                    ${detailKg('На підприємство', r.received_from_own_kg)}
                    ${detailKg('Всього', r.received_total_kg)}
                </div>
                <div class="m-detail-section">
                    <div class="m-detail-section-title">Втрати</div>
                    ${detailKg('Втрати, кг', r.losses_kg)}
                    ${detailRow('% втрат', `${formatNumber(r.loss_percent || 0)}%`)}
                </div>
                <div class="m-detail-section">
                    <div class="m-detail-section-title">Відвантажено компаніям</div>
                    ${detailKg('Готівка', r.shipped_cash_kg)}
                    ${detailKg('Безготівка', r.shipped_cashless_kg)}
                    ${detailKg('Всього', r.shipped_total_kg)}
                </div>
                <div class="m-detail-section">
                    ${detailKg('Видано контрактами', r.issued_via_contracts_kg)}
                    ${detailKg('Виплати оренди', r.lease_payments_kg)}
                    ${detailKg('Перекази людям', r.transfer_to_people_kg)}
                </div>
                <div class="m-detail-section m-detail-balance">
                    ${detailKg('Залишок', r.balance_kg)}
                    ${detailKg('• наше', r.own_balance_kg)}
                    ${detailKg('• фермерське', r.farmer_balance_kg)}
                </div>
            </div>
        </details>
    `).join('');
}

function renderSettlements(rows) {
    const list = document.getElementById('m-settlements-list');
    if (!list) return;
    const visible = rows.filter((r) =>
        (r.received_from_farmers_kg || 0) > 0 ||
        (r.bought_back_kg || 0) > 0 ||
        (r.transfer_between_farmers_kg || 0) > 0 ||
        (r.transfer_to_people_kg || 0) > 0 ||
        (r.deduct_kg || 0) > 0 ||
        (r.farmer_balance_kg || 0) > 0
    );
    if (!visible.length) {
        list.innerHTML = '<div class="m-empty">Немає розрахунків з фермерами</div>';
        return;
    }
    list.innerHTML = visible.map((r) => `
        <details class="m-detail">
            <summary class="m-detail-summary">
                <div class="m-row-title">${escapeHtml(r.culture_name)}</div>
                <div class="m-row-balance">${formatKg(r.farmer_balance_kg)} кг</div>
                ${CHEVRON_SVG}
            </summary>
            <div class="m-detail-body">
                <div class="m-detail-section">
                    ${detailKg('Надійшло', r.received_from_farmers_kg)}
                    ${detailKg('Викуплено', r.bought_back_kg)}
                </div>
                <div class="m-detail-section">
                    ${detailKg('Перекази між фермерами', r.transfer_between_farmers_kg)}
                    ${detailKg('Перекази людям', r.transfer_to_people_kg)}
                    ${detailKg('Списання', r.deduct_kg)}
                </div>
                <div class="m-detail-section m-detail-balance">
                    ${detailKg('На балансі', r.farmer_balance_kg)}
                </div>
            </div>
        </details>
    `).join('');
}

const CONTRACT_TYPE_LABELS = {
    debt: { text: 'Борговий', cls: 'm-badge-debt' },
    payment: { text: 'Виплата', cls: 'm-badge-payment' },
    reserve: { text: 'Резерв', cls: 'm-badge-reserve' },
    exchange: { text: 'Обмін', cls: 'm-badge-exchange' },
};

function renderDebts(rows) {
    const list = document.getElementById('m-debts-list');
    if (!list) return;
    if (!rows.length) {
        list.innerHTML = '<div class="m-empty">Відкритих боргів немає</div>';
        return;
    }
    list.innerHTML = rows.map((r) => {
        const t = CONTRACT_TYPE_LABELS[r.type] || { text: r.type || '—', cls: 'm-badge-debt' };
        const personBadge = r.is_person ? '<span class="m-badge m-badge-person">Людина</span>' : '';
        const noteHtml = r.note
            ? detailRow('Примітка', escapeHtml(r.note))
            : '';
        return `
            <details class="m-detail">
                <summary class="m-detail-summary">
                    <div class="m-row-main">
                        <div class="m-row-title">${escapeHtml(r.name)}</div>
                        <div class="m-row-sub">
                            <span class="m-badge ${t.cls}">${t.text}</span>
                            ${personBadge}
                            <span>#${r.contract_id}</span>
                        </div>
                    </div>
                    <div class="m-row-side">
                        <div class="m-row-amount danger">${formatNumber(r.balance_uah)} грн</div>
                        <div class="m-row-meta">з ${formatNumber(r.total_uah)}</div>
                    </div>
                    ${CHEVRON_SVG}
                </summary>
                <div class="m-detail-body">
                    <div class="m-detail-section">
                        ${detailRow('Контракт', `#${r.contract_id}`)}
                        ${detailRow('Контрагент', escapeHtml(r.name) + (r.is_person ? ' (людина)' : ''))}
                        ${detailRow('Тип', t.text)}
                        ${detailRow('Дата', formatDate(r.created_at))}
                    </div>
                    <div class="m-detail-section">
                        ${detailRow('Сума контракту', `${formatNumber(r.total_uah)} грн`)}
                        ${detailRow('Сплачено', `${formatNumber(r.paid_uah)} грн`)}
                    </div>
                    <div class="m-detail-section m-detail-balance">
                        ${detailRow('Залишок', `<span class="danger">${formatNumber(r.balance_uah)} грн</span>`)}
                    </div>
                    ${noteHtml ? `<div class="m-detail-section">${noteHtml}</div>` : ''}
                </div>
            </details>
        `;
    }).join('');
}

// ── Cash ────────────────────────────────────────────────────────────
async function loadCash() {
    try {
        const [balance, transactions] = await Promise.all([
            apiJson('/cash/balance'),
            apiJson('/cash/transactions?limit=200'),
        ]);
        renderCashStrip({
            uah: balance.uah_balance,
            usd: balance.usd_balance,
            eur: balance.eur_balance,
        });
        renderTransactions(transactions || []);
    } catch (err) {
        if (err.message === 'unauthorized') return;
        showToast('Помилка завантаження каси', 'error');
        console.error(err);
    }
}

function renderTransactions(rows) {
    const list = document.getElementById('m-tx-list');
    if (!list) return;
    if (!rows.length) {
        list.innerHTML = '<div class="m-empty">Транзакцій ще немає</div>';
        return;
    }
    list.innerHTML = rows.map((tx) => {
        const isAdd = tx.transaction_type === 'add';
        const sign = isAdd ? '+' : '−';
        const cls = isAdd ? 'success' : 'danger';
        const badgeCls = isAdd ? 'm-badge-add' : 'm-badge-sub';
        const badgeTxt = isAdd ? 'Додано' : 'Знято';
        const desc = tx.description ? escapeHtml(tx.description) : '<span style="color:var(--m-text-faint)">без опису</span>';
        const author = tx.user_full_name ? `<span class="sep">·</span><span>${escapeHtml(tx.user_full_name)}</span>` : '';
        return `
            <div class="m-row">
                <div class="m-row-main">
                    <div class="m-row-title">${desc}</div>
                    <div class="m-row-sub">
                        <span class="m-badge ${badgeCls}">${badgeTxt}</span>
                        <span>${formatDate(tx.created_at)}</span>
                        ${author}
                    </div>
                </div>
                <div class="m-row-side">
                    <div class="m-row-amount ${cls}">${sign}${formatNumber(tx.amount)} ${tx.currency}</div>
                </div>
            </div>
        `;
    }).join('');
}

// ── Cash modal ──────────────────────────────────────────────────────
function initCashModal() {
    const btn = document.getElementById('m-cash-op-btn');
    const modal = document.getElementById('m-cash-modal');
    const form = document.getElementById('m-cash-form');
    const errEl = document.getElementById('m-cash-error');
    const submit = document.getElementById('m-cash-submit');

    btn?.addEventListener('click', () => {
        if (!canEditMoney) {
            showToast('Доступно тільки супер адміну або менеджеру', 'error');
            return;
        }
        openModal(modal);
    });

    modal?.querySelectorAll('[data-close]').forEach((el) => {
        el.addEventListener('click', () => closeModal(modal, form, errEl));
    });

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = form.querySelector('input[name="m-cash-type"]:checked')?.value;
        const currency = form.querySelector('input[name="m-cash-cur"]:checked')?.value;
        const amount = parseFloat(document.getElementById('m-cash-amount').value);
        const description = document.getElementById('m-cash-desc').value.trim() || null;

        if (!type || !currency || !Number.isFinite(amount) || amount <= 0) {
            showError(errEl, 'Заповніть усі поля коректно');
            return;
        }

        submit.disabled = true;
        try {
            await apiJson('/cash/update-balance', {
                method: 'POST',
                body: JSON.stringify({
                    currency,
                    amount,
                    transaction_type: type,
                    description,
                }),
            });
            closeModal(modal, form, errEl);
            showToast('Операцію збережено', 'success');
            await loadCash();
            // Дашборд теж може оновити баланси, якщо він уже завантажувався.
            if (loadedPages.has('dashboard')) {
                loadDashboard().catch(() => {});
            }
        } catch (err) {
            if (err.message === 'unauthorized') return;
            showError(errEl, err.message || 'Помилка збереження');
        } finally {
            submit.disabled = false;
        }
    });
}

// ── Stock ───────────────────────────────────────────────────────────
function initStockTabs() {
    document.querySelectorAll('.m-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.stockTab;
            if (!target) return;
            document.querySelectorAll('.m-tab').forEach((t) => {
                t.classList.toggle('active', t.dataset.stockTab === target);
            });
            document.querySelectorAll('[data-stock-pane]').forEach((p) => {
                p.classList.toggle('hidden', p.dataset.stockPane !== target);
            });
        });
    });
}

async function loadStock() {
    try {
        const [cultures, stock] = await Promise.all([
            apiJson('/grain/cultures'),
            apiJson('/purchases/stock'),
        ]);
        culturesCache = cultures || [];
        purchaseStockCache = stock || [];
        renderGrainList(culturesCache);
        renderPurchaseList('fertilizer', 'm-fertilizer-list');
        renderPurchaseList('seed', 'm-seed-list');
    } catch (err) {
        if (err.message === 'unauthorized') return;
        showToast('Помилка завантаження складу', 'error');
        console.error(err);
    }
}

function renderGrainList(cultures) {
    const list = document.getElementById('m-grain-list');
    if (!list) return;
    const active = cultures.filter((c) => c.is_active !== false);
    if (!active.length) {
        list.innerHTML = '<div class="m-empty">Культур немає</div>';
        return;
    }
    list.innerHTML = active.map((c) => `
        <button class="m-row" type="button" data-stock-kind="grain" data-id="${c.id}" data-name="${escapeHtml(c.name)}" data-price="${c.price_per_kg}">
            <div class="m-row-main">
                <div class="m-row-title">${escapeHtml(c.name)}</div>
                <div class="m-row-sub"><span>Зерно</span></div>
            </div>
            <div class="m-row-side">
                <div class="m-row-amount">${formatNumber(c.price_per_kg)} грн/кг</div>
                <div class="m-row-meta">тап — змінити</div>
            </div>
        </button>
    `).join('');
    bindStockRows(list);
}

function renderPurchaseList(category, listId) {
    const list = document.getElementById(listId);
    if (!list) return;
    const items = purchaseStockCache.filter((s) => s.category === category);
    if (!items.length) {
        list.innerHTML = '<div class="m-empty">Позицій немає</div>';
        return;
    }
    list.innerHTML = items.map((s) => `
        <button class="m-row" type="button" data-stock-kind="purchase" data-id="${s.id}" data-name="${escapeHtml(s.name)}" data-price="${s.sale_price_per_kg}">
            <div class="m-row-main">
                <div class="m-row-title">${escapeHtml(s.name)}</div>
                <div class="m-row-sub"><span>${formatKg(s.quantity_kg)} кг на складі</span></div>
            </div>
            <div class="m-row-side">
                <div class="m-row-amount">${formatNumber(s.sale_price_per_kg)} грн/кг</div>
                <div class="m-row-meta">тап — змінити</div>
            </div>
        </button>
    `).join('');
    bindStockRows(list);
}

function bindStockRows(container) {
    container.querySelectorAll('.m-row').forEach((row) => {
        row.addEventListener('click', () => {
            if (!canEditMoney) {
                showToast('Зміна цін доступна тільки супер адміну або менеджеру', 'error');
                return;
            }
            openPriceModal({
                kind: row.dataset.stockKind,
                id: parseInt(row.dataset.id, 10),
                name: row.dataset.name,
                price: parseFloat(row.dataset.price),
            });
        });
    });
}

// ── Price modal ─────────────────────────────────────────────────────
let pendingPriceTarget = null;

function initPriceModal() {
    const modal = document.getElementById('m-price-modal');
    const form = document.getElementById('m-price-form');
    const errEl = document.getElementById('m-price-error');
    const submit = document.getElementById('m-price-submit');

    modal?.querySelectorAll('[data-close]').forEach((el) => {
        el.addEventListener('click', () => closeModal(modal, form, errEl));
    });

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!pendingPriceTarget) return;
        const newPrice = parseFloat(document.getElementById('m-price-new').value);
        if (!Number.isFinite(newPrice) || newPrice < 1) {
            showError(errEl, 'Ціна не може бути меншою за 1 грн/кг');
            return;
        }

        submit.disabled = true;
        try {
            const { kind, id } = pendingPriceTarget;
            if (kind === 'grain') {
                await apiJson(`/grain/cultures/${id}/price`, {
                    method: 'PATCH',
                    body: JSON.stringify({ price_per_kg: newPrice }),
                });
            } else {
                await apiJson(`/purchases/stock/${id}/price`, {
                    method: 'PATCH',
                    body: JSON.stringify({ sale_price_per_kg: newPrice }),
                });
            }
            closeModal(modal, form, errEl);
            showToast('Ціну оновлено', 'success');
            await loadStock();
        } catch (err) {
            if (err.message === 'unauthorized') return;
            showError(errEl, err.message || 'Помилка оновлення');
        } finally {
            submit.disabled = false;
        }
    });
}

function openPriceModal({ kind, id, name, price }) {
    pendingPriceTarget = { kind, id, name, price };
    const titleEl = document.getElementById('m-price-title');
    const nameEl = document.getElementById('m-price-name');
    const currentEl = document.getElementById('m-price-current');
    const newEl = document.getElementById('m-price-new');

    if (titleEl) titleEl.textContent = kind === 'grain' ? 'Ціна культури' : 'Ціна продажу';
    if (nameEl) nameEl.textContent = name;
    if (currentEl) currentEl.value = formatNumber(price);
    if (newEl) {
        newEl.value = '';
        newEl.placeholder = formatNumber(price);
    }

    openModal(document.getElementById('m-price-modal'));
    setTimeout(() => newEl?.focus(), 80);
}

// ── Modal helpers ───────────────────────────────────────────────────
function openModal(modal) {
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal(modal, form, errEl) {
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    if (form) form.reset();
    if (errEl) {
        errEl.textContent = '';
        errEl.classList.add('hidden');
    }
    pendingPriceTarget = null;
}

function showError(errEl, msg) {
    if (!errEl) return;
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
}
