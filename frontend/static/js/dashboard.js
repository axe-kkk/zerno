// API_BASE_URL, ICONS, iconBtn, EMPTY_VALUE_UA, emptyValueHtml — у core.js

let currentUser = null;
let isSuperAdmin = false;
let culturesCache = [];
let vehicleTypesCache = [];
let driversCache = [];
let intakesCache = [];

function intakeOnStock(intake) {
    return intake && !intake.pending_quality && !intake.pending_tare;
}

function intakeStatusLabel(intake) {
    if (!intake) return '';
    if (intake.pending_tare && intake.pending_quality) return 'Очікує тару та %';
    if (intake.pending_tare) return 'Очікує тару';
    if (intake.pending_quality) return 'Очікує %';
    return 'Підтверджено';
}

function intakeStatusBadgeClass(intake) {
    if (!intake) return 'success';
    if (intake.pending_tare) return 'danger';
    if (intake.pending_quality) return 'warning';
    return 'success';
}

let ownersCache = [];
let purchaseStockCache = [];
let purchasesCache = [];
let shipmentsCache = [];
let openFarmerBalanceModal = null;
// farmerContractsCache, farmerContractPaymentsCache, currentFarmerContractId,
// openFarmerContractPaymentModal — у farmer-contracts.js
// usersCache — у users.js
// landlordsCache, contractsCache, paymentsCache + leases editing/deleting state — у leases.js
let editingIntakeId = null;
let pendingDriverDeleteId = null;
let editingShipmentId = null;

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    initializeDashboard().catch((err) => {
        console.error('Помилка ініціалізації дашборда:', err);
        showToast('Не вдалося завантажити дані. Перезавантажте сторінку.', 'error');
    });
});

async function initializeDashboard() {
    initSidebarToggle();
    await loadUserInfo();
    initLogout();
    initIntakeForm();
    initIntakeCreateModal();
    initIntakeViewModal();
    initIntakeEditModal();
    initStockAdjustModal();
    initStockPriceModal();
    initCulturePriceModal();
    initStockReports();
    initPurchaseForm();
    initDriverForm();
    initDriverAddModal();
    initDriversListExport();
    initDriverEditModal();
    initDriverDeliveriesFilters();
    initDriverDeliveriesReportModal();
    initDriverDeleteModal();
    initShipmentsForm();
    initShipmentCreateModal();
    initShipmentsEditModal();
    initShipmentsReportModal();
    initUserAddModal();
    initUserEditModal();
    initUserDeleteModal();
    initCashForm();
    initCashReportModal();
    initIntakeReportModal();
    initIntakeSummaryReport();
    initPurchasesReportModal();
    initStockAdjustmentsReportModal();
    initStockReserveModal();
    initOwnersSearch();
    initFarmerIntakeFilters();
    initFarmersReportModal();
    initFarmerIntakesReportModal();
    initFarmerBalanceModal();
    initFarmerEditModal();
    initFarmerDeductModal();
    initFarmerTransferModal();
    initFarmerMovementFilters();
    initFarmerMovementsReportModal();
    initFarmerContractsSection();
    initWeightCalculations();
    initLandlords();
    initContracts();
    initPayments();
    initVouchers();
    initPeopleSection();
    initDashboardReportControls();

    // Показуємо скелетони у всіх таблицях, поки летять перші запити —
    // дешеве відчуття «ось зараз буде» замість порожніх рядків.
    showAllTableSkeletons();

    // Критичне «треба завжди»: баланс у хедері + малі довідники для форм/селектів.
    // Решту (intakes, contracts, payments, fields, ...) тягне initNavigation
    // ліниво при першому переході в потрібну секцію.
    await Promise.all([
        loadCashBalance(),
        loadCultures(),
        loadVehicleTypes(),
        loadDrivers()
    ]);

    initCustomSelects();
    initIntakeFilters();
    initFieldsSection();

    // Тільки тепер ініціюємо роутер: критичні довідники (cultures, drivers, ...)
    // готові, тож перший lazy-load секції рендериться нормально.
    initNavigation();

    updateTime();
    setInterval(updateTime, 1000);
}

// ── Дешева мемоізація для лінивих завантажувачів секцій ──
// Кожен ключ → Promise. При повторному кліку на ту саму вкладку викликаємо
// applyPage з force=true, що скидає кеш і змушує refetch.
const _sectionDataPromises = new Map();
function loadSectionOnce(key, loaderFn, forceRefresh = false) {
    if (forceRefresh) _sectionDataPromises.delete(key);
    if (_sectionDataPromises.has(key)) return _sectionDataPromises.get(key);
    const p = Promise.resolve().then(loaderFn).catch(err => {
        // Не залишаємо «отруєний» промис у кеші — наступний раз спробуємо знову.
        _sectionDataPromises.delete(key);
        throw err;
    });
    _sectionDataPromises.set(key, p);
    return p;
}

// apiFetch, apiFetchBlob, downloadBlob — у core.js

/**
 * Перезавантаження даних після мутації. Викликається в success-handler
 * замість одиничного await loadX(). Передавайте список скоупів — функція
 * виконає лише ті loader'и, що дійсно зачеплені операцією, паралельно.
 *
 * Доступні скоупи: dashboard, cash, cashTransactions, stock, purchaseStock,
 * stockAdjustments, allIntakes, shipments, owners, farmerMovements,
 * farmerContracts, farmerContractPayments, contracts, payments,
 * landlords, vouchers, fields, drivers, users, cultures, vehicleTypes,
 * purchases.
 *
 * Скоуп `dashboard` оновлює статистику головної лише якщо вона зараз видима —
 * щоб не плодити зайвих запитів при роботі в інших розділах.
 */
/**
 * Kebab-меню на вузьких екранах: при кліку поза кнопкою у комірці .actions-cell
 * (тобто по псевдо-кнопці ⋮ або порожньому місці) — toggle .open, що показує
 * усі іконки у спливаючій панелі. CSS прибирає це на широких екранах.
 */
document.addEventListener('click', (event) => {
    if (window.innerWidth > 720) return;
    const cell = event.target.closest('.actions-cell');
    // Клік по реальній кнопці-дії — пропускаємо, нехай спрацює;
    // клік по самій комірці (порожньому місці або псевдо ⋮) — toggle.
    if (!cell) {
        document.querySelectorAll('.actions-cell.open').forEach(c => c.classList.remove('open'));
        return;
    }
    const clickedAction = event.target.closest('.actions-cell > *, .actions-cell button, .actions-cell a');
    if (clickedAction && clickedAction !== cell) return;
    document.querySelectorAll('.actions-cell.open').forEach(c => {
        if (c !== cell) c.classList.remove('open');
    });
    cell.classList.toggle('open');
    event.stopPropagation();
});

/**
 * Заповнити <select> опціями фермерів з ownersCache. Викликається після loadOwnersList()
 * для всіх селектів, що показують довідник фермерів. Зберігає поточно обране значення.
 */
function populateOwnerSelect(selectId, { placeholder = 'Оберіть фермера' } = {}) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const current = select.value;
    const opts = [`<option value="">${placeholder}</option>`];
    (ownersCache || []).forEach(o => {
        const phone = o.phone ? ` (${o.phone})` : '';
        opts.push(`<option value="${o.id}">${escapeHtml(o.full_name)}${escapeHtml(phone)}</option>`);
    });
    select.innerHTML = opts.join('');
    if (current && (ownersCache || []).some(o => String(o.id) === current)) {
        select.value = current;
    }
    if (typeof refreshCustomSelect === 'function') refreshCustomSelect(select);
}

function populateLandlordSelect(selectId, { placeholder = 'Оберіть орендодавця' } = {}) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const current = select.value;
    const opts = [`<option value="">${placeholder}</option>`];
    (landlordsCache || []).forEach(l => {
        const phone = l.phone ? ` (${l.phone})` : '';
        opts.push(`<option value="${l.id}">${escapeHtml(l.full_name)}${escapeHtml(phone)}</option>`);
    });
    select.innerHTML = opts.join('');
    if (current && (landlordsCache || []).some(l => String(l.id) === current)) {
        select.value = current;
    }
    if (typeof refreshCustomSelect === 'function') refreshCustomSelect(select);
}

/** Універсальна quick-add модалка для довідників (фермер / орендодавець). */
function setupQuickAddModal({
    modalId, formId, nameId, phoneId, messageId, closeId, cancelId,
    apiPath,                         // '/grain/owners' | '/leases/landlords'
    cacheRef,                        // 'ownersCache' | 'landlordsCache'
    refreshScope,                    // ім'я скоупу для refreshAfterMutation
    onCreated                        // (createdItem) => void  — коли потрібно вибрати щойно створеного у конкретному селекті
}) {
    const modal = document.getElementById(modalId);
    const form = document.getElementById(formId);
    if (!modal || !form) return null;

    const nameInput = document.getElementById(nameId);
    const phoneInput = document.getElementById(phoneId);
    const messageEl = document.getElementById(messageId);
    const closeBtn = document.getElementById(closeId);
    const cancelBtn = document.getElementById(cancelId);
    const overlay = modal.querySelector('.modal-overlay');

    let currentCallback = null;

    const close = () => {
        modal.classList.add('hidden');
        if (form) form.reset();
        if (messageEl) { messageEl.textContent = ''; messageEl.classList.remove('error', 'success'); }
        currentCallback = null;
    };

    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);
    overlay?.addEventListener('click', close);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        const phone = phoneInput.value.trim() || null;
        if (!name) {
            if (messageEl) { messageEl.textContent = 'Вкажіть ПІБ'; messageEl.classList.add('error'); }
            return;
        }
        const response = await apiFetch(apiPath, {
            method: 'POST',
            body: JSON.stringify({ full_name: name, phone })
        });
        if (!response.ok) {
            const err = await response.json().catch(() => null);
            if (messageEl) { messageEl.textContent = err?.detail || 'Помилка створення'; messageEl.classList.add('error'); }
            return;
        }
        const created = await response.json();
        // Оновлюємо локальний кеш одразу — щоб селект побачив новий запис до redownload'у
        if (cacheRef === 'ownersCache') {
            ownersCache = [...(ownersCache || []), created].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
        } else if (cacheRef === 'landlordsCache') {
            landlordsCache = [...(landlordsCache || []), created].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
        }
        const cb = currentCallback;
        close();
        if (typeof cb === 'function') cb(created);
        // Refresh у фоні щоб синхронізуватись з сервером
        if (refreshScope) {
            refreshAfterMutation([refreshScope]).catch(() => {});
        }
    });

    return {
        open(callback) {
            currentCallback = typeof callback === 'function' ? callback : null;
            if (form) form.reset();
            if (messageEl) { messageEl.textContent = ''; messageEl.classList.remove('error', 'success'); }
            modal.classList.remove('hidden');
            setTimeout(() => nameInput?.focus(), 30);
        }
    };
}

let _farmerQuickAdd = null;
let _landlordQuickAdd = null;

function getFarmerQuickAdd() {
    if (!_farmerQuickAdd) {
        _farmerQuickAdd = setupQuickAddModal({
            modalId: 'farmer-quick-add-modal',
            formId: 'farmer-quick-add-form',
            nameId: 'farmer-quick-add-name',
            phoneId: 'farmer-quick-add-phone',
            messageId: 'farmer-quick-add-message',
            closeId: 'farmer-quick-add-close',
            cancelId: 'farmer-quick-add-cancel',
            apiPath: '/grain/owners',
            cacheRef: 'ownersCache',
            refreshScope: 'owners'
        });
    }
    return _farmerQuickAdd;
}

function getLandlordQuickAdd() {
    if (!_landlordQuickAdd) {
        _landlordQuickAdd = setupQuickAddModal({
            modalId: 'landlord-quick-add-modal',
            formId: 'landlord-quick-add-form',
            nameId: 'landlord-quick-add-name',
            phoneId: 'landlord-quick-add-phone',
            messageId: 'landlord-quick-add-message',
            closeId: 'landlord-quick-add-close',
            cancelId: 'landlord-quick-add-cancel',
            apiPath: '/leases/landlords',
            cacheRef: 'landlordsCache',
            refreshScope: 'landlords'
        });
    }
    return _landlordQuickAdd;
}

// showTableSkeleton, showAllTableSkeletons — у core.js

async function refreshAfterMutation(scopes) {
    if (!Array.isArray(scopes) || scopes.length === 0) return;
    const dashboardSection = document.getElementById('section-dashboard');
    const dashboardVisible = !!(dashboardSection && !dashboardSection.classList.contains('hidden'));

    // Інвалідуємо in-memory cache для зачеплених скоупів — щоб наступний завантаж
    // (а він зараз і відбудеться через map нижче) пішов на бекенд, а не з кешу.
    const cacheInvalidationPrefixes = {
        cash: ['/cash/balance', '/vouchers/summary'],
        cashTransactions: ['/cash/transactions'],
        stock: ['/grain/stock'],
        purchaseStock: ['/purchases/stock'],
        stockAdjustments: ['/grain/stock-adjustments'],
        allIntakes: ['/grain/intakes'],
        shipments: ['/grain/shipments'],
        owners: ['/grain/owners'],
        farmerMovements: ['/grain/farmer-movements'],
        farmerContracts: ['/farmer-contracts'],
        farmerContractPayments: ['/farmer-contracts'],
        contracts: ['/leases/contracts'],
        payments: ['/leases/payments'],
        landlords: ['/leases/landlords'],
        vouchers: ['/vouchers'],
        fields: ['/fields'],
        drivers: ['/grain/drivers'],
        users: ['/users'],
        cultures: ['/grain/cultures', '/grain/stock'],
        vehicleTypes: ['/grain/vehicle-types'],
        purchases: ['/purchases'],
        people: ['/people'],
        peopleActions: ['/people'],
    };
    for (const scope of scopes) {
        for (const prefix of cacheInvalidationPrefixes[scope] || []) {
            invalidateApiCache(prefix);
        }
    }

    const map = {
        dashboard:              () => dashboardVisible && typeof loadDashboardStats === 'function' ? loadDashboardStats() : null,
        cash:                   () => typeof loadCashBalance === 'function' ? loadCashBalance() : null,
        cashTransactions:       () => typeof loadCashTransactions === 'function' ? loadCashTransactions() : null,
        stock:                  () => typeof loadStock === 'function' ? loadStock() : null,
        purchaseStock:          () => typeof loadPurchaseStock === 'function' ? loadPurchaseStock() : null,
        stockAdjustments:       () => typeof loadStockAdjustments === 'function' ? loadStockAdjustments() : null,
        allIntakes:             () => typeof loadAllIntakes === 'function' ? loadAllIntakes() : null,
        shipments:              () => typeof loadShipments === 'function' ? loadShipments() : null,
        owners:                 () => typeof loadOwnersList === 'function' ? loadOwnersList('') : null,
        farmerMovements:        () => typeof loadFarmerMovements === 'function' ? loadFarmerMovements() : null,
        farmerContracts:        () => typeof loadFarmerContracts === 'function' ? loadFarmerContracts() : null,
        farmerContractPayments: () => typeof loadFarmerContractPayments === 'function' ? loadFarmerContractPayments() : null,
        contracts:              () => typeof loadContracts === 'function' ? loadContracts() : null,
        payments:               () => typeof loadPayments === 'function' ? loadPayments() : null,
        landlords:              () => typeof loadLandlords === 'function' ? loadLandlords() : null,
        vouchers:               () => typeof loadVouchersData === 'function' ? loadVouchersData() : null,
        fields:                 () => typeof loadFields === 'function' ? loadFields() : null,
        drivers:                () => typeof loadDrivers === 'function' ? loadDrivers() : null,
        users:                  () => typeof loadUsers === 'function' ? loadUsers() : null,
        cultures:               () => typeof loadCultures === 'function' ? loadCultures() : null,
        vehicleTypes:           () => typeof loadVehicleTypes === 'function' ? loadVehicleTypes() : null,
        purchases:              () => typeof loadPurchases === 'function' ? loadPurchases() : null,
        people:                 () => typeof loadPeople === 'function' ? loadPeople() : null,
        peopleActions:          () => typeof loadPeopleActions === 'function' ? loadPeopleActions() : null,
    };

    const tasks = [];
    const seen = new Set();
    for (const scope of scopes) {
        if (seen.has(scope)) continue;
        seen.add(scope);
        const fn = map[scope];
        if (!fn) {
            console.warn('refreshAfterMutation: невідомий скоуп', scope);
            continue;
        }
        const result = fn();
        if (result && typeof result.then === 'function') {
            tasks.push(result.catch(err => console.error(`refresh ${scope} failed:`, err)));
        }
    }
    if (tasks.length) {
        await Promise.allSettled(tasks);
    }
}

async function loadUserInfo() {
    try {
        const response = await apiFetch('/users/me');
        if (!response.ok) {
            throw new Error('Помилка завантаження даних користувача');
        }

        const user = await response.json();
        currentUser = user;
        isSuperAdmin = user.role === 'super_admin';

        const userName = user.full_name;
        const nameEl = document.getElementById('user-name');
        const roleEl = document.getElementById('user-role');
        if (nameEl) {
            nameEl.textContent = userName;
        }
        if (roleEl) {
            roleEl.textContent = isSuperAdmin
                ? 'Супер адмін'
                : (user.role === 'manager' ? 'Менеджер' : 'Користувач');
        }

        const initials = user.full_name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
        const initialsEl = document.getElementById('user-initials');
        if (initialsEl) initialsEl.textContent = initials || 'А';

        updateAdminVisibility();
    } catch (error) {
        console.error('Помилка завантаження даних користувача:', error);
        localStorage.removeItem('token');
        window.location.href = 'login.html';
    }
}

function updateAdminVisibility() {
    const isManager = currentUser?.role === 'manager';
    const canEditMoney = !!isSuperAdmin || isManager;
    document.body.classList.toggle('user-is-admin', !!isSuperAdmin);
    document.body.classList.toggle('user-is-not-admin', !isSuperAdmin);
    document.body.classList.toggle('user-is-money-editor', canEditMoney);
    document.querySelectorAll('[data-admin-only]').forEach(element => {
        // Менеджеру дозволяємо те, що позначене data-money-action
        const isMoneyAction = element.hasAttribute('data-money-action');
        const visible = isSuperAdmin || (isMoneyAction && canEditMoney);
        element.classList.toggle('hidden', !visible);
    });
}

async function loadDashboardStats() {
    // Звіт: завантажуємо за вибраним періодом (або весь час, якщо дати не задані).
    const startEl = document.getElementById('report-start-date');
    const endEl = document.getElementById('report-end-date');
    const startVal = startEl?.value || '';
    const endVal = endEl?.value || '';
    const params = new URLSearchParams();
    if (startVal) params.set('start_date', startVal);
    if (endVal) params.set('end_date', endVal);
    const path = `/dashboard/period-report${params.toString() ? `?${params}` : ''}`;

    try {
        const response = await apiFetch(path);
        if (!response.ok) throw new Error('Помилка завантаження звіту');
        const data = await response.json();

        // ── Заголовок: дата звіту ──
        const dateEl = document.getElementById('report-date');
        const periodHintEl = document.getElementById('report-period-hint');
        const today = new Date().toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
        dateEl.textContent = today;
        if (startVal && endVal) {
            periodHintEl.textContent = `Період: ${startVal} — ${endVal}`;
        } else if (startVal) {
            periodHintEl.textContent = `З ${startVal}`;
        } else if (endVal) {
            periodHintEl.textContent = `До ${endVal}`;
        } else {
            periodHintEl.textContent = 'Дані за весь час';
        }

        // ── Каса ──
        document.getElementById('dashboard-cash-uah').textContent = formatAmount(data.cash_balances.uah);
        document.getElementById('dashboard-cash-usd').textContent = formatAmount(data.cash_balances.usd);
        document.getElementById('dashboard-cash-eur').textContent = formatAmount(data.cash_balances.eur);

        // ── 1. Рух зерна по складу ──
        const movTbody = document.querySelector('#report-movements-table tbody');
        if (movTbody) {
            movTbody.innerHTML = '';
            if (!data.movements || !data.movements.length) {
                movTbody.innerHTML = '<tr><td colspan="13" class="empty-state">Немає культур</td></tr>';
            } else {
                data.movements.forEach(row => {
                    const lossPct = row.loss_percent || 0;
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="rt-sticky-col"><strong>${escapeHtml(row.culture_name)}</strong></td>
                        <td class="rt-num">${fmtKg(row.received_from_farmers_kg)}</td>
                        <td class="rt-num">${fmtKg(row.received_from_own_kg)}</td>
                        <td class="rt-num"><strong>${fmtKg(row.received_total_kg)}</strong></td>
                        <td class="rt-num">${fmtKg(row.losses_kg)}</td>
                        <td class="rt-num">${lossPct > 0 ? lossPct.toFixed(2) + '%' : '—'}</td>
                        <td class="rt-num">${fmtKg(row.shipped_cash_kg)}</td>
                        <td class="rt-num">${fmtKg(row.shipped_cashless_kg)}</td>
                        <td class="rt-num"><strong>${fmtKg(row.shipped_total_kg)}</strong></td>
                        <td class="rt-num">${fmtKg(row.issued_via_contracts_kg)}</td>
                        <td class="rt-num">${fmtKg(row.lease_payments_kg)}</td>
                        <td class="rt-num">${fmtKg(row.transfer_to_people_kg)}</td>
                        <td class="rt-num rt-balance">${fmtKg(row.balance_kg)}</td>
                    `;
                    movTbody.appendChild(tr);
                });
            }
        }

        // ── 2. Розрахунки з фермерами ──
        const settlTbody = document.querySelector('#report-farmer-settlements-table tbody');
        if (settlTbody) {
            settlTbody.innerHTML = '';
            if (!data.farmer_settlements || !data.farmer_settlements.length) {
                settlTbody.innerHTML = '<tr><td colspan="7" class="empty-state">Немає даних</td></tr>';
            } else {
                data.farmer_settlements.forEach(row => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="rt-sticky-col"><strong>${escapeHtml(row.culture_name)}</strong></td>
                        <td class="rt-num">${fmtKg(row.received_from_farmers_kg)}</td>
                        <td class="rt-num">${fmtKg(row.bought_back_kg)}</td>
                        <td class="rt-num">${fmtKg(row.transfer_between_farmers_kg)}</td>
                        <td class="rt-num">${fmtKg(row.transfer_to_people_kg)}</td>
                        <td class="rt-num">${fmtKg(row.deduct_kg)}</td>
                        <td class="rt-num rt-balance">${fmtKg(row.farmer_balance_kg)}</td>
                    `;
                    settlTbody.appendChild(tr);
                });
            }
        }

        // ── 3. Борги ──
        const debtsTbody = document.querySelector('#report-debts-table tbody');
        if (debtsTbody) {
            debtsTbody.innerHTML = '';
            if (!data.debts || !data.debts.length) {
                debtsTbody.innerHTML = '<tr><td colspan="8" class="empty-state">Боргів немає</td></tr>';
            } else {
                const typeLabels = { debt: 'Борговий', payment: 'Виплата', reserve: 'Резерв', exchange: 'Обмін' };
                data.debts.forEach(d => {
                    const dateStr = d.created_at
                        ? new Date(d.created_at).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        : '—';
                    const nameLabel = d.is_person
                        ? `${escapeHtml(d.name)} <span class="td-secondary">(людина)</span>`
                        : `<strong>${escapeHtml(d.name)}</strong>`;
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="td-mono">#${d.contract_id}</td>
                        <td>${nameLabel}</td>
                        <td>${escapeHtml(typeLabels[d.type] || d.type)}</td>
                        <td class="rt-num">${dateStr}</td>
                        <td class="rt-num">${formatAmount(d.total_uah)}</td>
                        <td class="rt-num">${formatAmount(d.paid_uah)}</td>
                        <td class="rt-num rt-balance">${formatAmount(d.balance_uah)}</td>
                        <td>${escapeHtml(d.note || '')}</td>
                    `;
                    debtsTbody.appendChild(tr);
                });
            }
        }
    } catch (error) {
        console.error('Помилка завантаження звіту дашборда:', error);
    }
}

// Helper: форматуємо кг (0 → «—», інакше число з пробілами)
function fmtKg(v) {
    const n = Number(v) || 0;
    if (Math.abs(n) < 0.005) return '<span class="rt-zero">—</span>';
    return formatAmount(n);
}

/** Прив'язує контролі періоду на головному дашборді. */
function initDashboardReportControls() {
    const refreshBtn = document.getElementById('report-refresh-btn');
    const resetBtn = document.getElementById('report-reset-btn');
    const exportBtn = document.getElementById('report-export-btn');
    const startEl = document.getElementById('report-start-date');
    const endEl = document.getElementById('report-end-date');

    refreshBtn?.addEventListener('click', () => {
        loadDashboardStats();
    });
    resetBtn?.addEventListener('click', () => {
        if (startEl) startEl.value = '';
        if (endEl) endEl.value = '';
        loadDashboardStats();
    });
    exportBtn?.addEventListener('click', async () => {
        const params = new URLSearchParams();
        if (startEl?.value) params.set('start_date', startEl.value);
        if (endEl?.value) params.set('end_date', endEl.value);
        const path = `/dashboard/period-report/export${params.toString() ? `?${params}` : ''}`;
        exportBtn.disabled = true;
        try {
            const response = await apiFetchBlob(path);
            if (!response.ok) {
                showToast('Помилка завантаження звіту', 'error');
                return;
            }
            const today = new Date().toISOString().slice(0, 10);
            const periodLabel = (startEl?.value && endEl?.value)
                ? `${startEl.value}_${endEl.value}`
                : (startEl?.value ? `from_${startEl.value}` : (endEl?.value ? `to_${endEl.value}` : 'all_time'));
            await downloadBlob(response, `dashboard_${periodLabel}_${today}.xlsx`);
        } catch (err) {
            console.error('Помилка експорту звіту дашборду:', err);
            showToast('Помилка завантаження звіту', 'error');
        } finally {
            exportBtn.disabled = false;
        }
    });
    [startEl, endEl].forEach(el => {
        el?.addEventListener('change', () => loadDashboardStats());
    });
}


async function loadCultures() {
    const response = await apiFetch('/grain/cultures');
    if (!response.ok) {
        console.error('Помилка завантаження культур');
        return;
    }
    culturesCache = await response.json();

    const select = document.getElementById('intake-culture');
    if (!select) {
        return;
    }
    select.innerHTML = culturesCache
        .map(culture => `<option value="${culture.id}">${culture.name}</option>`)
        .join('');
    initCustomSelects(select);

    const editSelect = document.getElementById('edit-culture');
    if (editSelect) {
        editSelect.innerHTML = culturesCache
            .map(culture => `<option value="${culture.id}">${culture.name}</option>`)
            .join('');
        initCustomSelects(editSelect);
    }

    updateFarmerIntakeFilterOptions();
    updateFarmerMovementFilterOptions();

    updateIntakeFilterOptions();
    updateIntakeReportOptions();
    updateDriverDeliveryFilterOptions();
    updateShipmentCultureOptions();

    const tableBody = document.querySelector('#cultures-table tbody');
    if (tableBody) {
    tableBody.innerHTML = '';
    culturesCache.forEach(culture => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><span class="inline-badge grain">${culture.name}</span></td>
            <td class="td-mono">${formatAmount(culture.price_per_kg)} ₴/кг</td>
            <td class="actions-cell"></td>
        `;
        if (isSuperAdmin) {
            const actionsCell = row.querySelector('.actions-cell');
            const priceBtn = document.createElement('button');
            priceBtn.className = 'btn-icon btn-icon-secondary';
            priceBtn.innerHTML = ICONS.price;
            priceBtn.title = 'Змінити ціну';
            priceBtn.addEventListener('click', () => {
                openCulturePriceModal({
                    id: culture.id,
                    label: culture.name,
                    price: culture.price_per_kg
                });
            });

            actionsCell.appendChild(priceBtn);
        } else {
            row.querySelector('.actions-cell').innerHTML = '<span class="td-secondary">Лише перегляд</span>';
        }
        tableBody.appendChild(row);
    });
    }
}

async function updateCulturePrice(cultureId, priceValue) {
    const price = parseFloat(priceValue);
    if (Number.isNaN(price) || price < 0) {
        return false;
    }
    const response = await apiFetch(`/grain/cultures/${cultureId}/price`, {
        method: 'PATCH',
        body: JSON.stringify({ price_per_kg: price })
    });
    if (response.ok) {
        await refreshAfterMutation(['cultures', 'stock', 'farmerContracts', 'vouchers', 'dashboard']);
        return true;
    }
    return false;
}

async function loadVehicleTypes() {
    const response = await apiFetch('/grain/vehicle-types');
    if (!response.ok) {
        console.error('Помилка завантаження транспорту');
        return;
    }
    vehicleTypesCache = await response.json();
    const select = document.getElementById('intake-vehicle');
    if (!select) {
        return;
    }
    select.innerHTML = vehicleTypesCache
        .map(vehicle => `<option value="${vehicle.id}">${vehicle.name}</option>`)
        .join('');
    initCustomSelects(select);

    const editSelect = document.getElementById('edit-vehicle');
    if (editSelect) {
        editSelect.innerHTML = vehicleTypesCache
            .map(vehicle => `<option value="${vehicle.id}">${vehicle.name}</option>`)
            .join('');
        initCustomSelects(editSelect);
    }
    updateDriverDeliveryFilterOptions();
}

async function loadDrivers() {
    const response = await apiFetch('/grain/drivers');
    if (!response.ok) {
        console.error('Помилка завантаження водіїв');
        return;
    }
    driversCache = await response.json();

    const select = document.getElementById('intake-driver');
    if (!select) {
        return;
    }
    select.innerHTML = '<option value="">Оберіть водія</option>'
        + driversCache.map(driver => `<option value="${driver.id}">${driver.full_name}</option>`).join('');
    initCustomSelects(select);

    const editSelect = document.getElementById('edit-driver');
    if (editSelect) {
        editSelect.innerHTML = '<option value="">Оберіть водія</option>'
            + driversCache.map(driver => `<option value="${driver.id}">${driver.full_name}</option>`).join('');
        initCustomSelects(editSelect);
    }

    const tableBody = document.querySelector('#drivers-table tbody');
    if (tableBody) {
    tableBody.innerHTML = '';
        driversCache
            .filter(driver => driver.is_active)
            .forEach(driver => {
        const row = document.createElement('tr');
                const canEdit = isSuperAdmin;
        row.innerHTML = `
                    <td>
                        ${driver.full_name}
                    </td>
                    <td>
                        ${driver.phone ? escapeHtml(driver.phone) : emptyValueHtml()}
                    </td>
                    <td class="actions-cell"></td>
                `;
                const actionsCell = row.querySelector('.actions-cell');
                const filterBtn = document.createElement('button');
                filterBtn.className = 'btn-icon btn-icon-secondary';
                filterBtn.innerHTML = ICONS.view;
                filterBtn.title = 'Показати доставки';
                filterBtn.addEventListener('click', () => {
                    const filterSelect = document.getElementById('driver-delivery-filter-driver');
                    if (filterSelect) {
                        filterSelect.value = String(driver.id);
                        initCustomSelects(filterSelect);
                        renderDriverDeliveriesTable(applyDriverDeliveryFilters());
                    }
                });
                actionsCell.appendChild(filterBtn);

                if (canEdit) {
                    const editBtn = document.createElement('button');
                    editBtn.className = 'btn-icon btn-icon-secondary';
                    editBtn.innerHTML = ICONS.edit;
                    editBtn.title = 'Редагувати водія';
                    editBtn.addEventListener('click', () => {
                        openDriverEditModal(driver);
                    });
                    actionsCell.appendChild(editBtn);

                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'btn-icon btn-icon-danger';
                    deleteBtn.innerHTML = ICONS.delete;
                    deleteBtn.title = 'Видалити водія';
                    deleteBtn.addEventListener('click', () => {
                        openDriverDeleteModal(driver.id);
                    });
                    actionsCell.appendChild(deleteBtn);
                }
        tableBody.appendChild(row);
    });
    }

    updateDriverDeliveryFilterOptions();
}

async function deleteDriver(driverId) {
    const response = await apiFetch(`/grain/drivers/${driverId}`, {
        method: 'DELETE'
    });
    if (response.ok) {
        await refreshAfterMutation(['drivers']);
        showToast('Водія видалено', 'success');
    } else {
        const error = await response.json().catch(() => null);
        showToast(error?.detail || 'Не вдалося видалити водія', 'error');
    }
}

function initDriverDeleteModal() {
    const modal = document.getElementById('driver-delete-modal');
    const closeBtn = document.getElementById('driver-delete-close');
    const cancelBtn = document.getElementById('driver-delete-cancel');
    const confirmBtn = document.getElementById('driver-delete-confirm');
    const overlay = modal?.querySelector('.modal-overlay');
    if (!modal || !closeBtn || !cancelBtn || !confirmBtn || !overlay) {
        return;
    }
    const closeModal = () => {
        pendingDriverDeleteId = null;
        modal.classList.add('hidden');
    };
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    confirmBtn.addEventListener('click', async () => {
        if (!pendingDriverDeleteId) {
            closeModal();
            return;
        }
        await deleteDriver(pendingDriverDeleteId);
        closeModal();
    });
}

function initShipmentsForm() {
    const form = document.getElementById('shipment-form');
    const cultureSelect = document.getElementById('shipment-culture');
    if (!form || !cultureSelect) {
        return;
    }
    formBindInvalidHighlightClearing(form);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const destination = document.getElementById('shipment-destination').value.trim();
        const cultureId = parseInt(cultureSelect.value, 10);
        const quantity = parseFloat(document.getElementById('shipment-quantity').value);
        const paymentFormat = document.getElementById('shipment-payment-format')?.value || 'none';
        const driverVal = document.getElementById('shipment-driver')?.value;
        const vehicleVal = document.getElementById('shipment-vehicle')?.value;
        if (!destination) {
            formShowValidationError(form, 'shipment-message', 'Вкажіть куди відправляємо', ['shipment-destination']);
            return;
        }
        if (!cultureId || Number.isNaN(quantity) || quantity <= 0) {
            const msg = !cultureId ? 'Оберіть культуру' : 'Вкажіть коректну кількість';
            const ids = !cultureId ? ['shipment-culture'] : ['shipment-quantity'];
            formShowValidationError(form, 'shipment-message', msg, ids);
            return;
        }
        const payload = {
            destination,
            culture_id: cultureId,
            quantity_kg: quantity,
            payment_format: paymentFormat
        };
        if (driverVal) payload.driver_id = parseInt(driverVal, 10);
        if (vehicleVal) payload.vehicle_type_id = parseInt(vehicleVal, 10);

        const response = await apiFetch('/grain/shipments', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            showToast('Відправку збережено', 'success');
            clearFormValidationState(form, 'shipment-message');
            form.reset();
            closeShipmentCreateModal();
            await refreshAfterMutation(['shipments', 'stock', 'stockAdjustments', 'dashboard']);
        } else {
            const error = await response.json().catch(() => null);
            setFormMessage('shipment-message', error?.detail || 'Помилка збереження', true);
        }
    });
}

function initShipmentCreateModal() {
    const modal = document.getElementById('shipment-create-modal');
    const openBtn = document.getElementById('shipment-open-modal');
    const closeBtn = document.getElementById('shipment-create-close');
    const overlay = modal?.querySelector('.modal-overlay');
    if (!modal || !openBtn || !closeBtn || !overlay) return;

    openBtn.addEventListener('click', () => {
        const form = document.getElementById('shipment-form');
        if (form) clearFormValidationState(form, 'shipment-message');
        populateShipmentSelects();
        modal.classList.remove('hidden');
        initCustomSelects();
    });
    closeBtn.addEventListener('click', closeShipmentCreateModal);
    overlay.addEventListener('click', closeShipmentCreateModal);
}

function closeShipmentCreateModal() {
    const modal = document.getElementById('shipment-create-modal');
    const form = document.getElementById('shipment-form');
    if (form) clearFormValidationState(form, 'shipment-message');
    if (modal) modal.classList.add('hidden');
}

function populateShipmentSelects() {
    const driverSelect = document.getElementById('shipment-driver');
    const vehicleSelect = document.getElementById('shipment-vehicle');
    if (driverSelect) {
        driverSelect.innerHTML = '<option value="">Не обрано</option>' +
            driversCache.map(d => `<option value="${d.id}">${d.full_name}</option>`).join('');
    }
    if (vehicleSelect) {
        vehicleSelect.innerHTML = '<option value="">Не обрано</option>' +
            vehicleTypesCache.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
    }
}

function updateShipmentCultureOptions() {
    const cultureSelect = document.getElementById('shipment-culture');
    const editSelect = document.getElementById('shipment-edit-culture');
    if (cultureSelect) {
        cultureSelect.innerHTML = culturesCache
            .map(culture => `<option value="${culture.id}">${culture.name}</option>`)
            .join('');
        initCustomSelects(cultureSelect);
    }
    if (editSelect) {
        editSelect.innerHTML = culturesCache
            .map(culture => `<option value="${culture.id}">${culture.name}</option>`)
            .join('');
        initCustomSelects(editSelect);
    }
}

function getPaymentFormatLabel(val) {
    if (val === 'cash') return 'Готівка';
    if (val === 'cashless') return 'Безготівковий';
    return emptyValueHtml();
}

function renderShipmentsTable(items) {
    const tableBody = document.querySelector('#shipments-table tbody');
    const hint = document.getElementById('shipments-hint');
    if (!tableBody) {
        return;
    }
    tableBody.innerHTML = '';
    if (items.length === 0) {
        if (hint) {
            hint.textContent = '';
        }
        tableBody.innerHTML = '<tr><td colspan="9" class="table-empty-message">Поки що відправок немає</td></tr>';
        return;
    }
    if (hint) {
        hint.textContent = '';
    }
    items.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(item.created_at)}</td>
            <td><strong>${item.destination}</strong></td>
            <td><span class="inline-badge grain">${getCultureName(item.culture_id)}</span></td>
            <td class="td-weight">${formatWeight(item.quantity_kg)} кг</td>
            <td>${getPaymentFormatLabel(item.payment_format)}</td>
            <td>${item.driver_id ? getDriverName(item.driver_id) : emptyValueHtml()}</td>
            <td>${item.vehicle_type_id ? getVehicleName(item.vehicle_type_id) : emptyValueHtml()}</td>
            <td>${getUserNameHtml(item.created_by_user_id)}</td>
            <td class="actions-cell"></td>
        `;
        const actionsCell = row.querySelector('.actions-cell');
        const editBtn = document.createElement('button');
        editBtn.className = 'btn-icon btn-icon-secondary';
        editBtn.title = 'Редагувати';
        editBtn.innerHTML = ICONS.edit;
        editBtn.addEventListener('click', () => {
            openShipmentEditModal(item);
        });
        actionsCell.appendChild(editBtn);
        tableBody.appendChild(row);
    });
}

function initShipmentsEditModal() {
    const modal = document.getElementById('shipment-edit-modal');
    const closeBtn = document.getElementById('shipment-edit-close');
    const overlay = modal?.querySelector('.modal-overlay');
    const form = document.getElementById('shipment-edit-form');
    if (!modal || !closeBtn || !overlay || !form) {
        return;
    }
    formBindInvalidHighlightClearing(form);
    const closeModal = () => {
        editingShipmentId = null;
        clearFormValidationState(form, 'shipment-edit-message');
        modal.classList.add('hidden');
    };
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!editingShipmentId) {
            return;
        }
        const destination = document.getElementById('shipment-edit-destination').value.trim();
        const cultureId = parseInt(document.getElementById('shipment-edit-culture').value, 10);
        const quantity = parseFloat(document.getElementById('shipment-edit-quantity').value);
        const paymentFormat = document.getElementById('shipment-edit-payment-format')?.value || 'none';
        const driverVal = document.getElementById('shipment-edit-driver')?.value;
        const vehicleVal = document.getElementById('shipment-edit-vehicle')?.value;
        if (!destination) {
            formShowValidationError(form, 'shipment-edit-message', 'Вкажіть куди відправляємо', ['shipment-edit-destination']);
            return;
        }
        if (!cultureId || Number.isNaN(quantity) || quantity <= 0) {
            const msg = !cultureId ? 'Оберіть культуру' : 'Вкажіть коректну кількість';
            const ids = !cultureId ? ['shipment-edit-culture'] : ['shipment-edit-quantity'];
            formShowValidationError(form, 'shipment-edit-message', msg, ids);
            return;
        }
        const payload = {
            destination,
            culture_id: cultureId,
            quantity_kg: quantity,
            payment_format: paymentFormat
        };
        if (driverVal) payload.driver_id = parseInt(driverVal, 10);
        if (vehicleVal) payload.vehicle_type_id = parseInt(vehicleVal, 10);

        const response = await apiFetch(`/grain/shipments/${editingShipmentId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            showToast('Відправку оновлено', 'success');
            clearFormValidationState(form, 'shipment-edit-message');
            await refreshAfterMutation(['shipments', 'stock', 'stockAdjustments', 'dashboard']);
            closeModal();
        } else {
            const error = await response.json().catch(() => null);
            setFormMessage('shipment-edit-message', error?.detail || 'Помилка оновлення', true);
        }
    });
}

function openShipmentEditModal(item) {
    const modal = document.getElementById('shipment-edit-modal');
    if (!modal) return;
    editingShipmentId = item.id;

    document.getElementById('shipment-edit-destination').value = item.destination;

    const cultureSelect = document.getElementById('shipment-edit-culture');
    cultureSelect.innerHTML = culturesCache
        .map(culture => `<option value="${culture.id}">${culture.name}</option>`)
        .join('');
    cultureSelect.value = String(item.culture_id);

    document.getElementById('shipment-edit-quantity').value = item.quantity_kg;

    const pfSelect = document.getElementById('shipment-edit-payment-format');
    if (pfSelect) pfSelect.value = item.payment_format || 'none';

    const driverSelect = document.getElementById('shipment-edit-driver');
    if (driverSelect) {
        driverSelect.innerHTML = '<option value="">Не обрано</option>' +
            driversCache.map(d => `<option value="${d.id}">${d.full_name}</option>`).join('');
        driverSelect.value = item.driver_id ? String(item.driver_id) : '';
    }

    const vehicleSelect = document.getElementById('shipment-edit-vehicle');
    if (vehicleSelect) {
        vehicleSelect.innerHTML = '<option value="">Не обрано</option>' +
            vehicleTypesCache.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
        vehicleSelect.value = item.vehicle_type_id ? String(item.vehicle_type_id) : '';
    }

    initCustomSelects();
    clearFormValidationState(document.getElementById('shipment-edit-form'), 'shipment-edit-message');
    modal.classList.remove('hidden');
}

function initShipmentsReportModal() {
    const modal = document.getElementById('shipments-report-modal');
    const openBtn = document.getElementById('shipments-report-btn');
    const closeBtn = document.getElementById('shipments-report-close');
    const cancelBtn = document.getElementById('shipments-report-cancel');
    const downloadBtn = document.getElementById('shipments-report-download');
    const overlay = modal?.querySelector('.modal-overlay');
    const startInput = document.getElementById('shipments-report-start');
    const endInput = document.getElementById('shipments-report-end');
    const startNative = document.getElementById('shipments-report-start-native');
    const endNative = document.getElementById('shipments-report-end-native');
    const startBtn = document.getElementById('shipments-report-start-btn');
    const endBtn = document.getElementById('shipments-report-end-btn');
    if (!modal || !openBtn || !closeBtn || !cancelBtn || !downloadBtn || !overlay || !startInput || !endInput || !startNative || !endNative || !startBtn || !endBtn) {
        return;
    }
    const openModal = () => modal.classList.remove('hidden');
    const closeModal = () => modal.classList.add('hidden');

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    bindDatePicker(startInput, startNative, startBtn);
    bindDatePicker(endInput, endNative, endBtn);

    downloadBtn.addEventListener('click', async () => {
        const startIso = parseDateInput(startInput.value, 'дата початку');
        if (startIso === undefined) {
            return;
        }
        const endIso = parseDateInput(endInput.value, 'дата завершення');
        if (endIso === undefined) {
            return;
        }
        const params = new URLSearchParams();
        if (startIso) {
            params.append('start_date', startIso);
        }
        if (endIso) {
            params.append('end_date', endIso);
        }
        const path = `/grain/shipments/export${params.toString() ? `?${params}` : ''}`;
        const response = await apiFetchBlob(path);
        if (!response.ok) {
            const error = await response.json().catch(() => null);
            showToast(error?.detail || 'Не вдалося сформувати звіт', 'error');
            return;
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'shipments_report.xlsx';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showToast('Звіт сформовано', 'success');
        closeModal();
    });
}

function getUserName(userId) {
    if (!userId) {
        return '-';
    }
    const user = usersCache?.find?.(item => item.id === userId);
    return user ? user.full_name : '-';
}

function getUserNameHtml(userId) {
    const name = getUserName(userId);
    return name === '-' ? emptyValueHtml() : escapeHtml(name);
}

function openDriverDeleteModal(driverId) {
    const modal = document.getElementById('driver-delete-modal');
    if (!modal) {
        return;
    }
    pendingDriverDeleteId = driverId;
    modal.classList.remove('hidden');
}

// editingUserId, pendingUserDeleteId, loadUsers — у users.js

// openUserEditModal — у users.js

async function loadOwnersList(query) {
    const response = await apiFetch(`/grain/owners${query ? `?q=${encodeURIComponent(query)}` : ''}`);
    if (!response.ok) {
        console.error('Помилка завантаження власників');
        return;
    }
    const owners = await response.json();
    if (!query) {
        ownersCache = owners;
        updateFarmerIntakeFilterOptions();
        updateFarmerContractsFilterOptions();
        updateFarmerMovementFilterOptions();
        // Перезаповнюємо всі owner-селекти, що можуть бути на сторінці
        ['intake-owner-select', 'farmer-contract-owner-select'].forEach(id => {
            if (document.getElementById(id) && typeof populateOwnerSelect === 'function') {
                populateOwnerSelect(id);
            }
        });
    }
    renderOwnersTable(owners);
}

function renderOwnersTable(owners) {
    const tableBody = document.querySelector('#owners-table tbody');
    if (!tableBody) {
        return;
    }
    tableBody.innerHTML = '';
    if (!owners.length) {
        tableBody.innerHTML = '<tr><td colspan="3" class="table-empty-message">Фермерів ще немає</td></tr>';
        return;
    }
    owners.forEach(owner => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${owner.full_name}</strong></td>
            <td>${owner.phone || emptyValueHtml()}</td>
            <td class="actions-cell">
                <button class="btn-icon btn-icon-secondary" data-edit-owner="${owner.id}" title="Редагувати">${ICONS.edit}</button>
                <button class="btn-icon btn-icon-secondary" data-balance="${owner.id}" title="Баланс">${ICONS.balance}</button>
            </td>
        `;
        row.querySelector('[data-edit-owner]').addEventListener('click', () => {
            openFarmerEditModal(owner);
        });
        row.querySelector('[data-balance]').addEventListener('click', () => {
            if (typeof openFarmerBalanceModal === 'function') {
                openFarmerBalanceModal(owner.id);
            }
        });
        tableBody.appendChild(row);
    });
}


// Журнальні: pagination + cache. Початково 100 записів за останні 90 днів,
// «Завантажити ще» дописує сторінку, «Завантажити всю історію» знімає date-фільтр.
const intakesState = createPaginatedState({ pageSize: 100, periodDays: 90 });
const shipmentsState = createPaginatedState({ pageSize: 100, periodDays: 90 });
const purchasesState = createPaginatedState({ pageSize: 100, periodDays: 90 });
const farmerMovementsState = createPaginatedState({ pageSize: 100, periodDays: 90 });
const cashTransactionsState = createPaginatedState({ pageSize: 100, periodDays: 90 });
const stockAdjustmentsState = createPaginatedState({ pageSize: 100, periodDays: 90 });

async function loadAllIntakes({ append = false } = {}) {
    if (!append) {
        intakesState.offset = 0;
        intakesState.items = [];
    }
    const path = '/grain/intakes' + intakesState.toQuery();
    const { data, total } = await apiFetchCached(path, { force: !append });
    intakesState.total = total ?? data.length;
    intakesState.items = append ? intakesState.items.concat(data) : data.slice();
    intakesCache = intakesState.items;
    renderIntakeTable(applyIntakeFilters(intakesCache));
    renderDriverDeliveriesTable(applyDriverDeliveryFilters());
    renderFarmerIntakesTable(applyFarmerIntakeFilters(intakesCache));
    updateIntakeMetrics(intakesCache);
    renderPagedHint('intakes-period-hint', intakesState, loadAllIntakes, 'карток');
}

function initDriverDeliveriesFilters() {
    const driverSelect = document.getElementById('driver-delivery-filter-driver');
    const cultureSelect = document.getElementById('driver-delivery-filter-culture');
    const vehicleSelect = document.getElementById('driver-delivery-filter-vehicle');
    const periodSelect = document.getElementById('driver-delivery-filter-period');
    if (!driverSelect || !cultureSelect || !vehicleSelect || !periodSelect) {
        return;
    }

    updateDriverDeliveryFilterOptions();

    [driverSelect, cultureSelect, vehicleSelect, periodSelect].forEach(select => {
        select.addEventListener('change', () => {
            renderDriverDeliveriesTable(applyDriverDeliveryFilters());
        });
    });
}

function updateDriverDeliveryFilterOptions() {
    const driverSelect = document.getElementById('driver-delivery-filter-driver');
    const cultureSelect = document.getElementById('driver-delivery-filter-culture');
    const vehicleSelect = document.getElementById('driver-delivery-filter-vehicle');
    const reportDriverSelect = document.getElementById('driver-deliveries-report-driver');
    const reportCultureSelect = document.getElementById('driver-deliveries-report-culture');
    const reportVehicleSelect = document.getElementById('driver-deliveries-report-vehicle');

    if (driverSelect) {
        driverSelect.innerHTML = `<option value="">Всі водії</option>${
            driversCache.map(driver => `<option value="${driver.id}">${driver.full_name}</option>`).join('')
        }`;
        initCustomSelects(driverSelect);
    }
    if (cultureSelect) {
        cultureSelect.innerHTML = `<option value="">Всі культури</option>${
            culturesCache.map(culture => `<option value="${culture.id}">${culture.name}</option>`).join('')
        }`;
        initCustomSelects(cultureSelect);
    }
    if (vehicleSelect) {
        vehicleSelect.innerHTML = `<option value="">Всі типи</option>${
            vehicleTypesCache.map(vehicle => `<option value="${vehicle.id}">${vehicle.name}</option>`).join('')
        }`;
        initCustomSelects(vehicleSelect);
    }

    if (reportDriverSelect) {
        reportDriverSelect.innerHTML = `<option value="">Всі водії</option>${
            driversCache.map(driver => `<option value="${driver.id}">${driver.full_name}</option>`).join('')
        }`;
        initCustomSelects(reportDriverSelect);
    }
    if (reportCultureSelect) {
        reportCultureSelect.innerHTML = `<option value="">Всі культури</option>${
            culturesCache.map(culture => `<option value="${culture.id}">${culture.name}</option>`).join('')
        }`;
        initCustomSelects(reportCultureSelect);
    }
    if (reportVehicleSelect) {
        reportVehicleSelect.innerHTML = `<option value="">Всі типи</option>${
            vehicleTypesCache.map(vehicle => `<option value="${vehicle.id}">${vehicle.name}</option>`).join('')
        }`;
        initCustomSelects(reportVehicleSelect);
    }
}

function getPeriodRange(period) {
    if (!period || period === 'all') {
        return null;
    }
    const now = new Date();
    const start = new Date(now);
    if (period === 'today') {
        start.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
        start.setDate(now.getDate() - 6);
        start.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
        start.setDate(now.getDate() - 29);
        start.setHours(0, 0, 0, 0);
    }
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

function buildDriverDeliveriesData() {
    const items = [];
    intakesCache.filter(i => i.is_internal_driver).forEach(intake => {
        items.push({
            _type: 'intake',
            created_at: intake.created_at,
            driver_id: intake.driver_id,
            culture_id: intake.culture_id,
            vehicle_type_id: intake.vehicle_type_id,
            has_trailer: intake.has_trailer,
            destination: null,
            quantity_kg: intake.net_weight_kg,
            gross_weight_kg: intake.gross_weight_kg,
            accepted_weight_kg: intake.accepted_weight_kg,
            pending_quality: intake.pending_quality,
            pending_tare: intake.pending_tare,
        });
    });
    shipmentsCache.filter(s => s.driver_id).forEach(ship => {
        items.push({
            _type: 'shipment',
            created_at: ship.created_at,
            driver_id: ship.driver_id,
            culture_id: ship.culture_id,
            vehicle_type_id: ship.vehicle_type_id,
            has_trailer: false,
            destination: ship.destination,
            quantity_kg: ship.quantity_kg,
            gross_weight_kg: null,
            accepted_weight_kg: ship.quantity_kg,
            pending_quality: false,
            pending_tare: false,
        });
    });
    return items;
}

function applyDriverDeliveryFilters() {
    const driverSelect = document.getElementById('driver-delivery-filter-driver');
    const cultureSelect = document.getElementById('driver-delivery-filter-culture');
    const vehicleSelect = document.getElementById('driver-delivery-filter-vehicle');
    const periodSelect = document.getElementById('driver-delivery-filter-period');

    const all = buildDriverDeliveriesData();

    if (!driverSelect || !cultureSelect || !vehicleSelect || !periodSelect) {
        return all;
    }

    const driverId = driverSelect.value ? parseInt(driverSelect.value, 10) : null;
    const cultureId = cultureSelect.value ? parseInt(cultureSelect.value, 10) : null;
    const vehicleId = vehicleSelect.value ? parseInt(vehicleSelect.value, 10) : null;
    const period = periodSelect.value;
    const range = getPeriodRange(period);

    return all.filter(item => {
        if (driverId && item.driver_id !== driverId) return false;
        if (cultureId && item.culture_id !== cultureId) return false;
        if (vehicleId && item.vehicle_type_id !== vehicleId) return false;
        if (range) {
            const createdAt = new Date(item.created_at);
            if (createdAt < range.start || createdAt > range.end) return false;
        }
        return true;
    });
}

function renderDriverDeliveriesTable(items) {
    const tableBody = document.querySelector('#driver-deliveries-table tbody');
    const hint = document.getElementById('driver-deliveries-hint');
    if (!tableBody || !hint) {
        return;
    }
    const rows = [...items].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    tableBody.innerHTML = '';
    if (!rows.length) {
        hint.textContent = '';
        tableBody.innerHTML = '<tr><td colspan="10" class="table-empty-message">Поки що рейсів немає</td></tr>';
        return;
    }
    hint.textContent = '';
    rows.forEach(item => {
        const row = document.createElement('tr');
        const driver = driversCache.find(d => d.id === item.driver_id);
        const isIntake = item._type === 'intake';
        const typeBadge = isIntake
            ? '<span class="status-badge info">Прийом</span>'
            : '<span class="status-badge warning">Відправка</span>';
        row.innerHTML = `
            <td>${formatDate(item.created_at)}</td>
            <td>${typeBadge}</td>
            <td><strong>${getDriverName(item.driver_id)}</strong></td>
            <td>${driver?.phone || emptyValueHtml()}</td>
            <td>${item.vehicle_type_id ? getVehicleName(item.vehicle_type_id) : emptyValueHtml()}</td>
            <td>${item.has_trailer ? '<span class="status-badge success">Так</span>' : '<span class="td-secondary">Ні</span>'}</td>
            <td><span class="inline-badge grain">${getCultureName(item.culture_id)}</span></td>
            <td>${item.destination || emptyValueHtml()}</td>
            <td class="td-weight">${isIntake && item.pending_tare ? emptyValueHtml() : formatWeight(item.quantity_kg) + ' кг'}</td>
            <td class="td-weight">${item._type === 'intake' && (item.pending_quality || item.pending_tare) ? `<span class="status-badge ${item.pending_tare ? 'danger' : 'warning'}">Очікує</span>` : formatWeight(item.accepted_weight_kg) + ' кг'}</td>
        `;
        tableBody.appendChild(row);
    });
}

function initFarmerIntakeFilters() {
    const ownerSelect = document.getElementById('farmer-intake-filter-owner');
    const cultureSelect = document.getElementById('farmer-intake-filter-culture');
    const periodSelect = document.getElementById('farmer-intake-filter-period');
    if (!ownerSelect || !cultureSelect || !periodSelect) {
        return;
    }

    updateFarmerIntakeFilterOptions();

    [ownerSelect, cultureSelect, periodSelect].forEach(select => {
        select.addEventListener('change', () => {
            renderFarmerIntakesTable(applyFarmerIntakeFilters(intakesCache));
        });
    });
}

function updateFarmerIntakeFilterOptions() {
    const ownerSelect = document.getElementById('farmer-intake-filter-owner');
    const cultureSelect = document.getElementById('farmer-intake-filter-culture');
    if (!ownerSelect || !cultureSelect) {
        return;
    }
    const ownerValue = ownerSelect.value;
    const cultureValue = cultureSelect.value;

    ownerSelect.innerHTML = `<option value="">Всі фермери</option>${
        ownersCache.map(owner => `<option value="${owner.id}">${owner.full_name}</option>`).join('')
    }`;
    cultureSelect.innerHTML = `<option value="">Всі культури</option>${
        culturesCache.map(culture => `<option value="${culture.id}">${culture.name}</option>`).join('')
    }`;

    ownerSelect.value = ownerValue;
    cultureSelect.value = cultureValue;
    initCustomSelects(ownerSelect);
    initCustomSelects(cultureSelect);
}

function applyFarmerIntakeFilters(intakes) {
    const ownerSelect = document.getElementById('farmer-intake-filter-owner');
    const cultureSelect = document.getElementById('farmer-intake-filter-culture');
    const periodSelect = document.getElementById('farmer-intake-filter-period');
    if (!ownerSelect || !cultureSelect || !periodSelect) {
        return intakes;
    }

    const ownerId = ownerSelect.value ? parseInt(ownerSelect.value, 10) : null;
    const cultureId = cultureSelect.value ? parseInt(cultureSelect.value, 10) : null;
    const period = periodSelect.value;
    const range = getPeriodRange(period);

    return intakes.filter(intake => {
        if (intake.is_own_grain) {
            return false;
        }
        if (ownerId && intake.owner_id !== ownerId) {
            return false;
        }
        if (cultureId && intake.culture_id !== cultureId) {
            return false;
        }
        if (range) {
            const createdAt = new Date(intake.created_at);
            if (createdAt < range.start || createdAt > range.end) {
                return false;
            }
        }
        return true;
    });
}

function renderFarmerIntakesTable(intakes) {
    const tableBody = document.querySelector('#farmer-intakes-table tbody');
    const hint = document.getElementById('farmer-intakes-hint');
    if (!tableBody || !hint) {
        return;
    }
    const rows = [...intakes]
        .filter(intake => !intake.is_own_grain)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    tableBody.innerHTML = '';
    if (!rows.length) {
        hint.textContent = '';
        tableBody.innerHTML = '<tr><td colspan="7" class="table-empty-message">Поки що приходів від фермерів немає</td></tr>';
        return;
    }
    hint.textContent = '';
    rows.forEach(intake => {
        const row = document.createElement('tr');
        const ownerName = intake.owner_full_name ? escapeHtml(intake.owner_full_name) : emptyValueHtml();
        const ownerPhone = intake.owner_phone ? escapeHtml(intake.owner_phone) : emptyValueHtml();
        row.innerHTML = `
            <td>${formatDate(intake.created_at)}</td>
            <td><strong>${ownerName}</strong></td>
            <td>${ownerPhone}</td>
            <td><span class="inline-badge grain">${getCultureName(intake.culture_id)}</span></td>
            <td class="td-weight">${formatWeight(intake.gross_weight_kg)} кг</td>
            <td class="td-weight">${formatWeight(intake.net_weight_kg)} кг</td>
            <td class="td-weight">${(intake.pending_quality || intake.pending_tare) ? `<span class="status-badge ${intake.pending_tare ? 'danger' : 'warning'}">Очікує</span>` : formatWeight(intake.accepted_weight_kg) + ' кг'}</td>
        `;
        tableBody.appendChild(row);
    });
}


function renderIntakeTable(intakes) {
    const tableBody = document.querySelector('#intakes-table tbody');
    if (!tableBody) {
        return;
    }
    tableBody.innerHTML = '';
    renderIntakeTableFooter(intakes);  // оновлюємо tfoot завжди — і коли порожньо
    if (!intakes.length) {
        tableBody.innerHTML = '<tr><td colspan="7" class="table-empty-message">Поки що приходів немає</td></tr>';
        return;
    }
    intakes.forEach(intake => {
        const row = document.createElement('tr');
        if (intake.pending_tare) {
            row.classList.add('row-pending-tare');
        } else if (intake.pending_quality) {
            row.classList.add('row-pending');
        }
        const cultureName = getCultureName(intake.culture_id);
        const ownerName = intake.is_own_grain ? 'Підприємство' : (intake.owner_full_name ? escapeHtml(intake.owner_full_name) : emptyValueHtml());
        const combineBadge = intake.is_own_combine ? ' <span class="intake-combine-badge" title="Наш комбайн">Комбайн</span>' : '';
        const statusLabel = intakeStatusLabel(intake);
        const badgeClass = intakeStatusBadgeClass(intake);
        row.innerHTML = `
            <td>${formatDate(intake.created_at)}</td>
            <td><span class="inline-badge grain">${cultureName}</span></td>
            <td class="td-weight">${intake.pending_tare ? emptyValueHtml() : formatWeight(intake.net_weight_kg) + ' кг'}</td>
            <td class="td-weight">${intakeOnStock(intake) ? formatWeight(intake.accepted_weight_kg) + ' кг' : emptyValueHtml()}</td>
            <td><strong>${ownerName}</strong>${combineBadge}</td>
            <td><span class="status-badge ${badgeClass}">${statusLabel}</span></td>
            <td class="actions-cell">
                <button class="btn-icon btn-icon-secondary" data-view="${intake.id}" title="Переглянути">${ICONS.view}</button>
                <button class="btn-icon btn-icon-secondary" data-edit="${intake.id}" title="Редагувати">${ICONS.edit}</button>
            </td>
        `;
        row.querySelector('[data-view]').addEventListener('click', () => {
            openIntakeView(intake.id);
        });
        row.querySelector('[data-edit]').addEventListener('click', () => {
            openIntakeEdit(intake.id);
        });
        tableBody.appendChild(row);
    });
}

/** Рендерить tfoot з підсумками для поточного фільтрованого набору intakes.
 *  Рахуємо нетто і прийнято тільки для тих карток, які реально на складі (без pending). */
function renderIntakeTableFooter(intakes) {
    const table = document.getElementById('intakes-table');
    if (!table) return;
    let tfoot = table.querySelector('tfoot.intake-totals');
    if (!tfoot) {
        tfoot = document.createElement('tfoot');
        tfoot.className = 'intake-totals';
        table.appendChild(tfoot);
    }
    const arr = intakes || [];
    let totalNet = 0;
    let totalAccepted = 0;
    let onStockCount = 0;
    let pendingCount = 0;
    arr.forEach(i => {
        if (i.pending_tare || i.pending_quality) {
            pendingCount++;
        } else {
            onStockCount++;
            totalNet += i.net_weight_kg || 0;
            totalAccepted += i.accepted_weight_kg || 0;
        }
    });
    const pendingHint = pendingCount > 0
        ? ` <span class="td-secondary">(+ ${pendingCount} очікують)</span>`
        : '';
    tfoot.innerHTML = `
        <tr>
            <td><strong>Σ ${arr.length} ${arr.length === 1 ? 'картка' : 'карток'}</strong>${pendingHint}</td>
            <td class="td-secondary">Підсумок підтверджених</td>
            <td class="td-weight"><strong>${formatWeight(totalNet)} кг</strong></td>
            <td class="td-weight"><strong>${formatWeight(totalAccepted)} кг</strong></td>
            <td colspan="3"></td>
        </tr>
    `;
}

// ===== Farmers Report Modals =====

function initFarmersReportModal() {
    const modal = document.getElementById('farmers-report-modal');
    const openBtn = document.getElementById('farmers-report-btn');
    const closeBtn = document.getElementById('farmers-report-close');
    const cancelBtn = document.getElementById('farmers-report-cancel');
    const downloadBtn = document.getElementById('farmers-report-download');
    const overlay = modal?.querySelector('.modal-overlay');
    const searchInput = document.getElementById('farmers-report-search');
    const suggestions = document.getElementById('farmers-report-suggestions');
    if (!modal || !openBtn || !downloadBtn) return;

    let timeout;
    const openModal = () => {
        if (searchInput) searchInput.value = '';
        if (suggestions) { suggestions.innerHTML = ''; suggestions.classList.add('hidden'); }
        modal.classList.remove('hidden');
    };
    const closeModal = () => modal.classList.add('hidden');

    openBtn.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);

    // Autocomplete suggestions
    if (searchInput && suggestions) {
        searchInput.addEventListener('input', () => {
            clearTimeout(timeout);
            const value = searchInput.value.trim();
            if (!value) {
                suggestions.innerHTML = '';
                suggestions.classList.add('hidden');
                return;
            }
            timeout = setTimeout(() => {
                const matches = ownersCache.filter(o =>
                    o.full_name.toLowerCase().includes(value.toLowerCase())
                );
                suggestions.innerHTML = '';
                if (!matches.length) {
                    suggestions.classList.add('hidden');
                    return;
                }
                matches.forEach(o => {
                    const item = document.createElement('div');
                    item.className = 'suggestion-item';
                    item.textContent = o.full_name;
                    item.addEventListener('click', () => {
                        searchInput.value = o.full_name;
                        suggestions.classList.add('hidden');
                    });
                    suggestions.appendChild(item);
                });
                suggestions.classList.remove('hidden');
            }, 150);
        });
        document.addEventListener('click', (e) => {
            if (!suggestions.contains(e.target) && e.target !== searchInput) {
                suggestions.classList.add('hidden');
            }
        });
    }

    downloadBtn.addEventListener('click', async () => {
        const search = searchInput?.value || '';
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        const path = `/grain/owners/export${params.toString() ? `?${params}` : ''}`;
        const response = await apiFetchBlob(path);
        if (!response.ok) {
            const error = await response.json().catch(() => null);
            showToast(error?.detail || 'Не вдалося сформувати звіт', 'error');
            return;
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'farmers_report.xlsx';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showToast('Звіт сформовано', 'success');
        closeModal();
    });
}

function initFarmerIntakesReportModal() {
    const modal = document.getElementById('farmer-intakes-report-modal');
    const openBtn = document.getElementById('farmer-intakes-report-btn');
    const closeBtn = document.getElementById('farmer-intakes-report-close');
    const cancelBtn = document.getElementById('farmer-intakes-report-cancel');
    const downloadBtn = document.getElementById('farmer-intakes-report-download');
    const overlay = modal?.querySelector('.modal-overlay');
    const startInput = document.getElementById('farmer-intakes-report-start');
    const endInput = document.getElementById('farmer-intakes-report-end');
    const startNative = document.getElementById('farmer-intakes-report-start-native');
    const endNative = document.getElementById('farmer-intakes-report-end-native');
    const startBtn = document.getElementById('farmer-intakes-report-start-btn');
    const endBtn = document.getElementById('farmer-intakes-report-end-btn');
    if (!modal || !openBtn || !downloadBtn) return;

    const openModal = () => {
        // Populate owner select
        const ownerSel = document.getElementById('farmer-intakes-report-owner');
        if (ownerSel) {
            ownerSel.innerHTML = '<option value="">Всі фермери</option>' +
                ownersCache.map(o => `<option value="${o.id}">${o.full_name}</option>`).join('');
            refreshCustomSelect(ownerSel);
        }
        // Populate culture select
        const cultureSel = document.getElementById('farmer-intakes-report-culture');
        if (cultureSel) {
            cultureSel.innerHTML = '<option value="">Всі культури</option>' +
                culturesCache.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            refreshCustomSelect(cultureSel);
        }
        modal.classList.remove('hidden');
    };
    const closeModal = () => modal.classList.add('hidden');

    openBtn.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);
    if (startInput && startNative && startBtn) bindDatePicker(startInput, startNative, startBtn);
    if (endInput && endNative && endBtn) bindDatePicker(endInput, endNative, endBtn);

    downloadBtn.addEventListener('click', async () => {
        const startIso = startInput ? parseDateInput(startInput.value, 'дата початку') : null;
        if (startIso === undefined) return;
        const endIso = endInput ? parseDateInput(endInput.value, 'дата завершення') : null;
        if (endIso === undefined) return;

        const params = new URLSearchParams();
        const ownerId = document.getElementById('farmer-intakes-report-owner')?.value;
        const cultureId = document.getElementById('farmer-intakes-report-culture')?.value;
        const period = document.getElementById('farmer-intakes-report-period')?.value;

        if (ownerId) params.append('owner_id', ownerId);
        if (cultureId) params.append('culture_id', cultureId);
        if (period) params.append('period', period);
        if (startIso) params.append('start_date', startIso);
        if (endIso) params.append('end_date', endIso);

        const path = `/grain/owners/intakes/export${params.toString() ? `?${params}` : ''}`;
        const response = await apiFetchBlob(path);
        if (!response.ok) {
            const error = await response.json().catch(() => null);
            showToast(error?.detail || 'Не вдалося сформувати звіт', 'error');
            return;
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'farmer_intakes_report.xlsx';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showToast('Звіт сформовано', 'success');
        closeModal();
    });
}

let farmerBalanceOwnerId = null;
let farmerBalanceKind = 'farmer';  // 'farmer' | 'person'

function initFarmerBalanceModal() {
    const modal = document.getElementById('farmer-balance-modal');
    const closeBtn = document.getElementById('farmer-balance-close');
    const cancelBtn = document.getElementById('farmer-balance-cancel');
    const downloadBtn = document.getElementById('farmer-balance-download');
    const overlay = modal?.querySelector('.modal-overlay');
    const tableBody = document.querySelector('#farmer-balance-table tbody');
    const hint = document.getElementById('farmer-balance-hint');
    const titleEl = document.getElementById('farmer-balance-title');
    if (!modal || !tableBody || !hint || !downloadBtn) return;

    const tableWrap = document.getElementById('farmer-balance-table-wrap');
    const cardsWrap = document.getElementById('farmer-balance-cards-wrap');

    const resetTable = (message) => {
        tableBody.innerHTML = '';
        if (cardsWrap) cardsWrap.innerHTML = '';
        hint.textContent = message;
    };

    const loadBalance = async (kind, id) => {
        const endpoint = kind === 'person'
            ? `/people/${id}/balance`
            : `/grain/owners/${id}/balance`;

        // Перемикаємо вигляд: для фермера — таблиця з кнопкою «Списати»,
        // для людини — просто картки read-only.
        const showCards = kind === 'person';
        if (tableWrap) tableWrap.classList.toggle('hidden', showCards);
        if (cardsWrap) cardsWrap.classList.toggle('hidden', !showCards);

        const response = await apiFetch(endpoint);
        if (!response.ok) {
            const error = await response.json().catch(() => null);
            showToast(error?.detail || 'Не вдалося отримати баланс', 'error');
            return;
        }
        const items = await response.json();
        tableBody.innerHTML = '';
        if (cardsWrap) cardsWrap.innerHTML = '';
        if (!items.length) {
            resetTable(kind === 'person' ? 'Немає зерна на балансі.' : 'Немає невикупленого зерна.');
            return;
        }
        hint.textContent = '';
        if (showCards) {
            // Спрощений вигляд для людини — картки «Культура / N кг»
            items.forEach(item => {
                const card = document.createElement('div');
                card.className = 'fcp-grain-card';
                card.innerHTML = `
                    <span class="fcp-grain-card__name">${escapeHtml(item.culture_name)}</span>
                    <span class="fcp-grain-card__qty">${formatWeight(item.quantity_kg)} кг</span>
                `;
                cardsWrap.appendChild(card);
            });
            return;
        }
        // Фермер — стара таблиця з кнопкою «Списати»
        items.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.culture_name}</td>
                <td class="td-weight">${formatWeight(item.quantity_kg)} кг</td>
                <td class="actions-cell"></td>
            `;
            const actionsCell = row.querySelector('.actions-cell');
            const deductBtn = document.createElement('button');
            deductBtn.className = 'btn btn-secondary btn-small';
            deductBtn.textContent = 'Списати';
            deductBtn.addEventListener('click', () => {
                openFarmerDeductModal(id, item.culture_id, item.culture_name, item.quantity_kg);
            });
            actionsCell.appendChild(deductBtn);
            tableBody.appendChild(row);
        });
    };

    const openModal = (id, opts = {}) => {
        if (!id) return;
        const kind = opts.kind === 'person' ? 'person' : 'farmer';
        farmerBalanceOwnerId = id;
        farmerBalanceKind = kind;
        let name;
        if (kind === 'person') {
            const p = (peopleCache || []).find(x => x.id === id);
            name = p ? p.full_name : 'Людина';
        } else {
            const owner = ownersCache.find(o => o.id === id);
            name = owner ? owner.full_name : 'Фермер';
        }
        if (titleEl) titleEl.textContent = `Баланс: ${name}`;
        // Excel-експорт балансу поки лише для фермерів — для людей endpoint-у немає.
        downloadBtn.style.display = kind === 'person' ? 'none' : '';
        resetTable('Завантаження...');
        loadBalance(kind, id);
        modal.classList.remove('hidden');
    };
    const closeModal = () => modal.classList.add('hidden');

    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);

    downloadBtn.addEventListener('click', async () => {
        if (!farmerBalanceOwnerId || farmerBalanceKind !== 'farmer') return;
        const response = await apiFetchBlob(`/grain/owners/${farmerBalanceOwnerId}/balance/export`);
        if (!response.ok) {
            const error = await response.json().catch(() => null);
            showToast(error?.detail || 'Не вдалося сформувати звіт', 'error');
            return;
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'farmer_balance_report.xlsx';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showToast('Звіт сформовано', 'success');
    });

    openFarmerBalanceModal = openModal;
}

let editingFarmerId = null;

function initFarmerEditModal() {
    const modal = document.getElementById('farmer-edit-modal');
    const closeBtn = document.getElementById('farmer-edit-close');
    const overlay = modal?.querySelector('.modal-overlay');
    const form = document.getElementById('farmer-edit-form');
    if (!modal || !closeBtn || !overlay || !form) return;

    formBindInvalidHighlightClearing(form);

    const closeModal = () => {
        editingFarmerId = null;
        clearFormValidationState(form, 'farmer-edit-message');
        modal.classList.add('hidden');
    };
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!editingFarmerId) return;
        const name = document.getElementById('farmer-edit-name').value.trim();
        const phone = document.getElementById('farmer-edit-phone').value.trim();
        if (!name) {
            formShowValidationError(form, 'farmer-edit-message', 'Вкажіть ПІБ фермера', ['farmer-edit-name']);
            return;
        }
        const response = await apiFetch(`/grain/owners/${editingFarmerId}`, {
            method: 'PATCH',
            body: JSON.stringify({ full_name: name, phone: phone || null })
        });
        if (response.ok) {
            showToast('Фермера оновлено', 'success');
            clearFormValidationState(form, 'farmer-edit-message');
            closeModal();
            await refreshAfterMutation(['owners', 'allIntakes']);
        } else {
            const error = await response.json().catch(() => null);
            setFormMessage('farmer-edit-message', error?.detail || 'Не вдалося оновити', true);
        }
    });
}

function openFarmerEditModal(owner) {
    const modal = document.getElementById('farmer-edit-modal');
    if (!modal) return;
    editingFarmerId = owner.id;
    document.getElementById('farmer-edit-name').value = owner.full_name;
    document.getElementById('farmer-edit-phone').value = owner.phone || '';
    const ff = document.getElementById('farmer-edit-form');
    if (ff) clearFormValidationState(ff, 'farmer-edit-message');
    modal.classList.remove('hidden');
}

function openFarmerDeductModal(ownerId, cultureId, cultureName, available) {
    const modal = document.getElementById('farmer-deduct-modal');
    if (!modal) return;
    const body = modal.querySelector('.modal-body');
    if (body) clearFormValidationState(body, 'farmer-deduct-message');
    document.getElementById('farmer-deduct-culture-name').value = cultureName;
    document.getElementById('farmer-deduct-available').value = formatWeight(available) + ' кг';
    document.getElementById('farmer-deduct-quantity').value = '';
    document.getElementById('farmer-deduct-quantity').max = available;
    document.getElementById('farmer-deduct-note').value = '';
    const title = document.getElementById('farmer-deduct-title');
    const owner = ownersCache.find(o => o.id === ownerId);
    if (title) title.textContent = `Списання: ${owner ? owner.full_name : ''}`;
    modal.classList.remove('hidden');

    modal._context = { ownerId, cultureId, available };
}

function initFarmerDeductModal() {
    const modal = document.getElementById('farmer-deduct-modal');
    const closeBtn = document.getElementById('farmer-deduct-close');
    const cancelBtn = document.getElementById('farmer-deduct-cancel');
    const confirmBtn = document.getElementById('farmer-deduct-confirm');
    const overlay = modal?.querySelector('.modal-overlay');
    if (!modal || !confirmBtn) return;

    const body = modal.querySelector('.modal-body');
    if (body) formBindInvalidHighlightClearing(body);

    const closeModal = () => {
        if (body) clearFormValidationState(body, 'farmer-deduct-message');
        modal.classList.add('hidden');
    };
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);

    confirmBtn.addEventListener('click', async () => {
        const ctx = modal._context;
        if (!ctx) return;
        const qty = parseFloat(document.getElementById('farmer-deduct-quantity').value);
        if (Number.isNaN(qty) || qty <= 0) {
            formShowValidationError(body, 'farmer-deduct-message', 'Вкажіть коректну кількість', ['farmer-deduct-quantity']);
            return;
        }
        if (qty > ctx.available) {
            formShowValidationError(body, 'farmer-deduct-message', `Максимум: ${formatWeight(ctx.available)} кг`, ['farmer-deduct-quantity']);
            return;
        }
        const note = document.getElementById('farmer-deduct-note').value.trim();
        const response = await apiFetch('/grain/farmer-movements/deduct', {
            method: 'POST',
            body: JSON.stringify({
                owner_id: ctx.ownerId,
                culture_id: ctx.cultureId,
                quantity_kg: qty,
                note: note || null
            })
        });
        if (response.ok) {
            showToast('Зерно списано', 'success');
            closeModal();
            if (typeof openFarmerBalanceModal === 'function') {
                openFarmerBalanceModal(ctx.ownerId);
            }
            await refreshAfterMutation([
                'farmerMovements',
                'stock',
                'stockAdjustments',
                'owners',
                'dashboard'
            ]);
        } else {
            const error = await response.json().catch(() => null);
            showToast(error?.detail || 'Помилка списання', 'error');
        }
    });
}

let farmerMovementsCache = [];

async function loadFarmerMovements({ append = false } = {}) {
    if (!append) { farmerMovementsState.offset = 0; farmerMovementsState.items = []; }
    const path = '/grain/farmer-movements' + farmerMovementsState.toQuery();
    const { data, total } = await apiFetchCached(path, { force: !append });
    farmerMovementsState.total = total ?? data.length;
    farmerMovementsState.items = append ? farmerMovementsState.items.concat(data) : data.slice();
    farmerMovementsCache = farmerMovementsState.items;
    renderFarmerMovementsTable(applyFarmerMovementFilters());
    renderPagedHint('farmer-movements-period-hint', farmerMovementsState, loadFarmerMovements, 'переміщень');
}

// ── People — у people.js ──

function applyFarmerMovementFilters() {
    const typeFilter = document.getElementById('farmer-movement-filter-type')?.value || '';
    const ownerFilter = document.getElementById('farmer-movement-filter-owner')?.value || '';
    const cultureFilter = document.getElementById('farmer-movement-filter-culture')?.value || '';
    const periodFilter = document.getElementById('farmer-movement-filter-period')?.value || 'all';

    let filtered = [...farmerMovementsCache];

    if (typeFilter) {
        filtered = filtered.filter(m => m.movement_type === typeFilter);
    }
    if (ownerFilter) {
        const oid = parseInt(ownerFilter);
        filtered = filtered.filter(m => m.from_owner_id === oid || m.to_owner_id === oid);
    }
    if (cultureFilter) {
        const cid = parseInt(cultureFilter);
        filtered = filtered.filter(m => m.culture_id === cid);
    }
    if (periodFilter !== 'all') {
        const now = new Date();
        let cutoff;
        if (periodFilter === 'today') {
            cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (periodFilter === 'week') {
            cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (periodFilter === 'month') {
            cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
        if (cutoff) {
            filtered = filtered.filter(m => new Date(m.created_at) >= cutoff);
        }
    }
    return filtered;
}

function renderFarmerMovementsTable(data) {
    const tableBody = document.querySelector('#farmer-movements-table tbody');
    const hint = document.getElementById('farmer-movements-hint');
    if (!tableBody) return;
    const items = data || farmerMovementsCache;
    tableBody.innerHTML = '';
    if (!items.length) {
        if (hint) hint.style.display = '';
        return;
    }
    if (hint) hint.style.display = 'none';
    items.forEach(m => {
        const fromOwner = ownersCache.find(o => o.id === m.from_owner_id);
        const toOwner = m.to_owner_id ? ownersCache.find(o => o.id === m.to_owner_id) : null;
        const toPerson = m.to_person_id ? (peopleCache || []).find(p => p.id === m.to_person_id) : null;
        const culture = culturesCache.find(c => c.id === m.culture_id);
        const typeBadge = m.movement_type === 'transfer'
            ? '<span class="inline-badge cash">Переміщення</span>'
            : '<span class="inline-badge receive">Списання</span>';
        let toCell;
        if (toOwner) {
            toCell = `<strong>${escapeHtml(toOwner.full_name)}</strong>`;
        } else if (toPerson) {
            toCell = `<strong>${escapeHtml(toPerson.full_name)}</strong> <span class="status-badge info" style="font-size:10px;">людина</span>`;
        } else {
            toCell = emptyValueHtml();
        }
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(m.created_at)}</td>
            <td>${typeBadge}</td>
            <td><strong>${fromOwner ? escapeHtml(fromOwner.full_name) : emptyValueHtml()}</strong></td>
            <td>${toCell}</td>
            <td>${culture ? escapeHtml(culture.name) : emptyValueHtml()}</td>
            <td class="td-weight">${formatWeight(m.quantity_kg)} кг</td>
            <td>${m.note ? escapeHtml(m.note) : emptyValueHtml()}</td>
        `;
        tableBody.appendChild(row);
    });
}

function initFarmerMovementFilters() {
    const typeSelect = document.getElementById('farmer-movement-filter-type');
    const ownerSelect = document.getElementById('farmer-movement-filter-owner');
    const cultureSelect = document.getElementById('farmer-movement-filter-culture');
    const periodSelect = document.getElementById('farmer-movement-filter-period');
    if (!typeSelect || !ownerSelect || !cultureSelect || !periodSelect) return;

    const update = () => renderFarmerMovementsTable(applyFarmerMovementFilters());

    typeSelect.addEventListener('change', update);
    ownerSelect.addEventListener('change', update);
    cultureSelect.addEventListener('change', update);
    periodSelect.addEventListener('change', update);

    initCustomSelects(typeSelect);
    initCustomSelects(periodSelect);
}

function updateFarmerMovementFilterOptions() {
    const ownerSelect = document.getElementById('farmer-movement-filter-owner');
    const cultureSelect = document.getElementById('farmer-movement-filter-culture');
    if (ownerSelect) {
        const val = ownerSelect.value;
        ownerSelect.innerHTML = '<option value="">Всі фермери</option>' +
            ownersCache.map(o => `<option value="${o.id}">${o.full_name}</option>`).join('');
        ownerSelect.value = val;
        initCustomSelects(ownerSelect);
    }
    if (cultureSelect) {
        const val = cultureSelect.value;
        cultureSelect.innerHTML = '<option value="">Всі культури</option>' +
            culturesCache.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        cultureSelect.value = val;
        initCustomSelects(cultureSelect);
    }
}

function initFarmerMovementsReportModal() {
    const modal = document.getElementById('farmer-movements-report-modal');
    const openBtn = document.getElementById('farmer-movements-report-btn');
    const closeBtn = document.getElementById('farmer-movements-report-close');
    const cancelBtn = document.getElementById('farmer-movements-report-cancel');
    const downloadBtn = document.getElementById('farmer-movements-report-download');
    const overlay = modal?.querySelector('.modal-overlay');

    const typeSelect = document.getElementById('farmer-movements-report-type');
    const ownerSelect = document.getElementById('farmer-movements-report-owner');
    const cultureSelect = document.getElementById('farmer-movements-report-culture');
    const periodSelect = document.getElementById('farmer-movements-report-period');
    const startInput = document.getElementById('farmer-movements-report-start');
    const endInput = document.getElementById('farmer-movements-report-end');
    const startNative = document.getElementById('farmer-movements-report-start-native');
    const endNative = document.getElementById('farmer-movements-report-end-native');
    const startBtn = document.getElementById('farmer-movements-report-start-btn');
    const endBtn = document.getElementById('farmer-movements-report-end-btn');

    if (!modal || !openBtn || !downloadBtn) return;

    const openModal = () => {
        if (ownerSelect) {
            ownerSelect.innerHTML = '<option value="">Всі фермери</option>' +
                ownersCache.map(o => `<option value="${o.id}">${o.full_name}</option>`).join('');
            initCustomSelects(ownerSelect);
        }
        if (cultureSelect) {
            cultureSelect.innerHTML = '<option value="">Всі культури</option>' +
                culturesCache.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            initCustomSelects(cultureSelect);
        }
        if (typeSelect) initCustomSelects(typeSelect);
        if (periodSelect) initCustomSelects(periodSelect);
        modal.classList.remove('hidden');
    };
    const closeModal = () => modal.classList.add('hidden');

    openBtn.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);

    if (startInput && startNative && startBtn) bindDatePicker(startInput, startNative, startBtn);
    if (endInput && endNative && endBtn) bindDatePicker(endInput, endNative, endBtn);
    if (periodSelect && startNative && endNative && startInput && endInput) {
        periodSelect.addEventListener('change', () => {
            applyPeriodToDates(periodSelect.value, startNative, endNative, startInput, endInput);
        });
    }

    downloadBtn.addEventListener('click', async () => {
        if (periodSelect && periodSelect.value && periodSelect.value !== '' && startInput && !startInput.value && endInput && !endInput.value) {
            applyPeriodToDates(periodSelect.value, startNative, endNative, startInput, endInput);
        }
        const startIso = startInput ? parseDateInput(startInput.value, 'дата початку') : null;
        if (startIso === undefined) return;
        const endIso = endInput ? parseDateInput(endInput.value, 'дата завершення') : null;
        if (endIso === undefined) return;

        const params = new URLSearchParams();
        if (startIso) params.append('start_date', startIso);
        if (endIso) params.append('end_date', endIso);
        if (typeSelect?.value) params.append('movement_type', typeSelect.value);
        if (ownerSelect?.value) params.append('owner_id', ownerSelect.value);
        if (cultureSelect?.value) params.append('culture_id', cultureSelect.value);

        const path = `/grain/farmer-movements/export${params.toString() ? `?${params}` : ''}`;
        const response = await apiFetchBlob(path);
        if (!response.ok) {
            const error = await response.json().catch(() => null);
            showToast(error?.detail || 'Не вдалося сформувати звіт', 'error');
            return;
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'farmer_movements.xlsx';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showToast('Звіт сформовано', 'success');
        closeModal();
    });
}

function initFarmerTransferModal() {
    const modal = document.getElementById('farmer-transfer-modal');
    const closeBtn = document.getElementById('farmer-transfer-close');
    const cancelBtn = document.getElementById('farmer-transfer-cancel');
    const confirmBtn = document.getElementById('farmer-transfer-confirm');
    const overlay = modal?.querySelector('.modal-overlay');
    const fromSelect = document.getElementById('farmer-transfer-from');
    const toSelect = document.getElementById('farmer-transfer-to');
    const cultureSelect = document.getElementById('farmer-transfer-culture');
    const quantityInput = document.getElementById('farmer-transfer-quantity');
    const noteInput = document.getElementById('farmer-transfer-note');
    const hint = document.getElementById('farmer-transfer-hint');
    const openBtn = document.getElementById('farmer-transfer-btn');
    if (!modal || !confirmBtn || !fromSelect || !toSelect || !cultureSelect) return;

    const transferRoot = modal.querySelector('.modal-body');
    if (transferRoot) formBindInvalidHighlightClearing(transferRoot);

    const closeModal = () => {
        if (transferRoot) clearFormValidationState(transferRoot, 'farmer-transfer-message');
        modal.classList.add('hidden');
    };
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);

    const populateOwners = () => {
        const opts = '<option value="">Оберіть</option>' +
            ownersCache.map(o => `<option value="${o.id}">${o.full_name}</option>`).join('');
        fromSelect.innerHTML = opts;
        toSelect.innerHTML = opts;
        initCustomSelects(fromSelect);
        initCustomSelects(toSelect);
    };

    const balanceSection = document.getElementById('farmer-transfer-balance');
    const balanceCards = document.getElementById('farmer-transfer-balance-cards');

    const loadFromBalance = async () => {
        const fromId = fromSelect.value;
        cultureSelect.innerHTML = '<option value="">Оберіть</option>';
        if (hint) hint.textContent = '';
        if (balanceSection) balanceSection.classList.add('hidden');
        if (balanceCards) balanceCards.innerHTML = '';
        if (!fromId) {
            refreshCustomSelect(cultureSelect);
            return;
        }
        const response = await apiFetch(`/grain/owners/${fromId}/balance`);
        if (!response.ok) return;
        const items = await response.json();
        if (!items.length) {
            if (hint) hint.textContent = 'У цього фермера немає зерна на балансі.';
            refreshCustomSelect(cultureSelect);
            return;
        }

        if (balanceSection && balanceCards) {
            balanceSection.classList.remove('hidden');
            balanceCards.innerHTML = '';
            items.forEach(item => {
                const card = document.createElement('div');
                card.className = 'farmer-transfer-balance__card';
                card.dataset.cultureId = item.culture_id;
                card.innerHTML = `
                    <span class="farmer-transfer-balance__card-name">${item.culture_name}</span>
                    <span class="farmer-transfer-balance__card-qty">${formatWeight(item.quantity_kg)} кг</span>
                `;
                card.addEventListener('click', () => {
                    balanceCards.querySelectorAll('.farmer-transfer-balance__card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    cultureSelect.value = String(item.culture_id);
                    const cWrapper = cultureSelect.closest('.custom-select');
                    if (cWrapper) {
                        updateCustomTrigger(cultureSelect, cWrapper);
                    }
                    quantityInput.focus();
                });
                balanceCards.appendChild(card);
            });
        }

        cultureSelect.innerHTML = '<option value="">Оберіть</option>' +
            items.map(i => `<option value="${i.culture_id}" data-max="${i.quantity_kg}">${i.culture_name} (до ${formatWeight(i.quantity_kg)} кг)</option>`).join('');
        const wrapper = cultureSelect.closest('.custom-select');
        if (wrapper) {
            buildCustomOptions(cultureSelect, wrapper);
            updateCustomTrigger(cultureSelect, wrapper);
        } else {
            initCustomSelects(cultureSelect);
        }
    };

    fromSelect.addEventListener('change', loadFromBalance);

    // ── Receiver toggle: фермер ↔ людина ──
    const personSelect = document.getElementById('farmer-transfer-person');
    const ftToFarmerField = document.getElementById('ft-to-farmer-field');
    const ftToPersonField = document.getElementById('ft-to-person-field');

    const getReceiverKind = () => {
        const checked = modal.querySelector('input[name="ft-receiver"]:checked');
        return checked ? checked.value : 'farmer';
    };

    const applyReceiverKind = () => {
        const kind = getReceiverKind();
        const isPerson = kind === 'person';
        ftToFarmerField?.classList.toggle('hidden', isPerson);
        ftToPersonField?.classList.toggle('hidden', !isPerson);
        if (isPerson) {
            toSelect.value = '';
            if (typeof refreshCustomSelect === 'function') refreshCustomSelect(toSelect);
        } else if (personSelect) {
            personSelect.value = '';
            if (typeof refreshCustomSelect === 'function') refreshCustomSelect(personSelect);
        }
    };

    modal.querySelectorAll('input[name="ft-receiver"]').forEach(r => {
        r.addEventListener('change', applyReceiverKind);
    });

    openBtn?.addEventListener('click', () => {
        if (transferRoot) clearFormValidationState(transferRoot, 'farmer-transfer-message');
        populateOwners();
        cultureSelect.innerHTML = '<option value="">Оберіть</option>';
        initCustomSelects(cultureSelect);
        if (quantityInput) quantityInput.value = '';
        if (noteInput) noteInput.value = '';
        if (hint) hint.textContent = '';
        if (balanceSection) balanceSection.classList.add('hidden');
        if (balanceCards) balanceCards.innerHTML = '';
        // Скинути радіо отримувача
        const farmerR = modal.querySelector('input[name="ft-receiver"][value="farmer"]');
        if (farmerR) farmerR.checked = true;
        if (personSelect) personSelect.value = '';
        applyReceiverKind();
        modal.classList.remove('hidden');
    });

    confirmBtn.addEventListener('click', async () => {
        const fromId = parseInt(fromSelect.value);
        const receiverKind = getReceiverKind();
        const isPersonReceiver = receiverKind === 'person';
        const toId = isPersonReceiver ? null : parseInt(toSelect.value);
        const personId = isPersonReceiver ? parseInt(personSelect?.value || '') : null;
        const cultureId = parseInt(cultureSelect.value);
        const qty = parseFloat(quantityInput.value);
        if (!fromId) {
            formShowValidationError(transferRoot, 'farmer-transfer-message', 'Оберіть фермера-відправника', ['farmer-transfer-from']);
            return;
        }
        if (isPersonReceiver) {
            if (!personId) {
                formShowValidationError(transferRoot, 'farmer-transfer-message', 'Оберіть людину', ['farmer-transfer-person']);
                return;
            }
        } else {
            if (!toId) {
                formShowValidationError(transferRoot, 'farmer-transfer-message', 'Оберіть фермера-отримувача', ['farmer-transfer-to']);
                return;
            }
            if (fromId === toId) {
                const ff = fromSelect.closest('.form-field');
                const tf = toSelect.closest('.form-field');
                formShowValidationError(transferRoot, 'farmer-transfer-message', 'Відправник і отримувач повинні бути різними', [], [ff, tf].filter(Boolean));
                return;
            }
        }
        if (!cultureId) {
            formShowValidationError(transferRoot, 'farmer-transfer-message', 'Оберіть культуру', ['farmer-transfer-culture']);
            return;
        }
        if (Number.isNaN(qty) || qty <= 0) {
            formShowValidationError(transferRoot, 'farmer-transfer-message', 'Вкажіть коректну кількість', ['farmer-transfer-quantity']);
            return;
        }

        const selectedOption = cultureSelect.options[cultureSelect.selectedIndex];
        const maxQty = parseFloat(selectedOption?.dataset?.max || '0');
        if (qty > maxQty) {
            formShowValidationError(transferRoot, 'farmer-transfer-message', `Максимум: ${formatWeight(maxQty)} кг`, ['farmer-transfer-quantity']);
            return;
        }

        const note = noteInput.value.trim();
        const response = await apiFetch('/grain/farmer-movements/transfer', {
            method: 'POST',
            body: JSON.stringify({
                from_owner_id: fromId,
                to_owner_id: toId,
                to_person_id: personId,
                culture_id: cultureId,
                quantity_kg: qty,
                note: note || null
            })
        });
        if (response.ok) {
            showToast('Зерно переміщено', 'success');
            closeModal();
            await refreshAfterMutation([
                'farmerMovements',
                'stock',
                'stockAdjustments',
                'allIntakes',
                'owners',
                'people',
                'peopleActions',
                'dashboard'
            ]);
        } else {
            const error = await response.json().catch(() => null);
            setFormMessage('farmer-transfer-message', error?.detail || 'Помилка переміщення', true);
        }
    });
}

function initIntakeFilters() {
    const cultureSelect = document.getElementById('intake-filter-culture');
    const statusSelect = document.getElementById('intake-filter-status');
    const periodSelect = document.getElementById('intake-filter-period');
    const queryInput = document.getElementById('intake-filter-query');
    const combineSelect = document.getElementById('intake-filter-combine');
    if (!cultureSelect || !statusSelect || !periodSelect || !queryInput) {
        return;
    }

    updateIntakeFilterOptions();

    const applyFilters = () => {
        renderIntakeTable(applyIntakeFilters(intakesCache));
    };

    [cultureSelect, statusSelect, periodSelect].forEach(select => {
        select.addEventListener('change', applyFilters);
    });
    if (combineSelect) combineSelect.addEventListener('change', applyFilters);

    let timeoutId;
    queryInput.addEventListener('input', () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(applyFilters, 200);
    });
}

function updateIntakeFilterOptions() {
    const cultureSelect = document.getElementById('intake-filter-culture');
    if (!cultureSelect) {
        return;
    }
    const currentValue = cultureSelect.value;
    cultureSelect.innerHTML = [
        '<option value="">Всі культури</option>',
        ...culturesCache.map(culture => `<option value="${culture.id}">${culture.name}</option>`)
    ].join('');
    if (currentValue) {
        cultureSelect.value = currentValue;
    }
    refreshCustomSelect(cultureSelect);
}

function updateIntakeReportOptions() {
    const cultureSelect = document.getElementById('intake-report-culture');
    if (!cultureSelect) {
        return;
    }
    const currentValue = cultureSelect.value;
    cultureSelect.innerHTML = [
        '<option value="">Всі культури</option>',
        ...culturesCache.map(culture => `<option value="${culture.id}">${culture.name}</option>`)
    ].join('');
    if (currentValue) {
        cultureSelect.value = currentValue;
    }
    refreshCustomSelect(cultureSelect);
}

function refreshCustomSelect(select) {
    const wrapper = select.closest('.custom-select');
    if (wrapper) {
        buildCustomOptions(select, wrapper);
        updateCustomTrigger(select, wrapper);
    } else {
        initCustomSelects(select);
    }
}

function applyIntakeFilters(intakes) {
    const cultureSelect = document.getElementById('intake-filter-culture');
    const statusSelect = document.getElementById('intake-filter-status');
    const periodSelect = document.getElementById('intake-filter-period');
    const queryInput = document.getElementById('intake-filter-query');
    const combineSelect = document.getElementById('intake-filter-combine');
    if (!cultureSelect || !statusSelect || !periodSelect || !queryInput) {
        return intakes;
    }

    const cultureId = cultureSelect.value ? parseInt(cultureSelect.value, 10) : null;
    const status = statusSelect.value;
    const period = periodSelect.value;
    const combineValue = combineSelect ? combineSelect.value : '';
    const query = queryInput.value.trim().toLowerCase();

    let filtered = intakes.slice();

    if (cultureId) {
        filtered = filtered.filter(item => item.culture_id === cultureId);
    }

    if (status === 'pending') {
        filtered = filtered.filter(item => item.pending_quality || item.pending_tare);
    } else if (status === 'confirmed') {
        filtered = filtered.filter(item => !item.pending_quality && !item.pending_tare);
    }

    if (combineValue === 'yes') {
        filtered = filtered.filter(item => item.is_own_combine === true);
    } else if (combineValue === 'no') {
        filtered = filtered.filter(item => !item.is_own_combine);
    }

    if (period !== 'all') {
        const now = new Date();
        const start = new Date(now);
        if (period === 'today') {
            start.setHours(0, 0, 0, 0);
        } else if (period === 'week') {
            start.setDate(now.getDate() - 6);
            start.setHours(0, 0, 0, 0);
        } else if (period === 'month') {
            start.setDate(now.getDate() - 29);
            start.setHours(0, 0, 0, 0);
        }
        filtered = filtered.filter(item => {
            const created = new Date(item.created_at);
            return created >= start;
        });
    }

    if (query) {
        filtered = filtered.filter(item => {
            const cultureName = getCultureName(item.culture_id).toLowerCase();
            const ownerName = item.is_own_grain ? 'підприємство' : (item.owner_full_name || '');
            const driverName = item.is_internal_driver
                ? getDriverName(item.driver_id)
                : 'інший водій';
            const haystack = [
                cultureName,
                ownerName.toLowerCase(),
                driverName.toLowerCase()
            ].join(' ');
            return haystack.includes(query);
        });
    }

    return filtered;
}

function initIntakeSummaryReport() {
    const modal = document.getElementById('intake-summary-report-modal');
    const openBtn = document.getElementById('intake-summary-report-btn');
    const closeBtn = document.getElementById('intake-summary-report-close');
    const cancelBtn = document.getElementById('intake-summary-report-cancel');
    const downloadBtn = document.getElementById('intake-summary-report-download');
    const overlay = modal?.querySelector('.modal-overlay');
    const startInput = document.getElementById('intake-summary-start');
    const endInput = document.getElementById('intake-summary-end');
    const startNative = document.getElementById('intake-summary-start-native');
    const endNative = document.getElementById('intake-summary-end-native');
    const startBtn = document.getElementById('intake-summary-start-btn');
    const endBtn = document.getElementById('intake-summary-end-btn');
    const periodSelect = document.getElementById('intake-summary-period');

    if (!modal || !openBtn || !downloadBtn) return;

    const openModal = () => {
        modal.classList.remove('hidden');
        initCustomSelects(periodSelect);
        applyPeriodToDates(periodSelect.value, startNative, endNative, startInput, endInput);
    };
    const closeModal = () => modal.classList.add('hidden');

    openBtn.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);
    bindDatePicker(startInput, startNative, startBtn);
    bindDatePicker(endInput, endNative, endBtn);
    periodSelect?.addEventListener('change', () => {
        applyPeriodToDates(periodSelect.value, startNative, endNative, startInput, endInput);
    });

    downloadBtn.addEventListener('click', async () => {
        const startIso = parseDateInput(startInput.value, 'дата початку');
        if (startIso === undefined) return;
        const endIso = parseDateInput(endInput.value, 'дата завершення');
        if (endIso === undefined) return;

        const params = new URLSearchParams();
        if (startIso) params.append('start_date', startIso);
        if (endIso) params.append('end_date', endIso);

        downloadBtn.disabled = true;
        downloadBtn.textContent = 'Завантаження...';
        try {
            const path = `/grain/intakes/summary-export${params.toString() ? `?${params}` : ''}`;
            const response = await apiFetchBlob(path);
            if (!response.ok) {
                showToast('Не вдалося сформувати звіт', 'error');
                return;
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'intakes_summary_report.xlsx';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            closeModal();
        } finally {
            downloadBtn.disabled = false;
            downloadBtn.textContent = 'Скачати Excel';
        }
    });
}

function initIntakeReportModal() {
    const modal = document.getElementById('intake-report-modal');
    const openBtn = document.getElementById('intake-report-btn');
    const closeBtn = document.getElementById('intake-report-close');
    const cancelBtn = document.getElementById('intake-report-cancel');
    const downloadBtn = document.getElementById('intake-report-download');
    const overlay = modal?.querySelector('.modal-overlay');
    const startInput = document.getElementById('intake-report-start');
    const endInput = document.getElementById('intake-report-end');
    const startNative = document.getElementById('intake-report-start-native');
    const endNative = document.getElementById('intake-report-end-native');
    const startBtn = document.getElementById('intake-report-start-btn');
    const endBtn = document.getElementById('intake-report-end-btn');
    const cultureSelect = document.getElementById('intake-report-culture');
    const periodSelect = document.getElementById('intake-report-period');
    const statusSelect = document.getElementById('intake-report-status');
    const combineSelect = document.getElementById('intake-report-combine');

    if (!modal || !openBtn || !closeBtn || !cancelBtn || !downloadBtn || !overlay || !startInput || !endInput || !startNative || !endNative || !startBtn || !endBtn || !cultureSelect || !periodSelect || !statusSelect) {
        return;
    }

    const openModal = () => {
        modal.classList.remove('hidden');
        const filterCulture = document.getElementById('intake-filter-culture');
        const filterPeriod = document.getElementById('intake-filter-period');
        const filterStatus = document.getElementById('intake-filter-status');
        if (filterCulture) {
            cultureSelect.value = filterCulture.value || '';
        }
        if (filterPeriod) {
            periodSelect.value = filterPeriod.value || 'all';
        }
        if (filterStatus) {
            statusSelect.value = filterStatus.value || 'all';
        }
        initCustomSelects(cultureSelect);
        initCustomSelects(periodSelect);
        initCustomSelects(statusSelect);
        applyPeriodToDates(periodSelect.value, startNative, endNative, startInput, endInput);
    };
    const closeModal = () => modal.classList.add('hidden');

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    bindDatePicker(startInput, startNative, startBtn);
    bindDatePicker(endInput, endNative, endBtn);
    periodSelect.addEventListener('change', () => {
        applyPeriodToDates(periodSelect.value, startNative, endNative, startInput, endInput);
    });

    downloadBtn.addEventListener('click', async () => {
        const startIso = parseDateInput(startInput.value, 'дата початку');
        if (startIso === undefined) {
            return;
        }
        const endIso = parseDateInput(endInput.value, 'дата завершення');
        if (endIso === undefined) {
            return;
        }
        const params = new URLSearchParams();
        if (startIso) {
            params.append('start_date', startIso);
        }
        if (endIso) {
            params.append('end_date', endIso);
        }
        if (cultureSelect.value) {
            params.append('culture_id', cultureSelect.value);
        }
        if (periodSelect.value && periodSelect.value !== 'all' && !startIso && !endIso) {
            applyPeriodToDates(periodSelect.value, startNative, endNative, startInput, endInput);
        }
        if (statusSelect.value && statusSelect.value !== 'all') {
            params.append('status_filter', statusSelect.value);
        }
        if (combineSelect && combineSelect.value === 'true') {
            params.append('is_own_combine', 'true');
        } else if (combineSelect && combineSelect.value === 'false') {
            params.append('is_own_combine', 'false');
        }

        const path = `/grain/intakes/export${params.toString() ? `?${params}` : ''}`;
        const response = await apiFetchBlob(path);
        if (!response.ok) {
            const error = await response.json().catch(() => null);
            showToast(error?.detail || 'Не вдалося сформувати звіт', 'error');
            return;
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'intake_report.xlsx';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showToast('Звіт сформовано', 'success');
        closeModal();
    });
}

function initPurchasesReportModal() {
    const modal = document.getElementById('purchases-report-modal');
    const openBtn = document.getElementById('purchases-report-btn');
    const closeBtn = document.getElementById('purchases-report-close');
    const cancelBtn = document.getElementById('purchases-report-cancel');
    const downloadBtn = document.getElementById('purchases-report-download');
    const overlay = modal?.querySelector('.modal-overlay');
    const startInput = document.getElementById('purchases-report-start');
    const endInput = document.getElementById('purchases-report-end');
    const startNative = document.getElementById('purchases-report-start-native');
    const endNative = document.getElementById('purchases-report-end-native');
    const startBtn = document.getElementById('purchases-report-start-btn');
    const endBtn = document.getElementById('purchases-report-end-btn');

    if (!modal || !openBtn || !closeBtn || !cancelBtn || !downloadBtn || !overlay || !startInput || !endInput || !startNative || !endNative || !startBtn || !endBtn) {
        return;
    }

    const openModal = () => modal.classList.remove('hidden');
    const closeModal = () => modal.classList.add('hidden');

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    bindDatePicker(startInput, startNative, startBtn);
    bindDatePicker(endInput, endNative, endBtn);

    downloadBtn.addEventListener('click', async () => {
        const startIso = parseDateInput(startInput.value, 'дата початку');
        if (startIso === undefined) {
            return;
        }
        const endIso = parseDateInput(endInput.value, 'дата завершення');
        if (endIso === undefined) {
            return;
        }
        const params = new URLSearchParams();
        if (startIso) {
            params.append('start_date', startIso);
        }
        if (endIso) {
            params.append('end_date', endIso);
        }
        const path = `/purchases/export${params.toString() ? `?${params}` : ''}`;
        const response = await apiFetchBlob(path);
        if (!response.ok) {
            const error = await response.json().catch(() => null);
            showToast(error?.detail || 'Не вдалося сформувати звіт', 'error');
            return;
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'purchases_report.xlsx';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showToast('Звіт сформовано', 'success');
        closeModal();
    });
}

function initDriverDeliveriesReportModal() {
    const modal = document.getElementById('driver-deliveries-report-modal');
    const openBtn = document.getElementById('driver-deliveries-report-btn');
    const closeBtn = document.getElementById('driver-deliveries-report-close');
    const cancelBtn = document.getElementById('driver-deliveries-report-cancel');
    const downloadBtn = document.getElementById('driver-deliveries-report-download');
    const overlay = modal?.querySelector('.modal-overlay');
    const driverSelect = document.getElementById('driver-deliveries-report-driver');
    const cultureSelect = document.getElementById('driver-deliveries-report-culture');
    const vehicleSelect = document.getElementById('driver-deliveries-report-vehicle');
    const periodSelect = document.getElementById('driver-deliveries-report-period');
    const startInput = document.getElementById('driver-deliveries-report-start');
    const endInput = document.getElementById('driver-deliveries-report-end');
    const startNative = document.getElementById('driver-deliveries-report-start-native');
    const endNative = document.getElementById('driver-deliveries-report-end-native');
    const startBtn = document.getElementById('driver-deliveries-report-start-btn');
    const endBtn = document.getElementById('driver-deliveries-report-end-btn');

    if (!modal || !openBtn || !closeBtn || !cancelBtn || !downloadBtn || !overlay || !driverSelect || !cultureSelect || !vehicleSelect || !periodSelect || !startInput || !endInput || !startNative || !endNative || !startBtn || !endBtn) {
        return;
    }

    const openModal = () => {
        modal.classList.remove('hidden');
        updateDriverDeliveryFilterOptions();
        initCustomSelects(driverSelect);
        initCustomSelects(cultureSelect);
        initCustomSelects(vehicleSelect);
        initCustomSelects(periodSelect);
    };
    const closeModal = () => modal.classList.add('hidden');

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    bindDatePicker(startInput, startNative, startBtn);
    bindDatePicker(endInput, endNative, endBtn);
    periodSelect.addEventListener('change', () => {
        applyPeriodToDates(periodSelect.value, startNative, endNative, startInput, endInput);
    });

    downloadBtn.addEventListener('click', async () => {
        if (periodSelect.value && periodSelect.value !== 'all' && !startInput.value && !endInput.value) {
            applyPeriodToDates(periodSelect.value, startNative, endNative, startInput, endInput);
        }
        const startIso = parseDateInput(startInput.value, 'дата початку');
        if (startIso === undefined) {
            return;
        }
        const endIso = parseDateInput(endInput.value, 'дата завершення');
        if (endIso === undefined) {
            return;
        }
        const params = new URLSearchParams();
        if (startIso) {
            params.append('start_date', startIso);
        }
        if (endIso) {
            params.append('end_date', endIso);
        }
        if (driverSelect.value) {
            params.append('driver_id', driverSelect.value);
        }
        if (cultureSelect.value) {
            params.append('culture_id', cultureSelect.value);
        }
        if (vehicleSelect.value) {
            params.append('vehicle_type_id', vehicleSelect.value);
        }
        const path = `/grain/driver-deliveries/export${params.toString() ? `?${params}` : ''}`;
        const response = await apiFetchBlob(path);
        if (!response.ok) {
            const error = await response.json().catch(() => null);
            showToast(error?.detail || 'Не вдалося сформувати звіт', 'error');
            return;
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'driver_deliveries.xlsx';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showToast('Звіт сформовано', 'success');
        closeModal();
    });
}

function initStockAdjustmentsReportModal() {
    const modal = document.getElementById('stock-adjustments-report-modal');
    const openBtn = document.getElementById('stock-adjustments-report-btn');
    const closeBtn = document.getElementById('stock-adjustments-report-close');
    const cancelBtn = document.getElementById('stock-adjustments-report-cancel');
    const downloadBtn = document.getElementById('stock-adjustments-report-download');
    const overlay = modal?.querySelector('.modal-overlay');
    const stockTypeSelect = document.getElementById('stock-adjustments-report-stock-type');
    const cultureSelect = document.getElementById('stock-adjustments-report-culture');
    const sourceSelect = document.getElementById('stock-adjustments-report-source');
    const startInput = document.getElementById('stock-adjustments-report-start');
    const endInput = document.getElementById('stock-adjustments-report-end');
    const startNative = document.getElementById('stock-adjustments-report-start-native');
    const endNative = document.getElementById('stock-adjustments-report-end-native');
    const startBtn = document.getElementById('stock-adjustments-report-start-btn');
    const endBtn = document.getElementById('stock-adjustments-report-end-btn');

    if (!modal || !openBtn || !closeBtn || !cancelBtn || !downloadBtn || !overlay || !stockTypeSelect || !cultureSelect || !sourceSelect || !startInput || !endInput || !startNative || !endNative || !startBtn || !endBtn) {
        return;
    }

    const openModal = () => {
        if (cultureSelect) {
            cultureSelect.innerHTML = '<option value="">Всі культури</option>' +
                culturesCache.map(culture => `<option value="${culture.id}">${culture.name}</option>`).join('');
            initCustomSelects(cultureSelect);
        }
        modal.classList.remove('hidden');
    };
    const closeModal = () => modal.classList.add('hidden');

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    bindDatePicker(startInput, startNative, startBtn);
    bindDatePicker(endInput, endNative, endBtn);

    downloadBtn.addEventListener('click', async () => {
        const startIso = parseDateInput(startInput.value, 'дата початку');
        if (startIso === undefined) {
            return;
        }
        const endIso = parseDateInput(endInput.value, 'дата завершення');
        if (endIso === undefined) {
            return;
        }
        const params = new URLSearchParams();
        if (startIso) {
            params.append('start_date', startIso);
        }
        if (endIso) {
            params.append('end_date', endIso);
        }
        if (stockTypeSelect.value) {
            params.append('stock_type', stockTypeSelect.value);
        }
        if (cultureSelect.value) {
            params.append('culture_id', cultureSelect.value);
        }
        if (sourceSelect.value) {
            params.append('source', sourceSelect.value);
        }
        const path = `/grain/stock/adjustments/export${params.toString() ? `?${params}` : ''}`;
        const response = await apiFetchBlob(path);
        if (!response.ok) {
            const error = await response.json().catch(() => null);
            showToast(error?.detail || 'Не вдалося сформувати звіт', 'error');
            return;
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'stock_adjustments.xlsx';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showToast('Звіт сформовано', 'success');
        closeModal();
    });
}

function applyPeriodToDates(period, startNative, endNative, startInput, endInput) {
    const now = new Date();
    let start = null;
    let end = new Date(now);
    end.setHours(0, 0, 0, 0);
    if (period === 'today') {
        start = new Date(now);
    } else if (period === 'week') {
        start = new Date(now);
        start.setDate(now.getDate() - 6);
    } else if (period === 'month') {
        start = new Date(now);
        start.setDate(now.getDate() - 29);
    }

    if (!start) {
        startNative.value = '';
        endNative.value = '';
        startInput.value = '';
        endInput.value = '';
        return;
    }

    start.setHours(0, 0, 0, 0);
    const toIso = (date) => date.toISOString().slice(0, 10);
    startNative.value = toIso(start);
    endNative.value = toIso(end);
    startInput.value = formatDateDisplay(startNative.value);
    endInput.value = formatDateDisplay(endNative.value);
}

function updateIntakeMetrics(intakes) {
    const pendingCount = intakes.filter(item => item.pending_quality || item.pending_tare).length;
    const now = new Date();
    const todayKey = now.toDateString();
    const todayCount = intakes.filter(item => new Date(item.created_at).toDateString() === todayKey).length;
    const todayKg = intakes
        .filter(item => new Date(item.created_at).toDateString() === todayKey)
        .reduce((sum, item) => sum + (intakeOnStock(item) ? (item.accepted_weight_kg || 0) : 0), 0);

    const pendingEl = document.getElementById('intake-pending-count');
    const todayEl = document.getElementById('intake-today-count');
    const todayKgEl = document.getElementById('intake-today-kg');

    if (pendingEl) pendingEl.textContent = pendingCount;
    if (todayEl) todayEl.textContent = todayCount;
    if (todayKgEl) todayKgEl.textContent = formatWeight(todayKg);
}

async function loadStock() {
    const response = await apiFetch('/grain/stock');
    if (!response.ok) {
        console.error('Помилка завантаження складу');
        return;
    }
    const stock = await response.json();
    // Гарантируем, что в таблице есть все культуры, даже с нулевым остатком.
    if (!culturesCache.length) {
        const culturesResponse = await apiFetch('/grain/cultures');
        if (culturesResponse.ok) {
            culturesCache = await culturesResponse.json();
        }
    }
    const stockByCulture = new Map(stock.map(item => [item.culture_id, item]));
    const mergedStock = culturesCache.length
        ? culturesCache.map(culture => {
            const existing = stockByCulture.get(culture.id);
            return existing || {
                culture_id: culture.id,
                culture_name: culture.name,
                quantity_kg: 0,
                own_quantity_kg: 0,
                farmer_quantity_kg: 0,
                reserved_kg: 0,
                price_per_kg: culture.price_per_kg
            };
        })
        : stock;
    const tableBody = document.querySelector('#stock-table tbody');
    tableBody.innerHTML = '';
    if (!mergedStock.length) {
        tableBody.innerHTML = '<tr><td colspan="6" class="table-empty-message">Склад порожній</td></tr>';
    }
    mergedStock.forEach(item => {
        const row = document.createElement('tr');
        const farmerQty = item.farmer_quantity_kg || 0;
        const reservedQty = item.reserved_kg || 0;
        const qtyColor = item.quantity_kg > 0 ? '#16a34a' : 'var(--text-muted)';
        row.innerHTML = `
            <td><span class="inline-badge grain">${item.culture_name}</span></td>
            <td class="td-weight"><strong style="color:${qtyColor}">${formatWeight(item.quantity_kg)} кг</strong></td>
            <td class="td-weight">${farmerQty > 0 ? formatWeight(farmerQty) + ' кг' : '<span class="td-secondary">0</span>'}</td>
            <td class="td-weight">${reservedQty > 0 ? `<span style="color:#b45309">${formatWeight(reservedQty)} кг</span>` : '<span class="td-secondary">0</span>'}</td>
            <td class="td-mono">${formatAmount(item.price_per_kg)} ₴/кг</td>
            <td class="actions-cell"></td>
        `;
        const actionsCell = row.querySelector('.actions-cell');
        if (isSuperAdmin) {
            const button = document.createElement('button');
            button.className = 'btn-icon btn-icon-secondary';
            button.innerHTML = ICONS.adjust;
            button.title = 'Змінити кількість';
            button.addEventListener('click', () => {
                openStockAdjustModal({
                    type: 'grain',
                    id: item.culture_id,
                    label: item.culture_name
                });
            });
            const priceBtn = document.createElement('button');
            priceBtn.className = 'btn-icon btn-icon-secondary';
            priceBtn.innerHTML = ICONS.price;
            priceBtn.title = 'Змінити ціну';
            priceBtn.addEventListener('click', () => {
                openCulturePriceModal({
                    id: item.culture_id,
                    label: item.culture_name,
                    price: item.price_per_kg
                });
            });
            actionsCell.appendChild(button);
            actionsCell.appendChild(priceBtn);
        } else {
            actionsCell.innerHTML = '<span class="td-secondary">Лише перегляд</span>';
        }
        tableBody.appendChild(row);
    });
}

async function loadPurchaseStock() {
    const response = await apiFetch('/purchases/stock');
    if (!response.ok) {
        console.error('Помилка завантаження складу закупівель');
        return;
    }
    purchaseStockCache = await response.json();
    renderPurchaseStockTable('purchase-stock-fertilizer-table', 'fertilizer');
    renderPurchaseStockTable('purchase-stock-seed-table', 'seed');
    const nameInput = document.getElementById('purchase-name');
    if (nameInput && nameInput.value) {
        nameInput.dispatchEvent(new Event('input'));
    }
}

async function loadStockAdjustments() {
    const tableBody = document.querySelector('#stock-adjustments-table tbody');
    const hint = document.getElementById('stock-adjustments-hint');
    if (!tableBody || !hint) {
        return;
    }
    hint.textContent = 'Завантаження...';
    tableBody.innerHTML = '';

    const [grainResponse, purchaseResponse] = await Promise.all([
        apiFetch('/grain/stock/adjustments'),
        apiFetch('/purchases/stock/adjustments')
    ]);

    if (!grainResponse.ok && !purchaseResponse.ok) {
        hint.textContent = 'Не вдалося завантажити журнал.';
        return;
    }

    const logs = [];
    if (grainResponse.ok) {
        logs.push(...await grainResponse.json());
    }
    if (purchaseResponse.ok) {
        logs.push(...await purchaseResponse.json());
    }

    logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const rows = logs.slice(0, 50);
    if (!rows.length) {
        hint.textContent = 'Поки що змін немає.';
        return;
    }

    hint.textContent = '';
    rows.forEach(item => {
        const row = document.createElement('tr');
        const isPurchase = item.stock_type === 'purchase';
        const categoryLabel = item.category === 'fertilizer'
            ? 'Добрива'
            : item.category === 'seed'
                ? 'Посівне'
                : 'Закупівлі';
        const typeLabel = isPurchase ? categoryLabel : 'Зерно';
        const isAdd = item.transaction_type === 'add';
        const deltaLabel = `<span class="${isAdd ? 'td-delta-add' : 'td-delta-sub'}">${isAdd ? '+' : '-'}${formatWeight(item.amount)} кг</span>`;
        const destPart = item.destination ? escapeHtml(item.destination) : emptyValueHtml();
        const noteLabel = item.source === 'shipment'
            ? `Відправка: ${destPart}`
            : item.source === 'intake'
                ? `Прийом: ${destPart}`
                : 'Ручне';

        row.innerHTML = `
            <td>${formatDate(item.created_at)}</td>
            <td>${typeLabel}</td>
            <td><strong>${item.item_name}</strong></td>
            <td>${deltaLabel}</td>
            <td class="td-weight">${formatWeight(item.quantity_after)} кг</td>
            <td>${item.user_full_name}</td>
            <td>${noteLabel}</td>
        `;
        tableBody.appendChild(row);
    });
}

function renderPurchaseStockTable(tableId, category) {
    const tableBody = document.querySelector(`#${tableId} tbody`);
    if (!tableBody) {
        return;
    }
    tableBody.innerHTML = '';
    const items = purchaseStockCache.filter(item => item.category === category);
    if (!items.length) {
        tableBody.innerHTML = '<tr><td colspan="6" class="table-empty-message">Товарів ще немає</td></tr>';
        return;
    }
    items.forEach(item => {
            const row = document.createElement('tr');
            const reserved = item.reserved_kg || 0;
            const available = item.quantity_kg - reserved;
            const availColor = available > 0 ? '#16a34a' : (available < 0 ? '#dc2626' : 'var(--text-muted)');
            row.innerHTML = `
                <td><strong>${item.name}</strong></td>
                <td class="td-weight">${formatWeight(item.quantity_kg)} кг</td>
                <td class="td-weight">${reserved > 0 ? `<span style="color:#b45309">${formatWeight(reserved)} кг</span>` : '<span class="td-secondary">0</span>'}</td>
                <td class="td-weight"><strong style="color:${availColor}">${formatWeight(available)} кг</strong></td>
                <td class="td-mono">${formatAmount(item.sale_price_per_kg ?? 0)} ₴/кг</td>
                <td class="actions-cell"></td>
            `;
            const actionsCell = row.querySelector('.actions-cell');
            if (isSuperAdmin) {
                const adjustBtn = document.createElement('button');
                adjustBtn.className = 'btn-icon btn-icon-secondary';
                adjustBtn.innerHTML = ICONS.adjust;
                adjustBtn.title = 'Змінити кількість';
                adjustBtn.addEventListener('click', () => {
                    openStockAdjustModal({
                        type: 'purchase',
                        id: item.id,
                        label: item.name
                    });
                });

                const priceBtn = document.createElement('button');
                priceBtn.className = 'btn-icon btn-icon-secondary';
                priceBtn.innerHTML = ICONS.price;
                priceBtn.title = 'Змінити ціну';
                priceBtn.addEventListener('click', () => {
                    openStockPriceModal({
                        id: item.id,
                        label: item.name,
                        price: item.sale_price_per_kg ?? 0
                    });
                });

                actionsCell.appendChild(adjustBtn);
                actionsCell.appendChild(priceBtn);
            } else {
                actionsCell.innerHTML = '<span class="td-secondary">Лише перегляд</span>';
            }
            tableBody.appendChild(row);
        });
}

async function updatePurchaseStockPrice(stockId, priceValue) {
    const price = parseFloat(priceValue);
    if (Number.isNaN(price) || price < 0) {
        return false;
    }
    const response = await apiFetch(`/purchases/stock/${stockId}/price`, {
        method: 'PATCH',
        body: JSON.stringify({ sale_price_per_kg: price })
    });
    if (response.ok) {
        await refreshAfterMutation(['purchaseStock', 'farmerContracts', 'dashboard']);
        return true;
    }
    return false;
}

let stockAdjustContext = null;
let stockReserveContext = null;
let stockPriceContext = null;
let culturePriceContext = null;

function initStockAdjustModal() {
    const modal = document.getElementById('stock-adjust-modal');
    const closeBtn = document.getElementById('stock-adjust-close');
    const cancelBtn = document.getElementById('stock-adjust-cancel');
    const applyBtn = document.getElementById('stock-adjust-apply');
    const overlay = modal?.querySelector('.modal-overlay');
    const typeSelect = document.getElementById('stock-adjust-type');
    const amountInput = document.getElementById('stock-adjust-amount');
    if (!modal || !closeBtn || !cancelBtn || !applyBtn || !overlay || !typeSelect || !amountInput) {
        return;
    }

    const body = modal.querySelector('.modal-body');
    if (body) formBindInvalidHighlightClearing(body);

    initCustomSelects(typeSelect);

    const closeModal = () => {
        if (body) clearFormValidationState(body, 'stock-adjust-message');
        modal.classList.add('hidden');
    };
    overlay.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    applyBtn.addEventListener('click', async () => {
        if (!stockAdjustContext) {
            return;
        }
        const amount = parseFloat(amountInput.value);
        if (Number.isNaN(amount) || amount <= 0) {
            formShowValidationError(body, 'stock-adjust-message', 'Вкажіть коректну кількість', ['stock-adjust-amount']);
            return;
        }
        const endpoint = stockAdjustContext.type === 'grain'
            ? `/grain/stock/${stockAdjustContext.id}/adjust`
            : `/purchases/stock/${stockAdjustContext.id}/adjust`;
        const response = await apiFetch(endpoint, {
            method: 'PATCH',
            body: JSON.stringify({
                transaction_type: typeSelect.value,
                amount
            })
        });
        if (response.ok) {
            closeModal();
            amountInput.value = '';
            const scope = stockAdjustContext.type === 'grain' ? 'stock' : 'purchaseStock';
            await refreshAfterMutation([scope, 'stockAdjustments', 'dashboard']);
        } else {
            const data = await response.json().catch(() => ({}));
            setFormMessage('stock-adjust-message', data.detail || 'Не вдалося оновити склад', true);
        }
    });
}

function initStockReserveModal() {
    const modal = document.getElementById('stock-reserve-modal');
    const closeBtn = document.getElementById('stock-reserve-close');
    const cancelBtn = document.getElementById('stock-reserve-cancel');
    const saveBtn = document.getElementById('stock-reserve-save');
    const overlay = modal?.querySelector('.modal-overlay');
    const actionSelect = document.getElementById('stock-reserve-action');
    const amountInput = document.getElementById('stock-reserve-amount');
    const title = document.getElementById('stock-reserve-title');
    if (!modal || !closeBtn || !cancelBtn || !saveBtn || !overlay || !actionSelect || !amountInput || !title) {
        return;
    }

    const body = modal.querySelector('.modal-body');
    if (body) formBindInvalidHighlightClearing(body);

    initCustomSelects(actionSelect);

    const closeModal = () => {
        if (body) clearFormValidationState(body, 'stock-reserve-message');
        modal.classList.add('hidden');
    };
    overlay.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    saveBtn.addEventListener('click', async () => {
        if (!stockReserveContext) return;
        const amount = parseFloat(amountInput.value);
        if (Number.isNaN(amount) || amount <= 0) {
            formShowValidationError(body, 'stock-reserve-message', 'Вкажіть коректну кількість', ['stock-reserve-amount']);
            return;
        }
        const action = actionSelect.value;
        const path = action === 'release'
            ? `/grain/stock/${stockReserveContext.id}/reserve/release`
            : `/grain/stock/${stockReserveContext.id}/reserve`;
        const response = await apiFetch(path, {
            method: 'POST',
            body: JSON.stringify({ quantity_kg: amount })
        });
        if (!response.ok) {
            const error = await response.json().catch(() => null);
            setFormMessage('stock-reserve-message', error?.detail || 'Не вдалося змінити бронювання', true);
            return;
        }
        await refreshAfterMutation(['stock', 'dashboard']);
        showToast('Бронювання оновлено', 'success');
        closeModal();
    });
}

function openStockReserveModal({ id, label }) {
    const modal = document.getElementById('stock-reserve-modal');
    const title = document.getElementById('stock-reserve-title');
    const amountInput = document.getElementById('stock-reserve-amount');
    const actionSelect = document.getElementById('stock-reserve-action');
    if (!modal || !title || !amountInput || !actionSelect) return;
    const body = modal.querySelector('.modal-body');
    if (body) clearFormValidationState(body, 'stock-reserve-message');
    stockReserveContext = { id, label };
    title.textContent = label;
    amountInput.value = '';
    actionSelect.value = 'reserve';
    refreshCustomSelect(actionSelect);
    modal.classList.remove('hidden');
}

function initStockPriceModal() {
    const modal = document.getElementById('stock-price-modal');
    const closeBtn = document.getElementById('stock-price-close');
    const cancelBtn = document.getElementById('stock-price-cancel');
    const applyBtn = document.getElementById('stock-price-apply');
    const overlay = modal?.querySelector('.modal-overlay');
    const priceInput = document.getElementById('stock-price-value');
    if (!modal || !closeBtn || !cancelBtn || !applyBtn || !overlay || !priceInput) {
        return;
    }

    const body = modal.querySelector('.modal-body');
    if (body) formBindInvalidHighlightClearing(body);

    const closeModal = () => {
        if (body) clearFormValidationState(body, 'stock-price-message');
        modal.classList.add('hidden');
    };
    overlay.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    applyBtn.addEventListener('click', async () => {
        if (!stockPriceContext) {
            return;
        }
        const price = parseFloat(priceInput.value);
        if (Number.isNaN(price) || price < 0) {
            formShowValidationError(body, 'stock-price-message', 'Вкажіть коректну ціну', ['stock-price-value']);
            return;
        }
        const ok = await updatePurchaseStockPrice(stockPriceContext.id, priceInput.value);
        if (!ok) {
            setFormMessage('stock-price-message', 'Не вдалося оновити ціну', true);
            return;
        }
        closeModal();
    });
}

function initCulturePriceModal() {
    const modal = document.getElementById('culture-price-modal');
    const closeBtn = document.getElementById('culture-price-close');
    const cancelBtn = document.getElementById('culture-price-cancel');
    const applyBtn = document.getElementById('culture-price-apply');
    const overlay = modal?.querySelector('.modal-overlay');
    const priceInput = document.getElementById('culture-price-value');
    if (!modal || !closeBtn || !cancelBtn || !applyBtn || !overlay || !priceInput) {
        return;
    }

    const body = modal.querySelector('.modal-body');
    if (body) formBindInvalidHighlightClearing(body);

    const closeModal = () => {
        if (body) clearFormValidationState(body, 'culture-price-message');
        modal.classList.add('hidden');
    };
    overlay.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    applyBtn.addEventListener('click', async () => {
        if (!culturePriceContext) {
            return;
        }
        const price = parseFloat(priceInput.value);
        if (Number.isNaN(price) || price < 0) {
            formShowValidationError(body, 'culture-price-message', 'Вкажіть коректну ціну', ['culture-price-value']);
            return;
        }
        const ok = await updateCulturePrice(culturePriceContext.id, priceInput.value);
        if (!ok) {
            setFormMessage('culture-price-message', 'Не вдалося оновити ціну', true);
            return;
        }
        closeModal();
    });
}

function openStockAdjustModal({ type, id, label }) {
    const modal = document.getElementById('stock-adjust-modal');
    const title = document.getElementById('stock-adjust-title');
    const amountInput = document.getElementById('stock-adjust-amount');
    const typeSelect = document.getElementById('stock-adjust-type');
    if (!modal || !title || !amountInput || !typeSelect) {
        return;
    }
    const body = modal.querySelector('.modal-body');
    if (body) clearFormValidationState(body, 'stock-adjust-message');
    stockAdjustContext = { type, id };
    title.textContent = label;
    amountInput.value = '';
    typeSelect.value = 'add';
    initCustomSelects(typeSelect);
    modal.classList.remove('hidden');
}

function openStockPriceModal({ id, label, price }) {
    const modal = document.getElementById('stock-price-modal');
    const title = document.getElementById('stock-price-title');
    const priceInput = document.getElementById('stock-price-value');
    if (!modal || !title || !priceInput) {
        return;
    }
    const body = modal.querySelector('.modal-body');
    if (body) clearFormValidationState(body, 'stock-price-message');
    stockPriceContext = { id };
    title.textContent = label;
    priceInput.value = Number(price).toFixed(2);
    modal.classList.remove('hidden');
}

function openCulturePriceModal({ id, label, price }) {
    const modal = document.getElementById('culture-price-modal');
    const title = document.getElementById('culture-price-title');
    const priceInput = document.getElementById('culture-price-value');
    if (!modal || !title || !priceInput) {
        return;
    }
    const body = modal.querySelector('.modal-body');
    if (body) clearFormValidationState(body, 'culture-price-message');
    culturePriceContext = { id };
    title.textContent = label;
    priceInput.value = Number(price).toFixed(2);
    modal.classList.remove('hidden');
}
async function loadPurchases({ append = false } = {}) {
    if (!append) { purchasesState.offset = 0; purchasesState.items = []; }
    const path = '/purchases' + purchasesState.toQuery();
    const { data, total } = await apiFetchCached(path, { force: !append });
    purchasesState.total = total ?? data.length;
    purchasesState.items = append ? purchasesState.items.concat(data) : data.slice();
    purchasesCache = purchasesState.items;
    renderPagedHint('purchases-period-hint', purchasesState, loadPurchases, 'закупівель');
    const tableBody = document.querySelector('#purchases-table tbody');
    if (!tableBody) {
        return;
    }
    tableBody.innerHTML = '';
    purchasesCache.forEach(item => {
        const categoryLabel = item.category === 'fertilizer' ? 'Добрива' : 'Посівне зерно';
        const typeBadge = item.is_free
            ? '<span class="inline-badge issue">Безкоштовно</span>'
            : '<span class="inline-badge purchase">Закупка</span>';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(item.created_at)}</td>
            <td>${typeBadge}</td>
            <td>${item.item_name}</td>
            <td>${categoryLabel}</td>
            <td>${item.is_free ? emptyValueHtml() : item.price_per_kg.toFixed(2)}</td>
            <td>${item.is_free ? emptyValueHtml() : item.currency}</td>
            <td>${formatWeight(item.quantity_kg)}</td>
            <td>${item.is_free ? emptyValueHtml() : formatCurrency(item.total_amount, item.currency)}</td>
        `;
        tableBody.appendChild(row);
    });
}

async function loadShipments({ append = false } = {}) {
    if (!append) { shipmentsState.offset = 0; shipmentsState.items = []; }
    const path = '/grain/shipments' + shipmentsState.toQuery();
    const { data, total } = await apiFetchCached(path, { force: !append });
    shipmentsState.total = total ?? data.length;
    shipmentsState.items = append ? shipmentsState.items.concat(data) : data.slice();
    shipmentsCache = shipmentsState.items;
    renderShipmentsTable(shipmentsCache);
    renderPagedHint('shipments-period-hint', shipmentsState, loadShipments, 'відправок');
    renderDriverDeliveriesTable(applyDriverDeliveryFilters());
}

function openIntakeEdit(intakeId) {
    const intake = intakesCache.find(item => item.id === intakeId);
    const modal = document.getElementById('intake-edit-modal');
    if (!intake || !modal) {
        return;
    }
    clearEditIntakeFormFieldErrors();
    editingIntakeId = intakeId;
    document.getElementById('edit-culture').value = intake.culture_id;
    document.getElementById('edit-vehicle').value = intake.vehicle_type_id;
    document.getElementById('edit-trailer').checked = intake.has_trailer;
    const editCombine = document.getElementById('edit-own-combine');
    if (editCombine) editCombine.checked = intake.is_own_combine === true;
    document.getElementById('edit-own-grain').checked = intake.is_own_grain;
    updateEditFieldSelect();
    const editField = document.getElementById('edit-field');
    if (editField) editField.value = intake.field_id || '';
    document.getElementById('edit-owner-name').value = intake.owner_full_name || '';
    document.getElementById('edit-owner-phone').value = intake.owner_phone || '';
    document.getElementById('edit-internal-driver').checked = intake.is_internal_driver;
    document.getElementById('edit-driver').value = intake.driver_id || '';
    document.getElementById('edit-gross').value = intake.gross_weight_kg;
    document.getElementById('edit-tare').value = intake.tare_weight_kg;
    document.getElementById('edit-impurity').value = intake.impurity_percent || 0;
    document.getElementById('edit-pending').checked = intake.pending_quality;
    const editPendingTare = document.getElementById('edit-pending-tare');
    if (editPendingTare) editPendingTare.checked = !!intake.pending_tare;
    document.getElementById('edit-note').value = intake.note || '';

    syncEditDriverBlocks();
    syncEditOwnerFields();
    initCustomSelects(document.getElementById('edit-culture'));
    initCustomSelects(document.getElementById('edit-vehicle'));
    initCustomSelects(document.getElementById('edit-driver'));

    modal.classList.remove('hidden');
}


function initSidebarToggle() {
    const STORAGE_KEY = 'sidebar-collapsed';
    const toggleBtn = document.getElementById('sidebar-toggle');
    if (!toggleBtn) return;

    // Заполняем data-label для tooltip'ів у згорнутому стані
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        const text = item.querySelector('.nav-text');
        if (text && !item.dataset.label) {
            item.dataset.label = text.textContent.trim();
        }
    });

    // Восстановить состояние
    if (localStorage.getItem(STORAGE_KEY) === '1') {
        document.body.classList.add('sidebar-collapsed');
        toggleBtn.setAttribute('aria-label', 'Розгорнути меню');
        toggleBtn.title = 'Розгорнути меню';
    }

    toggleBtn.addEventListener('click', () => {
        const collapsed = document.body.classList.toggle('sidebar-collapsed');
        localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
        toggleBtn.setAttribute('aria-label', collapsed ? 'Розгорнути меню' : 'Згорнути меню');
        toggleBtn.title = collapsed ? 'Розгорнути меню' : 'Згорнути меню';
    });

    // ── Мобільний drawer ──────────────────────────────────────────
    // На ≤720px сайдбар стає off-canvas drawer'ом. Бургер у топбарі
    // тогглить body.mobile-nav-open; backdrop і клік по пункту меню
    // закривають його. Десктопна логіка (sidebar-collapsed) лишається.
    const navBtn = document.getElementById('mobile-nav-toggle');
    const backdrop = document.getElementById('mobile-nav-backdrop');
    const closeMobileNav = () => document.body.classList.remove('mobile-nav-open');
    if (navBtn) {
        navBtn.addEventListener('click', () => {
            document.body.classList.toggle('mobile-nav-open');
        });
    }
    if (backdrop) {
        backdrop.addEventListener('click', closeMobileNav);
    }
    // Клік по пункту меню — на мобільному закриваємо drawer (інакше юзер не побачить контенту)
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        item.addEventListener('click', () => {
            if (window.matchMedia('(max-width: 720px)').matches) closeMobileNav();
        });
    });
    // Закривати drawer на розширенні вікна (щоб клас не «застряг»)
    window.addEventListener('resize', () => {
        if (!window.matchMedia('(max-width: 720px)').matches) closeMobileNav();
    });
}

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.page-section');
    const titles = {
        'dashboard': 'Дашборд',
        'cash': 'Каса',
        'intake': 'Прийом зерна',
        'purchases': 'Закупки',
        'stock': 'Склад',
        'drivers': 'Водії',
        'owners': 'Фермери',
        'people': 'Люди',
        'farmer-contracts': 'Контракти фермерів',
        'vouchers': 'Хлібний завод',
        'shipments': 'Відправки',
        'users': 'Користувачі',
        'landlords': 'Орендодавці',
        'fields': 'Поля'
    };
    const validPages = new Set(Object.keys(titles));

    function navItemFor(page) {
        return document.querySelector(`.nav-item[data-page="${page}"]`);
    }

    function isPageAllowed(page) {
        // Невидимий пункт меню (data-admin-only для не-адміна) → у роутер не пускаємо.
        const el = navItemFor(page);
        return !!el && !el.classList.contains('hidden');
    }

    function readPageFromHash() {
        const raw = (location.hash || '').replace(/^#/, '');
        return validPages.has(raw) ? raw : null;
    }

    function resolveFallback() {
        const last = localStorage.getItem('lastPage');
        if (last && validPages.has(last) && isPageAllowed(last)) return last;
        return 'dashboard';
    }

    function applyPage(page, { force = false } = {}) {
        if (!validPages.has(page)) return;
        navItems.forEach(nav => nav.classList.toggle('active', nav.dataset.page === page));
        document.getElementById('page-title').textContent = titles[page] || 'Дашборд';
        sections.forEach(section => section.classList.add('hidden'));
        const target = document.getElementById(`section-${page}`);
        if (target) target.classList.remove('hidden');
        localStorage.setItem('lastPage', page);

        // Лінивий завантажувач: перший вхід на секцію — fetch, повторні переходи — кеш.
        // force=true (клік на вже-активну вкладку) → скидаємо кеш і refetch.
        const once = (key, fn) => loadSectionOnce(key, fn, force);

        switch (page) {
            case 'dashboard':
                // Залежить від форми з датами → завжди fetch, мемоїзацію не використовуємо.
                loadDashboardStats();
                break;
            case 'cash':
                once('cash-transactions', loadCashTransactions);
                break;
            case 'intake':
                once('intakes', loadAllIntakes);
                once('owners', () => loadOwnersList(''));
                break;
            case 'purchases':
                once('purchases', loadPurchases);
                once('purchase-stock', loadPurchaseStock);
                break;
            case 'stock':
                once('stock', loadStock);
                once('stock-adjustments', loadStockAdjustments);
                break;
            case 'drivers':
                // Водії вже завантажені на старті (loadDrivers у Promise.all).
                break;
            case 'owners':
                once('owners', () => loadOwnersList(''));
                once('intakes', loadAllIntakes);
                once('farmer-movements', loadFarmerMovements);
                break;
            case 'people':
                once('people', loadPeople);
                once('people-actions', loadPeopleActions);
                break;
            case 'farmer-contracts':
                once('farmer-contracts', loadFarmerContracts);
                once('farmer-contract-payments', loadFarmerContractPayments);
                once('owners', () => loadOwnersList(''));
                once('purchase-stock', loadPurchaseStock);
                // Люди — потрібні для випадку «контракт з людиною»
                once('people', loadPeople);
                break;
            case 'vouchers':
                once('vouchers', loadVouchersData);
                break;
            case 'shipments':
                once('shipments', loadShipments);
                break;
            case 'users':
                once('users', loadUsers);
                break;
            case 'landlords':
                once('landlords', loadLandlords);
                once('contracts', loadContracts);
                once('payments', loadPayments);
                break;
            case 'fields': {
                // Потрібні і список полів, і всі прийоми (щоб показати, які прийоми по якому полю).
                const fieldsP = once('fields', async () => {
                    await loadFields();
                    updateFieldIntakesFilterOptions();
                });
                const intakesP = once('intakes', loadAllIntakes);
                Promise.all([fieldsP, intakesP]).then(() => {
                    if (typeof renderFieldIntakesTable === 'function') renderFieldIntakesTable();
                });
                break;
            }
        }
    }

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            if (!page || !validPages.has(page)) return;
            if (readPageFromHash() === page) {
                // Уже на цій сторінці — натискання має оновити дані секції.
                applyPage(page, { force: true });
            } else {
                // Зміна хешу запустить hashchange → applyPage.
                location.hash = '#' + page;
            }
        });
    });

    window.addEventListener('hashchange', () => {
        let page = readPageFromHash();
        if (!page || !isPageAllowed(page)) {
            page = resolveFallback();
            history.replaceState(null, '', '#' + page);
        }
        applyPage(page);
    });

    // Початкова маршрутизація. Пріоритет: hash → localStorage → 'dashboard'.
    const fromHash = readPageFromHash();
    const initial = (fromHash && isPageAllowed(fromHash)) ? fromHash : resolveFallback();
    if ((location.hash || '').replace(/^#/, '') !== initial) {
        // replaceState щоб не створювати зайвий запис історії з порожнім хешем.
        history.replaceState(null, '', '#' + initial);
    }
    applyPage(initial);
}

function initLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (!logoutBtn) {
        return;
    }
    logoutBtn.addEventListener('click', async () => {
        try {
            await apiFetch('/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Помилка виходу:', error);
        } finally {
            localStorage.removeItem('token');
            localStorage.removeItem('lastPage');
            window.location.href = 'login.html';
        }
    });
}

function clearIntakeFormFieldErrors() {
    document.querySelectorAll('#intake-form .form-field.has-field-error').forEach(el => {
        el.classList.remove('has-field-error');
    });
    const msg = document.getElementById('intake-message');
    if (msg) {
        msg.textContent = '';
        msg.classList.remove('error', 'success');
    }
}

function markIntakeFormFieldError(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const field = el.closest('.form-field');
    if (field) field.classList.add('has-field-error');
}

function clearEditIntakeFormFieldErrors() {
    document.querySelectorAll('#intake-edit-form .form-field.has-field-error').forEach(el => {
        el.classList.remove('has-field-error');
    });
    const msg = document.getElementById('edit-message');
    if (msg) {
        msg.textContent = '';
        msg.classList.remove('error', 'success');
    }
}

function markEditIntakeFormFieldError(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const field = el.closest('.form-field');
    if (field) field.classList.add('has-field-error');
}

function initEditIntakeFormInvalidStateClearing(form) {
    if (!form || form.dataset.editInvalidStateClearBound) return;
    form.dataset.editInvalidStateClearBound = '1';
    const onFieldChange = (e) => {
        const field = e.target?.closest?.('.form-field');
        if (field && form.contains(field)) {
            field.classList.remove('has-field-error');
        }
    };
    form.addEventListener('input', onFieldChange, true);
    form.addEventListener('change', onFieldChange, true);
}

function initIntakeFormInvalidStateClearing(form) {
    if (!form || form.dataset.invalidStateClearBound) return;
    form.dataset.invalidStateClearBound = '1';
    const onFieldChange = (e) => {
        const field = e.target?.closest?.('.form-field');
        if (field && form.contains(field)) {
            field.classList.remove('has-field-error');
        }
    };
    form.addEventListener('input', onFieldChange, true);
    form.addEventListener('change', onFieldChange, true);
}

// clearFormMessage, formClearFieldHighlights, formMarkFieldHighlights,
// formBindInvalidHighlightClearing, clearFormValidationState,
// formShowValidationError — у core.js

function initIntakeForm() {
    const form = document.getElementById('intake-form');
    if (form) {
        initIntakeFormInvalidStateClearing(form);
    }
    const ownGrainCheckbox = document.getElementById('intake-own-grain');
    const ownerPhone = document.getElementById('owner-phone');
    const ownerId = document.getElementById('owner-id');
    const internalDriverCheckbox = document.getElementById('intake-internal-driver');
    const internalBlock = document.getElementById('internal-driver-block');
    const externalBlock = document.getElementById('external-driver-block');

    ownGrainCheckbox.addEventListener('change', () => {
        const isOwn = ownGrainCheckbox.checked;
        const ownerSelect = document.getElementById('intake-owner-select');
        const ownerNewName = document.getElementById('intake-owner-new-name');
        if (ownerSelect) ownerSelect.value = '';
        if (ownerNewName) ownerNewName.value = '';
        ownerPhone.value = '';
        ownerId.value = '';
        document.getElementById('intake-owner-mode-select')?.classList.remove('hidden');
        document.getElementById('intake-owner-mode-new')?.classList.add('hidden');
        document.querySelectorAll('.owner-field').forEach(field => {
            field.classList.toggle('hidden', isOwn);
        });
        const ownNote = document.getElementById('own-grain-note');
        if (ownNote) {
            ownNote.classList.toggle('hidden', !isOwn);
        }
        const fieldWrap = document.getElementById('own-grain-field-wrap');
        const fieldSelect = document.getElementById('intake-field');
        if (fieldWrap) fieldWrap.classList.toggle('hidden', !isOwn);
        if (fieldSelect) {
            if (isOwn) updateIntakeFieldSelect();
            else fieldSelect.value = '';
        }
        if (typeof updateOwnerBadge === 'function') {
            updateOwnerBadge();
        }
        if (isOwn) initCustomSelects(fieldSelect);
    });

    internalDriverCheckbox.addEventListener('change', () => {
        const isInternal = internalDriverCheckbox.checked;
        internalBlock.classList.toggle('hidden', !isInternal);
        externalBlock.classList.toggle('hidden', isInternal);
        initCustomSelects();
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = buildIntakePayload();
        if (!payload) {
            return;
        }
        const response = await apiFetch('/grain/intakes', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            showToast('Картку збережено', 'success');
            clearIntakeFormFieldErrors();
            form.reset();
            document.getElementById('accepted-weight').value = '';
            document.getElementById('net-weight').value = '';
            document.getElementById('owner-id').value = '';
            const intakeField = document.getElementById('intake-field');
            if (intakeField) intakeField.value = '';
            const ownerSelect = document.getElementById('intake-owner-select');
            if (ownerSelect) {
                ownerSelect.value = '';
                if (typeof refreshCustomSelect === 'function') refreshCustomSelect(ownerSelect);
            }
            await refreshAfterMutation(['allIntakes', 'stock', 'stockAdjustments', 'owners', 'dashboard']);
            closeIntakeCreateModal();
        } else {
            const error = await response.json().catch(() => null);
            showToast(error?.detail || 'Помилка збереження', 'error');
        }
    });
}

function initIntakeCreateModal() {
    const modal = document.getElementById('intake-create-modal');
    const openBtn = document.getElementById('intake-open-modal');
    const closeBtn = document.getElementById('intake-create-close');
    const overlay = modal?.querySelector('.modal-overlay');
    if (!modal || !openBtn || !closeBtn || !overlay) {
        return;
    }

    openBtn.addEventListener('click', () => {
        clearIntakeFormFieldErrors();
        modal.classList.remove('hidden');
        updateIntakeFieldSelect();
        // Якщо в селекті ще немає опцій (відкриваємо модалку до того, як
        // initOwnersSearch встиг його заповнити) — populate тут.
        if (typeof populateOwnerSelect === 'function') {
            populateOwnerSelect('intake-owner-select');
        }
        initCustomSelects();
    });

    closeBtn.addEventListener('click', closeIntakeCreateModal);
    overlay.addEventListener('click', closeIntakeCreateModal);
}

function closeIntakeCreateModal() {
    const modal = document.getElementById('intake-create-modal');
    if (!modal) {
        return;
    }
    clearIntakeFormFieldErrors();
    modal.classList.add('hidden');
    const ownerId = document.getElementById('owner-id');
    if (ownerId) ownerId.value = '';
    const ownerSelect = document.getElementById('intake-owner-select');
    if (ownerSelect) {
        ownerSelect.value = '';
        if (typeof refreshCustomSelect === 'function') refreshCustomSelect(ownerSelect);
    }
    // Повертаємось у режим вибору зі списку та чистимо поле введення нового
    const newName = document.getElementById('intake-owner-new-name');
    if (newName) newName.value = '';
    const modeSelectWrap = document.getElementById('intake-owner-mode-select');
    const modeNewWrap = document.getElementById('intake-owner-mode-new');
    modeSelectWrap?.classList.remove('hidden');
    modeNewWrap?.classList.add('hidden');
}

function initIntakeViewModal() {
    const modal = document.getElementById('intake-view-modal');
    const closeBtn = document.getElementById('intake-view-close');
    if (!modal || !closeBtn) {
        return;
    }
    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
}

function initIntakeEditModal() {
    const modal = document.getElementById('intake-edit-modal');
    const closeBtn = document.getElementById('intake-edit-close');
    const overlay = modal?.querySelector('.modal-overlay');
    const form = document.getElementById('intake-edit-form');
    const internalCheckbox = document.getElementById('edit-internal-driver');
    const ownGrainCheckbox = document.getElementById('edit-own-grain');

    if (!modal || !closeBtn || !overlay || !form || !internalCheckbox || !ownGrainCheckbox) {
        return;
    }

    initEditIntakeFormInvalidStateClearing(form);

    const closeModal = () => {
        clearEditIntakeFormFieldErrors();
        modal.classList.add('hidden');
        editingIntakeId = null;
    };

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    internalCheckbox.addEventListener('change', syncEditDriverBlocks);
    ownGrainCheckbox.addEventListener('change', syncEditOwnerFields);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!editingIntakeId) {
            return;
        }
        const payload = buildEditPayload();
        if (!payload) {
            return;
        }
        const response = await apiFetch(`/grain/intakes/${editingIntakeId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            showToast('Картку оновлено', 'success');
            closeModal();
            await refreshAfterMutation(['allIntakes', 'stock', 'stockAdjustments', 'owners', 'dashboard']);
        } else {
            const error = await response.json().catch(() => null);
            showToast(error?.detail || 'Не вдалося оновити картку', 'error');
        }
    });
}

function openIntakeView(intakeId) {
    const intake = intakesCache.find(item => item.id === intakeId);
    const modal = document.getElementById('intake-view-modal');
    if (!intake || !modal) {
        return;
    }
    const driverTypeLabel = intake.is_internal_driver ? 'Наш водій' : 'Інший водій';
    const driverName = intake.is_internal_driver
        ? getDriverName(intake.driver_id)
        : 'Інший водій';

    document.getElementById('view-date').textContent = formatDate(intake.created_at);
    document.getElementById('view-culture').textContent = getCultureName(intake.culture_id);
    document.getElementById('view-vehicle').textContent = getVehicleName(intake.vehicle_type_id);
    document.getElementById('view-trailer').textContent = intake.has_trailer ? 'Так' : 'Ні';
    const viewCombine = document.getElementById('view-own-combine');
    if (viewCombine) viewCombine.textContent = intake.is_own_combine ? 'Так' : 'Ні';
    document.getElementById('view-own-grain').textContent = intake.is_own_grain ? 'Так' : 'Ні';
    const viewFieldWrap = document.getElementById('view-field-wrap');
    const viewField = document.getElementById('view-field');
    if (viewFieldWrap) viewFieldWrap.classList.toggle('hidden', !intake.is_own_grain || !intake.field_id);
    if (viewField) {
        if (intake.is_own_grain && intake.field_id) viewField.textContent = getFieldName(intake.field_id);
        else viewField.innerHTML = emptyValueHtml();
    }
    const viewOwner = document.getElementById('view-owner');
    if (viewOwner) {
        if (intake.is_own_grain) viewOwner.textContent = 'Підприємство';
        else if (intake.owner_full_name) viewOwner.textContent = intake.owner_full_name;
        else viewOwner.innerHTML = emptyValueHtml();
    }
    const viewOwnerPhone = document.getElementById('view-owner-phone');
    if (viewOwnerPhone) {
        if (intake.is_own_grain) viewOwnerPhone.innerHTML = emptyValueHtml();
        else if (intake.owner_phone) viewOwnerPhone.textContent = intake.owner_phone;
        else viewOwnerPhone.innerHTML = emptyValueHtml();
    }
    document.getElementById('view-driver-type').textContent = driverTypeLabel;
    const viewDriver = document.getElementById('view-driver');
    if (viewDriver) {
        if (intake.is_internal_driver && (driverName === '-' || !intake.driver_id)) {
            viewDriver.innerHTML = emptyValueHtml();
        } else {
            viewDriver.textContent = driverName;
        }
    }
    document.getElementById('view-gross').textContent = formatWeight(intake.gross_weight_kg);
    document.getElementById('view-tare').textContent = intake.pending_tare ? '—' : formatWeight(intake.tare_weight_kg);
    document.getElementById('view-net').textContent = intake.pending_tare ? '—' : formatWeight(intake.net_weight_kg);
    document.getElementById('view-impurity').textContent = `${formatWeight(intake.impurity_percent || 0)}%`;
    document.getElementById('view-pending').textContent = intake.pending_quality ? 'Так' : 'Ні';
    const viewPendingTare = document.getElementById('view-pending-tare');
    if (viewPendingTare) viewPendingTare.textContent = intake.pending_tare ? 'Так' : 'Ні';
    const viewAccepted = document.getElementById('view-accepted');
    if (viewAccepted) {
        if (!intakeOnStock(intake)) viewAccepted.innerHTML = emptyValueHtml();
        else viewAccepted.textContent = formatWeight(intake.accepted_weight_kg || 0);
    }
    const viewNote = document.getElementById('view-note');
    if (viewNote) {
        if (intake.note) viewNote.textContent = intake.note;
        else viewNote.innerHTML = emptyValueHtml();
    }

    modal.classList.remove('hidden');
}

function syncEditDriverBlocks() {
    const isInternal = document.getElementById('edit-internal-driver').checked;
    document.getElementById('edit-internal-driver-block').classList.toggle('hidden', !isInternal);
    document.getElementById('edit-external-driver-block').classList.toggle('hidden', isInternal);
}

function syncEditOwnerFields() {
    const isOwn = document.getElementById('edit-own-grain').checked;
    document.getElementById('edit-owner-name').disabled = isOwn;
    document.getElementById('edit-owner-phone').disabled = isOwn;
    const editFieldWrap = document.getElementById('edit-field-wrap');
    const editField = document.getElementById('edit-field');
    if (editFieldWrap) editFieldWrap.classList.toggle('hidden', !isOwn);
    if (editField) {
        if (isOwn) updateEditFieldSelect();
        else editField.value = '';
    }
    if (isOwn && editField) initCustomSelects(editField);
}

function updateEditFieldSelect() {
    const select = document.getElementById('edit-field');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">Оберіть поле</option>' +
        (fieldsCache || []).map(f => `<option value="${f.id}">${f.name} (${f.owner_name})</option>`).join('');
    if (current) select.value = current;
    initCustomSelects(select);
}

function buildEditPayload() {
    clearEditIntakeFormFieldErrors();

    const cultureEl = document.getElementById('edit-culture');
    const vehicleEl = document.getElementById('edit-vehicle');
    const cultureId = parseInt(cultureEl?.value, 10);
    const vehicleId = parseInt(vehicleEl?.value, 10);

    if (Number.isNaN(cultureId) || cultureId <= 0) {
        setFormMessage('edit-message', 'Оберіть культуру', true);
        markEditIntakeFormFieldError('edit-culture');
        cultureEl?.focus();
        return null;
    }
    if (Number.isNaN(vehicleId) || vehicleId <= 0) {
        setFormMessage('edit-message', 'Оберіть тип транспорту', true);
        markEditIntakeFormFieldError('edit-vehicle');
        vehicleEl?.focus();
        return null;
    }

    const isOwnGrain = document.getElementById('edit-own-grain').checked;
    const pendingTare = document.getElementById('edit-pending-tare')?.checked ?? false;
    const gross = parseFloat(document.getElementById('edit-gross').value);
    const tare = parseFloat(document.getElementById('edit-tare').value);

    if (Number.isNaN(gross) || gross <= 0) {
        setFormMessage('edit-message', 'Вкажіть брутто', true);
        markEditIntakeFormFieldError('edit-gross');
        document.getElementById('edit-gross')?.focus();
        return null;
    }
    let tareOut = tare;
    if (pendingTare) {
        tareOut = 0;
    } else if (Number.isNaN(tare) || tare <= 0) {
        setFormMessage('edit-message', 'Вкажіть тару або позначте «Очікує тару»', true);
        markEditIntakeFormFieldError('edit-tare');
        document.getElementById('edit-tare')?.focus();
        return null;
    }
    if (!pendingTare && gross < tareOut) {
        setFormMessage('edit-message', 'Брутто не може бути менше тари', true);
        markEditIntakeFormFieldError('edit-gross');
        markEditIntakeFormFieldError('edit-tare');
        document.getElementById('edit-gross')?.focus();
        return null;
    }

    const fieldId = isOwnGrain ? (parseInt(document.getElementById('edit-field').value, 10) || null) : null;
    if (isOwnGrain && !fieldId) {
        setFormMessage('edit-message', 'Оберіть поле, з якого привезли зерно', true);
        markEditIntakeFormFieldError('edit-field');
        document.getElementById('edit-field')?.focus();
        return null;
    }

    if (!isOwnGrain) {
        const ownerName = document.getElementById('edit-owner-name').value.trim();
        const ownerPhone = document.getElementById('edit-owner-phone').value.trim();
        if (!ownerName) {
            setFormMessage('edit-message', 'Вкажіть власника зерна', true);
            markEditIntakeFormFieldError('edit-owner-name');
            document.getElementById('edit-owner-name')?.focus();
            return null;
        }
    }

    const isInternalDriver = document.getElementById('edit-internal-driver').checked;
    if (isInternalDriver) {
        const driverId = document.getElementById('edit-driver').value;
        if (!driverId) {
            setFormMessage('edit-message', 'Вкажіть водія підприємства', true);
            markEditIntakeFormFieldError('edit-driver');
            document.getElementById('edit-driver')?.focus();
            return null;
        }
    }

    const payload = {
        culture_id: cultureId,
        vehicle_type_id: vehicleId,
        has_trailer: document.getElementById('edit-trailer').checked,
        is_own_combine: document.getElementById('edit-own-combine').checked,
        is_own_grain: isOwnGrain,
        field_id: fieldId,
        is_internal_driver: isInternalDriver,
        gross_weight_kg: gross,
        tare_weight_kg: tareOut,
        impurity_percent: parseFloat(document.getElementById('edit-impurity').value || '0'),
        pending_quality: document.getElementById('edit-pending').checked,
        pending_tare: pendingTare,
        note: document.getElementById('edit-note').value.trim() || null
    };

    if (!payload.is_own_grain) {
        payload.owner_full_name = document.getElementById('edit-owner-name').value.trim();
        payload.owner_phone = document.getElementById('edit-owner-phone').value.trim() || null;
    }

    if (payload.is_internal_driver) {
        payload.driver_id = parseInt(document.getElementById('edit-driver').value, 10);
    } else {
        payload.external_driver_name = 'Інший водій';
    }

    return payload;
}

function updateIntakeFieldSelect() {
    const select = document.getElementById('intake-field');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">Оберіть поле</option>' +
        (fieldsCache || []).map(f => `<option value="${f.id}">${f.name} (${f.owner_name})</option>`).join('');
    if (current) select.value = current;
    initCustomSelects(select);
}

function buildIntakePayload() {
    clearIntakeFormFieldErrors();

    const cultureEl = document.getElementById('intake-culture');
    const vehicleEl = document.getElementById('intake-vehicle');
    const cultureId = parseInt(cultureEl?.value, 10);
    const vehicleId = parseInt(vehicleEl?.value, 10);

    if (Number.isNaN(cultureId) || cultureId <= 0) {
        setFormMessage('intake-message', 'Оберіть культуру', true);
        markIntakeFormFieldError('intake-culture');
        cultureEl?.focus();
        return null;
    }
    if (Number.isNaN(vehicleId) || vehicleId <= 0) {
        setFormMessage('intake-message', 'Оберіть тип транспорту', true);
        markIntakeFormFieldError('intake-vehicle');
        vehicleEl?.focus();
        return null;
    }

    const hasTrailer = document.getElementById('intake-trailer').checked;
    const isOwnCombine = document.getElementById('intake-own-combine').checked;
    const isOwnGrain = document.getElementById('intake-own-grain').checked;
    const ownerSelectEl = document.getElementById('intake-owner-select');
    const ownerNewEl = document.getElementById('intake-owner-new-name');
    const newWrap = document.getElementById('intake-owner-mode-new');
    const isNewMode = newWrap && !newWrap.classList.contains('hidden');
    let ownerId = '';
    let ownerName = '';
    if (isNewMode) {
        // Режим введення нового фермера — id порожній, ім'я з input.
        ownerName = (ownerNewEl?.value || '').trim();
    } else {
        ownerId = (ownerSelectEl?.value) || document.getElementById('owner-id').value || '';
        const selectedOwnerObj = ownerId ? (ownersCache || []).find(o => String(o.id) === String(ownerId)) : null;
        ownerName = selectedOwnerObj ? selectedOwnerObj.full_name : '';
    }
    const ownerPhone = document.getElementById('owner-phone').value.trim();
    const isInternalDriver = document.getElementById('intake-internal-driver').checked;
    const driverId = document.getElementById('intake-driver').value;
    const gross = parseFloat(document.getElementById('gross-weight').value);
    const tare = parseFloat(document.getElementById('tare-weight').value);
    const impurity = parseFloat(document.getElementById('impurity-percent').value || '0');
    const pendingQuality = document.getElementById('pending-quality').checked;
    const pendingTare = document.getElementById('pending-tare').checked;
    const note = document.getElementById('intake-note').value.trim();

    if (Number.isNaN(gross) || gross <= 0) {
        setFormMessage('intake-message', 'Вкажіть брутто', true);
        markIntakeFormFieldError('gross-weight');
        document.getElementById('gross-weight')?.focus();
        return null;
    }
    if (!pendingTare) {
        if (Number.isNaN(tare) || tare <= 0) {
            setFormMessage('intake-message', 'Вкажіть тару або позначте «Очікує тару»', true);
            markIntakeFormFieldError('tare-weight');
            document.getElementById('tare-weight')?.focus();
            return null;
        }
        if (gross < tare) {
            setFormMessage('intake-message', 'Брутто не може бути менше тари', true);
            markIntakeFormFieldError('gross-weight');
            markIntakeFormFieldError('tare-weight');
            document.getElementById('gross-weight')?.focus();
            return null;
        }
    }

    if (!isOwnGrain && !ownerId && !ownerName) {
        const msg = isNewMode ? 'Введіть ПІБ нового фермера' : 'Оберіть фермера зі списку';
        setFormMessage('intake-message', msg, true);
        const focusId = isNewMode ? 'intake-owner-new-name' : 'intake-owner-select';
        markIntakeFormFieldError(focusId);
        document.getElementById(focusId)?.focus();
        return null;
    }
    if (isOwnGrain) {
        const fieldId = document.getElementById('intake-field')?.value;
        if (!fieldId) {
            setFormMessage('intake-message', 'Оберіть поле, з якого привезли зерно', true);
            markIntakeFormFieldError('intake-field');
            document.getElementById('intake-field')?.focus();
            return null;
        }
    }

    if (isInternalDriver && !driverId) {
        setFormMessage('intake-message', 'Вкажіть водія підприємства', true);
        markIntakeFormFieldError('intake-driver');
        document.getElementById('intake-driver')?.focus();
        return null;
    }

    const payload = {
        culture_id: cultureId,
        vehicle_type_id: vehicleId,
        has_trailer: hasTrailer,
        is_own_combine: isOwnCombine,
        is_own_grain: isOwnGrain,
        is_internal_driver: isInternalDriver,
        gross_weight_kg: gross,
        tare_weight_kg: pendingTare ? 0 : tare,
        impurity_percent: impurity,
        pending_quality: pendingQuality,
        pending_tare: pendingTare,
        note: note || null
    };

    if (isOwnGrain) {
        payload.field_id = parseInt(document.getElementById('intake-field').value, 10);
    }
    if (!isOwnGrain) {
        if (ownerId) {
            payload.owner_id = parseInt(ownerId, 10);
        } else {
            payload.owner_full_name = ownerName;
            payload.owner_phone = ownerPhone || null;
        }
    }

    if (isInternalDriver) {
        payload.driver_id = parseInt(driverId, 10);
    } else {
        payload.external_driver_name = 'Інший водій';
    }

    return payload;
}

function initDriverForm() {
    const form = document.getElementById('driver-form');
    if (!form) {
        return;
    }
    formBindInvalidHighlightClearing(form);
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!isSuperAdmin) {
            formShowValidationError(form, 'driver-message', 'Доступно лише супер адміну', ['driver-name']);
            return;
        }
        const name = document.getElementById('driver-name').value.trim();
        const phone = document.getElementById('driver-phone').value.trim();
        if (!name) {
            formShowValidationError(form, 'driver-message', 'Вкажіть ПІБ водія', ['driver-name']);
            return;
        }
        const response = await apiFetch('/grain/drivers', {
            method: 'POST',
            body: JSON.stringify({ full_name: name, phone: phone || null })
        });
        if (response.ok) {
            setFormMessage('driver-message', 'Водія додано', false);
            formClearFieldHighlights(form);
            form.reset();
            await refreshAfterMutation(['drivers']);
            closeDriverAddModal();
        } else {
            setFormMessage('driver-message', 'Не вдалося додати водія', true);
        }
    });
}

function initDriverAddModal() {
    const modal = document.getElementById('driver-add-modal');
    const openBtn = document.getElementById('driver-add-btn');
    const closeBtn = document.getElementById('driver-add-close');
    const overlay = modal?.querySelector('.modal-overlay');
    if (!modal || !openBtn || !closeBtn || !overlay) {
        return;
    }
    openBtn.addEventListener('click', () => {
        const df = document.getElementById('driver-form');
        if (df) clearFormValidationState(df, 'driver-message');
        modal.classList.remove('hidden');
    });
    closeBtn.addEventListener('click', closeDriverAddModal);
    overlay.addEventListener('click', closeDriverAddModal);
}

function closeDriverAddModal() {
    const modal = document.getElementById('driver-add-modal');
    const df = document.getElementById('driver-form');
    if (df) clearFormValidationState(df, 'driver-message');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function initDriversListExport() {
    const btn = document.getElementById('drivers-list-export-btn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        const response = await apiFetchBlob('/grain/drivers/export');
        if (!response.ok) {
            showToast('Не вдалося сформувати звіт', 'error');
            return;
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'drivers.xlsx';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showToast('Звіт сформовано', 'success');
    });
}

let editingDriverId = null;

function initDriverEditModal() {
    const modal = document.getElementById('driver-edit-modal');
    const closeBtn = document.getElementById('driver-edit-close');
    const overlay = modal?.querySelector('.modal-overlay');
    const form = document.getElementById('driver-edit-form');
    if (!modal || !closeBtn || !overlay || !form) return;

    formBindInvalidHighlightClearing(form);

    const closeModal = () => {
        editingDriverId = null;
        clearFormValidationState(form, 'driver-edit-message');
        modal.classList.add('hidden');
    };
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!editingDriverId) return;
        const name = document.getElementById('driver-edit-name').value.trim();
        const phone = document.getElementById('driver-edit-phone').value.trim();
        if (!name) {
            formShowValidationError(form, 'driver-edit-message', 'Вкажіть ПІБ водія', ['driver-edit-name']);
            return;
        }
        const response = await apiFetch(`/grain/drivers/${editingDriverId}`, {
            method: 'PATCH',
            body: JSON.stringify({ full_name: name, phone: phone || null })
        });
        if (response.ok) {
            showToast('Водія оновлено', 'success');
            clearFormValidationState(form, 'driver-edit-message');
            closeModal();
            await refreshAfterMutation(['drivers']);
        } else {
            const error = await response.json().catch(() => null);
            setFormMessage('driver-edit-message', error?.detail || 'Не вдалося оновити', true);
        }
    });
}

function openDriverEditModal(driver) {
    const modal = document.getElementById('driver-edit-modal');
    if (!modal) return;
    editingDriverId = driver.id;
    document.getElementById('driver-edit-name').value = driver.full_name;
    document.getElementById('driver-edit-phone').value = driver.phone || '';
    const df = document.getElementById('driver-edit-form');
    if (df) clearFormValidationState(df, 'driver-edit-message');
    modal.classList.remove('hidden');
}

function initUserAddModal() {
    const modal = document.getElementById('user-add-modal');
    const openBtn = document.getElementById('user-add-btn');
    const closeBtn = document.getElementById('user-add-close');
    const overlay = modal?.querySelector('.modal-overlay');
    const form = document.getElementById('user-form');
    if (!modal || !openBtn || !closeBtn || !overlay || !form) {
        return;
    }
    formBindInvalidHighlightClearing(form);
    const openModal = () => {
        clearFormValidationState(form, 'user-message');
        modal.classList.remove('hidden');
    };
    const closeModal = () => {
        clearFormValidationState(form, 'user-message');
        form.reset();
        modal.classList.add('hidden');
    };
    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!isSuperAdmin) {
            formShowValidationError(form, 'user-message', 'Доступно лише супер адміну', ['user-full-name']);
            return;
        }
        const fullName = document.getElementById('user-full-name').value.trim();
        const username = document.getElementById('user-username').value.trim();
        const password = document.getElementById('user-password').value.trim();
        const role = document.getElementById('user-add-role')?.value || 'user';
        if (!fullName || !username || !password) {
            const ids = [];
            if (!fullName) ids.push('user-full-name');
            if (!username) ids.push('user-username');
            if (!password) ids.push('user-password');
            formShowValidationError(form, 'user-message', 'Заповніть всі поля', ids);
            return;
        }
        const response = await apiFetch('/users', {
            method: 'POST',
            body: JSON.stringify({ full_name: fullName, username, password, role })
        });
        if (response.ok) {
            showToast('Користувача створено', 'success');
            clearFormValidationState(form, 'user-message');
            form.reset();
            await refreshAfterMutation(['users']);
            closeModal();
        } else {
            const error = await response.json().catch(() => null);
            setFormMessage('user-message', error?.detail || 'Помилка створення', true);
        }
    });
}



function initStockReports() {
    const grainBtn = document.getElementById('stock-grain-report-btn');
    const fertilizerBtn = document.getElementById('stock-fertilizer-report-btn');
    const seedBtn = document.getElementById('stock-seed-report-btn');

    if (grainBtn) {
        grainBtn.addEventListener('click', async () => {
            const response = await apiFetchBlob('/grain/stock/export');
            if (!response.ok) {
                showToast('Не вдалося сформувати звіт', 'error');
                return;
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'grain_stock_report.xlsx';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        });
    }

    const downloadPurchaseStock = async (category, filename) => {
        const response = await apiFetchBlob(`/purchases/stock/export?category=${encodeURIComponent(category)}`);
        if (!response.ok) {
            showToast('Не вдалося сформувати звіт', 'error');
            return;
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    };

    if (fertilizerBtn) {
        fertilizerBtn.addEventListener('click', () => {
            downloadPurchaseStock('fertilizer', 'purchase_stock_fertilizer.xlsx');
        });
    }

    if (seedBtn) {
        seedBtn.addEventListener('click', () => {
            downloadPurchaseStock('seed', 'purchase_stock_seed.xlsx');
        });
    }

    const summaryBtn = document.getElementById('stock-summary-report-btn');
    if (summaryBtn) {
        summaryBtn.addEventListener('click', async () => {
            summaryBtn.disabled = true;
            summaryBtn.textContent = 'Завантаження...';
            try {
                const response = await apiFetchBlob('/grain/stock/summary-export');
                if (!response.ok) {
                    showToast('Не вдалося сформувати звіт', 'error');
                    return;
                }
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'stock_summary_report.xlsx';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            } finally {
                summaryBtn.disabled = false;
                summaryBtn.textContent = 'Спец. звіт';
            }
        });
    }
}

function bindDatePicker(textInput, nativeInput, triggerBtn) {
    triggerBtn.addEventListener('click', () => {
        if (typeof nativeInput.showPicker === 'function') {
            nativeInput.showPicker();
        } else {
            nativeInput.focus();
            nativeInput.click();
        }
    });

    nativeInput.addEventListener('change', () => {
        if (!nativeInput.value) {
            textInput.value = '';
            return;
        }
        textInput.value = formatDateDisplay(nativeInput.value);
    });

    textInput.addEventListener('blur', () => {
        const iso = parseDateInput(textInput.value, 'дата');
        if (iso) {
            nativeInput.value = iso;
            textInput.value = formatDateDisplay(iso);
        }
    });
}

// formatDateDisplay, parseDateInput — у core.js

function initCustomSelects(targetSelect) {
    const selects = targetSelect
        ? [targetSelect]
        : Array.from(document.querySelectorAll('.form-field select'));

    selects.forEach(select => {
        if (!select) {
            return;
        }
        const wrapper = select.closest('.custom-select');
        if (wrapper) {
            buildCustomOptions(select, wrapper);
            updateCustomTrigger(select, wrapper);
            return;
        }

        const customWrapper = document.createElement('div');
        customWrapper.className = 'custom-select';

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'custom-select-trigger';
        trigger.addEventListener('click', () => {
            customWrapper.classList.toggle('open');
            // При відкритті — скинути пошук, фокус у поле пошуку
            if (customWrapper.classList.contains('open')) {
                const searchInput = customWrapper.querySelector('.custom-select-search-input');
                if (searchInput) {
                    searchInput.value = '';
                    filterCustomOptions(customWrapper, '');
                    setTimeout(() => searchInput.focus(), 30);
                }
            }
            // Позиционирование випадаючого меню в модальних вікнах
            if (customWrapper.closest('#contract-modal') || customWrapper.closest('#farmer-contract-modal') || customWrapper.closest('#intake-create-modal')) {
                setTimeout(() => {
                    positionContractSelectOptions(customWrapper);
                }, 0);
            }
        });

        const options = document.createElement('div');
        options.className = 'custom-options';

        select.classList.add('custom-select-hidden');

        select.parentNode.insertBefore(customWrapper, select);
        customWrapper.appendChild(select);
        customWrapper.appendChild(trigger);
        customWrapper.appendChild(options);

        buildCustomOptions(select, customWrapper);
        updateCustomTrigger(select, customWrapper);
    });

    document.addEventListener('click', (event) => {
        document.querySelectorAll('.custom-select.open').forEach(wrapper => {
            if (!wrapper.contains(event.target)) {
                wrapper.classList.remove('open');
            }
        });
    });
    
    // Зміна розміру вікна — оновлення позиції випадаючих у модалках
    window.addEventListener('resize', () => {
        document.querySelectorAll('#contract-modal .custom-select.open, #farmer-contract-modal .custom-select.open, #intake-create-modal .custom-select.open').forEach(wrapper => {
            positionContractSelectOptions(wrapper);
        });
    });

    document.addEventListener('scroll', (event) => {
        const inTrackedModal = event.target.closest && (
            event.target.closest('#contract-modal') ||
            event.target.closest('#farmer-contract-modal') ||
            event.target.closest('#intake-create-modal')
        );
        if (!inTrackedModal) return;
        document.querySelectorAll('#contract-modal .custom-select.open, #farmer-contract-modal .custom-select.open, #intake-create-modal .custom-select.open').forEach(wrapper => {
            const trigger = wrapper.querySelector('.custom-select-trigger');
            if (!trigger) return;
            const tr = trigger.getBoundingClientRect();
            // Видимая область модалки (с учётом sticky-header/footer)
            const scroller = trigger.closest('.modal-body') || event.target;
            const sr = (scroller && scroller.getBoundingClientRect) ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
            // Если триггер скрыт за хедером/футером — закрываем дропдаун
            if (tr.bottom < sr.top + 4 || tr.top > sr.bottom - 4) {
                wrapper.classList.remove('open');
                return;
            }
            positionContractSelectOptions(wrapper);
        });
    }, true);
}

function buildCustomOptions(select, wrapper) {
    const optionsContainer = wrapper.querySelector('.custom-options');
    optionsContainer.innerHTML = '';

    // Поиск: если у select >8 опций или есть data-searchable, рендерим input.
    const isSearchable = select.dataset.searchable === 'true' || select.options.length > 8;
    if (isSearchable) {
        const searchWrap = document.createElement('div');
        searchWrap.className = 'custom-select-search';
        const search = document.createElement('input');
        search.type = 'text';
        search.placeholder = 'Пошук...';
        search.className = 'custom-select-search-input';
        search.autocomplete = 'off';
        search.addEventListener('input', () => filterCustomOptions(wrapper, search.value));
        search.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                wrapper.classList.remove('open');
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const list = wrapper.querySelector('.custom-options-list');
                const visible = list && list.querySelector('.custom-option:not(.hidden)');
                if (visible) visible.click();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                const list = wrapper.querySelector('.custom-options-list');
                const visible = list && list.querySelector('.custom-option:not(.hidden)');
                if (visible) visible.focus();
            }
        });
        // Не даём клику на input закрыть дропдаун.
        search.addEventListener('click', (e) => e.stopPropagation());
        searchWrap.appendChild(search);
        optionsContainer.appendChild(searchWrap);
    }

    const list = document.createElement('div');
    list.className = 'custom-options-list';
    optionsContainer.appendChild(list);

    // Перевіряємо, чи є хоч одна «справжня» опція (не placeholder з value="").
    // Якщо немає — placeholder у dropdown'і не рендеримо, бо empty-state нижче
    // вже передає той самий сенс. Дублювання заплутує користувача.
    const realOptions = Array.from(select.options).filter(o => !o.hidden && o.value !== '');
    const hasReal = realOptions.length > 0;
    let placeholderOption = null;

    Array.from(select.options).forEach(option => {
        if (option.hidden) return;
        if (!hasReal && option.value === '') {
            placeholderOption = option;
            return; // не рендеримо placeholder, коли реальних опцій немає
        }
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'custom-option';
        item.textContent = option.textContent;
        item.dataset.value = option.value;
        item.dataset.searchText = (option.textContent || '').toLowerCase();
        if (option.value === select.value) {
            item.classList.add('selected');
        }
        if (option.disabled) {
            item.classList.add('disabled');
            item.disabled = true;
        } else {
            item.addEventListener('click', () => {
                select.value = option.value;
                select.dispatchEvent(new Event('change'));
                updateCustomTrigger(select, wrapper);
                wrapper.classList.remove('open');
            });
        }
        list.appendChild(item);
    });

    if (!hasReal) {
        // Пріоритет повідомлення: data-empty-message → текст placeholder'а → дефолт.
        // Текст placeholder'а зазвичай вже містить контекстне «Немає контрактів...»,
        // тож використовуємо його замість родового «Немає даних».
        const msg = select.dataset.emptyMessage
            || (placeholderOption && placeholderOption.textContent && placeholderOption.textContent.trim())
            || 'Немає даних';
        const empty = document.createElement('div');
        empty.className = 'custom-select-empty';
        empty.textContent = msg;
        optionsContainer.appendChild(empty);
    } else if (isSearchable) {
        const empty = document.createElement('div');
        empty.className = 'custom-select-empty hidden';
        empty.textContent = 'Нічого не знайдено';
        optionsContainer.appendChild(empty);
    }
}

/** Фільтр опцій кастомного select по тексту. */
function filterCustomOptions(wrapper, query) {
    const q = (query || '').trim().toLowerCase();
    const list = wrapper.querySelector('.custom-options-list');
    if (!list) return;
    const empty = wrapper.querySelector('.custom-select-empty');
    let visible = 0;
    list.querySelectorAll('.custom-option').forEach(item => {
        const match = !q || (item.dataset.searchText || '').includes(q);
        item.classList.toggle('hidden', !match);
        if (match) visible++;
    });
    if (empty) empty.classList.toggle('hidden', visible > 0);
}

function updateCustomTrigger(select, wrapper) {
    if (!select.value && select.options.length) {
        select.value = select.options[0].value;
    }
    const trigger = wrapper.querySelector('.custom-select-trigger');
    const selectedOption = select.options[select.selectedIndex];
    trigger.textContent = selectedOption ? selectedOption.textContent : 'Оберіть...';

    const selectedValue = select.value;
    wrapper.querySelectorAll('.custom-option').forEach(option => {
        option.classList.toggle('selected', option.dataset.value === selectedValue);
    });
}

// Функция для правильного позиционирования выпадающего меню в модальных окнах
function positionContractSelectOptions(wrapper) {
    const options = wrapper.querySelector('.custom-options');
    if (!options || !wrapper.classList.contains('open')) {
        return;
    }

    const modal = wrapper.closest('#contract-modal, #farmer-contract-modal, #intake-create-modal');
    if (!modal) {
        return;
    }

    const trigger = wrapper.querySelector('.custom-select-trigger');
    if (!trigger) {
        return;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const margin = 16;  // мінімальний відступ від країв вьюпорту

    options.style.position = 'fixed';
    options.style.left = `${triggerRect.left}px`;
    options.style.width = `${triggerRect.width}px`;
    options.style.zIndex = '10001';

    // Знаходимо "природну" висоту дропдауну (зі всіма опціями). Тимчасово
    // знімаємо max-height/тіньовий розрахунок щоб виміряти весь контент.
    const prevMax = options.style.maxHeight;
    options.style.maxHeight = 'none';
    const naturalHeight = options.scrollHeight;
    options.style.maxHeight = prevMax;

    const spaceBelow = window.innerHeight - triggerRect.bottom - margin;
    const spaceAbove = triggerRect.top - margin;
    const desired = Math.min(naturalHeight, 320);  // hard-cap навіть якщо багато місця

    if (desired <= spaceBelow || spaceBelow >= spaceAbove) {
        // Показуємо нижче — обмежуємо max-height доступним простором,
        // щоб скрол з'явився всередині дропдауну, а не «втікав» за вьюпорт.
        options.style.top = `${triggerRect.bottom + 6}px`;
        options.style.maxHeight = `${Math.max(120, Math.min(desired, spaceBelow))}px`;
    } else {
        // Показуємо вище
        const h = Math.max(120, Math.min(desired, spaceAbove));
        options.style.top = `${triggerRect.top - h - 6}px`;
        options.style.maxHeight = `${h}px`;
    }

    // Не виходити за правий край
    if (triggerRect.left + triggerRect.width > window.innerWidth) {
        options.style.left = `${window.innerWidth - triggerRect.width - 10}px`;
    }
}

function initOwnersSearch() {
    const ownersSearch = document.getElementById('owners-search');
    if (!ownersSearch) {
        return;
    }
    let timeoutId;
    ownersSearch.addEventListener('input', () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            loadOwnersList(ownersSearch.value.trim());
        }, 300);
    });

    // Кнопка «Звіт залишків» — Excel-зведення по всіх фермерах з позитивним балансом.
    document.getElementById('farmers-balances-export-btn')?.addEventListener('click', async (event) => {
        const btn = event.currentTarget;
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Готується...';
        try {
            const response = await apiFetchBlob('/grain/owners/balances/export');
            if (!response.ok) {
                const err = await response.json().catch(() => null);
                showToast(err?.detail || 'Не вдалося сформувати звіт', 'error');
                return;
            }
            await downloadBlob(response, `farmers_balances_${new Date().toISOString().slice(0, 10)}.xlsx`);
            showToast('Звіт сформовано', 'success');
        } catch (e) {
            showToast('Помилка експорту', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });

    // Двохрежимний пікер фермера в картці приходу:
    //   режим A — обираємо існуючого зі списку (dropdown з пошуком)
    //   режим B — вводимо ПІБ нового фермера у текстове поле; ownerId лишається порожнім,
    //             бекенд створить власника по name+phone під час збереження картки.
    const ownerSelect = document.getElementById('intake-owner-select');
    const ownerIdInput = document.getElementById('owner-id');
    const ownerPhoneInput = document.getElementById('owner-phone');
    const ownerAddBtn = document.getElementById('intake-owner-add-btn');
    const ownerBackBtn = document.getElementById('intake-owner-back-btn');
    const ownerNewName = document.getElementById('intake-owner-new-name');
    const modeSelectWrap = document.getElementById('intake-owner-mode-select');
    const modeNewWrap = document.getElementById('intake-owner-mode-new');

    function setIntakeOwnerMode(mode) {
        const isNew = mode === 'new';
        modeSelectWrap?.classList.toggle('hidden', isNew);
        modeNewWrap?.classList.toggle('hidden', !isNew);
        if (isNew) {
            // Скидаємо вибір зі списку — стартуємо ввід нового
            if (ownerSelect) {
                ownerSelect.value = '';
                if (typeof refreshCustomSelect === 'function') refreshCustomSelect(ownerSelect);
            }
            ownerIdInput.value = '';
            setTimeout(() => ownerNewName?.focus(), 30);
        } else {
            if (ownerNewName) ownerNewName.value = '';
        }
    }

    if (ownerSelect && ownerIdInput) {
        populateOwnerSelect('intake-owner-select');

        ownerSelect.addEventListener('change', () => {
            const id = ownerSelect.value;
            ownerIdInput.value = id;
            if (id) {
                const owner = (ownersCache || []).find(o => String(o.id) === String(id));
                if (owner && ownerPhoneInput && !ownerPhoneInput.value.trim()) {
                    ownerPhoneInput.value = owner.phone || '';
                }
            }
        });
    }

    ownerAddBtn?.addEventListener('click', () => setIntakeOwnerMode('new'));
    ownerBackBtn?.addEventListener('click', () => setIntakeOwnerMode('select'));
}

function initPurchaseForm() {
    const form = document.getElementById('purchase-form');
    const nameInput = document.getElementById('purchase-name');
    const categorySelect = document.getElementById('purchase-category');
    const priceInput = document.getElementById('purchase-price');
    const currencySelect = document.getElementById('purchase-currency');
    const quantityInput = document.getElementById('purchase-quantity');
    const totalInput = document.getElementById('purchase-total');
    const suggestions = document.getElementById('purchase-name-suggestions');
    const nameHint = document.getElementById('purchase-name-hint');
    const isFreeCheckbox = document.getElementById('purchase-is-free');
    const priceField = document.getElementById('purchase-price-field');
    const currencyField = document.getElementById('purchase-currency-field');
    const totalField = document.getElementById('purchase-total-field');
    const submitBtn = document.getElementById('purchase-submit-btn');

    if (!form || !nameInput || !categorySelect || !priceInput || !currencySelect || !quantityInput || !totalInput || !suggestions || !nameHint) {
        return;
    }

    initCustomSelects(categorySelect);
    initCustomSelects(currencySelect);

    const toggleFreeMode = () => {
        const isFree = isFreeCheckbox.checked;
        if (priceField) priceField.style.display = isFree ? 'none' : '';
        if (currencyField) currencyField.style.display = isFree ? 'none' : '';
        if (totalField) totalField.style.display = isFree ? 'none' : '';
        if (submitBtn) submitBtn.textContent = isFree ? 'Додати на склад' : 'Зберегти закупівлю';
    };
    if (isFreeCheckbox) {
        isFreeCheckbox.addEventListener('change', toggleFreeMode);
        toggleFreeMode();
    }

    const updateTotal = () => {
        const price = parseFloat(priceInput.value);
        const qty = parseFloat(quantityInput.value);
        if (!Number.isNaN(price) && !Number.isNaN(qty)) {
            totalInput.value = formatCurrency(price * qty, currencySelect.value);
        } else {
            totalInput.value = '';
        }
    };

    const updateNameHint = () => {
        const normalized = normalizePurchaseName(nameInput.value);
        if (!normalized) {
            nameHint.textContent = '';
            return;
        }
        const match = purchaseStockCache.find(item => (
            item.category === categorySelect.value &&
            normalizePurchaseName(item.name) === normalized
        ));
        if (match) {
            nameHint.textContent = `Є на складі: ${formatWeight(match.quantity_kg)} кг`;
        } else {
            nameHint.textContent = '';
        }
    };

    const renderSuggestions = () => {
        const query = normalizePurchaseName(nameInput.value);
        suggestions.innerHTML = '';
        if (!query) {
            suggestions.classList.add('hidden');
            return;
        }
        if (!purchaseStockCache.length) {
            loadPurchaseStock().then(renderSuggestions);
            return;
        }
        const isMatch = (item) => {
            const normalizedName = normalizePurchaseName(item.name);
            if (normalizedName.includes(query)) {
                return true;
            }
            const tokens = normalizedName.split(' ');
            return tokens.some(token => token.startsWith(query));
        };
        let matches = purchaseStockCache
            .filter(item => item.category === categorySelect.value)
            .filter(isMatch);
        let fallback = [];
        if (!matches.length) {
            fallback = purchaseStockCache.filter(isMatch).slice(0, 6);
        }
        let renderItems = matches.length ? matches.slice(0, 6) : fallback;
        if (!renderItems.length && purchasesCache.length) {
            const historyMatches = purchasesCache
                .filter(item => {
                    const normalizedName = normalizePurchaseName(item.item_name);
                    return normalizedName.includes(query) ||
                        normalizedName.split(' ').some(token => token.startsWith(query));
                })
                .slice(0, 6)
                .map(item => ({
                    name: item.item_name,
                    category: item.category
                }));
            renderItems = historyMatches;
        }
        if (!renderItems.length) {
            suggestions.classList.add('hidden');
            return;
        }
        renderItems.forEach(item => {
            const row = document.createElement('div');
            row.className = 'suggestion-item';
            const categoryLabel = item.category === 'fertilizer' ? 'Добрива' : 'Посівне зерно';
            row.textContent = matches.length ? item.name : `${item.name} (${categoryLabel})`;
            row.addEventListener('click', () => {
                nameInput.value = item.name;
                if (item.category !== categorySelect.value) {
                    categorySelect.value = item.category;
                    refreshCustomSelect(categorySelect);
                }
                suggestions.classList.add('hidden');
                updateNameHint();
            });
            suggestions.appendChild(row);
        });
        suggestions.classList.remove('hidden');
    };

    nameInput.addEventListener('input', () => {
        renderSuggestions();
        updateNameHint();
    });
    nameInput.addEventListener('focus', renderSuggestions);
    categorySelect.addEventListener('change', () => {
        renderSuggestions();
        updateNameHint();
    });
    nameInput.addEventListener('blur', () => {
        setTimeout(() => suggestions.classList.add('hidden'), 150);
    });
    priceInput.addEventListener('input', updateTotal);
    quantityInput.addEventListener('input', updateTotal);
    currencySelect.addEventListener('change', updateTotal);

    document.addEventListener('click', (event) => {
        if (!suggestions.contains(event.target) && event.target !== nameInput) {
            suggestions.classList.add('hidden');
        }
    });

    formBindInvalidHighlightClearing(form);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const isFree = isFreeCheckbox ? isFreeCheckbox.checked : false;
        const name = nameInput.value.trim();
        const qty = parseFloat(quantityInput.value);
        if (!name) {
            formShowValidationError(form, 'purchase-message', 'Вкажіть назву позиції', ['purchase-name']);
            return;
        }
        if (Number.isNaN(qty) || qty <= 0) {
            formShowValidationError(form, 'purchase-message', 'Вкажіть коректну кількість', ['purchase-quantity']);
            return;
        }

        const payload = {
            item_name: name,
            category: categorySelect.value,
            quantity_kg: qty,
            is_free: isFree
        };

        if (!isFree) {
            const price = parseFloat(priceInput.value);
            if (Number.isNaN(price) || price <= 0) {
                formShowValidationError(form, 'purchase-message', 'Вкажіть коректну ціну', ['purchase-price']);
                return;
            }
            payload.price_per_kg = price;
            payload.currency = currencySelect.value;
        }

        const response = await apiFetch('/purchases', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            showToast(isFree ? 'Додано на склад' : 'Закупівлю збережено', 'success');
            clearFormValidationState(form, 'purchase-message');
            form.reset();
            totalInput.value = '';
            nameHint.textContent = '';
            suggestions.classList.add('hidden');
            if (isFreeCheckbox) {
                isFreeCheckbox.checked = false;
                toggleFreeMode();
            }
            const scopes = ['purchaseStock', 'purchases', 'stockAdjustments', 'dashboard'];
            if (!isFree) {
                scopes.push('cash', 'cashTransactions');
            }
            await refreshAfterMutation(scopes);
        } else {
            const error = await response.json().catch(() => null);
            setFormMessage('purchase-message', error?.detail || 'Помилка збереження', true);
        }
    });
}

function normalizePurchaseName(value) {
    return value
        .toLowerCase()
        .replace(/[їі]/g, 'и')
        .replace(/є/g, 'е')
        .replace(/ґ/g, 'г')
        .replace(/ё/g, 'е')
        .replace(/[^a-zа-я0-9\s]/gi, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function initWeightCalculations() {
    const gross = document.getElementById('gross-weight');
    const tare = document.getElementById('tare-weight');
    const impurity = document.getElementById('impurity-percent');
    const pending = document.getElementById('pending-quality');
    const pendingTare = document.getElementById('pending-tare');

    [gross, tare, impurity].forEach(element => {
        element.addEventListener('input', calculateWeights);
        element.addEventListener('change', calculateWeights);
    });

    const bindPillToggle = (checkbox) => {
        if (!checkbox) return;
        const pendingLabel = checkbox.closest('label');
        if (pendingLabel) {
            pendingLabel.addEventListener('click', (e) => {
                if (e.target !== checkbox && e.target.tagName !== 'INPUT') {
                    e.preventDefault();
                    e.stopPropagation();
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        }
        checkbox.addEventListener('change', () => calculateWeights());
    };

    bindPillToggle(pending);
    bindPillToggle(pendingTare);

    calculateWeights();
}

function calculateWeights() {
    const gross = parseFloat(document.getElementById('gross-weight').value) || 0;
    const tare = parseFloat(document.getElementById('tare-weight').value) || 0;
    const impurityInput = document.getElementById('impurity-percent');
    const impurity = parseFloat(impurityInput.value) || 0;
    const pending = document.getElementById('pending-quality').checked;
    const pendingTare = document.getElementById('pending-tare')?.checked;
    const tareInput = document.getElementById('tare-weight');
    const net = pendingTare ? 0 : gross - tare;

    impurityInput.disabled = pending || pendingTare;
    if (pending || pendingTare) {
        impurityInput.value = '0';
    }
    if (tareInput) {
        tareInput.disabled = !!pendingTare;
    }

    document.getElementById('net-weight').value = pendingTare ? '' : (net > 0 ? formatWeight(net) : '');
    if (pendingTare) {
        document.getElementById('accepted-weight').value = 'Очікує тару';
    } else if (pending) {
        document.getElementById('accepted-weight').value = 'Очікує %';
    } else if (net > 0) {
        const accepted = net * (1 - impurity / 100);
        document.getElementById('accepted-weight').value = formatWeight(accepted);
    } else {
        document.getElementById('accepted-weight').value = '';
    }
}

// setFormMessage, showToast, escapeHtml,
// formatCurrency, formatAmount, formatWeight, formatDate, formatDateOnly,
// toLocalDateOnly, todayLocalDateOnly — у core.js


// Хлібний завод (Талони на зерно) — у vouchers.js

// renderVoucherStats, renderVouchersTable, renderVoucherPaymentsTable,
// openVoucherPaymentModal, initVouchers — у vouchers.js
