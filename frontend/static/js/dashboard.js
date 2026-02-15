// Конфигурация API
// При работе через Docker используем относительный путь (nginx проксирует /api/)
// При локальной разработке можно использовать 'http://localhost:8000/api'
const API_BASE_URL = '/api';

// ── SVG Icons for table action buttons ──
const ICONS = {
    view: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
    delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
    cancel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
    operation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    activate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
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

let currentUser = null;
let isSuperAdmin = false;
let culturesCache = [];
let vehicleTypesCache = [];
let driversCache = [];
let intakesCache = [];
let ownersCache = [];
let purchaseStockCache = [];
let purchasesCache = [];
let shipmentsCache = [];
let openFarmerBalanceModal = null;
let farmerContractsCache = [];
let farmerContractPaymentsCache = [];
let currentFarmerContractId = null;
let openFarmerContractPaymentModal = null;
let usersCache = [];
let landlordsCache = [];
let contractsCache = [];
let paymentsCache = [];
let editingIntakeId = null;
let pendingDriverDeleteId = null;
let editingShipmentId = null;
let editingLandlordId = null;
let deletingLandlordId = null;
let editingContractId = null;
let deletingContractId = null;
let cancellingPaymentId = null;

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    initializeDashboard();
});

async function initializeDashboard() {
    await loadUserInfo();
    initNavigation();
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
    initDriverDeliveriesFilters();
    initDriverDeliveriesReportModal();
    initDriverDeleteModal();
    initShipmentsForm();
    initShipmentsEditModal();
    initShipmentsReportModal();
    initUserAddModal();
    initUserEditModal();
    initUserDeleteModal();
    initCashForm();
    initCashReportModal();
    initIntakeReportModal();
    initPurchasesReportModal();
    initStockAdjustmentsReportModal();
    initStockReserveModal();
    initOwnersSearch();
    initFarmerIntakeFilters();
    initFarmersReportModal();
    initFarmerIntakesReportModal();
    initFarmerBalanceModal();
    initFarmerContractsSection();
    initWeightCalculations();
    initLandlords();
    initContracts();
    initPayments();
    initVouchers();

    await Promise.all([
        loadCashBalance(),
        loadCultures(),
        loadVehicleTypes(),
        loadDrivers()
    ]);

    // Загружаем статистику дашборда, если он открыт
    const dashboardSection = document.getElementById('section-dashboard');
    if (dashboardSection && !dashboardSection.classList.contains('hidden')) {
        await loadDashboardStats();
    }

    initCustomSelects();
    initIntakeFilters();

    await loadStock();
    await loadAllIntakes();
    await loadOwnersList('');
    await loadUsers();
    await loadCashTransactions();
    await loadPurchaseStock();
    await loadFarmerContracts();
    await loadFarmerContractPayments();
    await loadStockAdjustments();
    await loadPurchases();
    await loadShipments();
    await loadLandlords();
    await loadContracts();
    await loadPayments();

    updateTime();
    setInterval(updateTime, 1000);
}

function apiFetch(path, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        'Authorization': `Bearer ${token}`
    };

    return fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers
    });
}

function apiFetchBlob(path) {
    const token = localStorage.getItem('token');
    return fetch(`${API_BASE_URL}${path}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
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
        document.getElementById('user-name').textContent = userName;
        document.getElementById('user-role').textContent =
            isSuperAdmin ? 'Супер адмін' : 'Користувач';

        const initials = user.full_name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
        document.getElementById('user-initials').textContent = initials || 'А';

        updateAdminVisibility();
    } catch (error) {
        console.error('Помилка завантаження даних користувача:', error);
        localStorage.removeItem('token');
        window.location.href = 'login.html';
    }
}

function updateAdminVisibility() {
    document.querySelectorAll('[data-admin-only]').forEach(element => {
        element.classList.toggle('hidden', !isSuperAdmin);
    });
}

async function loadDashboardStats() {
    try {
        const response = await apiFetch('/dashboard/stats');
        if (!response.ok) throw new Error('Помилка завантаження статистики');

        const stats = await response.json();

        // ── Top strip: Cash ──
        document.getElementById('dashboard-cash-uah').textContent = formatAmount(stats.cash_balances.uah);
        document.getElementById('dashboard-cash-usd').textContent = formatAmount(stats.cash_balances.usd);
        document.getElementById('dashboard-cash-eur').textContent = formatAmount(stats.cash_balances.eur);


        // ── Panel 1: Today ──
        document.getElementById('dashboard-intakes-today').textContent = stats.intakes_today;
        document.getElementById('dashboard-shipments-today').textContent = stats.shipments_today;
        document.getElementById('dashboard-intakes-today-kg').textContent = formatAmount(stats.intakes_today_kg || 0) + ' кг';
        document.getElementById('dashboard-shipments-today-kg').textContent = formatAmount(stats.shipments_today_kg || 0) + ' кг';
        document.getElementById('dashboard-intakes-pending').textContent = stats.intakes_pending || 0;

        // ── Panel 1: Grain ownership ──
        const ownKg = stats.own_stock_kg || 0;
        const farmerKg = stats.farmer_stock_kg || 0;
        document.getElementById('dashboard-own-stock').textContent = formatAmount(ownKg);
        document.getElementById('dashboard-farmer-stock').textContent = formatAmount(farmerKg);
        const ownershipTotal = ownKg + farmerKg;
        const ownPctBar = ownershipTotal > 0 ? (ownKg / ownershipTotal * 100) : 50;
        const farmerPctBar = ownershipTotal > 0 ? (farmerKg / ownershipTotal * 100) : 50;
        document.getElementById('dashboard-own-bar').style.width = ownPctBar + '%';
        document.getElementById('dashboard-farmer-bar').style.width = farmerPctBar + '%';

        // ── Left panel: Stock by culture (horizontal bars) ──
        const stockContainer = document.getElementById('dashboard-stock-cultures');
        document.getElementById('dashboard-total-stock').textContent = formatAmount(stats.total_stock_kg) + ' кг';

        if (stats.stock_by_culture && stats.stock_by_culture.length > 0) {
            // Сортируем: сначала по количеству (убывание), затем по алфавиту
            const sorted = [...stats.stock_by_culture].sort((a, b) => {
                if (b.quantity_kg !== a.quantity_kg) {
                    return b.quantity_kg - a.quantity_kg;
                }
                return a.name.localeCompare(b.name);
            });
            
            const maxQty = Math.max(...sorted.map(c => c.quantity_kg), 0);
            
            stockContainer.innerHTML = sorted.map(c => {
                const ownPct = maxQty > 0 ? ((c.own_quantity_kg || 0) / maxQty * 100) : 0;
                const farmerPct = maxQty > 0 ? ((c.farmer_quantity_kg || 0) / maxQty * 100) : 0;
                return `
                    <div class="db-stock-item">
                        <div class="db-stock-row">
                            <span class="db-stock-name">${escapeHtml(c.name)}</span>
                            <div class="db-stock-bar-wrap">
                                <div class="db-stock-bar-own" style="width:${ownPct}%"></div>
                                <div class="db-stock-bar-farmer" style="width:${farmerPct}%"></div>
                            </div>
                            <span class="db-stock-qty">${formatAmount(c.quantity_kg)}</span>
                        </div>
                        <div class="db-stock-sub">
                            <span><span class="dot-own">${formatAmount(c.own_quantity_kg || 0)}</span> власне</span>
                            <span><span class="dot-farmer">${formatAmount(c.farmer_quantity_kg || 0)}</span> фермер.</span>
                        </div>
                    </div>`;
            }).join('');
        } else {
            stockContainer.innerHTML = '<div class="db-empty">Немає культур</div>';
        }

        // ── Panel 1: Contracts ──
        document.getElementById('dashboard-contracts-open-value').textContent = stats.contracts_open;
        document.getElementById('dashboard-contracts-closed-value').textContent = stats.contracts_closed;
        document.getElementById('dashboard-contracts-total-value').textContent = formatAmount(stats.contracts_total_value);
        document.getElementById('dashboard-contracts-balance-value').textContent = formatAmount(stats.contracts_balance);

        // ── Panel 1: Vouchers ──
        const vCountEl = document.getElementById('dashboard-vouchers-count');
        const vOpenEl = document.getElementById('dashboard-vouchers-open');
        const vTotalEl = document.getElementById('dashboard-vouchers-total');
        const vRemainingEl = document.getElementById('dashboard-vouchers-remaining');
        if (vCountEl) vCountEl.textContent = stats.vouchers_count || 0;
        if (vOpenEl) vOpenEl.textContent = stats.vouchers_open_count || 0;
        if (vTotalEl) vTotalEl.textContent = formatAmount(stats.vouchers_total_value_uah || 0);
        if (vRemainingEl) vRemainingEl.textContent = formatAmount(stats.vouchers_remaining_uah || 0);

        // ── Panel 2: Grain from farmers ──
        const purchased = stats.grain_purchased_from_farmers_kg || 0;
        const notPurchased = stats.grain_not_purchased_from_farmers_kg || 0;
        document.getElementById('dashboard-grain-purchased').textContent = formatAmount(purchased);
        document.getElementById('dashboard-grain-not-purchased').textContent = formatAmount(notPurchased);
        const grainTotal = purchased + notPurchased;
        const grainPct = grainTotal > 0 ? Math.round((purchased / grainTotal) * 100) : 0;
        document.getElementById('dashboard-purchase-pct').textContent = grainPct + '%';
        document.getElementById('dashboard-purchase-bar').style.width = grainPct + '%';

        // ── Panel 2: Purchases by category ──
        const purTotalEl = document.getElementById('dashboard-purchases-total');
        const purContainer = document.getElementById('dashboard-purchases-by-cat');
        if (purTotalEl) purTotalEl.textContent = formatAmount(stats.purchases_stock_total || 0) + ' кг';
        if (purContainer) {
            const cats = stats.purchases_by_category || [];
            const catColors = ['#8b5cf6', '#6366f1', '#ec4899', '#f59e0b', '#14b8a6', '#f97316', '#06b6d4'];
            if (cats.length > 0) {
                purContainer.innerHTML = cats.map((c, i) => `
                    <div class="db-gf-cat-row">
                        <span class="db-gf-cat-dot" style="background:${catColors[i % catColors.length]}"></span>
                        <span class="db-gf-cat-name">${escapeHtml(c.category)}</span>
                        <span class="db-gf-cat-val">${formatAmount(c.quantity_kg)} кг</span>
                    </div>`).join('');
            } else {
                purContainer.innerHTML = '<div class="db-empty">Немає закупок</div>';
            }
        }

        // ── Right: Recent transactions ──
        const txContainer = document.getElementById('dashboard-recent-transactions');
        if (stats.recent_transactions && stats.recent_transactions.length > 0) {
            txContainer.innerHTML = '<div class="db-tx-list">' + stats.recent_transactions.map(t => {
                const isAdd = t.type === 'add';
                const sign = isAdd ? '+' : '−';
                const cls = isAdd ? 'tx-add' : 'tx-sub';
                const amtCls = isAdd ? 'tx-positive' : 'tx-negative';
                const date = t.created_at ? new Date(t.created_at).toLocaleString('uk-UA', {
                    day: '2-digit', month: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                }) : '—';
                return `
                    <div class="db-tx-item ${cls}">
                        <div class="db-tx-amount ${amtCls}">${sign}${formatAmount(t.amount)} ${escapeHtml(t.currency)}</div>
                        <div class="db-tx-details">
                            <div class="db-tx-desc">${escapeHtml(t.description || '—')}</div>
                            <div class="db-tx-date">${date}</div>
                        </div>
                    </div>`;
            }).join('') + '</div>';
        } else {
            txContainer.innerHTML = '<div class="db-empty">Немає транзакцій</div>';
        }
    } catch (error) {
        console.error('Помилка завантаження статистики дашборда:', error);
    }
}

async function loadCashBalance() {
    try {
        const response = await apiFetch('/cash/balance');
        if (!response.ok) {
            throw new Error('Помилка завантаження балансу');
        }

        const balance = await response.json();
        const uahEl = document.getElementById('balance-uah');
        const usdEl = document.getElementById('balance-usd');
        const eurEl = document.getElementById('balance-eur');
        
        if (uahEl) uahEl.textContent = formatCurrency(balance.uah_balance, 'UAH');
        if (usdEl) usdEl.textContent = formatCurrency(balance.usd_balance, 'USD');
        if (eurEl) eurEl.textContent = formatCurrency(balance.eur_balance, 'EUR');

        document.getElementById('cash-uah').textContent =
            formatCurrency(balance.uah_balance, 'UAH');
        document.getElementById('cash-usd').textContent =
            formatCurrency(balance.usd_balance, 'USD');
        document.getElementById('cash-eur').textContent =
            formatCurrency(balance.eur_balance, 'EUR');

        // Load voucher debt for cash section
        try {
            const vResp = await apiFetch('/vouchers/summary');
            if (vResp.ok) {
                const vSummary = await vResp.json();
                const debtBlock = document.getElementById('cash-voucher-debt');
                const debtValue = document.getElementById('cash-voucher-debt-value');
                if (debtBlock && debtValue) {
                    const remaining = vSummary.total_remaining_uah || 0;
                    if (remaining > 0) {
                        debtBlock.style.display = 'block';
                        debtValue.textContent = formatAmount(remaining) + ' грн';
                    } else {
                        debtBlock.style.display = 'none';
                    }
                }
            }
        } catch (e) {
            console.error('Помилка завантаження боргу по талонах:', e);
        }
    } catch (error) {
        console.error('Помилка завантаження балансу:', error);
    }
}

async function loadCashTransactions() {
    const response = await apiFetch('/cash/transactions');
    if (!response.ok) {
        console.error('Помилка завантаження транзакцій');
        return;
    }
    const transactions = await response.json();
    const tableBody = document.querySelector('#cash-transactions-table tbody');
    tableBody.innerHTML = '';
    if (!transactions.length) {
        tableBody.innerHTML = '<tr><td colspan="6" class="table-empty-message">Операцій ще немає</td></tr>';
        return;
    }
    const currSymbols = { UAH: '₴', USD: '$', EUR: '€' };
    transactions.forEach(item => {
        const row = document.createElement('tr');
        const isAdd = item.transaction_type === 'add';
        const currSymbol = currSymbols[item.currency] || item.currency;
        row.innerHTML = `
            <td>${formatDate(item.created_at)}</td>
            <td>${item.user_full_name || '—'}</td>
            <td><strong>${currSymbol} ${item.currency}</strong></td>
            <td><span class="${isAdd ? 'td-delta-add' : 'td-delta-sub'}">${isAdd ? '+' : '-'}${formatAmount(Math.abs(item.amount))} ${currSymbol}</span></td>
            <td><span class="inline-badge ${isAdd ? 'issue' : 'receive'}">${isAdd ? 'Додано' : 'Віднято'}</span></td>
            <td>${item.description || '<span class="td-secondary">—</span>'}</td>
        `;
        tableBody.appendChild(row);
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
        showToast('Вкажіть коректну ціну', 'error');
        return;
    }
    const response = await apiFetch(`/grain/cultures/${cultureId}/price`, {
        method: 'PATCH',
        body: JSON.stringify({ price_per_kg: price })
    });
    if (response.ok) {
        await loadCultures();
        await loadStock();
    } else {
        showToast('Не вдалося оновити ціну', 'error');
    }
}

async function loadVehicleTypes() {
    const response = await apiFetch('/grain/vehicle-types');
    if (!response.ok) {
        console.error('Помилка завантаження транспорту');
        return;
    }
    vehicleTypesCache = await response.json();
    const select = document.getElementById('intake-vehicle');
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
    select.innerHTML = driversCache
        .map(driver => `<option value="${driver.id}">${driver.full_name}</option>`)
        .join('');
    initCustomSelects(select);

    const editSelect = document.getElementById('edit-driver');
    if (editSelect) {
        editSelect.innerHTML = driversCache
            .map(driver => `<option value="${driver.id}">${driver.full_name}</option>`)
            .join('');
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
                        ${driver.phone || '-'}
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
                        renderDriverDeliveriesTable(applyDriverDeliveryFilters(intakesCache));
                    }
                });
                actionsCell.appendChild(filterBtn);

                if (canEdit) {
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
        await loadDrivers();
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

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const destination = document.getElementById('shipment-destination').value.trim();
        const cultureId = parseInt(cultureSelect.value, 10);
        const quantity = parseFloat(document.getElementById('shipment-quantity').value);
        if (!destination) {
            setFormMessage('shipment-message', '', false);
            showToast('Вкажіть куди відправляємо', 'error');
            return;
        }
        if (!cultureId || Number.isNaN(quantity) || quantity <= 0) {
            setFormMessage('shipment-message', '', false);
            showToast('Вкажіть коректну кількість', 'error');
            return;
        }
        const response = await apiFetch('/grain/shipments', {
            method: 'POST',
            body: JSON.stringify({
                destination,
                culture_id: cultureId,
                quantity_kg: quantity
            })
        });
        if (response.ok) {
            const created = await response.json();
            shipmentsCache = [created, ...shipmentsCache.filter(item => item.id !== created.id)];
            renderShipmentsTable(shipmentsCache);
            setFormMessage('shipment-message', '', false);
            showToast('Відправку збережено', 'success');
            form.reset();
            await loadShipments();
            await loadStock();
            await loadStockAdjustments();
        } else {
            const error = await response.json().catch(() => null);
            setFormMessage('shipment-message', '', false);
            showToast(error?.detail || 'Помилка збереження', 'error');
        }
    });
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
        tableBody.innerHTML = '<tr><td colspan="6" class="table-empty-message">Поки що відправок немає</td></tr>';
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
            <td>${getUserName(item.created_by_user_id)}</td>
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
    const closeModal = () => {
        editingShipmentId = null;
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
        if (!destination) {
            setFormMessage('shipment-edit-message', '', false);
            showToast('Вкажіть куди відправляємо', 'error');
            return;
        }
        if (!cultureId || Number.isNaN(quantity) || quantity <= 0) {
            setFormMessage('shipment-edit-message', '', false);
            showToast('Вкажіть коректну кількість', 'error');
            return;
        }
        const response = await apiFetch(`/grain/shipments/${editingShipmentId}`, {
            method: 'PATCH',
            body: JSON.stringify({
                destination,
                culture_id: cultureId,
                quantity_kg: quantity
            })
        });
        if (response.ok) {
            setFormMessage('shipment-edit-message', '', false);
            showToast('Відправку оновлено', 'success');
            await loadShipments();
            await loadStock();
            closeModal();
        } else {
            const error = await response.json().catch(() => null);
            setFormMessage('shipment-edit-message', '', false);
            showToast(error?.detail || 'Помилка оновлення', 'error');
        }
    });
}

function openShipmentEditModal(item) {
    const modal = document.getElementById('shipment-edit-modal');
    const destinationInput = document.getElementById('shipment-edit-destination');
    const cultureSelect = document.getElementById('shipment-edit-culture');
    const quantityInput = document.getElementById('shipment-edit-quantity');
    if (!modal || !destinationInput || !cultureSelect || !quantityInput) {
        return;
    }
    editingShipmentId = item.id;
    destinationInput.value = item.destination;
    cultureSelect.innerHTML = culturesCache
        .map(culture => `<option value="${culture.id}">${culture.name}</option>`)
        .join('');
    cultureSelect.value = String(item.culture_id);
    initCustomSelects(cultureSelect);
    quantityInput.value = item.quantity_kg;
    setFormMessage('shipment-edit-message', '', false);
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

function openDriverDeleteModal(driverId) {
    const modal = document.getElementById('driver-delete-modal');
    if (!modal) {
        return;
    }
    pendingDriverDeleteId = driverId;
    modal.classList.remove('hidden');
}

let editingUserId = null;
let pendingUserDeleteId = null;

async function loadUsers() {
    const response = await apiFetch('/users');
    if (!response.ok) {
        console.error('Помилка завантаження користувачів');
        return;
    }
    const users = await response.json();
    usersCache = users;
    const tableBody = document.querySelector('#users-table tbody');
    tableBody.innerHTML = '';
    if (!users.length) {
        tableBody.innerHTML = '<tr><td colspan="5" class="table-empty-message">Користувачів ще немає</td></tr>';
    }
    users.forEach(user => {
        const canEdit = isSuperAdmin && user.role !== 'super_admin';
        const row = document.createElement('tr');
        const isAdmin = user.role === 'super_admin';
        const roleBadge = isAdmin
            ? '<span class="status-badge danger">Супер адмін</span>'
            : '<span class="status-badge info">Користувач</span>';
        row.innerHTML = `
            <td><strong>${escapeHtml(user.full_name || '')}</strong></td>
            <td class="td-mono">${escapeHtml(user.username)}</td>
            <td>${roleBadge}</td>
            <td>
                <label class="switch">
                    <input type="checkbox" ${user.is_active ? 'checked' : ''} ${canEdit ? '' : 'disabled'}>
                    <span class="slider"></span>
                </label>
            </td>
            <td class="actions-cell"></td>
        `;

        const actionsCell = row.querySelector('.actions-cell');
        if (canEdit) {
            const editButton = document.createElement('button');
            editButton.className = 'btn-icon btn-icon-secondary';
            editButton.innerHTML = ICONS.edit;
            editButton.title = 'Редагувати';
            editButton.addEventListener('click', () => {
                openUserEditModal(user);
            });

            const deleteButton = document.createElement('button');
            deleteButton.className = 'btn-icon btn-icon-danger';
            deleteButton.innerHTML = ICONS.delete;
            deleteButton.title = 'Видалити';
            deleteButton.addEventListener('click', () => {
                openUserDeleteModal(user.id);
            });

            actionsCell.appendChild(editButton);
            actionsCell.appendChild(deleteButton);
        } else {
            actionsCell.innerHTML = '<span class="td-secondary">Лише перегляд</span>';
        }

        const activeToggle = row.querySelector('input[type="checkbox"]');
        if (activeToggle && canEdit) {
            activeToggle.addEventListener('change', async () => {
                const payload = {
                    full_name: user.full_name,
                    is_active: activeToggle.checked
                };
                const response = await apiFetch(`/users/${user.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(payload)
                });
                if (response.ok) {
                    showToast('Користувача оновлено', 'success');
                    await loadUsers();
                } else {
                    showToast('Не вдалося оновити', 'error');
                    activeToggle.checked = !activeToggle.checked;
                }
            });
        }

        tableBody.appendChild(row);
    });
}

function openUserEditModal(user) {
    const modal = document.getElementById('user-edit-modal');
    if (!modal) {
        return;
    }
    editingUserId = user.id;
    document.getElementById('user-edit-full-name').value = user.full_name || '';
    document.getElementById('user-edit-username').value = user.username;
    document.getElementById('user-edit-role').value = user.role === 'super_admin' ? 'Супер адмін' : 'Користувач';
    const passwordInput = document.getElementById('user-edit-password');
    passwordInput.value = user.password_plain || '';
    passwordInput.type = 'text';
    const passwordToggle = document.getElementById('user-edit-password-toggle');
    if (passwordToggle) {
        passwordToggle.textContent = 'Сховати';
    }
    document.getElementById('user-edit-is-active').checked = user.is_active;
    updateUserStatusLabel(user.is_active);
    setFormMessage('user-edit-message', '', false);
    modal.classList.remove('hidden');
}

function updateUserStatusLabel(isActive) {
    const label = document.getElementById('user-edit-status-label');
    if (label) {
        label.textContent = isActive ? 'Активний' : 'Неактивний';
    }
}

function initUserEditModal() {
    const modal = document.getElementById('user-edit-modal');
    const closeBtn = document.getElementById('user-edit-close');
    const overlay = modal?.querySelector('.modal-overlay');
    const form = document.getElementById('user-edit-form');
    const passwordToggle = document.getElementById('user-edit-password-toggle');
    const deleteBtn = document.getElementById('user-edit-delete');
    
    if (!modal || !closeBtn || !overlay || !form || !passwordToggle || !deleteBtn) {
        return;
    }
    
    const closeModal = () => {
        editingUserId = null;
        modal.classList.add('hidden');
    };
    
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    
    passwordToggle.addEventListener('click', () => {
        const passwordInput = document.getElementById('user-edit-password');
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            passwordToggle.textContent = 'Сховати';
        } else {
            passwordInput.type = 'password';
            passwordToggle.textContent = 'Показати';
        }
    });
    
    // Инициализация типа поля при загрузке
    const passwordInput = document.getElementById('user-edit-password');
    if (passwordInput && passwordInput.type === 'password') {
        passwordInput.type = 'text';
        passwordToggle.textContent = 'Сховати';
    }
    
    const activeToggle = document.getElementById('user-edit-is-active');
    if (activeToggle) {
        activeToggle.addEventListener('change', () => {
            updateUserStatusLabel(activeToggle.checked);
        });
    }
    
    deleteBtn.addEventListener('click', () => {
        if (editingUserId) {
            closeModal();
            openUserDeleteModal(editingUserId);
        }
    });
    
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!editingUserId) {
            return;
        }
        const fullName = document.getElementById('user-edit-full-name').value.trim();
        const password = document.getElementById('user-edit-password').value.trim();
        const isActive = document.getElementById('user-edit-is-active').checked;
        
        if (!fullName) {
            setFormMessage('user-edit-message', 'Вкажіть ПІБ', true);
            return;
        }
        
        const payload = {
            full_name: fullName,
            is_active: isActive
        };
        
        // Всегда отправляем пароль
        const currentUser = usersCache.find(u => u.id === editingUserId);
        if (password) {
            // Если введен новый пароль, используем его
            payload.password = password;
        } else if (currentUser && currentUser.password_plain) {
            // Если пароль не изменен, отправляем текущий
            payload.password = currentUser.password_plain;
        }
        
        const response = await apiFetch(`/users/${editingUserId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            showToast('Користувача оновлено', 'success');
            await loadUsers();
            closeModal();
        } else {
            const error = await response.json().catch(() => null);
            setFormMessage('user-edit-message', error?.detail || 'Помилка оновлення', true);
        }
    });
}

function openUserDeleteModal(userId) {
    const modal = document.getElementById('user-delete-modal');
    if (!modal) {
        return;
    }
    pendingUserDeleteId = userId;
    modal.classList.remove('hidden');
}

function initUserDeleteModal() {
    const modal = document.getElementById('user-delete-modal');
    const closeBtn = document.getElementById('user-delete-close');
    const cancelBtn = document.getElementById('user-delete-cancel');
    const confirmBtn = document.getElementById('user-delete-confirm');
    const overlay = modal?.querySelector('.modal-overlay');
    
    if (!modal || !closeBtn || !cancelBtn || !confirmBtn || !overlay) {
        return;
    }
    
    const closeModal = () => {
        pendingUserDeleteId = null;
        modal.classList.add('hidden');
    };
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    
    confirmBtn.addEventListener('click', async () => {
        if (!pendingUserDeleteId) {
            closeModal();
            return;
        }
        const response = await apiFetch(`/users/${pendingUserDeleteId}`, { method: 'DELETE' });
        if (response.ok) {
            showToast('Користувача видалено', 'success');
            await loadUsers();
            closeModal();
        } else {
            const error = await response.json().catch(() => null);
            showToast(error?.detail || 'Не вдалося видалити', 'error');
        }
    });
}

async function deleteUser(userId) {
    const response = await apiFetch(`/users/${userId}`, { method: 'DELETE' });
    if (response.ok) {
        await loadUsers();
        showToast('Користувача видалено', 'success');
    } else {
        showToast('Не вдалося видалити', 'error');
    }
}

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
            <td>${owner.phone || '<span class="td-secondary">—</span>'}</td>
            <td class="actions-cell">
                <button class="btn-icon btn-icon-secondary" data-balance="${owner.id}" title="Баланс">${ICONS.balance}</button>
            </td>
        `;
        row.querySelector('[data-balance]').addEventListener('click', () => {
            if (typeof openFarmerBalanceModal === 'function') {
                openFarmerBalanceModal(owner.id);
            }
        });
        tableBody.appendChild(row);
    });
}

function openReserveActivateModal(contractId) {
    const modal = document.getElementById('reserve-activate-modal');
    const idEl = document.getElementById('reserve-activate-id');
    const closeBtn = document.getElementById('reserve-activate-close');
    const cancelBtn = document.getElementById('reserve-activate-cancel');
    const confirmBtn = document.getElementById('reserve-activate-confirm');
    const overlay = modal?.querySelector('.modal-overlay');

    idEl.textContent = `#${contractId}`;
    modal.classList.remove('hidden');

    const close = () => modal.classList.add('hidden');

    const onConfirm = async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Активація...';
        try {
            const resp = await apiFetch(`/farmer-contracts/${contractId}/activate`, { method: 'POST' });
            if (!resp.ok) {
                const err = await resp.json().catch(() => null);
                showToast(err?.detail || 'Помилка активації', 'error');
                return;
            }
            showToast('Контракт активовано', 'success');
            close();
            await loadFarmerContracts();
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Активувати';
        }
    };

    // Clean up old listeners by cloning
    const newConfirm = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
    newConfirm.addEventListener('click', onConfirm);

    const newCancel = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
    newCancel.addEventListener('click', close);

    const newClose = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newClose, closeBtn);
    newClose.addEventListener('click', close);

    overlay?.addEventListener('click', close, { once: true });
}

function openContractCloseModal(contractId) {
    const modal = document.getElementById('contract-close-modal');
    const idEl = document.getElementById('contract-close-id');
    const closeBtn = document.getElementById('contract-close-close');
    const cancelBtn = document.getElementById('contract-close-cancel');
    const confirmBtn = document.getElementById('contract-close-confirm');
    const overlay = modal?.querySelector('.modal-overlay');

    idEl.textContent = `#${contractId}`;
    modal.classList.remove('hidden');

    const close = () => modal.classList.add('hidden');

    const onConfirm = async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Закриття...';
        try {
            const resp = await apiFetch(`/farmer-contracts/${contractId}/close`, { method: 'POST' });
            if (!resp.ok) {
                const err = await resp.json().catch(() => null);
                showToast(err?.detail || 'Помилка закриття', 'error');
                return;
            }
            showToast('Контракт закрито', 'success');
            close();
            await loadFarmerContracts();
            await loadStock();
            await loadPurchaseStock();
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Закрити контракт';
        }
    };

    // Clean up old listeners by cloning
    const newConfirm = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
    newConfirm.addEventListener('click', onConfirm);

    const newCancel = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
    newCancel.addEventListener('click', close);

    const newClose = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newClose, closeBtn);
    newClose.addEventListener('click', close);

    overlay?.addEventListener('click', close, { once: true });
}

function openFcPaymentCancelModal(payment) {
    const modal = document.getElementById('fc-payment-cancel-modal');
    const closeBtn = document.getElementById('fc-payment-cancel-close');
    const cancelBtn = document.getElementById('fc-payment-cancel-cancel');
    const confirmBtn = document.getElementById('fc-payment-cancel-confirm');
    const overlay = modal?.querySelector('.modal-overlay');
    const info = document.getElementById('fc-payment-cancel-info');

    const typeLabels = {
        'goods_issue': 'Видача',
        'goods_receive': 'Прийом',
        'cash': 'Гроші',
        'grain': 'Зерно'
    };
    const typeLabel = typeLabels[payment.payment_type] || payment.payment_type;
    if (info) {
        info.textContent = `${typeLabel}: ${payment.item_name || ''} — контракт #${payment.contract_id}`;
    }
    modal.classList.remove('hidden');

    const close = () => modal.classList.add('hidden');

    const onConfirm = async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Скасування...';
        try {
            const resp = await apiFetch(`/farmer-contracts/payments/${payment.id}/cancel`, { method: 'POST' });
            if (!resp.ok) {
                const err = await resp.json().catch(() => null);
                showToast(err?.detail || 'Помилка скасування', 'error');
                return;
            }
            showToast('Операцію скасовано', 'success');
            close();
            await loadFarmerContracts();
            await loadFarmerContractPayments();
            await loadStock();
            await loadPurchaseStock();
            await loadCashBalance();
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Так, скасувати';
        }
    };

    // Clean up old listeners by cloning
    const newConfirm = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
    newConfirm.addEventListener('click', onConfirm);

    const newCancel = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
    newCancel.addEventListener('click', close);

    const newClose = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newClose, closeBtn);
    newClose.addEventListener('click', close);

    overlay?.addEventListener('click', close, { once: true });
}

// ───── Contract Detail Modal ─────
let fcDetailContractId = null;
async function openFcContractDetailModal(contractId) {
    const modal = document.getElementById('fc-detail-modal');
    if (!modal) return;
    fcDetailContractId = contractId;

    const ownersMap = new Map(ownersCache.map(o => [o.id, o.full_name]));
    const typeLabels = { 'payment': 'Виплата', 'debt': 'Контракт', 'reserve': 'Резерв' };
    const statusMap = {
        'open': { label: 'Відкритий', cls: 'warning' },
        'closed': { label: 'Закритий', cls: 'success' },
        'cancelled': { label: 'Скасований', cls: 'danger' },
        'pending': { label: 'Очікує', cls: 'info' }
    };
    const dirLabels = { 'from_company': 'Від компанії', 'from_farmer': 'Від фермера' };
    const payTypeLabels = {
        'goods_issue': 'Видача', 'goods_receive': 'Прийом',
        'cash': 'Гроші', 'grain': 'Зерно', 'settlement': 'Розрахунок'
    };

    // Show modal immediately with loading state
    document.getElementById('fc-detail-id').textContent = `#${contractId}`;
    document.getElementById('fc-detail-items-tbody').innerHTML = '<tr><td colspan="6">Завантаження…</td></tr>';
    document.getElementById('fc-detail-payments-tbody').innerHTML = '<tr><td colspan="6">Завантаження…</td></tr>';
    document.getElementById('fc-detail-payments-hint').textContent = '';
    modal.classList.remove('hidden');

    try {
        const [contractResp, paymentsResp] = await Promise.all([
            apiFetch(`/farmer-contracts/${contractId}`),
            apiFetch(`/farmer-contracts/${contractId}/payments`)
        ]);

        if (!contractResp.ok) {
            showToast('Не вдалося завантажити контракт', 'error');
            modal.classList.add('hidden');
            return;
        }

        const contract = await contractResp.json();
        const payments = paymentsResp.ok ? await paymentsResp.json() : [];

        const ownerName = ownersMap.get(contract.owner_id) || `#${contract.owner_id}`;
        const st = statusMap[contract.status] || { label: contract.status, cls: 'warning' };
        let typeLabel = typeLabels[contract.contract_type] || contract.contract_type;
        if (contract.was_reserve) typeLabel += ' (резерв)';

        document.getElementById('fc-detail-owner').textContent = ownerName;
        document.getElementById('fc-detail-type').textContent = typeLabel;
        document.getElementById('fc-detail-status').innerHTML = `<span class="status-badge ${st.cls}">${st.label}</span>`;
        document.getElementById('fc-detail-date').textContent = formatDate(contract.created_at);
        document.getElementById('fc-detail-total').textContent = formatAmount(contract.total_value_uah);
        document.getElementById('fc-detail-balance').textContent = formatAmount(contract.balance_uah);
        const currText = contract.currency
            ? `${contract.currency.toUpperCase()}${contract.exchange_rate ? ' (курс: ' + contract.exchange_rate + ')' : ''}`
            : 'UAH';
        document.getElementById('fc-detail-currency').textContent = currText;
        const noteRow = document.getElementById('fc-detail-note-row');
        if (contract.note) {
            document.getElementById('fc-detail-note').textContent = contract.note;
            noteRow.style.display = '';
        } else {
            noteRow.style.display = 'none';
        }

        // Items table
        const itemsTbody = document.getElementById('fc-detail-items-tbody');
        itemsTbody.innerHTML = '';
        if (contract.items && contract.items.length) {
            contract.items.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${dirLabels[item.direction] || item.direction}</td>
                    <td>${item.item_name || '—'}</td>
                    <td>${formatWeight(item.quantity_kg)}</td>
                    <td>${formatAmount(item.price_per_kg)}</td>
                    <td>${formatAmount(item.total_value_uah)}</td>
                    <td>${formatWeight(item.delivered_kg)}</td>
                `;
                itemsTbody.appendChild(tr);
            });
        } else {
            itemsTbody.innerHTML = '<tr><td colspan="6" class="hint">Немає позицій</td></tr>';
        }

        // Payments table
        const payTbody = document.getElementById('fc-detail-payments-tbody');
        const payHint = document.getElementById('fc-detail-payments-hint');
        payTbody.innerHTML = '';
        payHint.textContent = '';
        if (payments.length) {
            payments.forEach(p => {
                const tr = document.createElement('tr');
                if (p.is_cancelled) tr.classList.add('payment-cancelled');
                const statusLabel = p.is_cancelled
                    ? '<span class="status-badge danger">Скасовано</span>'
                    : '<span class="status-badge success">Активна</span>';
                tr.innerHTML = `
                    <td>${formatDate(p.payment_date)}</td>
                    <td>${payTypeLabels[p.payment_type] || p.payment_type}</td>
                    <td>${p.item_name || '—'}</td>
                    <td>${p.quantity_kg != null ? formatWeight(p.quantity_kg) : '—'}</td>
                    <td>${formatAmount(p.amount_uah)}</td>
                    <td>${statusLabel}</td>
                `;
                payTbody.appendChild(tr);
            });
        } else {
            payHint.textContent = 'Операцій поки що немає.';
        }
    } catch (err) {
        console.error('Error loading contract detail', err);
        showToast('Помилка завантаження деталей', 'error');
        modal.classList.add('hidden');
    }
}

function initFcContractDetailModal() {
    const modal = document.getElementById('fc-detail-modal');
    const closeBtn = document.getElementById('fc-detail-close');
    const closeBtnBottom = document.getElementById('fc-detail-close-btn');
    const downloadBtn = document.getElementById('fc-detail-download-btn');
    const overlay = modal?.querySelector('.modal-overlay');
    if (!modal) return;
    const close = () => modal.classList.add('hidden');
    closeBtn?.addEventListener('click', close);
    closeBtnBottom?.addEventListener('click', close);
    overlay?.addEventListener('click', close);

    downloadBtn?.addEventListener('click', async () => {
        if (!fcDetailContractId) return;
        downloadBtn.disabled = true;
        downloadBtn.textContent = 'Завантаження…';
        try {
            const response = await apiFetchBlob(`/farmer-contracts/${fcDetailContractId}/export`);
            if (!response.ok) {
                const err = await response.json().catch(() => null);
                showToast(err?.detail || 'Не вдалося сформувати звіт', 'error');
                return;
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `contract_${fcDetailContractId}.xlsx`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            showToast('Звіт сформовано', 'success');
        } catch (e) {
            showToast('Помилка завантаження звіту', 'error');
        } finally {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Скачати Excel';
        }
    });
}

// ───── Payment Detail Modal ─────
function openFcPaymentDetailModal(payment) {
    const modal = document.getElementById('fc-payment-detail-modal');
    if (!modal) return;

    const ownersMap = new Map(ownersCache.map(o => [o.id, o.full_name]));
    const contractsMap = new Map(farmerContractsCache.map(c => [c.id, c]));
    const typeLabels = {
        'goods_issue': 'Видача', 'goods_receive': 'Прийом',
        'cash': 'Гроші', 'grain': 'Зерно', 'settlement': 'Розрахунок'
    };

    const contract = contractsMap.get(payment.contract_id);
    const ownerName = contract ? (ownersMap.get(contract.owner_id) || `#${contract.owner_id}`) : '—';

    document.getElementById('fc-pay-detail-id').textContent = `#${payment.id}`;
    document.getElementById('fc-pay-detail-date').textContent = formatDate(payment.payment_date);
    document.getElementById('fc-pay-detail-type').textContent = typeLabels[payment.payment_type] || payment.payment_type;
    document.getElementById('fc-pay-detail-owner').textContent = ownerName;
    document.getElementById('fc-pay-detail-contract').textContent = `#${payment.contract_id}`;
    document.getElementById('fc-pay-detail-item').textContent = payment.item_name || '—';
    document.getElementById('fc-pay-detail-qty').textContent = payment.quantity_kg != null ? formatWeight(payment.quantity_kg) + ' кг' : '—';

    const curr = (payment.currency || 'UAH').toUpperCase();
    document.getElementById('fc-pay-detail-amount').textContent = `${formatAmount(payment.amount)} ${curr}`;
    document.getElementById('fc-pay-detail-amount-uah').textContent = `${formatAmount(payment.amount_uah)} грн`;
    const rateText = payment.exchange_rate ? `${curr} (курс: ${payment.exchange_rate})` : curr;
    document.getElementById('fc-pay-detail-currency').textContent = rateText;

    if (payment.is_cancelled) {
        document.getElementById('fc-pay-detail-status').innerHTML = '<span class="status-badge danger">Скасовано</span>';
    } else {
        document.getElementById('fc-pay-detail-status').innerHTML = '<span class="status-badge success">Активна</span>';
    }

    modal.classList.remove('hidden');
}

function initFcPaymentDetailModal() {
    const modal = document.getElementById('fc-payment-detail-modal');
    const closeBtn = document.getElementById('fc-pay-detail-close');
    const closeBtnBottom = document.getElementById('fc-pay-detail-close-btn');
    const overlay = modal?.querySelector('.modal-overlay');
    if (!modal) return;
    const close = () => modal.classList.add('hidden');
    closeBtn?.addEventListener('click', close);
    closeBtnBottom?.addEventListener('click', close);
    overlay?.addEventListener('click', close);
}

function initFcContractsReportModal() {
    const modal = document.getElementById('fc-contracts-report-modal');
    const openBtn = document.getElementById('fc-contracts-report-btn');
    const closeBtn = document.getElementById('fc-contracts-report-close');
    const cancelBtn = document.getElementById('fc-contracts-report-cancel');
    const downloadBtn = document.getElementById('fc-contracts-report-download');
    const overlay = modal?.querySelector('.modal-overlay');
    const startInput = document.getElementById('fc-contracts-report-start');
    const endInput = document.getElementById('fc-contracts-report-end');
    const startNative = document.getElementById('fc-contracts-report-start-native');
    const endNative = document.getElementById('fc-contracts-report-end-native');
    const startBtn = document.getElementById('fc-contracts-report-start-btn');
    const endBtn = document.getElementById('fc-contracts-report-end-btn');
    if (!modal || !openBtn || !downloadBtn) return;

    const openModal = () => {
        // Заповнюємо список фермерів
        const ownerSel = document.getElementById('fc-contracts-report-owner');
        if (ownerSel) {
            ownerSel.innerHTML = '<option value="">Всі фермери</option>' +
                ownersCache.map(o => `<option value="${o.id}">${o.full_name}</option>`).join('');
            refreshCustomSelect(ownerSel);
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
        const ownerId = document.getElementById('fc-contracts-report-owner')?.value;
        const typeVal = document.getElementById('fc-contracts-report-type')?.value;
        const statusVal = document.getElementById('fc-contracts-report-status')?.value;
        if (ownerId) params.append('owner_id', ownerId);
        if (typeVal) params.append('contract_type', typeVal);
        if (statusVal) params.append('status_filter', statusVal);
        if (startIso) params.append('start_date', startIso);
        if (endIso) params.append('end_date', endIso);

        const path = `/farmer-contracts/export${params.toString() ? `?${params}` : ''}`;
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
        link.download = 'farmer_contracts_report.xlsx';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showToast('Звіт сформовано', 'success');
        closeModal();
    });
}

function initFcPaymentsReportModal() {
    const modal = document.getElementById('fc-payments-report-modal');
    const openBtn = document.getElementById('fc-payments-report-btn');
    const closeBtn = document.getElementById('fc-payments-report-close');
    const cancelBtn = document.getElementById('fc-payments-report-cancel');
    const downloadBtn = document.getElementById('fc-payments-report-download');
    const overlay = modal?.querySelector('.modal-overlay');
    const startInput = document.getElementById('fc-payments-report-start');
    const endInput = document.getElementById('fc-payments-report-end');
    const startNative = document.getElementById('fc-payments-report-start-native');
    const endNative = document.getElementById('fc-payments-report-end-native');
    const startBtn = document.getElementById('fc-payments-report-start-btn');
    const endBtn = document.getElementById('fc-payments-report-end-btn');
    if (!modal || !openBtn || !downloadBtn) return;

    const openModal = () => {
        // Заповнюємо список фермерів
        const ownerSel = document.getElementById('fc-payments-report-owner');
        if (ownerSel) {
            ownerSel.innerHTML = '<option value="">Всі фермери</option>' +
                ownersCache.map(o => `<option value="${o.id}">${o.full_name}</option>`).join('');
            refreshCustomSelect(ownerSel);
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
        const ownerId = document.getElementById('fc-payments-report-owner')?.value;
        const typeVal = document.getElementById('fc-payments-report-type')?.value;
        const showCancelled = document.getElementById('fc-payments-report-show-cancelled')?.checked;
        if (ownerId) params.append('owner_id', ownerId);
        if (typeVal) params.append('payment_type', typeVal);
        if (startIso) params.append('start_date', startIso);
        if (endIso) params.append('end_date', endIso);
        if (showCancelled) params.append('show_cancelled', 'true');

        const path = `/farmer-contracts/payments/export${params.toString() ? `?${params}` : ''}`;
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
        link.download = 'farmer_payments_report.xlsx';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showToast('Звіт сформовано', 'success');
        closeModal();
    });
}

function initFarmerContractsSection() {
    const ownerFilter = document.getElementById('farmer-contracts-filter-owner');
    const typeFilter = document.getElementById('farmer-contracts-filter-type');
    const statusFilter = document.getElementById('farmer-contracts-filter-status');
    const paymentsOwnerFilter = document.getElementById('farmer-contract-payments-filter-owner');
    const paymentsContractFilter = document.getElementById('farmer-contract-payments-filter-contract');
    [ownerFilter, typeFilter, statusFilter].filter(Boolean).forEach(sel => {
        sel.addEventListener('change', () => {
            renderFarmerContractsTable(applyFarmerContractsFilters(farmerContractsCache));
        });
    });
    if (paymentsOwnerFilter && paymentsContractFilter) {
        [paymentsOwnerFilter, paymentsContractFilter].forEach(sel => {
            sel.addEventListener('change', () => {
                renderFarmerContractPaymentsTable(applyFarmerContractPaymentsFilters(farmerContractPaymentsCache));
            });
        });
    }
    initFarmerContractModal();
    initFarmerContractPaymentModal();
    initFcContractDetailModal();
    initFcPaymentDetailModal();
    initFcContractsReportModal();
    initFcPaymentsReportModal();
    updateFarmerContractsFilterOptions();
}

function updateFarmerContractsFilterOptions() {
    const ownerFilter = document.getElementById('farmer-contracts-filter-owner');
    const paymentsOwnerFilter = document.getElementById('farmer-contract-payments-filter-owner');
    const paymentsContractFilter = document.getElementById('farmer-contract-payments-filter-contract');

    if (ownerFilter) {
        const current = ownerFilter.value;
        ownerFilter.innerHTML = '<option value="">Всі фермери</option>' +
            ownersCache.map(o => `<option value="${o.id}">${o.full_name}</option>`).join('');
        ownerFilter.value = current;
        initCustomSelects(ownerFilter);
        refreshCustomSelect(ownerFilter);
    }
    if (paymentsOwnerFilter) {
        const current = paymentsOwnerFilter.value;
        paymentsOwnerFilter.innerHTML = '<option value="">Всі фермери</option>' +
            ownersCache.map(o => `<option value="${o.id}">${o.full_name}</option>`).join('');
        paymentsOwnerFilter.value = current;
        initCustomSelects(paymentsOwnerFilter);
        refreshCustomSelect(paymentsOwnerFilter);
    }
    if (paymentsContractFilter) {
        const current = paymentsContractFilter.value;
        paymentsContractFilter.innerHTML = '<option value="">Всі контракти</option>' +
            farmerContractsCache.map(c => `<option value="${c.id}">#${c.id}</option>`).join('');
        paymentsContractFilter.value = current;
        initCustomSelects(paymentsContractFilter);
        refreshCustomSelect(paymentsContractFilter);
    }
}

async function loadFarmerContracts() {
    const response = await apiFetch('/farmer-contracts');
    if (!response.ok) {
        console.error('Помилка завантаження контрактів фермерів');
        return;
    }
    farmerContractsCache = await response.json();
    updateFarmerContractsFilterOptions();
    renderFarmerContractsTable(applyFarmerContractsFilters(farmerContractsCache));
}

async function loadFarmerContractPayments() {
    const response = await apiFetch('/farmer-contracts/payments');
    if (!response.ok) {
        console.error('Помилка завантаження виплат по контрактах');
        return;
    }
    farmerContractPaymentsCache = await response.json();
    updateFarmerContractsFilterOptions();
    renderFarmerContractPaymentsTable(applyFarmerContractPaymentsFilters(farmerContractPaymentsCache));
}

function applyFarmerContractsFilters(contracts) {
    const ownerFilter = document.getElementById('farmer-contracts-filter-owner');
    const typeFilter = document.getElementById('farmer-contracts-filter-type');
    const statusFilter = document.getElementById('farmer-contracts-filter-status');
    const ownerId = ownerFilter?.value ? parseInt(ownerFilter.value, 10) : null;
    const typeVal = typeFilter?.value || '';
    const status = statusFilter?.value || '';
    return contracts.filter(c => {
        if (ownerId && c.owner_id !== ownerId) return false;
        if (typeVal && c.contract_type !== typeVal) return false;
        if (status && c.status !== status) return false;
        return true;
    });
}

function renderFarmerContractsTable(contracts) {
    const tableBody = document.querySelector('#farmer-contracts-table tbody');
    if (!tableBody) return;
    const ownersMap = new Map(ownersCache.map(o => [o.id, o.full_name]));
    const typeLabels = {
        'payment': 'Виплата',
        'debt': 'Контракт',
        'reserve': 'Резерв'
    };
    const statusMap = {
        'open': { label: 'Відкритий', cls: 'warning' },
        'closed': { label: 'Закритий', cls: 'success' },
        'cancelled': { label: 'Скасований', cls: 'danger' },
        'pending': { label: 'Очікує', cls: 'info' }
    };
    tableBody.innerHTML = '';
    if (!contracts.length) {
        tableBody.innerHTML = '<tr><td colspan="7" class="table-empty-message">Контрактів ще немає</td></tr>';
        return;
    }
    contracts.forEach(contract => {
        const row = document.createElement('tr');
        if (contract.status === 'closed') row.classList.add('row-muted');
        if (contract.status === 'cancelled') row.classList.add('row-cancelled');
        const ownerName = ownersMap.get(contract.owner_id) || `#${contract.owner_id}`;
        const st = statusMap[contract.status] || { label: contract.status, cls: 'warning' };
        let typeLabel = typeLabels[contract.contract_type] || contract.contract_type;
        if (contract.was_reserve) typeLabel += ' (резерв)';
        const balanceColor = contract.balance_uah > 0.01 ? '#dc2626' : '#16a34a';
        row.innerHTML = `
            <td class="td-mono">#${contract.id}</td>
            <td><strong>${ownerName}</strong></td>
            <td>${typeLabel}</td>
            <td class="td-weight">${formatAmount(contract.total_value_uah)} ₴</td>
            <td><strong style="color:${balanceColor}">${formatAmount(contract.balance_uah)} ₴</strong></td>
            <td><span class="status-badge ${st.cls}">${st.label}</span></td>
            <td class="actions-cell"></td>
        `;
        const actionsCell = row.querySelector('.actions-cell');

        // Detail button
        const detailBtn = document.createElement('button');
        detailBtn.className = 'btn-icon btn-icon-secondary';
        detailBtn.title = 'Детально';
        detailBtn.innerHTML = ICONS.view;
        detailBtn.addEventListener('click', () => openFcContractDetailModal(contract.id));
        actionsCell.appendChild(detailBtn);

        // Open contracts: pay/issue button
        if (contract.status === 'open') {
            const payBtn = document.createElement('button');
            payBtn.className = 'btn-icon btn-icon-primary';
            payBtn.title = 'Операція';
            payBtn.innerHTML = ICONS.operation;
            payBtn.addEventListener('click', () => openFarmerContractPaymentModal(contract));
            actionsCell.appendChild(payBtn);
        }

        // Pending reserve: activate button
        if (contract.status === 'pending' && contract.contract_type === 'reserve') {
            const activateBtn = document.createElement('button');
            activateBtn.className = 'btn-icon btn-icon-primary';
            activateBtn.title = 'Активувати';
            activateBtn.innerHTML = ICONS.activate;
            activateBtn.addEventListener('click', () => {
                openReserveActivateModal(contract.id);
            });
            actionsCell.appendChild(activateBtn);
        }

        // Open or pending: close button
        if (contract.status === 'open' || contract.status === 'pending') {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'btn-icon btn-icon-danger';
            closeBtn.title = 'Закрити контракт';
            closeBtn.innerHTML = ICONS.close;
            closeBtn.addEventListener('click', () => {
                openContractCloseModal(contract.id);
            });
            actionsCell.appendChild(closeBtn);
        }

        tableBody.appendChild(row);
    });
}

function applyFarmerContractPaymentsFilters(payments) {
    const ownerFilter = document.getElementById('farmer-contract-payments-filter-owner');
    const contractFilter = document.getElementById('farmer-contract-payments-filter-contract');
    const ownerId = ownerFilter?.value ? parseInt(ownerFilter.value, 10) : null;
    const contractId = contractFilter?.value ? parseInt(contractFilter.value, 10) : null;
    const contractsMap = new Map(farmerContractsCache.map(c => [c.id, c.owner_id]));
    return payments.filter(p => {
        if (contractId && p.contract_id !== contractId) return false;
        if (ownerId) {
            const contractOwnerId = contractsMap.get(p.contract_id);
            if (contractOwnerId !== ownerId) return false;
        }
        return true;
    });
}

function renderFarmerContractPaymentsTable(payments) {
    const tableBody = document.querySelector('#farmer-contract-payments-table tbody');
    const hint = document.getElementById('farmer-contract-payments-hint');
    if (!tableBody || !hint) return;
    const ownersMap = new Map(ownersCache.map(o => [o.id, o.full_name]));
    const contractsMap = new Map(farmerContractsCache.map(c => [c.id, c]));
    tableBody.innerHTML = '';
    if (!payments.length) {
        hint.textContent = '';
        tableBody.innerHTML = '<tr><td colspan="6" class="table-empty-message">Поки що виплат немає</td></tr>';
        return;
    }
    hint.textContent = '';
    const typeLabels = {
        'goods_issue': { text: 'Видача', cls: 'issue' },
        'goods_receive': { text: 'Прийом', cls: 'receive' },
        'cash': { text: 'Гроші', cls: 'cash' },
        'grain': { text: 'Зерно', cls: 'grain' },
        'settlement': { text: 'Розрахунок', cls: 'settlement' },
        'voucher': { text: 'Талон', cls: 'voucher' }
    };
    payments.forEach(payment => {
        const row = document.createElement('tr');
        if (payment.is_cancelled) row.classList.add('row-cancelled');
        const contract = contractsMap.get(payment.contract_id);
        const ownerName = contract ? (ownersMap.get(contract.owner_id) || `#${contract.owner_id}`) : '—';
        const typeInfo = typeLabels[payment.payment_type] || { text: payment.payment_type, cls: '' };
        let amountLabel = '';
        if (payment.payment_type === 'goods_issue' || payment.payment_type === 'goods_receive') {
            const itemName = payment.item_name || '—';
            amountLabel = `<strong>${itemName}</strong>: ${formatWeight(payment.quantity_kg || 0)} ${payment.item_name === 'Готівка' ? 'грн' : 'кг'} <span class="td-secondary">(${formatAmount(payment.amount_uah)} ₴)</span>`;
        } else if (payment.payment_type === 'grain' || payment.payment_type === 'voucher') {
            amountLabel = `<strong>${payment.item_name || 'Зерно'}</strong>: ${formatWeight(payment.quantity_kg || 0)} кг <span class="td-secondary">(${formatAmount(payment.amount_uah)} ₴)</span>`;
        } else {
            amountLabel = `<strong>${formatCurrency(payment.amount, payment.currency)}</strong> <span class="td-secondary">(≈${formatAmount(payment.amount_uah)} ₴)</span>`;
        }
        if (payment.is_cancelled) {
            amountLabel = `<s>${amountLabel}</s> <span class="status-badge danger">Скасовано</span>`;
        }
        row.innerHTML = `
            <td>${formatDate(payment.payment_date)}</td>
            <td><strong>${ownerName}</strong></td>
            <td class="td-mono">#${payment.contract_id}</td>
            <td><span class="inline-badge ${typeInfo.cls}">${typeInfo.text}</span></td>
            <td>${amountLabel}</td>
            <td class="actions-cell"></td>
        `;
        {
            const actionsCell = row.querySelector('.actions-cell');
            const detailBtn = document.createElement('button');
            detailBtn.className = 'btn-icon btn-icon-secondary';
            detailBtn.title = 'Детально';
            detailBtn.innerHTML = ICONS.view;
            detailBtn.addEventListener('click', () => openFcPaymentDetailModal(payment));
            actionsCell.appendChild(detailBtn);

            if (!payment.is_cancelled && payment.payment_type !== 'settlement') {
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'btn-icon btn-icon-danger';
                cancelBtn.title = 'Скасувати';
                cancelBtn.innerHTML = ICONS.cancel;
                cancelBtn.addEventListener('click', () => {
                    openFcPaymentCancelModal(payment);
                });
                actionsCell.appendChild(cancelBtn);
            }
        }
        tableBody.appendChild(row);
    });
}

function initFarmerContractModal() {
    const modal = document.getElementById('farmer-contract-modal');
    const openBtn = document.getElementById('farmer-contract-add-btn');
    const closeBtn = document.getElementById('farmer-contract-close');
    const cancelBtn = document.getElementById('farmer-contract-cancel');
    const saveBtn = document.getElementById('farmer-contract-save');
    const addFarmerItemBtn = document.getElementById('farmer-contract-add-farmer-item');
    const addCompanyItemBtn = document.getElementById('farmer-contract-add-company-item');
    const overlay = modal?.querySelector('.modal-overlay');
    const ownerInput = document.getElementById('farmer-contract-owner');
    const ownerIdInput = document.getElementById('farmer-contract-owner-id');
    const ownerSuggestions = document.getElementById('farmer-contract-owner-suggestions');
    const typeSelect = document.getElementById('farmer-contract-type');
    const noteInput = document.getElementById('farmer-contract-note');
    const farmerItemsBody = document.getElementById('farmer-contract-items-farmer');
    const companyItemsBody = document.getElementById('farmer-contract-items-company');
    const farmerTotalLabel = document.getElementById('farmer-contract-total-farmer');
    const companyTotalLabel = document.getElementById('farmer-contract-total-company');
    const balanceTotalLabel = document.getElementById('farmer-contract-total-balance');
    if (!modal || !openBtn || !saveBtn || !addFarmerItemBtn || !addCompanyItemBtn || !ownerInput || !ownerIdInput || !ownerSuggestions || !farmerItemsBody || !companyItemsBody || !farmerTotalLabel || !companyTotalLabel || !balanceTotalLabel) return;

    const farmerSection = document.getElementById('fc-section-farmer');
    const companySection = document.querySelector('.fc-section--company');
    const companyTitle = document.getElementById('fc-company-title');
    const totalFarmerWrap = document.getElementById('fc-total-farmer-wrap');
    const totalCompanyWrap = document.getElementById('fc-total-company-wrap');
    const totalCompanyLabel = document.getElementById('fc-total-company-label');
    const totalBalanceWrap = document.getElementById('fc-total-balance-wrap');
    const totalBalanceLabel = document.getElementById('fc-total-balance-label');
    const totalPayoutWrap = document.getElementById('fc-total-payout-wrap');
    const payoutValueEl = document.getElementById('farmer-contract-total-payout');

    // Farmer balance section (payment)
    const fcFarmerBalanceSection = document.getElementById('fc-farmer-balance-section');
    const fcFarmerBalanceCards = document.getElementById('fc-farmer-balance-cards');
    const fcFarmerBalanceTotal = document.getElementById('fc-farmer-balance-total');

    // Payment options
    const paymentOptions = document.getElementById('fc-payment-options');
    const fcPaymentCurrency = document.getElementById('fc-payment-currency');
    const fcPaymentRateField = document.getElementById('fc-payment-rate-field');
    const fcPaymentRate = document.getElementById('fc-payment-rate');
    const fcPaymentEquiv = document.getElementById('fc-payment-equiv');

    let paymentFarmerBalance = [];

    const loadFarmerBalanceForPayment = async (ownerId) => {
        if (!ownerId) {
            fcFarmerBalanceCards.innerHTML = '<div class="fcp-grain-empty">Оберіть фермера</div>';
            fcFarmerBalanceTotal.textContent = '—';
            paymentFarmerBalance = [];
            return;
        }
        try {
            const resp = await apiFetch(`/grain/owners/${ownerId}/balance`);
            if (resp.ok) {
                paymentFarmerBalance = await resp.json();
            } else {
                paymentFarmerBalance = [];
            }
        } catch { paymentFarmerBalance = []; }

        if (!paymentFarmerBalance.length) {
            fcFarmerBalanceCards.innerHTML = '<div class="fcp-grain-empty">Немає зерна на балансі</div>';
            fcFarmerBalanceTotal.textContent = '0,00 грн';
            return;
        }
        let totalUah = 0;
        fcFarmerBalanceCards.innerHTML = '';
        paymentFarmerBalance.forEach(item => {
            const culture = culturesCache.find(c => c.id === item.culture_id);
            const price = culture ? culture.price_per_kg : 0;
            const valueUah = item.quantity_kg * price;
            totalUah += valueUah;
            const card = document.createElement('div');
            card.className = 'fcp-grain-card';
            card.innerHTML = `
                <span class="fcp-grain-card__name">${item.culture_name}</span>
                <span class="fcp-grain-card__qty">${formatWeight(item.quantity_kg)} кг ≈ ${formatAmount(valueUah)} грн</span>
            `;
            fcFarmerBalanceCards.appendChild(card);
        });
        fcFarmerBalanceTotal.textContent = formatAmount(totalUah) + ' грн';
    };

    const applyContractType = () => {
        const type = typeSelect.value;
        const isDebt = type === 'debt';
        const isPayment = type === 'payment';
        const isReserve = type === 'reserve';

        // Farmer balance section — visible for payment
        fcFarmerBalanceSection.classList.toggle('hidden', !isPayment);

        // Payment options (currency/rate) — only for payment type
        paymentOptions.classList.toggle('hidden', !isPayment);

        // Farmer section — visible for payment
        if (isPayment) {
            farmerSection.classList.remove('hidden');
            totalFarmerWrap.style.display = '';
        } else {
            farmerSection.classList.add('hidden');
            farmerItemsBody.innerHTML = '';
            totalFarmerWrap.style.display = 'none';
        }

        // Company section — hidden for payment, visible for others
        if (isPayment) {
            companySection.classList.add('hidden');
            companyItemsBody.innerHTML = '';
            totalCompanyWrap.style.display = 'none';
            totalBalanceWrap.classList.add('hidden');
            totalPayoutWrap.classList.remove('hidden');
        } else {
            companySection.classList.remove('hidden');
            totalCompanyWrap.style.display = '';
            totalBalanceWrap.classList.remove('hidden');
            totalPayoutWrap.classList.add('hidden');
        }

        // Labels
        if (isDebt || isReserve) {
            companyTitle.textContent = isReserve ? 'Резерв позицій' : 'Фермер отримує';
            totalCompanyLabel.textContent = isReserve ? 'Резерв' : 'Фермер отримує';
            totalBalanceLabel.textContent = isReserve ? 'Сума резерву' : 'Борг фермера';
        }

        // Company section hint
        const hintEl = document.getElementById('fc-company-hint');
        if (hintEl) {
            hintEl.textContent = isReserve
                ? 'Вкажіть назву, кількість та ціну. Якщо позиції немає на складі — вона буде створена.'
                : 'Позиції бронюються на складі після створення контракту';
        }

        // Farmer section title
        const farmerTitle = farmerSection?.querySelector('.fc-section__title');
        if (farmerTitle) {
            const badge = farmerTitle.querySelector('.fc-section__badge');
            if (isPayment) {
                farmerTitle.innerHTML = '';
                if (badge) farmerTitle.appendChild(badge);
                farmerTitle.append(' Зерно для обміну на гроші');
            } else {
                farmerTitle.innerHTML = '';
                if (badge) farmerTitle.appendChild(badge);
                farmerTitle.append(' Від фермера');
            }
        }

        // Load farmer balance for payment type
        if (isPayment && ownerIdInput.value) {
            loadFarmerBalanceForPayment(parseInt(ownerIdInput.value, 10));
        }

        updateContractTotal();
    };

    const resetForm = () => {
        ownerInput.value = '';
        ownerIdInput.value = '';
        ownerSuggestions.innerHTML = '';
        ownerSuggestions.classList.add('hidden');
        typeSelect.value = 'debt';
        initCustomSelects(typeSelect);
        noteInput.value = '';
        farmerItemsBody.innerHTML = '';
        companyItemsBody.innerHTML = '';
        paymentFarmerBalance = [];
        if (fcPaymentCurrency) { fcPaymentCurrency.value = 'UAH'; initCustomSelects(fcPaymentCurrency); }
        if (fcPaymentRate) fcPaymentRate.value = '';
        if (fcPaymentRateField) fcPaymentRateField.classList.add('hidden');
        if (fcPaymentEquiv) fcPaymentEquiv.textContent = '';
        if (fcFarmerBalanceCards) fcFarmerBalanceCards.innerHTML = '<div class="fcp-grain-empty">Оберіть фермера</div>';
        if (fcFarmerBalanceTotal) fcFarmerBalanceTotal.textContent = '—';
        applyContractType();
    };

    const openModal = () => {
        resetForm();
        modal.classList.remove('hidden');
    };
    const closeModal = () => modal.classList.add('hidden');

    openBtn.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);
    addFarmerItemBtn.addEventListener('click', () => addContractItemRow(farmerItemsBody, 'farmer'));
    addCompanyItemBtn.addEventListener('click', () => addContractItemRow(companyItemsBody, 'company'));
    typeSelect.addEventListener('change', applyContractType);

    // Payment currency/rate
    if (fcPaymentCurrency) {
        fcPaymentCurrency.addEventListener('change', () => {
            const isForeign = fcPaymentCurrency.value !== 'UAH';
            fcPaymentRateField.classList.toggle('hidden', !isForeign);
            if (!isForeign) fcPaymentRate.value = '';
            updateContractTotal();
        });
    }
    if (fcPaymentRate) {
        fcPaymentRate.addEventListener('input', updateContractTotal);
    }

    saveBtn.addEventListener('click', async () => {
        const ownerId = ownerIdInput.value ? parseInt(ownerIdInput.value, 10) : null;
        if (!ownerId) {
            showToast('Оберіть фермера зі списку', 'warning');
            return;
        }
        const type = typeSelect.value;
        const isPayment = type === 'payment';
        const isDebt = type === 'debt';
        const isReserve = type === 'reserve';

        const farmerItems = (isDebt || isReserve) ? [] : getContractItems(farmerItemsBody, 'farmer');
        const companyItems = isPayment ? [] : getContractItems(companyItemsBody, 'company');

        if (isPayment) {
            if (!farmerItems.length) {
                showToast('Вкажіть зерно для обміну на гроші', 'warning');
                return;
            }
        } else {
            if (!companyItems.length && (!farmerItems.length)) {
                showToast('Додайте позиції контракту', 'warning');
                return;
            }
            if (!companyItems.length) {
                showToast('Додайте що фермер отримує', 'warning');
                return;
            }
        }

        const payload = {
            owner_id: ownerId,
            contract_type: type,
            note: noteInput.value.trim() || null,
            farmer_items: farmerItems,
            company_items: companyItems
        };

        // Payment type: add currency/rate
        if (isPayment) {
            payload.currency = fcPaymentCurrency?.value || 'UAH';
            if (payload.currency !== 'UAH') {
                const rate = parseFloat(fcPaymentRate?.value) || 0;
                if (!rate) {
                    showToast('Вкажіть курс валюти', 'warning');
                    return;
                }
                payload.exchange_rate = rate;
            }
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Збереження...';
        try {
            const response = await apiFetch('/farmer-contracts', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const error = await response.json().catch(() => null);
                showToast(error?.detail || 'Не вдалося створити контракт', 'error');
                return;
            }
            showToast(isPayment ? 'Контракт виплати створено та оплачено' : 'Контракт створено', 'success');
            closeModal();
            await loadFarmerContracts();
            await loadFarmerContractPayments();
            await loadStock();
            await loadPurchaseStock();
            await loadCashBalance();
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Створити';
        }
    });

    function addContractItemRow(targetBody, direction) {
        const card = document.createElement('div');
        card.className = 'fc-item';
        const isPayment = typeSelect.value === 'payment';
        const isReserve = typeSelect.value === 'reserve';

        if (isReserve) {
            // Reserve: text input with autocomplete for item name, editable price
            card.innerHTML = `
                <select class="farmer-contract-item-type">
                    <option value="purchase">Товар</option>
                    <option value="grain">Зерно</option>
                </select>
                <div class="fc-item-autocomplete" style="position:relative;">
                    <input type="text" class="farmer-contract-item-name-input" placeholder="Введіть назву..." autocomplete="off">
                    <input type="hidden" class="farmer-contract-item-name-id">
                    <div class="fc-item-suggestions hidden"></div>
                </div>
                <input type="number" class="farmer-contract-item-qty" min="0" step="0.01" placeholder="0">
                <input type="number" class="farmer-contract-item-price" min="0" step="0.01" placeholder="Ціна">
                <span class="fc-item__total farmer-contract-item-total">0 грн</span>
                <button class="fc-item__remove farmer-contract-item-remove" title="Видалити">×</button>
            `;
            targetBody.appendChild(card);
            const typeSel = card.querySelector('.farmer-contract-item-type');
            initCustomSelects(typeSel);
            wireReserveItemRow(card);
        } else {
            let typeOptions;
            if (isPayment && direction === 'farmer') {
                typeOptions = `<option value="grain">Зерно</option>`;
            } else if (direction === 'company') {
                typeOptions = `<option value="grain">Зерно</option>
                           <option value="purchase">Товар</option>
                           <option value="cash">Гроші</option>
                           <option value="voucher">Талон</option>`;
            } else {
                typeOptions = `<option value="grain">Зерно</option>
                           <option value="cash">Гроші</option>`;
            }
            card.innerHTML = `
                <select class="farmer-contract-item-type">
                    ${typeOptions}
                </select>
                <select class="farmer-contract-item-select"></select>
                <input type="number" class="farmer-contract-item-qty" min="0" step="0.01" placeholder="0">
                <input type="number" class="farmer-contract-item-price" min="0" step="0.01" placeholder="0.00" readonly>
                <span class="fc-item__total farmer-contract-item-total">0 грн</span>
                <button class="fc-item__remove farmer-contract-item-remove" title="Видалити">×</button>
            `;
            targetBody.appendChild(card);
            const typeSel = card.querySelector('.farmer-contract-item-type');
            initCustomSelects(typeSel);
            wireItemRow(card, direction);
        }
        updateContractTotal();
    }

    // Autocomplete for farmer
    let ownerTimeout;
    ownerInput.addEventListener('input', () => {
        clearTimeout(ownerTimeout);
        ownerIdInput.value = '';
        const value = ownerInput.value.trim();
        if (!value) {
            ownerSuggestions.innerHTML = '';
            ownerSuggestions.classList.add('hidden');
            return;
        }
        ownerTimeout = setTimeout(() => {
            const matches = ownersCache.filter(o =>
                o.full_name.toLowerCase().includes(value.toLowerCase())
            );
            ownerSuggestions.innerHTML = '';
            if (!matches.length) {
                ownerSuggestions.classList.add('hidden');
                return;
            }
            matches.forEach(o => {
                const item = document.createElement('div');
                item.className = 'suggestion-item';
                item.textContent = o.full_name;
                item.addEventListener('click', () => {
                    ownerInput.value = o.full_name;
                    ownerIdInput.value = String(o.id);
                    ownerSuggestions.classList.add('hidden');
                    // Load balance for payment type
                    if (typeSelect.value === 'payment') {
                        loadFarmerBalanceForPayment(o.id);
                    }
                });
                ownerSuggestions.appendChild(item);
            });
            ownerSuggestions.classList.remove('hidden');
        }, 150);
    });
    document.addEventListener('click', (e) => {
        if (!ownerSuggestions.contains(e.target) && e.target !== ownerInput) {
            ownerSuggestions.classList.add('hidden');
        }
    });

    function wireItemRow(card, direction) {
        const typeSel = card.querySelector('.farmer-contract-item-type');
        const itemSel = card.querySelector('.farmer-contract-item-select');
        const qtyInput = card.querySelector('.farmer-contract-item-qty');
        const priceInput = card.querySelector('.farmer-contract-item-price');
        const removeBtn = card.querySelector('.farmer-contract-item-remove');

        const updateItemOptions = () => {
            const type = typeSel.value;
            if (type === 'grain') {
                itemSel.innerHTML = '<option value="">Оберіть</option>' +
                    culturesCache.map(c => `<option value="${c.id}" data-price="${c.price_per_kg}">${c.name}</option>`).join('');
                priceInput.value = '';
                priceInput.readOnly = true;
            } else if (type === 'purchase') {
                if (direction === 'farmer') {
                    itemSel.innerHTML = '<option value="">—</option>';
                    priceInput.value = '';
                    priceInput.readOnly = true;
                } else {
                    itemSel.innerHTML = '<option value="">Оберіть</option>' +
                        purchaseStockCache.map(p => `<option value="${p.id}" data-price="${p.sale_price_per_kg}">${p.name}</option>`).join('');
                    priceInput.value = '';
                    priceInput.readOnly = true;
                }
            } else if (type === 'voucher') {
                // Талон — тільки пшениця
                const wheat = culturesCache.find(c => c.name === 'Пшениця');
                if (wheat) {
                    itemSel.innerHTML = `<option value="${wheat.id}" data-price="${wheat.price_per_kg}" selected>Пшениця</option>`;
                    priceInput.value = parseFloat(wheat.price_per_kg).toFixed(2);
                } else {
                    itemSel.innerHTML = '<option value="">Пшениця не знайдена</option>';
                    priceInput.value = '';
                }
                priceInput.readOnly = true;
            } else {
                // Гроші — ціна вводиться вручну (курс)
                itemSel.innerHTML = '<option value="cash">Готівка</option>';
                priceInput.value = '1';
                priceInput.readOnly = false;
            }
            refreshCustomSelect(itemSel);
            updateRowTotal();
        };

        const updateRowTotal = () => {
            const qty = parseFloat(qtyInput.value) || 0;
            const price = parseFloat(priceInput.value) || 0;
            card.querySelector('.farmer-contract-item-total').textContent = formatAmount(qty * price) + ' грн';
            updateContractTotal();
        };

        typeSel.addEventListener('change', updateItemOptions);
        itemSel.addEventListener('change', () => {
            const sel = itemSel.options[itemSel.selectedIndex];
            if (sel && sel.dataset && sel.dataset.price) {
                priceInput.value = parseFloat(sel.dataset.price).toFixed(2);
            }
            updateRowTotal();
        });
        qtyInput.addEventListener('input', updateRowTotal);
        priceInput.addEventListener('input', updateRowTotal);
        removeBtn.addEventListener('click', () => { card.remove(); updateContractTotal(); });

        updateItemOptions();
    }

    function wireReserveItemRow(card) {
        const typeSel = card.querySelector('.farmer-contract-item-type');
        const nameInput = card.querySelector('.farmer-contract-item-name-input');
        const nameIdInput = card.querySelector('.farmer-contract-item-name-id');
        const suggestionsDiv = card.querySelector('.fc-item-suggestions');
        const qtyInput = card.querySelector('.farmer-contract-item-qty');
        const priceInput = card.querySelector('.farmer-contract-item-price');
        const removeBtn = card.querySelector('.farmer-contract-item-remove');

        const updateRowTotal = () => {
            const qty = parseFloat(qtyInput.value) || 0;
            const price = parseFloat(priceInput.value) || 0;
            card.querySelector('.farmer-contract-item-total').textContent = formatAmount(qty * price) + ' грн';
            updateContractTotal();
        };

        let debounce;
        nameInput.addEventListener('input', () => {
            clearTimeout(debounce);
            nameIdInput.value = '';
            const val = nameInput.value.trim().toLowerCase();
            if (!val) { suggestionsDiv.innerHTML = ''; suggestionsDiv.classList.add('hidden'); return; }
            debounce = setTimeout(() => {
                const type = typeSel.value;
                let matches = [];
                if (type === 'grain') {
                    matches = culturesCache.filter(c => c.name.toLowerCase().includes(val))
                        .map(c => ({ id: c.id, name: c.name, price: c.price_per_kg, source: 'grain' }));
                } else {
                    matches = purchaseStockCache.filter(p => p.name.toLowerCase().includes(val))
                        .map(p => ({ id: p.id, name: p.name, price: p.sale_price_per_kg, source: 'purchase' }));
                }
                suggestionsDiv.innerHTML = '';
                if (!matches.length) {
                    suggestionsDiv.classList.add('hidden');
                    return;
                }
                matches.slice(0, 8).forEach(m => {
                    const item = document.createElement('div');
                    item.className = 'suggestion-item';
                    item.textContent = m.name;
                    item.addEventListener('click', () => {
                        nameInput.value = m.name;
                        nameIdInput.value = String(m.id);
                        nameIdInput.dataset.source = m.source;
                        suggestionsDiv.classList.add('hidden');
                    });
                    suggestionsDiv.appendChild(item);
                });
                suggestionsDiv.classList.remove('hidden');
            }, 150);
        });

        document.addEventListener('click', (e) => {
            if (!suggestionsDiv.contains(e.target) && e.target !== nameInput) {
                suggestionsDiv.classList.add('hidden');
            }
        });

        typeSel.addEventListener('change', () => {
            nameInput.value = '';
            nameIdInput.value = '';
            suggestionsDiv.innerHTML = '';
            suggestionsDiv.classList.add('hidden');
            priceInput.value = '';
            updateRowTotal();
        });

        qtyInput.addEventListener('input', updateRowTotal);
        priceInput.addEventListener('input', updateRowTotal);
        removeBtn.addEventListener('click', () => { card.remove(); updateContractTotal(); });
    }

    function updateContractTotal() {
        const type = typeSelect.value;
        const isDebt = type === 'debt';
        const isPayment = type === 'payment';
        const isReserve = type === 'reserve';

        const sumFarmer = (isDebt || isReserve) ? 0 : [...farmerItemsBody.querySelectorAll('.fc-item')].reduce((acc, card) => {
            const qty = parseFloat(card.querySelector('.farmer-contract-item-qty')?.value || '0');
            const price = parseFloat(card.querySelector('.farmer-contract-item-price')?.value || '0');
            return acc + (qty * price);
        }, 0);
        const sumCompany = isPayment ? 0 : [...companyItemsBody.querySelectorAll('.fc-item')].reduce((acc, card) => {
            const qty = parseFloat(card.querySelector('.farmer-contract-item-qty')?.value || '0');
            const price = parseFloat(card.querySelector('.farmer-contract-item-price')?.value || '0');
            return acc + (qty * price);
        }, 0);

        farmerTotalLabel.textContent = formatAmount(sumFarmer) + ' грн';
        companyTotalLabel.textContent = formatAmount(sumCompany) + ' грн';

        if (isPayment) {
            // For payment type, show payout amount in selected currency
            const currency = fcPaymentCurrency?.value || 'UAH';
            const rate = parseFloat(fcPaymentRate?.value) || 0;
            let payoutLabel = formatAmount(sumFarmer) + ' грн';
            if (currency !== 'UAH' && rate > 0) {
                const payoutAmount = sumFarmer / rate;
                payoutLabel = formatAmount(payoutAmount) + ' ' + currency + ` (≈${formatAmount(sumFarmer)} грн)`;
            }
            payoutValueEl.textContent = payoutLabel;
        } else {
            balanceTotalLabel.textContent = formatAmount(sumCompany) + ' грн';
        }
    }

    function getContractItems(targetBody, direction) {
        const isReserve = typeSelect.value === 'reserve';
        const cards = [...targetBody.querySelectorAll('.fc-item')];
        const items = [];
        cards.forEach(card => {
            const type = card.querySelector('.farmer-contract-item-type')?.value;
            const qty = parseFloat(card.querySelector('.farmer-contract-item-qty')?.value || '0');
            const price = parseFloat(card.querySelector('.farmer-contract-item-price')?.value || '0');
            if (!type || qty <= 0 || price <= 0) return;
            const entry = { direction: direction === 'company' ? 'from_company' : 'from_farmer', item_type: type, quantity_kg: qty, price_per_kg: price };

            if (isReserve) {
                // Reserve items use text input with autocomplete
                const nameInput = card.querySelector('.farmer-contract-item-name-input');
                const nameIdInput = card.querySelector('.farmer-contract-item-name-id');
                const name = nameInput?.value?.trim();
                if (!name) return;
                entry.item_name = name;
                const idVal = nameIdInput?.value ? parseInt(nameIdInput.value, 10) : null;
                const source = nameIdInput?.dataset?.source;
                if (idVal && source === 'grain') {
                    entry.culture_id = idVal;
                    entry.item_type = 'grain';
                } else if (idVal && source === 'purchase') {
                    entry.purchase_stock_id = idVal;
                    entry.item_type = 'purchase';
                }
                // If no id — backend will create new purchase stock by name
            } else {
                const itemSelect = card.querySelector('.farmer-contract-item-select');
                if (type === 'grain' || type === 'voucher') {
                    const cultureId = itemSelect?.value ? parseInt(itemSelect.value, 10) : null;
                    if (!cultureId) return;
                    entry.culture_id = cultureId;
                } else if (type === 'purchase') {
                    const stockId = itemSelect?.value ? parseInt(itemSelect.value, 10) : null;
                    if (!stockId) return;
                    entry.purchase_stock_id = stockId;
                }
            }
            items.push(entry);
        });
        return items;
    }
}

function initFarmerContractPaymentModal() {
    const modal = document.getElementById('farmer-contract-payment-modal');
    const closeBtn = document.getElementById('farmer-contract-payment-close');
    const cancelBtn = document.getElementById('farmer-contract-payment-cancel');
    const saveBtn = document.getElementById('farmer-contract-payment-save');
    const overlay = modal?.querySelector('.modal-overlay');

    // Info card
    const contractIdEl = document.getElementById('fcp-contract-id');
    const farmerNameEl = document.getElementById('fcp-farmer-name');
    const contractTypeEl = document.getElementById('fcp-contract-type');
    const balanceEl = document.getElementById('fcp-balance');

    // Tabs
    const tabIssue = document.getElementById('fcp-tab-issue');
    const tabReceive = document.getElementById('fcp-tab-receive');
    const tabCash = document.getElementById('fcp-tab-cash');
    const tabGrain = document.getElementById('fcp-tab-grain');
    const allTabs = [tabIssue, tabReceive, tabCash, tabGrain];

    // Sections
    const sectionIssue = document.getElementById('fcp-section-issue');
    const sectionReceive = document.getElementById('fcp-section-receive');
    const sectionCash = document.getElementById('fcp-section-cash');
    const sectionGrain = document.getElementById('fcp-section-grain');
    const allSections = [sectionIssue, sectionReceive, sectionCash, sectionGrain];

    // Issue fields
    const issueItemsContainer = document.getElementById('fcp-issue-items');
    const issueSelectedEl = document.getElementById('fcp-issue-selected');
    const issueQtyInput = document.getElementById('fcp-issue-qty');
    const issueEquiv = document.getElementById('fcp-issue-equiv');

    // Receive fields
    const receiveItemsContainer = document.getElementById('fcp-receive-items');
    const receiveSelectedEl = document.getElementById('fcp-receive-selected');
    const receiveQtyInput = document.getElementById('fcp-receive-qty');
    const receiveEquiv = document.getElementById('fcp-receive-equiv');

    // Cash fields
    const cashAmountInput = document.getElementById('fcp-cash-amount');
    const cashCurrencySelect = document.getElementById('fcp-cash-currency');
    const rateRow = document.getElementById('fcp-rate-row');
    const cashRateInput = document.getElementById('fcp-cash-rate');
    const cashEquiv = document.getElementById('fcp-cash-equiv');

    // Grain fields
    const grainCardsContainer = document.getElementById('fcp-grain-cards');
    const grainCultureSelect = document.getElementById('fcp-grain-culture');
    const grainQtyInput = document.getElementById('fcp-grain-qty');
    const grainEquiv = document.getElementById('fcp-grain-equiv');

    // Voucher confirm (inside issue section)
    const voucherConfirmEl = document.getElementById('fcp-voucher-confirm');

    if (!modal || !saveBtn) return;

    let currentPaymentType = 'goods_issue';
    let farmerBalanceData = [];
    let contractDetail = null;
    let selectedIssueItemId = null;
    let selectedReceiveItemId = null;

    const tabMap = {
        'goods_issue': { tab: tabIssue, section: sectionIssue },
        'goods_receive': { tab: tabReceive, section: sectionReceive },
        'cash': { tab: tabCash, section: sectionCash },
        'grain': { tab: tabGrain, section: sectionGrain }
    };

    const switchTab = (type) => {
        currentPaymentType = type;
        allTabs.forEach(t => t?.classList.remove('active'));
        allSections.forEach(s => s?.classList.add('hidden'));
        const entry = tabMap[type];
        if (entry) {
            entry.tab?.classList.add('active');
            entry.section?.classList.remove('hidden');
        }
    };

    const resetForm = () => {
        selectedIssueItemId = null;
        selectedReceiveItemId = null;
        issueSelectedEl.textContent = '—';
        issueQtyInput.value = '';
        issueEquiv.textContent = '';
        receiveSelectedEl.textContent = '—';
        receiveQtyInput.value = '';
        receiveEquiv.textContent = '';
        cashAmountInput.value = '';
        cashCurrencySelect.value = 'UAH';
        initCustomSelects(cashCurrencySelect);
        cashRateInput.value = '';
        rateRow.classList.add('hidden');
        cashEquiv.textContent = '';
        grainQtyInput.value = '';
        grainEquiv.textContent = '';
        grainCardsContainer.innerHTML = '<div class="fcp-grain-empty">Завантаження...</div>';
        grainCultureSelect.innerHTML = '<option value="">Оберіть</option>';
        initCustomSelects(grainCultureSelect);
        refreshCustomSelect(grainCultureSelect);
        issueItemsContainer.innerHTML = '<div class="fcp-grain-empty">Завантаження...</div>';
        receiveItemsContainer.innerHTML = '<div class="fcp-grain-empty">Завантаження...</div>';
        if (voucherConfirmEl) { voucherConfirmEl.classList.add('hidden'); voucherConfirmEl.innerHTML = ''; }
    };

    // ── Render contract item cards (all types including vouchers) ──
    const renderContractItems = (items, container, direction) => {
        const filtered = items.filter(i => i.direction === direction);
        if (!filtered.length) {
            container.innerHTML = '<div class="fcp-grain-empty">Немає позицій</div>';
            return;
        }
        container.innerHTML = '';
        const typeLabels = { grain: 'Зерно', purchase: 'Товар', cash: 'Гроші', voucher: 'Талон' };
        filtered.forEach(item => {
            const isVoucher = item.item_type === 'voucher';
            const remaining = Math.max(0, item.quantity_kg - (item.delivered_kg || 0));
            const pct = item.quantity_kg > 0 ? ((item.delivered_kg || 0) / item.quantity_kg * 100) : 0;
            const done = remaining < 0.01;
            const unit = item.item_type === 'cash' ? 'грн' : 'кг';

            if (isVoucher) {
                // ── Voucher card: special layout with direct "Видати талон" button ──
                const totalVal = remaining * item.price_per_kg;
                const card = document.createElement('div');
                card.className = 'fcp-voucher-card' + (done ? ' fcp-voucher-card--done' : '');
                card.innerHTML = `
                    <div class="fcp-voucher-card__info">
                        <div class="fcp-voucher-card__name">${item.item_name || 'Талон: Пшениця'}</div>
                        <div class="fcp-voucher-card__details">
                            <span>${formatWeight(item.quantity_kg)} кг</span>
                            <span>×</span>
                            <span>${formatAmount(item.price_per_kg)} грн/кг</span>
                            <span>=</span>
                            <span class="fcp-voucher-card__total">${formatAmount(item.quantity_kg * item.price_per_kg)} грн</span>
                        </div>
                    </div>
                    ${done
                        ? '<span class="fcp-voucher-card__status-done">✓ Виписано</span>'
                        : `<button class="btn btn-primary btn-small fcp-voucher-card__btn" data-item-id="${item.id}" data-culture-id="${item.culture_id}" data-qty="${remaining}">Видати талон</button>`
                    }
                `;
                container.appendChild(card);
            } else {
                // ── Regular item card: clickable to select ──
                const card = document.createElement('div');
                card.className = 'fcp-ci-card' + (done ? ' fcp-ci-card--done' : '');
                card.dataset.itemId = item.id;
                card.innerHTML = `
                    <div class="fcp-ci-info">
                        <span class="fcp-ci-name">${item.item_name || '—'}</span>
                        <span class="fcp-ci-meta">${typeLabels[item.item_type] || item.item_type} • ${formatWeight(item.quantity_kg)} ${unit} × ${formatAmount(item.price_per_kg)} грн</span>
                    </div>
                    <div class="fcp-ci-progress">
                        <span class="fcp-ci-remaining">${done ? '✓ Видано' : `${formatWeight(remaining)} ${unit}`}</span>
                        <div class="fcp-ci-bar"><div class="fcp-ci-bar__fill" style="width:${Math.min(100, pct)}%"></div></div>
                    </div>
                `;
                if (!done) {
                    card.addEventListener('click', () => {
                        container.querySelectorAll('.fcp-ci-card').forEach(c => c.classList.remove('selected'));
                        card.classList.add('selected');
                        if (direction === 'from_company') {
                            selectedIssueItemId = item.id;
                            issueSelectedEl.textContent = `${item.item_name} (залишок: ${formatWeight(remaining)} ${unit})`;
                            issueQtyInput.max = remaining;
                            issueQtyInput.focus();
                        } else {
                            selectedReceiveItemId = item.id;
                            receiveSelectedEl.textContent = `${item.item_name} (залишок: ${formatWeight(remaining)} ${unit})`;
                            receiveQtyInput.max = remaining;
                            receiveQtyInput.focus();
                        }
                    });
                }
                container.appendChild(card);
            }
        });

        // ── Bind "Видати талон" buttons for voucher items ──
        container.querySelectorAll('.fcp-voucher-card__btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const itemId = parseInt(btn.dataset.itemId);
                const cultureId = parseInt(btn.dataset.cultureId);
                const qty = parseFloat(btn.dataset.qty);
                const pricePerKg = (contractDetail?.items?.find(i => i.id === itemId))?.price_per_kg || 0;

                if (voucherConfirmEl) {
                    voucherConfirmEl.innerHTML = `
                        <div class="fcp-voucher-confirm__text">
                            Видати талон на <strong>${formatWeight(qty)} кг</strong> Пшениці (≈ ${formatAmount(qty * pricePerKg)} грн)?
                        </div>
                        <div class="fcp-voucher-confirm__actions">
                            <button class="btn btn-secondary btn-small fcp-voucher-confirm__no">Скасувати</button>
                            <button class="btn btn-primary btn-small fcp-voucher-confirm__yes">Так, видати</button>
                        </div>
                    `;
                    voucherConfirmEl.classList.remove('hidden');

                    voucherConfirmEl.querySelector('.fcp-voucher-confirm__no')?.addEventListener('click', () => {
                        voucherConfirmEl.classList.add('hidden');
                    });

                    voucherConfirmEl.querySelector('.fcp-voucher-confirm__yes')?.addEventListener('click', async () => {
                        voucherConfirmEl.classList.add('hidden');
                        btn.disabled = true;
                        btn.textContent = 'Видача...';
                        try {
                            const response = await apiFetch(`/farmer-contracts/${currentFarmerContractId}/payments`, {
                                method: 'POST',
                                body: JSON.stringify({
                                    payment_type: 'voucher',
                                    contract_item_id: itemId,
                                    culture_id: cultureId,
                                    quantity_kg: qty
                                })
                            });
                            if (!response.ok) {
                                const error = await response.json().catch(() => null);
                                showToast(error?.detail || 'Помилка видачі талону', 'error');
                                return;
                            }
                            showToast('Талон виписано!', 'success');
                            // Reload contract data to refresh the cards
                            const cResp = await apiFetch(`/farmer-contracts/${currentFarmerContractId}`);
                            if (cResp.ok) {
                                contractDetail = await cResp.json();
                            }
                            loadContractData({ id: currentFarmerContractId, owner_id: contractDetail?.owner_id });
                            await loadFarmerContracts();
                            await loadFarmerContractPayments();
                            await loadStock();
                        } catch (err) {
                            showToast(err.message || 'Помилка', 'error');
                        } finally {
                            btn.disabled = false;
                            btn.textContent = 'Видати талон';
                        }
                    });
                }
            });
        });
    };

    // ── Load contract detail + farmer balance ──
    const loadContractData = async (contract) => {
        // Load contract items
        try {
            const resp = await apiFetch(`/farmer-contracts/${contract.id}`);
            if (resp.ok) {
                contractDetail = await resp.json();
                renderContractItems(contractDetail.items || [], issueItemsContainer, 'from_company');
                renderContractItems(contractDetail.items || [], receiveItemsContainer, 'from_farmer');
            }
        } catch {}
        // Load farmer balance
        try {
            const resp = await apiFetch(`/grain/owners/${contract.owner_id}/balance`);
            if (resp.ok) { farmerBalanceData = await resp.json(); }
            else { farmerBalanceData = []; }
        } catch { farmerBalanceData = []; }

        // Render grain cards
        if (!farmerBalanceData.length) {
            grainCardsContainer.innerHTML = '<div class="fcp-grain-empty">Немає зерна на балансі</div>';
        } else {
            grainCardsContainer.innerHTML = '';
            farmerBalanceData.forEach(item => {
                const card = document.createElement('div');
                card.className = 'fcp-grain-card';
                card.dataset.cultureId = item.culture_id;
                card.innerHTML = `
                    <span class="fcp-grain-card__name">${item.culture_name}</span>
                    <span class="fcp-grain-card__qty">${formatWeight(item.quantity_kg)} кг</span>
                `;
                card.addEventListener('click', () => {
                    grainCardsContainer.querySelectorAll('.fcp-grain-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    grainCultureSelect.value = item.culture_id;
                    refreshCustomSelect(grainCultureSelect);
                    grainQtyInput.focus();
                    updateGrainEquiv();
                });
                grainCardsContainer.appendChild(card);
            });
            grainCultureSelect.innerHTML = '<option value="">Оберіть</option>' +
                farmerBalanceData.map(b => {
                    const c = culturesCache.find(cc => cc.id === b.culture_id);
                    const price = c ? c.price_per_kg : 0;
                    return `<option value="${b.culture_id}" data-price="${price}" data-max="${b.quantity_kg}">${b.culture_name} (до ${formatWeight(b.quantity_kg)} кг)</option>`;
                }).join('');
            refreshCustomSelect(grainCultureSelect);
        }

        // Voucher items are now rendered as part of renderContractItems in the Issue tab
    };

    // ── Open modal ──
    const openModal = (contract) => {
        currentFarmerContractId = contract.id;
        const ownerName = ownersCache.find(o => o.id === contract.owner_id)?.full_name || `#${contract.owner_id}`;
        const typeLabels = { 'debt': 'Контракт', 'payment': 'Виплата', 'reserve': 'Резерв' };

        contractIdEl.textContent = `#${contract.id}`;
        farmerNameEl.textContent = ownerName;
        contractTypeEl.textContent = typeLabels[contract.contract_type] || contract.contract_type;
        if (contract.was_reserve) contractTypeEl.textContent += ' (з резерву)';
        balanceEl.textContent = formatAmount(contract.balance_uah) + ' грн';

        // Show/hide tabs based on contract type (debt: issue, cash, grain)
        tabIssue.classList.remove('fcp-tab--hidden');
        tabReceive.classList.add('fcp-tab--hidden');
        tabCash.classList.remove('fcp-tab--hidden');
        tabGrain.classList.remove('fcp-tab--hidden');

        resetForm();
        switchTab('goods_issue');
        modal.classList.remove('hidden');
        loadContractData(contract);
    };
    openFarmerContractPaymentModal = openModal;

    const closeModal = () => modal.classList.add('hidden');

    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);

    // Tab clicks
    allTabs.forEach(tab => {
        tab?.addEventListener('click', () => {
            if (tab.classList.contains('fcp-tab--hidden')) return;
            switchTab(tab.dataset.type);
        });
    });

    // ── Issue equiv ──
    issueQtyInput.addEventListener('input', () => {
        if (!selectedIssueItemId || !contractDetail) { issueEquiv.textContent = ''; return; }
        const item = (contractDetail.items || []).find(i => i.id === selectedIssueItemId);
        const qty = parseFloat(issueQtyInput.value) || 0;
        if (item && qty) {
            const remaining = item.quantity_kg - (item.delivered_kg || 0);
            let text = `= ${formatAmount(qty * item.price_per_kg)} грн`;
            if (qty > remaining) text += ` (макс: ${formatWeight(remaining)})`;
            issueEquiv.textContent = text;
        } else { issueEquiv.textContent = ''; }
    });

    // ── Receive equiv ──
    receiveQtyInput.addEventListener('input', () => {
        if (!selectedReceiveItemId || !contractDetail) { receiveEquiv.textContent = ''; return; }
        const item = (contractDetail.items || []).find(i => i.id === selectedReceiveItemId);
        const qty = parseFloat(receiveQtyInput.value) || 0;
        if (item && qty) {
            const remaining = item.quantity_kg - (item.delivered_kg || 0);
            let text = `= ${formatAmount(qty * item.price_per_kg)} грн`;
            if (qty > remaining) text += ` (макс: ${formatWeight(remaining)})`;
            receiveEquiv.textContent = text;
        } else { receiveEquiv.textContent = ''; }
    });

    // ── Cash equiv ──
    const onCurrencyChange = () => {
        const isForeign = cashCurrencySelect.value !== 'UAH';
        rateRow.classList.toggle('hidden', !isForeign);
        if (!isForeign) cashRateInput.value = '';
        updateCashEquiv();
    };
    cashCurrencySelect.addEventListener('change', onCurrencyChange);
    cashAmountInput.addEventListener('input', updateCashEquiv);
    cashRateInput.addEventListener('input', updateCashEquiv);

    function updateCashEquiv() {
        const amount = parseFloat(cashAmountInput.value) || 0;
        const currency = cashCurrencySelect.value;
        const rate = parseFloat(cashRateInput.value) || 0;
        if (!amount) { cashEquiv.textContent = ''; return; }
        if (currency === 'UAH') {
            cashEquiv.textContent = `= ${formatAmount(amount)} грн`;
        } else if (rate) {
            cashEquiv.textContent = `= ${formatAmount(amount * rate)} грн`;
        } else { cashEquiv.textContent = ''; }
    }

    // ── Grain equiv ──
    grainCultureSelect.addEventListener('change', () => {
        const val = grainCultureSelect.value;
        grainCardsContainer.querySelectorAll('.fcp-grain-card').forEach(c => {
            c.classList.toggle('selected', c.dataset.cultureId === val);
        });
        updateGrainEquiv();
    });
    grainQtyInput.addEventListener('input', updateGrainEquiv);

    function updateGrainEquiv() {
        const qty = parseFloat(grainQtyInput.value) || 0;
        const sel = grainCultureSelect.options[grainCultureSelect.selectedIndex];
        const price = parseFloat(sel?.dataset?.price || '0');
        const maxQty = parseFloat(sel?.dataset?.max || '0');
        if (qty && price) {
            let text = `= ${formatAmount(qty * price)} грн`;
            if (maxQty && qty > maxQty) text += ` (макс: ${formatWeight(maxQty)} кг)`;
            grainEquiv.textContent = text;
        } else { grainEquiv.textContent = ''; }
    }

    // ── Save ──
    saveBtn.addEventListener('click', async () => {
        if (!currentFarmerContractId) return;
        const type = currentPaymentType;
        let payload = { payment_type: type };

        if (type === 'goods_issue') {
            if (!selectedIssueItemId) { showToast('Оберіть позицію для видачі', 'warning'); return; }
            const qty = parseFloat(issueQtyInput.value) || 0;
            if (!qty) { showToast('Вкажіть кількість', 'warning'); return; }
            payload.contract_item_id = selectedIssueItemId;
            payload.quantity_kg = qty;
        } else if (type === 'goods_receive') {
            if (!selectedReceiveItemId) { showToast('Оберіть позицію для прийому', 'warning'); return; }
            const qty = parseFloat(receiveQtyInput.value) || 0;
            if (!qty) { showToast('Вкажіть кількість', 'warning'); return; }
            payload.contract_item_id = selectedReceiveItemId;
            payload.quantity_kg = qty;
        } else if (type === 'cash') {
            const amount = parseFloat(cashAmountInput.value) || 0;
            if (!amount) { showToast('Вкажіть суму', 'warning'); return; }
            payload.amount = amount;
            payload.currency = cashCurrencySelect.value;
            if (payload.currency !== 'UAH') {
                const rate = parseFloat(cashRateInput.value) || 0;
                if (!rate) { showToast('Вкажіть курс', 'warning'); return; }
                payload.exchange_rate = rate;
            }
        } else if (type === 'grain') {
            const cultureId = grainCultureSelect.value ? parseInt(grainCultureSelect.value, 10) : null;
            const qty = parseFloat(grainQtyInput.value) || 0;
            if (!cultureId || !qty) { showToast('Вкажіть культуру та кількість', 'warning'); return; }
            payload.culture_id = cultureId;
            payload.quantity_kg = qty;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Збереження...';
        try {
            const response = await apiFetch(`/farmer-contracts/${currentFarmerContractId}/payments`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const error = await response.json().catch(() => null);
                showToast(error?.detail || 'Не вдалося зберегти', 'error');
                return;
            }
            showToast('Операцію збережено', 'success');
            closeModal();
            await loadFarmerContracts();
            await loadFarmerContractPayments();
            await loadStock();
            await loadCashBalance();
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Зберегти';
        }
    });
}

async function loadAllIntakes() {
    const response = await apiFetch('/grain/intakes');
    if (!response.ok) {
        console.error('Помилка завантаження карток');
        return;
    }
    intakesCache = await response.json();
    renderIntakeTable(applyIntakeFilters(intakesCache));
    renderDriverDeliveriesTable(applyDriverDeliveryFilters(intakesCache));
    renderFarmerIntakesTable(applyFarmerIntakeFilters(intakesCache));

    updateIntakeMetrics(intakesCache);
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
            renderDriverDeliveriesTable(applyDriverDeliveryFilters(intakesCache));
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

function applyDriverDeliveryFilters(intakes) {
    const driverSelect = document.getElementById('driver-delivery-filter-driver');
    const cultureSelect = document.getElementById('driver-delivery-filter-culture');
    const vehicleSelect = document.getElementById('driver-delivery-filter-vehicle');
    const periodSelect = document.getElementById('driver-delivery-filter-period');
    if (!driverSelect || !cultureSelect || !vehicleSelect || !periodSelect) {
        return intakes;
    }

    const driverId = driverSelect.value ? parseInt(driverSelect.value, 10) : null;
    const cultureId = cultureSelect.value ? parseInt(cultureSelect.value, 10) : null;
    const vehicleId = vehicleSelect.value ? parseInt(vehicleSelect.value, 10) : null;
    const period = periodSelect.value;
    const range = getPeriodRange(period);

    return intakes.filter(intake => {
        if (!intake.is_internal_driver) {
            return false;
        }
        if (driverId && intake.driver_id !== driverId) {
            return false;
        }
        if (cultureId && intake.culture_id !== cultureId) {
            return false;
        }
        if (vehicleId && intake.vehicle_type_id !== vehicleId) {
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

function renderDriverDeliveriesTable(intakes) {
    const tableBody = document.querySelector('#driver-deliveries-table tbody');
    const hint = document.getElementById('driver-deliveries-hint');
    if (!tableBody || !hint) {
        return;
    }
    const rows = [...intakes]
        .filter(intake => intake.is_internal_driver)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    tableBody.innerHTML = '';
    if (!rows.length) {
        hint.textContent = '';
        tableBody.innerHTML = '<tr><td colspan="9" class="table-empty-message">Поки що доставок немає</td></tr>';
        return;
    }
    hint.textContent = '';
    rows.forEach(intake => {
        const row = document.createElement('tr');
        const driver = driversCache.find(item => item.id === intake.driver_id);
        row.innerHTML = `
            <td>${formatDate(intake.created_at)}</td>
            <td><strong>${getDriverName(intake.driver_id)}</strong></td>
            <td>${driver?.phone || '<span class="td-secondary">—</span>'}</td>
            <td>${getVehicleName(intake.vehicle_type_id)}</td>
            <td>${intake.has_trailer ? '<span class="status-badge success">Так</span>' : '<span class="td-secondary">Ні</span>'}</td>
            <td><span class="inline-badge grain">${getCultureName(intake.culture_id)}</span></td>
            <td class="td-weight">${formatWeight(intake.gross_weight_kg)} кг</td>
            <td class="td-weight">${formatWeight(intake.net_weight_kg)} кг</td>
            <td class="td-weight">${intake.pending_quality ? '<span class="status-badge warning">Очікує</span>' : formatWeight(intake.accepted_weight_kg) + ' кг'}</td>
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
        const ownerName = intake.owner_full_name || '—';
        const ownerPhone = intake.owner_phone || '<span class="td-secondary">—</span>';
        row.innerHTML = `
            <td>${formatDate(intake.created_at)}</td>
            <td><strong>${ownerName}</strong></td>
            <td>${ownerPhone}</td>
            <td><span class="inline-badge grain">${getCultureName(intake.culture_id)}</span></td>
            <td class="td-weight">${formatWeight(intake.gross_weight_kg)} кг</td>
            <td class="td-weight">${formatWeight(intake.net_weight_kg)} кг</td>
            <td class="td-weight">${intake.pending_quality ? '<span class="status-badge warning">Очікує</span>' : formatWeight(intake.accepted_weight_kg) + ' кг'}</td>
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
    if (!intakes.length) {
        tableBody.innerHTML = '<tr><td colspan="7" class="table-empty-message">Поки що приходів немає</td></tr>';
        return;
    }
    intakes.forEach(intake => {
        const row = document.createElement('tr');
        if (intake.pending_quality) {
            row.classList.add('row-pending');
        }
        const cultureName = getCultureName(intake.culture_id);
        const ownerName = intake.is_own_grain ? 'Підприємство' : (intake.owner_full_name || '—');
        const statusLabel = intake.pending_quality ? 'Очікує %' : 'Підтверджено';
        row.innerHTML = `
            <td>${formatDate(intake.created_at)}</td>
            <td><span class="inline-badge grain">${cultureName}</span></td>
            <td class="td-weight">${formatWeight(intake.net_weight_kg)} кг</td>
            <td class="td-weight">${intake.pending_quality ? '<span class="td-secondary">—</span>' : formatWeight(intake.accepted_weight_kg) + ' кг'}</td>
            <td><strong>${ownerName}</strong></td>
            <td><span class="status-badge ${intake.pending_quality ? 'warning' : 'success'}">${statusLabel}</span></td>
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

function initFarmerBalanceModal() {
    const modal = document.getElementById('farmer-balance-modal');
    const closeBtn = document.getElementById('farmer-balance-close');
    const cancelBtn = document.getElementById('farmer-balance-cancel');
    const downloadBtn = document.getElementById('farmer-balance-download');
    const overlay = modal?.querySelector('.modal-overlay');
    const ownerSelect = document.getElementById('farmer-balance-owner');
    const tableBody = document.querySelector('#farmer-balance-table tbody');
    const hint = document.getElementById('farmer-balance-hint');
    if (!modal || !ownerSelect || !tableBody || !hint || !downloadBtn) return;

    const resetTable = (message) => {
        tableBody.innerHTML = '';
        hint.textContent = message;
    };

    const loadBalanceForOwner = async (ownerId) => {
        const response = await apiFetch(`/grain/owners/${ownerId}/balance`);
        if (!response.ok) {
            const error = await response.json().catch(() => null);
            showToast(error?.detail || 'Не вдалося отримати баланс', 'error');
            return;
        }
        const items = await response.json();
        tableBody.innerHTML = '';
        if (!items.length) {
            resetTable('Для цього фермера немає невикупленого зерна.');
            return;
        }
        hint.textContent = '';
        items.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.culture_name}</td>
                <td>${formatWeight(item.quantity_kg)}</td>
            `;
            tableBody.appendChild(row);
        });
    };

    const openModal = (ownerId = null) => {
        ownerSelect.innerHTML = '<option value=\"\">Оберіть фермера</option>' +
            ownersCache.map(o => `<option value=\"${o.id}\">${o.full_name}</option>`).join('');
        ownerSelect.value = ownerId ? String(ownerId) : '';
        refreshCustomSelect(ownerSelect);
        resetTable('Оберіть фермера для перегляду балансу.');
        if (ownerId) {
            loadBalanceForOwner(ownerId);
        }
        modal.classList.remove('hidden');
    };
    const closeModal = () => modal.classList.add('hidden');

    const openBtn = document.getElementById('farmer-balance-btn');
    openBtn?.addEventListener('click', () => openModal());
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);

    ownerSelect.addEventListener('change', async () => {
        const ownerId = ownerSelect.value;
        if (!ownerId) {
            resetTable('Оберіть фермера для перегляду балансу.');
            return;
        }
        await loadBalanceForOwner(ownerId);
    });

    downloadBtn.addEventListener('click', async () => {
        const ownerId = ownerSelect.value;
        if (!ownerId) {
            showToast('Оберіть фермера для експорту', 'warning');
            return;
        }
        const response = await apiFetchBlob(`/grain/owners/${ownerId}/balance/export`);
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

function initIntakeFilters() {
    const cultureSelect = document.getElementById('intake-filter-culture');
    const statusSelect = document.getElementById('intake-filter-status');
    const periodSelect = document.getElementById('intake-filter-period');
    const queryInput = document.getElementById('intake-filter-query');
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
    if (!cultureSelect || !statusSelect || !periodSelect || !queryInput) {
        return intakes;
    }

    const cultureId = cultureSelect.value ? parseInt(cultureSelect.value, 10) : null;
    const status = statusSelect.value;
    const period = periodSelect.value;
    const query = queryInput.value.trim().toLowerCase();

    let filtered = intakes.slice();

    if (cultureId) {
        filtered = filtered.filter(item => item.culture_id === cultureId);
    }

    if (status === 'pending') {
        filtered = filtered.filter(item => item.pending_quality);
    } else if (status === 'confirmed') {
        filtered = filtered.filter(item => !item.pending_quality);
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
        params.append('internal_only', 'true');

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
    const pendingCount = intakes.filter(item => item.pending_quality).length;
    const now = new Date();
    const todayKey = now.toDateString();
    const todayCount = intakes.filter(item => new Date(item.created_at).toDateString() === todayKey).length;
    const todayKg = intakes
        .filter(item => new Date(item.created_at).toDateString() === todayKey)
        .reduce((sum, item) => sum + (item.pending_quality ? 0 : item.accepted_weight_kg || 0), 0);

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
            const reserveBtn = document.createElement('button');
            reserveBtn.className = 'btn-icon btn-icon-warning';
            reserveBtn.innerHTML = ICONS.reserve;
            reserveBtn.title = 'Бронювання';
            reserveBtn.addEventListener('click', () => {
                openStockReserveModal({
                    id: item.culture_id,
                    label: item.culture_name
                });
            });

            actionsCell.appendChild(button);
            actionsCell.appendChild(priceBtn);
            actionsCell.appendChild(reserveBtn);
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
        const noteLabel = item.source === 'shipment'
            ? `Відправка: ${item.destination || '—'}`
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
        showToast('Вкажіть коректну ціну', 'error');
        return;
    }
    const response = await apiFetch(`/purchases/stock/${stockId}/price`, {
        method: 'PATCH',
        body: JSON.stringify({ sale_price_per_kg: price })
    });
    if (response.ok) {
        await loadPurchaseStock();
    } else {
        showToast('Не вдалося оновити ціну', 'error');
    }
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

    initCustomSelects(typeSelect);

    const closeModal = () => modal.classList.add('hidden');
    overlay.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    applyBtn.addEventListener('click', async () => {
        if (!stockAdjustContext) {
            return;
        }
        const amount = parseFloat(amountInput.value);
        if (Number.isNaN(amount) || amount <= 0) {
            showToast('Вкажіть коректну кількість', 'error');
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
            stockAdjustContext.type === 'grain' ? await loadStock() : await loadPurchaseStock();
            await loadStockAdjustments();
        } else {
            const data = await response.json().catch(() => ({}));
            showToast(data.detail || 'Не вдалося оновити склад', 'error');
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

    initCustomSelects(actionSelect);

    const closeModal = () => modal.classList.add('hidden');
    overlay.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    saveBtn.addEventListener('click', async () => {
        if (!stockReserveContext) return;
        const amount = parseFloat(amountInput.value);
        if (Number.isNaN(amount) || amount <= 0) {
            showToast('Вкажіть коректну кількість', 'error');
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
            showToast(error?.detail || 'Не вдалося змінити бронювання', 'error');
            return;
        }
        await loadStock();
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

    const closeModal = () => modal.classList.add('hidden');
    overlay.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    applyBtn.addEventListener('click', async () => {
        if (!stockPriceContext) {
            return;
        }
        await updatePurchaseStockPrice(stockPriceContext.id, priceInput.value);
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

    const closeModal = () => modal.classList.add('hidden');
    overlay.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    applyBtn.addEventListener('click', async () => {
        if (!culturePriceContext) {
            return;
        }
        await updateCulturePrice(culturePriceContext.id, priceInput.value);
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
    culturePriceContext = { id };
    title.textContent = label;
    priceInput.value = Number(price).toFixed(2);
    modal.classList.remove('hidden');
}
async function loadPurchases() {
    const response = await apiFetch('/purchases');
    if (!response.ok) {
        console.error('Помилка завантаження закупівель');
        return;
    }
    purchasesCache = await response.json();
    const tableBody = document.querySelector('#purchases-table tbody');
    if (!tableBody) {
        return;
    }
    tableBody.innerHTML = '';
    purchasesCache.forEach(item => {
        const categoryLabel = item.category === 'fertilizer' ? 'Добрива' : 'Посівне зерно';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(item.created_at)}</td>
            <td>${item.item_name}</td>
            <td>${categoryLabel}</td>
            <td>${item.price_per_kg.toFixed(2)}</td>
            <td>${item.currency}</td>
            <td>${formatWeight(item.quantity_kg)}</td>
            <td>${formatCurrency(item.total_amount, item.currency)}</td>
        `;
        tableBody.appendChild(row);
    });
}

async function loadShipments() {
    const response = await apiFetch('/grain/shipments');
    if (!response.ok) {
        console.error('Помилка завантаження відправок');
        return;
    }
    shipmentsCache = await response.json();
    renderShipmentsTable(shipmentsCache);
}

function openIntakeEdit(intakeId) {
    const intake = intakesCache.find(item => item.id === intakeId);
    const modal = document.getElementById('intake-edit-modal');
    if (!intake || !modal) {
        return;
    }
    editingIntakeId = intakeId;
    document.getElementById('edit-culture').value = intake.culture_id;
    document.getElementById('edit-vehicle').value = intake.vehicle_type_id;
    document.getElementById('edit-trailer').checked = intake.has_trailer;
    document.getElementById('edit-own-grain').checked = intake.is_own_grain;
    document.getElementById('edit-owner-name').value = intake.owner_full_name || '';
    document.getElementById('edit-owner-phone').value = intake.owner_phone || '';
    document.getElementById('edit-internal-driver').checked = intake.is_internal_driver;
    document.getElementById('edit-driver').value = intake.driver_id || '';
    document.getElementById('edit-gross').value = intake.gross_weight_kg;
    document.getElementById('edit-tare').value = intake.tare_weight_kg;
    document.getElementById('edit-impurity').value = intake.impurity_percent || 0;
    document.getElementById('edit-pending').checked = intake.pending_quality;
    document.getElementById('edit-note').value = intake.note || '';

    syncEditDriverBlocks();
    syncEditOwnerFields();
    initCustomSelects(document.getElementById('edit-culture'));
    initCustomSelects(document.getElementById('edit-vehicle'));
    initCustomSelects(document.getElementById('edit-driver'));

    modal.classList.remove('hidden');
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
        'farmer-contracts': 'Контракти фермерів',
        'vouchers': 'Хлібний завод',
        'shipments': 'Відправки',
        'users': 'Користувачі',
        'landlords': 'Орендодавці'
    };

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            const page = item.dataset.page;
            document.getElementById('page-title').textContent = titles[page] || 'Дашборд';

            sections.forEach(section => section.classList.add('hidden'));
            const target = document.getElementById(`section-${page}`);
            if (target) {
                target.classList.remove('hidden');
            }
            if (page === 'shipments') {
                loadShipments();
            }
            if (page === 'stock') {
                loadStockAdjustments();
            }
            if (page === 'owners') {
                loadOwnersList('');
                renderFarmerIntakesTable(applyFarmerIntakeFilters(intakesCache));
            }
            if (page === 'dashboard') {
                loadDashboardStats();
            }
            if (page === 'vouchers') {
                loadVouchersData();
            }
        });
    });

}

function initLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn.addEventListener('click', async () => {
        try {
            await apiFetch('/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Помилка виходу:', error);
        } finally {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
        }
    });
}

function initIntakeForm() {
    const form = document.getElementById('intake-form');
    const ownGrainCheckbox = document.getElementById('intake-own-grain');
    const ownerSearch = document.getElementById('owner-search');
    const ownerPhone = document.getElementById('owner-phone');
    const ownerId = document.getElementById('owner-id');
    const internalDriverCheckbox = document.getElementById('intake-internal-driver');
    const internalBlock = document.getElementById('internal-driver-block');
    const externalBlock = document.getElementById('external-driver-block');

    ownGrainCheckbox.addEventListener('change', () => {
        const isOwn = ownGrainCheckbox.checked;
        ownerSearch.value = '';
        ownerPhone.value = '';
        ownerId.value = '';
        ownerSearch.disabled = isOwn;
        ownerPhone.disabled = isOwn;
        document.querySelectorAll('.owner-field').forEach(field => {
            field.classList.toggle('hidden', isOwn);
        });
        const ownNote = document.getElementById('own-grain-note');
        if (ownNote) {
            ownNote.classList.toggle('hidden', !isOwn);
        }
        // Обновляем бейдж при очистке
        if (typeof updateOwnerBadge === 'function') {
            updateOwnerBadge();
        }
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
            form.reset();
            document.getElementById('accepted-weight').value = '';
            document.getElementById('net-weight').value = '';
            document.getElementById('owner-id').value = '';
            document.getElementById('owner-suggestions').classList.add('hidden');
            // Обновляем бейдж при очистке формы
            const ownerBadge = document.getElementById('owner-badge');
            const ownerSearch = document.getElementById('owner-search');
            if (ownerBadge) {
                ownerBadge.classList.add('hidden');
            }
            if (ownerSearch) {
                ownerSearch.classList.remove('owner-selected');
            }
            await loadAllIntakes();
            await loadStock();
            await loadOwnersList('');
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
        modal.classList.remove('hidden');
        initCustomSelects();
    });

    closeBtn.addEventListener('click', closeIntakeCreateModal);
}

function closeIntakeCreateModal() {
    const modal = document.getElementById('intake-create-modal');
    if (!modal) {
        return;
    }
    modal.classList.add('hidden');
    // Сбрасываем бейдж при закрытии модального окна
    const ownerBadge = document.getElementById('owner-badge');
    const ownerSearch = document.getElementById('owner-search');
    const ownerId = document.getElementById('owner-id');
    if (ownerBadge) {
        ownerBadge.classList.add('hidden');
    }
    if (ownerSearch) {
        ownerSearch.classList.remove('owner-selected');
    }
    if (ownerId) {
        ownerId.value = '';
    }
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

    const closeModal = () => {
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
            await loadAllIntakes();
            await loadStock();
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
    const ownerName = intake.is_own_grain ? 'Підприємство' : (intake.owner_full_name || '-');
    const ownerPhone = intake.is_own_grain ? '-' : (intake.owner_phone || '-');
    const driverTypeLabel = intake.is_internal_driver ? 'Наш водій' : 'Інший водій';
    const driverName = intake.is_internal_driver
        ? getDriverName(intake.driver_id)
        : 'Інший водій';

    document.getElementById('view-date').textContent = formatDate(intake.created_at);
    document.getElementById('view-culture').textContent = getCultureName(intake.culture_id);
    document.getElementById('view-vehicle').textContent = getVehicleName(intake.vehicle_type_id);
    document.getElementById('view-trailer').textContent = intake.has_trailer ? 'Так' : 'Ні';
    document.getElementById('view-own-grain').textContent = intake.is_own_grain ? 'Так' : 'Ні';
    document.getElementById('view-owner').textContent = ownerName;
    document.getElementById('view-owner-phone').textContent = ownerPhone;
    document.getElementById('view-driver-type').textContent = driverTypeLabel;
    document.getElementById('view-driver').textContent = driverName;
    document.getElementById('view-gross').textContent = formatWeight(intake.gross_weight_kg);
    document.getElementById('view-tare').textContent = formatWeight(intake.tare_weight_kg);
    document.getElementById('view-net').textContent = formatWeight(intake.net_weight_kg);
    document.getElementById('view-impurity').textContent = `${formatWeight(intake.impurity_percent || 0)}%`;
    document.getElementById('view-pending').textContent = intake.pending_quality ? 'Так' : 'Ні';
    document.getElementById('view-accepted').textContent = intake.pending_quality
        ? '-'
        : formatWeight(intake.accepted_weight_kg || 0);
    document.getElementById('view-note').textContent = intake.note ? intake.note : '-';

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
}

function buildEditPayload() {
    const payload = {
        culture_id: parseInt(document.getElementById('edit-culture').value, 10),
        vehicle_type_id: parseInt(document.getElementById('edit-vehicle').value, 10),
        has_trailer: document.getElementById('edit-trailer').checked,
        is_own_grain: document.getElementById('edit-own-grain').checked,
        is_internal_driver: document.getElementById('edit-internal-driver').checked,
        gross_weight_kg: parseFloat(document.getElementById('edit-gross').value),
        tare_weight_kg: parseFloat(document.getElementById('edit-tare').value),
        impurity_percent: parseFloat(document.getElementById('edit-impurity').value || '0'),
        pending_quality: document.getElementById('edit-pending').checked,
        note: document.getElementById('edit-note').value.trim() || null
    };

    if (Number.isNaN(payload.gross_weight_kg) || Number.isNaN(payload.tare_weight_kg)) {
        showToast('Вкажіть брутто та тару', 'error');
        return null;
    }
    if (payload.gross_weight_kg < payload.tare_weight_kg) {
        showToast('Брутто не може бути менше тари', 'error');
        return null;
    }

    if (!payload.is_own_grain) {
        const ownerName = document.getElementById('edit-owner-name').value.trim();
        const ownerPhone = document.getElementById('edit-owner-phone').value.trim();
        if (!ownerName) {
            showToast('Вкажіть власника зерна', 'error');
            return null;
        }
        payload.owner_full_name = ownerName;
        payload.owner_phone = ownerPhone || null;
    }

    if (payload.is_internal_driver) {
        const driverId = document.getElementById('edit-driver').value;
        if (!driverId) {
            showToast('Вкажіть водія підприємства', 'error');
            return null;
        }
        payload.driver_id = parseInt(driverId, 10);
    } else {
        payload.external_driver_name = 'Інший водій';
    }

    return payload;
}

function buildIntakePayload() {
    const cultureId = parseInt(document.getElementById('intake-culture').value, 10);
    const vehicleId = parseInt(document.getElementById('intake-vehicle').value, 10);
    const hasTrailer = document.getElementById('intake-trailer').checked;
    const isOwnGrain = document.getElementById('intake-own-grain').checked;
    const ownerId = document.getElementById('owner-id').value;
    const ownerName = document.getElementById('owner-search').value.trim();
    const ownerPhone = document.getElementById('owner-phone').value.trim();
    const isInternalDriver = document.getElementById('intake-internal-driver').checked;
    const driverId = document.getElementById('intake-driver').value;
    const gross = parseFloat(document.getElementById('gross-weight').value);
    const tare = parseFloat(document.getElementById('tare-weight').value);
    const impurity = parseFloat(document.getElementById('impurity-percent').value || '0');
    const pendingQuality = document.getElementById('pending-quality').checked;
    const note = document.getElementById('intake-note').value.trim();

    if (Number.isNaN(gross) || Number.isNaN(tare)) {
        setFormMessage('intake-message', 'Вкажіть брутто та тару', true);
        return null;
    }
    if (gross < tare) {
        setFormMessage('intake-message', 'Брутто не може бути менше тари', true);
        return null;
    }

    if (!isOwnGrain && !ownerId && !ownerName) {
        setFormMessage('intake-message', 'Вкажіть власника зерна', true);
        return null;
    }

    if (isInternalDriver && !driverId) {
        setFormMessage('intake-message', 'Вкажіть водія підприємства', true);
        return null;
    }


    const payload = {
        culture_id: cultureId,
        vehicle_type_id: vehicleId,
        has_trailer: hasTrailer,
        is_own_grain: isOwnGrain,
        is_internal_driver: isInternalDriver,
        gross_weight_kg: gross,
        tare_weight_kg: tare,
        impurity_percent: impurity,
        pending_quality: pendingQuality,
        note: note || null
    };

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
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!isSuperAdmin) {
            setFormMessage('driver-message', 'Доступно лише супер адміну', true);
            return;
        }
        const name = document.getElementById('driver-name').value.trim();
        const phone = document.getElementById('driver-phone').value.trim();
        if (!name) {
            setFormMessage('driver-message', 'Вкажіть ПІБ водія', true);
            return;
        }
        const response = await apiFetch('/grain/drivers', {
            method: 'POST',
            body: JSON.stringify({ full_name: name, phone: phone || null })
        });
        if (response.ok) {
            setFormMessage('driver-message', 'Водія додано', false);
            form.reset();
            await loadDrivers();
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
        modal.classList.remove('hidden');
    });
    closeBtn.addEventListener('click', closeDriverAddModal);
    overlay.addEventListener('click', closeDriverAddModal);
}

function closeDriverAddModal() {
    const modal = document.getElementById('driver-add-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
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
    const openModal = () => modal.classList.remove('hidden');
    const closeModal = () => {
        form.reset();
        setFormMessage('user-message', '', false);
        modal.classList.add('hidden');
    };
    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!isSuperAdmin) {
            showToast('Доступно лише супер адміну', 'error');
            return;
        }
        const fullName = document.getElementById('user-full-name').value.trim();
        const username = document.getElementById('user-username').value.trim();
        const password = document.getElementById('user-password').value.trim();
        if (!fullName || !username || !password) {
            setFormMessage('user-message', 'Заповніть всі поля', true);
            return;
        }
        const response = await apiFetch('/users', {
            method: 'POST',
            body: JSON.stringify({ full_name: fullName, username, password })
        });
        if (response.ok) {
            showToast('Користувача створено', 'success');
            form.reset();
            setFormMessage('user-message', '', false);
            await loadUsers();
            closeModal();
        } else {
            const error = await response.json().catch(() => null);
            setFormMessage('user-message', error?.detail || 'Помилка створення', true);
        }
    });
}

function initCashForm() {
    const form = document.getElementById('cash-form');
    if (!form) {
        return;
    }
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!isSuperAdmin) {
            setFormMessage('cash-message', 'Доступно лише супер адміну', true);
            return;
        }
        const currency = document.getElementById('cash-currency').value;
        const amount = parseFloat(document.getElementById('cash-amount').value);
        const transactionType = document.getElementById('cash-type').value;
        const description = document.getElementById('cash-description').value.trim();
        if (Number.isNaN(amount) || amount <= 0) {
            setFormMessage('cash-message', 'Вкажіть коректну суму', true);
            return;
        }
        const response = await apiFetch('/cash/update-balance', {
            method: 'POST',
            body: JSON.stringify({
                currency,
                amount,
                transaction_type: transactionType,
                description: description || null
            })
        });
        if (response.ok) {
            showToast('Операцію збережено', 'success');
            form.reset();
            await loadCashBalance();
            await loadCashTransactions();
        } else {
            const error = await response.json().catch(() => null);
            showToast(error?.detail || 'Помилка операції', 'error');
        }
    });
}

function initCashReportModal() {
    const modal = document.getElementById('cash-report-modal');
    const openBtn = document.getElementById('cash-report-btn');
    const closeBtn = document.getElementById('cash-report-close');
    const cancelBtn = document.getElementById('cash-report-cancel');
    const downloadBtn = document.getElementById('cash-report-download');
    const overlay = modal?.querySelector('.modal-overlay');
    const startInput = document.getElementById('cash-report-start');
    const endInput = document.getElementById('cash-report-end');
    const startNative = document.getElementById('cash-report-start-native');
    const endNative = document.getElementById('cash-report-end-native');
    const startBtn = document.getElementById('cash-report-start-btn');
    const endBtn = document.getElementById('cash-report-end-btn');

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
        if (!isSuperAdmin) {
            showToast('Доступно лише супер адміну', 'error');
            return;
        }
        const startValue = startInput.value;
        const endValue = endInput.value;
        const startIso = parseDateInput(startValue, 'дата початку');
        if (startIso === undefined) {
            return;
        }
        const endIso = parseDateInput(endValue, 'дата завершення');
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
        const path = `/cash/transactions/export${params.toString() ? `?${params}` : ''}`;
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
        link.download = 'cash_report.xlsx';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showToast('Звіт сформовано', 'success');
        closeModal();
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

function formatDateDisplay(isoDate) {
    const [year, month, day] = isoDate.split('-');
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
            // Исправляем позиционирование выпадающего меню в модальных окнах
            if (customWrapper.closest('#contract-modal') || customWrapper.closest('#farmer-contract-modal')) {
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
    
    // Обработка изменения размера окна для выпадающих меню в модальных окнах
    window.addEventListener('resize', () => {
        document.querySelectorAll('#contract-modal .custom-select.open, #farmer-contract-modal .custom-select.open').forEach(wrapper => {
            positionContractSelectOptions(wrapper);
        });
    });
    
    // Обработка прокрутки для выпадающих меню в модальных окнах
    document.addEventListener('scroll', (event) => {
        if (event.target.closest('#contract-modal') || event.target.closest('#farmer-contract-modal')) {
            document.querySelectorAll('#contract-modal .custom-select.open, #farmer-contract-modal .custom-select.open').forEach(wrapper => {
                positionContractSelectOptions(wrapper);
            });
        }
    }, true);
}

function buildCustomOptions(select, wrapper) {
    const optionsContainer = wrapper.querySelector('.custom-options');
    optionsContainer.innerHTML = '';
    Array.from(select.options).forEach(option => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'custom-option';
        item.textContent = option.textContent;
        item.dataset.value = option.value;
        if (option.value === select.value) {
            item.classList.add('selected');
        }
        item.addEventListener('click', () => {
            select.value = option.value;
            select.dispatchEvent(new Event('change'));
            updateCustomTrigger(select, wrapper);
            wrapper.classList.remove('open');
        });
        optionsContainer.appendChild(item);
    });
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
    
    const modal = wrapper.closest('#contract-modal, #farmer-contract-modal');
    if (!modal) {
        return;
    }
    
    const trigger = wrapper.querySelector('.custom-select-trigger');
    if (!trigger) {
        return;
    }
    
    const triggerRect = trigger.getBoundingClientRect();
    
    // Используем fixed позиционирование для правильного отображения поверх всего
    options.style.position = 'fixed';
    options.style.top = `${triggerRect.bottom + 6}px`;
    options.style.left = `${triggerRect.left}px`;
    options.style.width = `${triggerRect.width}px`;
    options.style.zIndex = '10001';
    
    // Проверяем, не выходит ли меню за нижний край экрана
    const optionsHeight = options.offsetHeight || 260;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    
    if (spaceBelow < optionsHeight && triggerRect.top > optionsHeight) {
        // Показываем меню сверху
        options.style.top = `${triggerRect.top - optionsHeight - 6}px`;
    }
    
    // Проверяем, не выходит ли меню за правый край экрана
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

    const ownerSearch = document.getElementById('owner-search');
    const suggestions = document.getElementById('owner-suggestions');
    const ownerBadge = document.getElementById('owner-badge');
    const ownerIdInput = document.getElementById('owner-id');
    let ownerTimeout;
    let lastSelectedOwnerName = ''; // Сохраняем имя выбранного фермера
    
    // Функция для обновления индикатора существующего фермера
    function updateOwnerBadge() {
        const hasOwnerId = ownerIdInput.value && ownerIdInput.value !== '';
        const currentValue = ownerSearch.value.trim();
        // Проверяем, совпадает ли текущее значение с выбранным фермером
        const isStillSelected = hasOwnerId && currentValue === lastSelectedOwnerName;
        
        if (isStillSelected) {
            ownerBadge.classList.remove('hidden');
            ownerSearch.classList.add('owner-selected');
        } else {
            ownerBadge.classList.add('hidden');
            ownerSearch.classList.remove('owner-selected');
            // Если значение изменилось, сбрасываем owner-id
            if (hasOwnerId && currentValue !== lastSelectedOwnerName) {
                ownerIdInput.value = '';
            }
        }
    }
    
    ownerSearch.addEventListener('input', () => {
        clearTimeout(ownerTimeout);
        const value = ownerSearch.value.trim();
        
        // Если значение изменилось по сравнению с выбранным фермером, сбрасываем owner-id
        if (ownerIdInput.value && value !== lastSelectedOwnerName) {
            ownerIdInput.value = '';
            lastSelectedOwnerName = '';
            updateOwnerBadge();
        }
        
        if (!value) {
            suggestions.classList.add('hidden');
            suggestions.innerHTML = '';
            ownerIdInput.value = '';
            lastSelectedOwnerName = '';
            updateOwnerBadge();
            return;
        }
        ownerTimeout = setTimeout(async () => {
            const response = await apiFetch(`/grain/owners?q=${encodeURIComponent(value)}`);
            if (!response.ok) {
                return;
            }
            const owners = await response.json();
            suggestions.innerHTML = '';
            if (!owners.length) {
                suggestions.classList.add('hidden');
                // Если нет совпадений, сбрасываем owner-id
                ownerIdInput.value = '';
                lastSelectedOwnerName = '';
                updateOwnerBadge();
                return;
            }
            owners.forEach(owner => {
                const item = document.createElement('div');
                item.className = 'suggestion-item';
                item.textContent = owner.full_name;
                item.addEventListener('click', () => {
                    ownerSearch.value = owner.full_name;
                    ownerIdInput.value = owner.id;
                    lastSelectedOwnerName = owner.full_name; // Сохраняем выбранное имя
                    document.getElementById('owner-phone').value = owner.phone || '';
                    suggestions.classList.add('hidden');
                    updateOwnerBadge();
                });
                suggestions.appendChild(item);
            });
            suggestions.classList.remove('hidden');
        }, 300);
    });
    
    // Проверяем при изменении owner-id (на случай ручного изменения)
    ownerIdInput.addEventListener('change', updateOwnerBadge);

    document.addEventListener('click', (event) => {
        if (!suggestions.contains(event.target) && event.target !== ownerSearch) {
            suggestions.classList.add('hidden');
        }
    });
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

    if (!form || !nameInput || !categorySelect || !priceInput || !currencySelect || !quantityInput || !totalInput || !suggestions || !nameHint) {
        return;
    }

    initCustomSelects(categorySelect);
    initCustomSelects(currencySelect);

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

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const name = nameInput.value.trim();
        const price = parseFloat(priceInput.value);
        const qty = parseFloat(quantityInput.value);
        if (!name) {
            showToast('Вкажіть назву позиції', 'error');
            return;
        }
        if (Number.isNaN(price) || price <= 0) {
            showToast('Вкажіть коректну ціну', 'error');
            return;
        }
        if (Number.isNaN(qty) || qty <= 0) {
            showToast('Вкажіть коректну кількість', 'error');
            return;
        }

        const payload = {
            item_name: name,
            category: categorySelect.value,
            price_per_kg: price,
            currency: currencySelect.value,
            quantity_kg: qty
        };

        const response = await apiFetch('/purchases', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            showToast('Закупівлю збережено', 'success');
            form.reset();
            totalInput.value = '';
            nameHint.textContent = '';
            suggestions.classList.add('hidden');
            await loadPurchaseStock();
            await loadPurchases();
            await loadCashBalance();
            await loadCashTransactions();
        } else {
            const error = await response.json().catch(() => null);
            showToast(error?.detail || 'Помилка збереження', 'error');
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

    [gross, tare, impurity].forEach(element => {
        element.addEventListener('input', calculateWeights);
        element.addEventListener('change', calculateWeights);
    });

    // Обработчик для чекбокса "Очікує % втрат" - только клик на сам чекбокс
    const pendingLabel = pending.closest('label');
    if (pendingLabel) {
        // Предотвращаем стандартное поведение label - чекбокс меняется только при клике на сам чекбокс
        pendingLabel.addEventListener('click', (e) => {
            // Если клик был на label (не на сам чекбокс), предотвращаем изменение
            if (e.target !== pending && e.target.tagName !== 'INPUT') {
                e.preventDefault();
                e.stopPropagation();
                // Программно переключаем чекбокс, чтобы зарегистрировать изменение
                pending.checked = !pending.checked;
                pending.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }

    // Обработчик изменения состояния чекбокса
    pending.addEventListener('change', () => {
        calculateWeights();
    });

    calculateWeights();
}

function calculateWeights() {
    const gross = parseFloat(document.getElementById('gross-weight').value) || 0;
    const tare = parseFloat(document.getElementById('tare-weight').value) || 0;
    const impurityInput = document.getElementById('impurity-percent');
    const impurity = parseFloat(impurityInput.value) || 0;
    const pending = document.getElementById('pending-quality').checked;
    const net = gross - tare;

    // Блокируем инпут "Втрати, %" если чекбокс нажат
    impurityInput.disabled = pending;
    if (pending) {
        impurityInput.value = '0';
    }

    document.getElementById('net-weight').value = net > 0 ? formatWeight(net) : '';
    if (pending) {
        document.getElementById('accepted-weight').value = 'Очікує';
    } else if (net > 0) {
        const accepted = net * (1 - impurity / 100);
        document.getElementById('accepted-weight').value = formatWeight(accepted);
    } else {
        document.getElementById('accepted-weight').value = '';
    }
}

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

function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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

function getCultureName(cultureId) {
    const found = culturesCache.find(culture => culture.id === cultureId);
    return found ? found.name : '-';
}

function getVehicleName(vehicleId) {
    const found = vehicleTypesCache.find(vehicle => vehicle.id === vehicleId);
    return found ? found.name : '-';
}

function getDriverName(driverId) {
    const found = driversCache.find(driver => driver.id === driverId);
    return found ? found.full_name : '-';
}

// Landlords management - переменные уже объявлены выше (строка 3526)

async function loadLandlords() {
    const response = await apiFetch('/leases/landlords');
    if (!response.ok) {
        console.error('Помилка завантаження орендодавців');
        return;
    }
    landlordsCache = await response.json();
    renderLandlordsTable();
    updateContractsFilterLandlords();
    updatePaymentsFilterLandlords();
}

function renderLandlordsTable() {
    const tableBody = document.querySelector('#landlords-table tbody');
    if (!tableBody) {
        return;
    }
    tableBody.innerHTML = '';
    const searchVal = (document.getElementById('landlords-filter-search')?.value || '').toLowerCase();
    const filtered = landlordsCache.filter(l => {
        if (searchVal && !l.full_name.toLowerCase().includes(searchVal)) return false;
        return true;
    });
    if (!filtered.length) {
        tableBody.innerHTML = '<tr><td colspan="3" class="table-empty-message">Орендодавців не знайдено</td></tr>';
        return;
    }
    filtered.forEach(landlord => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${landlord.full_name}</strong></td>
            <td>${landlord.phone || '<span class="td-secondary">—</span>'}</td>
            <td class="actions-cell">
                <button class="btn-icon btn-icon-secondary" data-edit="${landlord.id}" title="Редагувати">${ICONS.edit}</button>
                <button class="btn-icon btn-icon-danger" data-delete="${landlord.id}" title="Видалити">${ICONS.delete}</button>
            </td>
        `;
        row.querySelector(`[data-edit="${landlord.id}"]`).addEventListener('click', () => {
            openLandlordEditModal(landlord);
        });
        row.querySelector(`[data-delete="${landlord.id}"]`).addEventListener('click', () => {
            openLandlordDeleteModal(landlord);
        });
        tableBody.appendChild(row);
    });
}

function initLandlords() {
    const addBtn = document.getElementById('landlord-add-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            openLandlordAddModal();
        });
    }
    initLandlordModal();
    initLandlordDeleteModal();
    initLandlordsFilter();
    initLandlordsReportModal();
}

function openLandlordAddModal() {
    editingLandlordId = null;
    document.getElementById('landlord-modal-title').textContent = 'Додати орендодавця';
    document.getElementById('landlord-form').reset();
    setFormMessage('landlord-message', '', false);
    document.getElementById('landlord-modal').classList.remove('hidden');
}

function openLandlordEditModal(landlord) {
    editingLandlordId = landlord.id;
    document.getElementById('landlord-modal-title').textContent = 'Редагувати орендодавця';
    document.getElementById('landlord-full-name').value = landlord.full_name;
    document.getElementById('landlord-phone').value = landlord.phone || '';
    setFormMessage('landlord-message', '', false);
    document.getElementById('landlord-modal').classList.remove('hidden');
}

function initLandlordModal() {
    const modal = document.getElementById('landlord-modal');
    const form = document.getElementById('landlord-form');
    const closeBtn = document.getElementById('landlord-modal-close');
    const overlay = modal?.querySelector('.modal-overlay');
    
    if (!modal || !form || !closeBtn || !overlay) {
        return;
    }
    
    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
    overlay.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
    
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const fullName = document.getElementById('landlord-full-name').value.trim();
        const phone = document.getElementById('landlord-phone').value.trim();
        
        if (!fullName) {
            setFormMessage('landlord-message', 'Вкажіть ПІБ', true);
            return;
        }
        
        const payload = {
            full_name: fullName,
            phone: phone || null
        };
        
        const url = editingLandlordId 
            ? `/leases/landlords/${editingLandlordId}`
            : '/leases/landlords';
        const method = editingLandlordId ? 'PATCH' : 'POST';
        
        const response = await apiFetch(url, {
            method,
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            showToast(editingLandlordId ? 'Орендодавця оновлено' : 'Орендодавця додано', 'success');
            modal.classList.add('hidden');
            await loadLandlords();
            await loadContracts(); // Обновляем контракты, так как там может быть автодополнение
        } else {
            const error = await response.json().catch(() => null);
            setFormMessage('landlord-message', error?.detail || 'Помилка збереження', true);
        }
    });
}

function initLandlordDeleteModal() {
    const modal = document.getElementById('landlord-delete-modal');
    const closeBtn = document.getElementById('landlord-delete-close');
    const cancelBtn = document.getElementById('landlord-delete-cancel');
    const confirmBtn = document.getElementById('landlord-delete-confirm');
    const overlay = modal?.querySelector('.modal-overlay');
    
    if (!modal || !closeBtn || !cancelBtn || !confirmBtn || !overlay) {
        return;
    }
    
    const closeModal = () => {
        modal.classList.add('hidden');
        deletingLandlordId = null;
    };
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    
    confirmBtn.addEventListener('click', async () => {
        if (!deletingLandlordId) {
            return;
        }
        const response = await apiFetch(`/leases/landlords/${deletingLandlordId}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            showToast('Орендодавця видалено', 'success');
            closeModal();
            await loadLandlords();
            await loadContracts();
        } else {
            const error = await response.json().catch(() => null);
            showToast(error?.detail || 'Помилка видалення', 'error');
        }
    });
}

function openLandlordDeleteModal(landlord) {
    deletingLandlordId = landlord.id;
    document.getElementById('landlord-delete-name').textContent = landlord.full_name;
    document.getElementById('landlord-delete-modal').classList.remove('hidden');
}

// Contracts management
async function loadContracts() {
    const response = await apiFetch('/leases/contracts');
    if (!response.ok) {
        console.error('Помилка завантаження контрактів');
        return;
    }
    contractsCache = await response.json();
    renderContractsTable();
    updatePaymentContractSelect();
}

function renderContractsTable() {
    const tableBody = document.querySelector('#contracts-table tbody');
    if (!tableBody) {
        return;
    }
    tableBody.innerHTML = '';
    const filterLandlord = document.getElementById('contracts-filter-landlord')?.value || '';
    const filterStatus = document.getElementById('contracts-filter-status')?.value || '';
    const filtered = contractsCache.filter(c => {
        if (filterLandlord && String(c.landlord_id) !== filterLandlord) return false;
        if (filterStatus === 'active' && !c.is_active) return false;
        if (filterStatus === 'inactive' && c.is_active) return false;
        return true;
    });
    if (!filtered.length) {
        tableBody.innerHTML = '<tr><td colspan="5" class="table-empty-message">Контрактів не знайдено</td></tr>';
        return;
    }
    filtered.forEach(contract => {
        const row = document.createElement('tr');
        if (!contract.is_active) row.classList.add('row-muted');
        const statusBadge = contract.is_active 
            ? '<span class="status-badge success">Активний</span>'
            : '<span class="status-badge muted">Неактивний</span>';
        
        row.innerHTML = `
            <td><strong>${contract.landlord_full_name}</strong></td>
            <td>${contract.field_name}</td>
            <td>${formatDate(contract.contract_date)}</td>
            <td>${statusBadge}</td>
            <td class="actions-cell">
                <button class="btn-icon btn-icon-secondary" data-view="${contract.id}" title="Переглянути">${ICONS.view}</button>
                <button class="btn-icon btn-icon-secondary" data-edit="${contract.id}" title="Редагувати">${ICONS.edit}</button>
                <button class="btn-icon btn-icon-danger" data-delete="${contract.id}" title="Видалити">${ICONS.delete}</button>
            </td>
        `;
        row.querySelector(`[data-view="${contract.id}"]`).addEventListener('click', () => {
            openContractViewModal(contract);
        });
        row.querySelector(`[data-edit="${contract.id}"]`).addEventListener('click', () => {
            openContractEditModal(contract);
        });
        row.querySelector(`[data-delete="${contract.id}"]`).addEventListener('click', () => {
            openContractDeleteModal(contract);
        });
        tableBody.appendChild(row);
    });
}

function initContracts() {
    const addBtn = document.getElementById('contract-add-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            openContractAddModal();
        });
    }
    initContractModal();
    initContractDeleteModal();
    initContractViewModal();
    initContractLandlordSearch();
    initContractsFilter();
    initContractsReportModal();
    
    // Кнопка добавления позиции
    const addItemBtn = document.getElementById('contract-add-item');
    if (addItemBtn) {
        addItemBtn.addEventListener('click', addContractItem);
    }
}

function resetContractItems() {
    const tbody = document.getElementById('contract-items-tbody');
    if (!tbody) {
        return;
    }
    tbody.innerHTML = `
        <tr class="contract-item-row">
            <td>
                <select class="contract-item-culture" required>
                    <option value="">Оберіть культуру</option>
                </select>
            </td>
            <td>
                <input type="number" class="contract-item-quantity" min="0" step="0.01" placeholder="кг" required>
            </td>
            <td>
                <input type="number" class="contract-item-price" min="0" step="0.01" placeholder="грн/кг" required>
            </td>
            <td>
                <button type="button" class="btn btn-danger btn-small contract-item-remove">×</button>
            </td>
        </tr>
    `;
    updateContractItemSelects();
    updateContractItemRemoveButtons();
}

function addContractItem() {
    const tbody = document.getElementById('contract-items-tbody');
    if (!tbody) {
        return;
    }
    const newRow = document.createElement('tr');
    newRow.className = 'contract-item-row';
    newRow.innerHTML = `
        <td>
            <select class="contract-item-culture" required>
                <option value="">Оберіть культуру</option>
            </select>
        </td>
        <td>
            <input type="number" class="contract-item-quantity" min="0" step="0.01" placeholder="кг" required>
        </td>
        <td>
            <input type="number" class="contract-item-price" min="0" step="0.01" placeholder="грн/кг" required>
        </td>
        <td>
            <button type="button" class="btn btn-danger btn-small contract-item-remove">×</button>
        </td>
    `;
    tbody.appendChild(newRow);
    updateContractItemSelects();
    updateContractItemRemoveButtons();
    // Инициализируем кастомный select для новой строки
    setTimeout(() => {
        const newSelect = newRow.querySelector('.contract-item-culture');
        if (newSelect && typeof initCustomSelects === 'function') {
            initCustomSelects(newSelect);
        }
    }, 50);
}

function updateContractItemSelects() {
    const selects = document.querySelectorAll('.contract-item-culture');
    selects.forEach(select => {
        if (!culturesCache.length) {
            return;
        }
        const currentValue = select.value;
        select.innerHTML = '<option value="">Оберіть культуру</option>' +
            culturesCache.map(culture => 
                `<option value="${culture.id}">${culture.name}</option>`
            ).join('');
        if (currentValue) {
            select.value = currentValue;
        }
        // Применяем кастомные стили к выпадающему меню
        refreshCustomSelect(select);
    });
}

function updateContractItemRemoveButtons() {
    const rows = document.querySelectorAll('#contract-items-tbody .contract-item-row');
    rows.forEach((row, index) => {
        const removeBtn = row.querySelector('.contract-item-remove');
        if (removeBtn && index > 0) {
            // Стили для отображения кнопки удаления управляются через CSS
            removeBtn.onclick = () => {
                row.remove();
                updateContractItemRemoveButtons();
            };
        }
    });
}

function openContractAddModal() {
    editingContractId = null;
    document.getElementById('contract-modal-title').textContent = 'Додати контракт';
    document.getElementById('contract-form').reset();
    document.getElementById('contract-landlord-id').value = '';
    document.getElementById('contract-landlord-search').value = '';
    document.getElementById('contract-is-active').checked = true;
    setFormMessage('contract-message', '', false);
    resetContractItems();
    updateContractLandlordBadge();
    document.getElementById('contract-modal').classList.remove('hidden');
    // Убеждаемся, что кастомные select инициализированы после открытия модального окна
    setTimeout(() => {
        updateContractItemSelects();
        const selects = document.querySelectorAll('#contract-items-table .contract-item-culture');
        selects.forEach(select => {
            if (select && typeof initCustomSelects === 'function') {
                initCustomSelects(select);
            }
        });
    }, 100);
}

function openContractEditModal(contract) {
    editingContractId = contract.id;
    document.getElementById('contract-modal-title').textContent = 'Редагувати контракт';
    document.getElementById('contract-landlord-search').value = contract.landlord_full_name;
    document.getElementById('contract-landlord-id').value = contract.landlord_id;
    document.getElementById('contract-field-name').value = contract.field_name;
    const contractDate = new Date(contract.contract_date);
    document.getElementById('contract-date-native').value = contractDate.toISOString().split('T')[0];
    document.getElementById('contract-date').value = formatDateInput(contractDate);
    document.getElementById('contract-note').value = contract.note || '';
    document.getElementById('contract-is-active').checked = contract.is_active;
    setFormMessage('contract-message', '', false);
    
    // Загружаем позиции контракта
    const tbody = document.getElementById('contract-items-tbody');
    tbody.innerHTML = '';
    if (contract.contract_items && contract.contract_items.length > 0) {
        contract.contract_items.forEach((item, index) => {
            const row = document.createElement('tr');
            row.className = 'contract-item-row';
            row.innerHTML = `
                <td>
                    <select class="contract-item-culture" required>
                        <option value="">Оберіть культуру</option>
                    </select>
                </td>
                <td>
                    <input type="number" class="contract-item-quantity" min="0" step="0.01" placeholder="кг" value="${item.quantity_kg}" required>
                </td>
                <td>
                    <input type="number" class="contract-item-price" min="0" step="0.01" placeholder="грн/кг" value="${item.price_per_kg_uah}" required>
                </td>
                <td>
                    <button type="button" class="btn btn-danger btn-small contract-item-remove">×</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } else {
        resetContractItems();
    }
    updateContractItemSelects();
    // Устанавливаем значения культур
    if (contract.contract_items && contract.contract_items.length > 0) {
        const selects = document.querySelectorAll('.contract-item-culture');
        contract.contract_items.forEach((item, index) => {
            if (selects[index]) {
                selects[index].value = item.culture_id;
                refreshCustomSelect(selects[index]);
            }
        });
    }
    updateContractItemRemoveButtons();
    updateContractLandlordBadge();
    document.getElementById('contract-modal').classList.remove('hidden');
}

function initContractModal() {
    const modal = document.getElementById('contract-modal');
    const form = document.getElementById('contract-form');
    const closeBtn = document.getElementById('contract-modal-close');
    const overlay = modal?.querySelector('.modal-overlay');
    const dateBtn = document.getElementById('contract-date-btn');
    const dateInput = document.getElementById('contract-date');
    const dateNative = document.getElementById('contract-date-native');
    
    if (!modal || !form || !closeBtn || !overlay) {
        return;
    }
    
    const closeModal = () => {
        modal.classList.add('hidden');
        form.reset();
        document.getElementById('contract-landlord-id').value = '';
        document.getElementById('contract-landlord-search').value = '';
        resetContractItems();
        editingContractId = null;
        setFormMessage('contract-message', '', false);
    };
    
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    
    if (dateBtn && dateNative) {
        dateBtn.addEventListener('click', () => {
            dateNative.showPicker();
        });
        dateNative.addEventListener('change', () => {
            const date = new Date(dateNative.value);
            dateInput.value = formatDateInput(date);
        });
    }
    
    // Обработчик для чекбокса "Активний контракт" - сохраняет сразу при изменении
    const isActiveCheckbox = document.getElementById('contract-is-active');
    if (isActiveCheckbox) {
        const pillToggleLabel = isActiveCheckbox.closest('.pill-toggle');
        const pillToggleSpan = pillToggleLabel?.querySelector('span');
        let shouldProcessChange = false;
        
        // Обработчик mousedown на label - проверяем, был ли клик на чекбоксе или span
        if (pillToggleLabel) {
            pillToggleLabel.addEventListener('mousedown', (event) => {
                // Разрешаем обработку только если клик был на чекбоксе или span
                shouldProcessChange = (event.target === isActiveCheckbox || event.target === pillToggleSpan);
                
                // Если клик был не на чекбоксе и не на span, предотвращаем стандартное поведение
                if (!shouldProcessChange) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            });
        }
        
        // Обрабатываем изменение только если клик был на чекбоксе или span
        isActiveCheckbox.addEventListener('change', async (event) => {
            // Если клик был не на чекбоксе или span, отменяем изменение
            if (!shouldProcessChange) {
                event.target.checked = !event.target.checked;
                shouldProcessChange = false;
                return;
            }
            shouldProcessChange = false;
            
            // Сохраняем только если редактируется существующий контракт
            if (editingContractId) {
                const isActive = event.target.checked;
                try {
                    const response = await apiFetch(`/leases/contracts/${editingContractId}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ is_active: isActive })
                    });
                    
                    if (response.ok) {
                        showToast(isActive ? 'Контракт активовано' : 'Контракт деактивовано', 'success');
                        await loadContracts();
                        await loadPayments();
                    } else {
                        // Откатываем изменение чекбокса при ошибке
                        event.target.checked = !isActive;
                        const error = await response.json().catch(() => null);
                        showToast(error?.detail || 'Помилка оновлення статусу', 'error');
                    }
                } catch (error) {
                    // Откатываем изменение чекбокса при ошибке
                    event.target.checked = !isActive;
                    console.error('Помилка оновлення статусу контракту:', error);
                    showToast('Помилка оновлення статусу', 'error');
                }
            }
        });
    }
    
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const landlordId = document.getElementById('contract-landlord-id').value;
        const fieldName = document.getElementById('contract-field-name').value.trim();
        
        // Получаем позиции контракта из таблицы
        const contractItems = [];
        const itemRows = document.querySelectorAll('#contract-items-tbody .contract-item-row');
        itemRows.forEach(row => {
            const cultureSelect = row.querySelector('.contract-item-culture');
            const quantityInput = row.querySelector('.contract-item-quantity');
            const priceInput = row.querySelector('.contract-item-price');
            
            if (cultureSelect && cultureSelect.value && quantityInput && priceInput) {
                contractItems.push({
                    culture_id: parseInt(cultureSelect.value),
                    quantity_kg: parseFloat(quantityInput.value) || 0,
                    price_per_kg_uah: parseFloat(priceInput.value) || 0
                });
            }
        });
        
        const dateNative = document.getElementById('contract-date-native').value;
        const note = document.getElementById('contract-note').value.trim();
        const isActive = document.getElementById('contract-is-active').checked;
        
        if (!landlordId) {
            setFormMessage('contract-message', 'Виберіть орендодавця', true);
            return;
        }
        if (!fieldName) {
            setFormMessage('contract-message', 'Вкажіть назву поля', true);
            return;
        }
        if (contractItems.length === 0) {
            setFormMessage('contract-message', 'Додайте хоча б одну позицію контракту', true);
            return;
        }
        // Проверяем валидность каждой позиции
        for (let i = 0; i < contractItems.length; i++) {
            const item = contractItems[i];
            if (!item.culture_id || item.culture_id <= 0) {
                setFormMessage('contract-message', `Виберіть культуру для позиції ${i + 1}`, true);
                return;
            }
            if (Number.isNaN(item.quantity_kg) || item.quantity_kg <= 0) {
                setFormMessage('contract-message', `Вкажіть коректну кількість для позиції ${i + 1}`, true);
                return;
            }
            if (Number.isNaN(item.price_per_kg_uah) || item.price_per_kg_uah <= 0) {
                setFormMessage('contract-message', `Вкажіть коректну ціну для позиції ${i + 1}`, true);
                return;
            }
        }
        if (!dateNative) {
            setFormMessage('contract-message', 'Вкажіть дату контракту', true);
            return;
        }
        
        const contractDate = new Date(dateNative + 'T00:00:00');
        
        const payload = {
            landlord_id: parseInt(landlordId),
            field_name: fieldName,
            contract_items: contractItems,
            contract_date: contractDate.toISOString(),
            note: note || null,
            is_active: isActive
        };
        
        const url = editingContractId 
            ? `/leases/contracts/${editingContractId}`
            : '/leases/contracts';
        const method = editingContractId ? 'PATCH' : 'POST';
        
        const response = await apiFetch(url, {
            method,
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            showToast(editingContractId ? 'Контракт оновлено' : 'Контракт додано', 'success');
            form.reset();
            document.getElementById('contract-landlord-id').value = '';
            document.getElementById('contract-landlord-search').value = '';
            resetContractItems();
            editingContractId = null;
            setFormMessage('contract-message', '', false);
            modal.classList.add('hidden');
            await loadContracts();
            await loadPayments();
        } else {
            const error = await response.json().catch(() => null);
            setFormMessage('contract-message', error?.detail || 'Помилка збереження', true);
        }
    });
}

function initContractLandlordSearch() {
    const searchInput = document.getElementById('contract-landlord-search');
    const suggestions = document.getElementById('contract-landlord-suggestions');
    const badge = document.getElementById('contract-landlord-badge');
    const landlordIdInput = document.getElementById('contract-landlord-id');
    let timeout;
    let lastSelectedName = '';
    
    if (!searchInput || !suggestions || !badge || !landlordIdInput) {
        return;
    }
    
    function updateBadge() {
        const hasId = landlordIdInput.value && landlordIdInput.value !== '';
        const currentValue = searchInput.value.trim();
        const isStillSelected = hasId && currentValue === lastSelectedName;
        
        if (isStillSelected) {
            badge.classList.remove('hidden');
            searchInput.classList.add('owner-selected');
        } else {
            badge.classList.add('hidden');
            searchInput.classList.remove('owner-selected');
            if (hasId && currentValue !== lastSelectedName) {
                landlordIdInput.value = '';
            }
        }
    }
    
    searchInput.addEventListener('input', () => {
        clearTimeout(timeout);
        const value = searchInput.value.trim();
        
        if (landlordIdInput.value && value !== lastSelectedName) {
            landlordIdInput.value = '';
            lastSelectedName = '';
            updateBadge();
        }
        
        if (!value) {
            suggestions.classList.add('hidden');
            suggestions.innerHTML = '';
            landlordIdInput.value = '';
            lastSelectedName = '';
            updateBadge();
            return;
        }
        
        timeout = setTimeout(async () => {
            const response = await apiFetch(`/leases/landlords?q=${encodeURIComponent(value)}`);
            if (!response.ok) {
                return;
            }
            const landlords = await response.json();
            suggestions.innerHTML = '';
            if (!landlords.length) {
                suggestions.classList.add('hidden');
                landlordIdInput.value = '';
                lastSelectedName = '';
                updateBadge();
                return;
            }
            landlords.forEach(landlord => {
                const item = document.createElement('div');
                item.className = 'suggestion-item';
                item.textContent = landlord.full_name;
                item.addEventListener('click', () => {
                    searchInput.value = landlord.full_name;
                    landlordIdInput.value = landlord.id;
                    lastSelectedName = landlord.full_name;
                    suggestions.classList.add('hidden');
                    updateBadge();
                });
                suggestions.appendChild(item);
            });
            suggestions.classList.remove('hidden');
        }, 300);
    });
    
    document.addEventListener('click', (event) => {
        if (!suggestions.contains(event.target) && event.target !== searchInput) {
            suggestions.classList.add('hidden');
        }
    });
}


function updateContractLandlordBadge() {
    const landlordId = document.getElementById('contract-landlord-id').value;
    const badge = document.getElementById('contract-landlord-badge');
    if (landlordId && badge) {
        badge.classList.remove('hidden');
        document.getElementById('contract-landlord-search').classList.add('owner-selected');
    }
}

function initContractDeleteModal() {
    const modal = document.getElementById('contract-delete-modal');
    const closeBtn = document.getElementById('contract-delete-close');
    const cancelBtn = document.getElementById('contract-delete-cancel');
    const confirmBtn = document.getElementById('contract-delete-confirm');
    const overlay = modal?.querySelector('.modal-overlay');
    
    if (!modal || !closeBtn || !cancelBtn || !confirmBtn || !overlay) {
        return;
    }
    
    const closeModal = () => {
        modal.classList.add('hidden');
        deletingContractId = null;
    };
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    
    confirmBtn.addEventListener('click', async () => {
        if (!deletingContractId) {
            return;
        }
        const response = await apiFetch(`/leases/contracts/${deletingContractId}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            showToast('Контракт видалено', 'success');
            closeModal();
            await loadContracts();
            await loadPayments();
        } else {
            const error = await response.json().catch(() => null);
            showToast(error?.detail || 'Помилка видалення', 'error');
        }
    });
}

async function openContractViewModal(contract) {
    document.getElementById('view-contract-landlord').textContent = contract.landlord_full_name;
    document.getElementById('view-contract-field').textContent = contract.field_name;
    document.getElementById('view-contract-date').textContent = formatDate(contract.contract_date);
    const statusBadge = contract.is_active 
        ? '<span class="status-badge success">Активний</span>'
        : '<span class="status-badge muted">Неактивний</span>';
    document.getElementById('view-contract-status').innerHTML = statusBadge;
    document.getElementById('view-contract-note').textContent = contract.note || '-';
    
    // Заполняем позиции контракта
    const itemsTbody = document.getElementById('view-contract-items-tbody');
    itemsTbody.innerHTML = '';
    if (contract.contract_items && contract.contract_items.length > 0) {
        contract.contract_items.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.culture_name || '-'}</td>
                <td>${formatWeight(item.quantity_kg)}</td>
                <td>${item.price_per_kg_uah.toFixed(2)}</td>
            `;
            itemsTbody.appendChild(row);
        });
    } else {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="3" style="text-align: center; color: var(--text-secondary);">Позиції відсутні</td>';
        itemsTbody.appendChild(row);
    }

    // Баланс за поточний рік — показываем загрузку
    const balanceEl = document.getElementById('view-contract-balance');
    balanceEl.innerHTML = '<div class="contract-balance-loading">Завантаження…</div>';
    
    document.getElementById('contract-view-modal').classList.remove('hidden');

    // Загружаем баланс асинхронно
    try {
        const response = await apiFetch(`/leases/contracts/${contract.id}/balance`);
        if (!response.ok) throw new Error();
        const balance = await response.json();
        renderContractViewBalance(balance);
    } catch (e) {
        console.error('Помилка завантаження балансу контракту', e);
        balanceEl.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;">Не вдалося завантажити баланс</div>';
    }
}

function renderContractViewBalance(balance) {
    const balanceEl = document.getElementById('view-contract-balance');
    if (!balanceEl) return;

    const fmtDate = (s) => {
        const d = new Date(s);
        return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const periodText = `${fmtDate(balance.period_start)} — ${fmtDate(balance.period_end)} (рік ${balance.period_number})`;

    let totalOwed = 0;
    let totalPaidCash = 0;
    balance.items.forEach(item => {
        totalOwed += item.annual_quantity_kg * item.price_per_kg_uah;
        totalPaidCash += item.paid_kg * item.price_per_kg_uah;
    });
    const totalRemaining = totalOwed - totalPaidCash;
    const allDone = balance.items.every(item => item.remaining_kg <= 0);

    let html = `
        <div class="contract-balance-section">
            <div class="contract-balance-period">${periodText}</div>
            <div class="contract-balance-items">
    `;

    balance.items.forEach(item => {
        const pct = item.annual_quantity_kg > 0
            ? Math.round((item.paid_kg / item.annual_quantity_kg) * 100) : 0;
        const done = item.remaining_kg <= 0;

        html += `
            <div class="balance-item${done ? ' balance-item-done' : ''}">
                <div class="balance-item-header">
                    <span class="balance-culture-name">${item.culture_name}</span>
                    <span class="balance-culture-stats">${formatWeight(item.paid_kg)} / ${formatWeight(item.annual_quantity_kg)} кг</span>
                </div>
                <div class="balance-bar">
                    <div class="balance-bar-fill${done ? ' balance-bar-done' : ''}" style="width: ${Math.min(pct, 100)}%"></div>
                </div>
                <div class="balance-item-footer">
                    ${done
                        ? '<span style="color:var(--primary)">✓ Повністю виплачено</span>'
                        : `Залишок: <strong>${formatWeight(item.remaining_kg)} кг</strong> (${formatWeight(item.remaining_cash_uah)} грн)`
                    }
                </div>
            </div>
        `;
    });

    html += '</div>';

    // Итого
    if (allDone) {
        html += `<div class="contract-balance-total contract-balance-done">✓ Усі виплати за цей період здійснено</div>`;
    } else {
        html += `<div class="contract-balance-total">Загалом залишок: <strong>${formatWeight(totalRemaining)} грн</strong></div>`;
    }

    html += '</div>';
    balanceEl.innerHTML = html;
}

function initContractViewModal() {
    const modal = document.getElementById('contract-view-modal');
    const closeBtn = document.getElementById('contract-view-close');
    const closeBtnBottom = document.getElementById('contract-view-close-btn');
    const overlay = modal?.querySelector('.modal-overlay');
    
    if (!modal || !closeBtn || !closeBtnBottom || !overlay) {
        return;
    }
    
    const closeModal = () => {
        modal.classList.add('hidden');
    };
    
    closeBtn.addEventListener('click', closeModal);
    closeBtnBottom.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
}

function openContractDeleteModal(contract) {
    deletingContractId = contract.id;
    document.getElementById('contract-delete-field').textContent = contract.field_name;
    document.getElementById('contract-delete-modal').classList.remove('hidden');
}

// ===== Payments management =====
let paymentBalance = null;

async function loadPayments() {
    const response = await apiFetch('/leases/payments');
    if (!response.ok) {
        console.error('Помилка завантаження виплат');
        return;
    }
    paymentsCache = await response.json();
    renderPaymentsTable();
    updatePaymentContractSelect();
}

function renderPaymentsTable() {
    const tableBody = document.querySelector('#payments-table tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    const filterLandlord = document.getElementById('payments-filter-landlord')?.value || '';
    const filterType = document.getElementById('payments-filter-type')?.value || '';
    const filterStatus = document.getElementById('payments-filter-status')?.value || '';
    const showCancelled = filterStatus === 'all';
    const filtered = paymentsCache.filter(p => {
        if (filterLandlord && p.landlord_full_name !== landlordsCache.find(l => String(l.id) === filterLandlord)?.full_name) return false;
        if (filterType && p.payment_type !== filterType) return false;
        if (!showCancelled && p.is_cancelled) return false;
        return true;
    });
    if (!filtered.length) {
        tableBody.innerHTML = '<tr><td colspan="6" class="table-empty-message">Виплат не знайдено</td></tr>';
        return;
    }
    filtered.forEach(payment => {
        const row = document.createElement('tr');
        if (payment.is_cancelled) {
            row.classList.add('row-cancelled');
        }
        let sumText = '<span class="td-secondary">—</span>';
        if (payment.grain_items && payment.grain_items.length > 0) {
            const grainParts = payment.grain_items.map(item =>
                `<span class="inline-badge grain">${formatWeight(item.quantity_kg)} ${item.culture_name || ''}</span>`
            ).join(' ');
            if (payment.payment_type === 'cash') {
                sumText = `<strong>${formatAmount(payment.amount || 0)} ${payment.currency || '₴'}</strong> ${grainParts}`;
            } else {
                sumText = grainParts;
            }
        } else if (payment.payment_type === 'cash') {
            sumText = `<strong>${formatAmount(payment.amount || 0)} ${payment.currency || '₴'}</strong>`;
        }

        const typeBadge = payment.payment_type === 'grain'
            ? '<span class="inline-badge grain">Зерном</span>'
            : '<span class="inline-badge cash">Грошима</span>';

        const statusBadge = payment.is_cancelled
            ? ' <span class="status-badge danger">Скасовано</span>'
            : '';

        const cancelBtn = payment.is_cancelled
            ? ''
            : `<button class="btn-icon btn-icon-danger" onclick="cancelPayment(${payment.id})" title="Скасувати виплату">${ICONS.cancel}</button>`;

        row.innerHTML = `
            <td>${formatDate(payment.payment_date)}</td>
            <td><strong>${payment.landlord_full_name || '—'}</strong></td>
            <td>${payment.contract_field_name || '—'}</td>
            <td>${typeBadge}${statusBadge}</td>
            <td>${sumText}</td>
            <td class="actions-cell">${cancelBtn}</td>
        `;
        tableBody.appendChild(row);
    });
}

function cancelPayment(paymentId) {
    const payment = paymentsCache.find(p => p.id === paymentId);
    if (!payment) return;

    cancellingPaymentId = paymentId;

    const info = document.getElementById('payment-cancel-info');
    if (info) {
        let details = `${formatDate(payment.payment_date)} — ${payment.landlord_full_name || '?'}`;
        if (payment.payment_type === 'grain' && payment.grain_items?.length) {
            const parts = payment.grain_items.map(i => `${formatWeight(i.quantity_kg)} ${i.culture_name || ''}`).join(', ');
            details += ` (${parts})`;
        } else if (payment.payment_type === 'cash') {
            details += ` (${payment.amount?.toFixed(2) || 0} ${payment.currency || 'грн'})`;
        }
        info.textContent = details;
    }

    document.getElementById('payment-cancel-modal').classList.remove('hidden');
}

function initPaymentCancelModal() {
    const modal = document.getElementById('payment-cancel-modal');
    const closeBtn = document.getElementById('payment-cancel-close');
    const cancelBtn = document.getElementById('payment-cancel-cancel');
    const confirmBtn = document.getElementById('payment-cancel-confirm');
    const overlay = modal?.querySelector('.modal-overlay');
    if (!modal || !confirmBtn) return;

    const closeModal = () => {
        modal.classList.add('hidden');
        cancellingPaymentId = null;
    };

    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);

    confirmBtn.addEventListener('click', async () => {
        if (!cancellingPaymentId) return;
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Скасування...';

        try {
            const response = await apiFetch(`/leases/payments/${cancellingPaymentId}/cancel`, {
                method: 'POST'
            });

            if (response.ok) {
                const cancelled = await response.json();
                showToast('Виплату скасовано', 'success');
                closeModal();
                await loadPayments();
                if (cancelled.payment_type === 'grain') {
                    await loadStock();
                    await loadStockAdjustments();
                } else {
                    await loadCashBalance();
                    await loadCashTransactions();
                }
            } else {
                const error = await response.json().catch(() => null);
                showToast(error?.detail || 'Не вдалося скасувати виплату', 'error');
            }
        } catch (err) {
            console.error('Помилка скасування виплати:', err);
            showToast('Помилка скасування виплати', 'error');
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Так, скасувати';
        }
    });
}

function initPayments() {
    const addBtn = document.getElementById('payment-add-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => openPaymentAddModal());
    }
    initPaymentModal();
    initPaymentCancelModal();
    initPaymentsFilter();
    initPaymentsReportModal();
}

function openPaymentAddModal() {
    document.getElementById('payment-form').reset();
    document.getElementById('payment-contract').value = '';
    document.getElementById('payment-type').value = 'grain';
    document.getElementById('payment-currency').value = 'UAH';
    document.getElementById('payment-rate').value = '';
    document.getElementById('payment-rate-field').classList.add('hidden');
    paymentBalance = null;
    document.getElementById('payment-balance-card').classList.add('hidden');
    document.getElementById('payment-grain-items-list').innerHTML =
        '<div class="grain-items-placeholder">Оберіть контракт</div>';
    updatePaymentFields();
    setFormMessage('payment-message', '', false);
    updatePaymentContractSelect();

    document.getElementById('payment-modal').classList.remove('hidden');

    setTimeout(() => {
        const contractSelect = document.getElementById('payment-contract');
        const typeSelect = document.getElementById('payment-type');
        if (contractSelect && typeof initCustomSelects === 'function') initCustomSelects(contractSelect);
        if (typeSelect && typeof initCustomSelects === 'function') initCustomSelects(typeSelect);
    }, 100);
}

async function onPaymentContractChange() {
    const contractId = document.getElementById('payment-contract').value;
    const balanceCard = document.getElementById('payment-balance-card');
    const grainList = document.getElementById('payment-grain-items-list');

    if (!contractId) {
        balanceCard.classList.add('hidden');
        paymentBalance = null;
        if (grainList) grainList.innerHTML =
            '<div class="grain-items-placeholder">Оберіть контракт</div>';
        return;
    }

    try {
        const response = await apiFetch(`/leases/contracts/${contractId}/balance`);
        if (!response.ok) throw new Error();
        paymentBalance = await response.json();
        renderPaymentBalance();
        populatePaymentGrainItems();
        populatePaymentCashCulture();
        balanceCard.classList.remove('hidden');
    } catch (e) {
        console.error('Помилка завантаження залишку', e);
        paymentBalance = null;
        balanceCard.classList.add('hidden');
    }
}

function renderPaymentBalance() {
    if (!paymentBalance) return;
    const periodEl = document.getElementById('payment-balance-period');
    const itemsEl = document.getElementById('payment-balance-items');

    const fmtDate = (s) => {
        const d = new Date(s);
        return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    periodEl.textContent = `${fmtDate(paymentBalance.period_start)} — ${fmtDate(paymentBalance.period_end)} (рік ${paymentBalance.period_number})`;

    itemsEl.innerHTML = paymentBalance.items.map(item => {
        const pct = item.annual_quantity_kg > 0
            ? Math.round((item.paid_kg / item.annual_quantity_kg) * 100) : 0;
        const allPaid = item.remaining_kg <= 0;
        return `
            <div class="balance-item${allPaid ? ' balance-item-done' : ''}">
                <div class="balance-item-header">
                    <span class="balance-culture-name">${item.culture_name}</span>
                    <span class="balance-culture-stats">${item.paid_kg} / ${item.annual_quantity_kg} кг</span>
                </div>
                <div class="balance-bar">
                    <div class="balance-bar-fill${allPaid ? ' balance-bar-done' : ''}" style="width: ${Math.min(pct, 100)}%"></div>
                </div>
                <div class="balance-item-footer">
                    ${allPaid
                        ? '<span style="color:var(--primary)">✓ Повністю виплачено</span>'
                        : `Залишок: <strong>${item.remaining_kg} кг</strong> (${item.remaining_cash_uah} грн)`
                    }
                </div>
            </div>
        `;
    }).join('');
}

function populatePaymentGrainItems() {
    if (!paymentBalance) return;
    const list = document.getElementById('payment-grain-items-list');
    if (!list) return;

    const available = paymentBalance.items.filter(item => item.remaining_kg > 0);

    if (available.length === 0) {
        list.innerHTML = '<div class="grain-items-done">✓ Усе виплачено за цей період</div>';
        return;
    }

    list.innerHTML = available.map(item => {
        const pct = item.annual_quantity_kg > 0
            ? Math.round((item.paid_kg / item.annual_quantity_kg) * 100) : 0;
        return `
        <div class="grain-pay-card" data-culture-id="${item.culture_id}">
            <div class="grain-pay-header">
                <span class="grain-pay-name">${item.culture_name}</span>
                <span class="grain-pay-stats">${formatWeight(item.paid_kg)} / ${formatWeight(item.annual_quantity_kg)} кг</span>
            </div>
            <div class="grain-pay-bar">
                <div class="grain-pay-bar-fill" style="width: ${Math.min(pct, 100)}%"></div>
            </div>
            <div class="grain-pay-input-row">
                <input type="number" class="grain-item-quantity"
                       min="0" max="${item.remaining_kg}" step="0.01"
                       placeholder="0" data-max="${item.remaining_kg}">
                <span class="grain-pay-separator">із</span>
                <span class="grain-pay-max">${formatWeight(item.remaining_kg)} кг</span>
            </div>
        </div>`;
    }).join('');
}

function populatePaymentCashCulture() {
    if (!paymentBalance) return;
    const select = document.getElementById('payment-cash-culture');
    if (!select) return;

    select.innerHTML = '<option value="">Оберіть культуру</option>' +
        paymentBalance.items
            .filter(item => item.remaining_kg > 0)
            .map(item => `<option value="${item.culture_id}"
                data-remaining-kg="${item.remaining_kg}"
                data-price="${item.price_per_kg_uah}"
                data-max-cash="${item.remaining_cash_uah}">
                ${item.culture_name} (залишок: ${item.remaining_kg} кг)
            </option>`).join('');

    if (typeof initCustomSelects === 'function') {
        setTimeout(() => initCustomSelects(select), 50);
    }
    updatePaymentCashEquivalent();
}

function updatePaymentCashEquivalent() {
    const select = document.getElementById('payment-cash-culture');
    const amountInput = document.getElementById('payment-amount');
    const equivEl = document.getElementById('payment-cash-equivalent');
    const uahEquivEl = document.getElementById('payment-uah-equiv');
    const currencySelect = document.getElementById('payment-currency');
    const rateInput = document.getElementById('payment-rate');
    if (!select || !amountInput || !equivEl) return;

    const currency = currencySelect ? currencySelect.value : 'UAH';
    const opt = select.options[select.selectedIndex];

    // Инлайн эквивалент под полем суммы (для валюты)
    if (uahEquivEl) {
        const rate = rateInput ? (parseFloat(rateInput.value) || 0) : 0;
        const amount = parseFloat(amountInput.value) || 0;
        if (currency !== 'UAH' && rate > 0 && amount > 0) {
            const uahTotal = amount * rate;
            uahEquivEl.innerHTML = `= <strong>${formatWeight(uahTotal)} грн</strong>`;
            uahEquivEl.classList.remove('hidden');
        } else if (currency !== 'UAH' && rate > 0) {
            uahEquivEl.innerHTML = `1 ${currency} = ${formatWeight(rate)} грн`;
            uahEquivEl.classList.remove('hidden');
        } else {
            uahEquivEl.classList.add('hidden');
        }
    }

    if (!opt || !opt.value) {
        equivEl.innerHTML = '';
        amountInput.max = '';
        return;
    }

    const remainingKg = parseFloat(opt.dataset.remainingKg);
    const price = parseFloat(opt.dataset.price);
    const maxCash = parseFloat(opt.dataset.maxCash);
    const amount = parseFloat(amountInput.value) || 0;
    const rate = rateInput ? (parseFloat(rateInput.value) || 0) : 0;

    // Сума в гривнях
    const amountUah = currency === 'UAH' ? amount : amount * rate;

    if (currency === 'UAH') {
        amountInput.max = maxCash;
    } else if (rate > 0) {
        amountInput.max = (maxCash / rate).toFixed(2);
    } else {
        amountInput.removeAttribute('max');
    }

    if (currency === 'UAH') {
        if (amount > 0 && price > 0) {
            const equivKg = (amount / price).toFixed(2);
            const overLimit = parseFloat(equivKg) > remainingKg;
            equivEl.innerHTML = `Еквівалент: <strong${overLimit ? ' style="color:var(--danger)"' : ''}>${equivKg} кг</strong> з ${formatWeight(remainingKg)} кг залишку (${formatWeight(price)} грн/кг)`;
        } else {
            equivEl.innerHTML = `Максимум: <strong>${formatWeight(maxCash)} грн</strong> (${formatWeight(remainingKg)} кг × ${formatWeight(price)} грн/кг)`;
        }
    } else {
        if (rate > 0 && amount > 0 && price > 0) {
            const uahTotal = amount * rate;
            const equivKg = (amountUah / price).toFixed(2);
            const overLimit = parseFloat(equivKg) > remainingKg;
            equivEl.innerHTML = `${formatWeight(uahTotal)} грн → <strong${overLimit ? ' style="color:var(--danger)"' : ''}>${equivKg} кг</strong> з ${formatWeight(remainingKg)} кг залишку`;
        } else if (rate > 0) {
            const maxForeign = (maxCash / rate).toFixed(2);
            equivEl.innerHTML = `Максимум: <strong>${formatWeight(parseFloat(maxForeign))} ${currency}</strong> (${formatWeight(maxCash)} грн за курсом ${formatWeight(rate)})`;
        } else {
            equivEl.innerHTML = `<span style="color:var(--warning)">Вкажіть курс ${currency} до грн</span>`;
        }
    }
}

function initPaymentModal() {
    const modal = document.getElementById('payment-modal');
    const form = document.getElementById('payment-form');
    const closeBtn = document.getElementById('payment-modal-close');
    const overlay = modal?.querySelector('.modal-overlay');
    const paymentTypeSelect = document.getElementById('payment-type');
    const contractSelect = document.getElementById('payment-contract');
    const cashCultureSelect = document.getElementById('payment-cash-culture');
    const cashAmountInput = document.getElementById('payment-amount');
    const currencySelect = document.getElementById('payment-currency');
    if (!modal || !form || !closeBtn || !overlay) return;

    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    overlay.addEventListener('click', () => modal.classList.add('hidden'));

    // При выборе контракта — загрузить баланс
    if (contractSelect) {
        contractSelect.addEventListener('change', onPaymentContractChange);
    }

    if (paymentTypeSelect) {
        paymentTypeSelect.addEventListener('change', updatePaymentFields);
    }

    // Обновлять эквивалент при изменении культуры/суммы/валюты
    if (cashCultureSelect) {
        cashCultureSelect.addEventListener('change', updatePaymentCashEquivalent);
    }
    if (cashAmountInput) {
        cashAmountInput.addEventListener('input', updatePaymentCashEquivalent);
    }
    if (currencySelect) {
        currencySelect.addEventListener('change', () => {
            const rateField = document.getElementById('payment-rate-field');
            const rateInput = document.getElementById('payment-rate');
            if (currencySelect.value === 'UAH') {
                rateField.classList.add('hidden');
                rateInput.value = '';
            } else {
                rateField.classList.remove('hidden');
            }
            updatePaymentCashEquivalent();
        });
    }
    const rateInput = document.getElementById('payment-rate');
    if (rateInput) {
        rateInput.addEventListener('input', updatePaymentCashEquivalent);
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const contractId = document.getElementById('payment-contract').value;
        const paymentType = document.getElementById('payment-type').value;
        const note = document.getElementById('payment-note').value.trim();

        if (!contractId) {
            setFormMessage('payment-message', 'Виберіть контракт', true);
            return;
        }
        if (!paymentBalance) {
            setFormMessage('payment-message', 'Зачекайте, завантажується залишок', true);
            return;
        }

        const payload = {
            contract_id: parseInt(contractId),
            payment_type: paymentType,
            payment_date: new Date().toISOString(),
            note: note || null,
            grain_items: []
        };

        if (paymentType === 'grain') {
            const rows = document.querySelectorAll('#payment-grain-items-list .grain-pay-card');
            for (const row of rows) {
                const cultureId = row.dataset.cultureId;
                const input = row.querySelector('.grain-item-quantity');
                const qty = parseFloat(input.value);
                if (isNaN(qty) || qty <= 0) continue;

                const maxQty = parseFloat(input.dataset.max);
                if (qty > maxQty + 0.01) {
                    setFormMessage('payment-message',
                        `Перевищено залишок: макс. ${maxQty} кг`, true);
                    return;
                }
                payload.grain_items.push({
                    culture_id: parseInt(cultureId),
                    quantity_kg: qty
                });
            }
            if (payload.grain_items.length === 0) {
                setFormMessage('payment-message',
                    'Вкажіть кількість хоча б для однієї культури', true);
                return;
            }
        } else {
            // Cash
            const cultureId = document.getElementById('payment-cash-culture').value;
            const amount = parseFloat(document.getElementById('payment-amount').value);
            const currency = document.getElementById('payment-currency').value;
            const rate = parseFloat(document.getElementById('payment-rate').value) || 0;

            if (!cultureId) {
                setFormMessage('payment-message', 'Виберіть культуру', true);
                return;
            }
            if (isNaN(amount) || amount <= 0) {
                setFormMessage('payment-message', 'Вкажіть суму', true);
                return;
            }
            if (currency !== 'UAH' && (!rate || rate <= 0)) {
                setFormMessage('payment-message', `Вкажіть курс ${currency} до грн`, true);
                return;
            }

            const amountUah = currency === 'UAH' ? amount : amount * rate;

            const balItem = paymentBalance.items.find(i => i.culture_id == cultureId);
            if (!balItem) {
                setFormMessage('payment-message', 'Культуру не знайдено', true);
                return;
            }
            const equivKg = balItem.price_per_kg_uah > 0
                ? amountUah / balItem.price_per_kg_uah : 0;
            if (equivKg > balItem.remaining_kg + 0.01) {
                const maxMsg = currency === 'UAH'
                    ? `макс. ${balItem.remaining_cash_uah} грн`
                    : `макс. ${(balItem.remaining_cash_uah / rate).toFixed(2)} ${currency}`;
                setFormMessage('payment-message',
                    `Сума перевищує залишок: ${maxMsg}`, true);
                return;
            }

            payload.currency = currency;
            payload.amount = amount;
            payload.grain_items.push({
                culture_id: parseInt(cultureId),
                quantity_kg: parseFloat(equivKg.toFixed(2))
            });
        }

        const response = await apiFetch('/leases/payments', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showToast('Виплату додано', 'success');
            paymentBalance = null;
            document.getElementById('payment-balance-card').classList.add('hidden');
            modal.classList.add('hidden');
            await loadPayments();
            // Оновити склад та касу, бо виплата списує з них
            if (paymentType === 'grain') {
                await loadStock();
                await loadStockAdjustments();
            } else {
                await loadCashBalance();
                await loadCashTransactions();
            }
        } else {
            const error = await response.json().catch(() => null);
            setFormMessage('payment-message', error?.detail || 'Помилка збереження', true);
        }
    });
}

function updatePaymentFields() {
    const paymentType = document.getElementById('payment-type').value;
    const grainFields = document.getElementById('payment-grain-fields');
    const cashFields = document.getElementById('payment-cash-fields');

    if (paymentType === 'grain') {
        grainFields.classList.remove('hidden');
        cashFields.classList.add('hidden');
    } else {
        grainFields.classList.add('hidden');
        cashFields.classList.remove('hidden');
        updatePaymentCashEquivalent();
    }
}

function updatePaymentContractSelect() {
    const select = document.getElementById('payment-contract');
    if (!select || !contractsCache.length) return;
    select.innerHTML = '<option value="">Оберіть контракт</option>' +
        contractsCache
            .filter(c => c.is_active)
            .map(c => `<option value="${c.id}">${c.landlord_full_name} — ${c.field_name}</option>`)
            .join('');
}


function formatDateInput(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const dateString = now.toLocaleDateString('uk-UA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    document.getElementById('current-time').textContent =
        `${dateString} - ${timeString}`;
}

// ===== Filters for Landlords / Contracts / Payments =====

function initLandlordsFilter() {
    const searchInput = document.getElementById('landlords-filter-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => renderLandlordsTable());
    }
}

function initContractsFilter() {
    const landlordSel = document.getElementById('contracts-filter-landlord');
    const statusSel = document.getElementById('contracts-filter-status');
    if (landlordSel) landlordSel.addEventListener('change', () => renderContractsTable());
    if (statusSel) statusSel.addEventListener('change', () => renderContractsTable());
}

function updateContractsFilterLandlords() {
    const sel = document.getElementById('contracts-filter-landlord');
    if (!sel) return;
    const val = sel.value;
    sel.innerHTML = '<option value="">Всі орендодавці</option>' +
        landlordsCache.map(l => `<option value="${l.id}">${l.full_name}</option>`).join('');
    sel.value = val;
    refreshCustomSelect(sel);
}

function initPaymentsFilter() {
    const landlordSel = document.getElementById('payments-filter-landlord');
    const typeSel = document.getElementById('payments-filter-type');
    const statusSel = document.getElementById('payments-filter-status');
    if (landlordSel) landlordSel.addEventListener('change', () => renderPaymentsTable());
    if (typeSel) typeSel.addEventListener('change', () => renderPaymentsTable());
    if (statusSel) statusSel.addEventListener('change', () => renderPaymentsTable());
}

function updatePaymentsFilterLandlords() {
    const sel = document.getElementById('payments-filter-landlord');
    if (!sel) return;
    const val = sel.value;
    sel.innerHTML = '<option value="">Всі орендодавці</option>' +
        landlordsCache.map(l => `<option value="${l.id}">${l.full_name}</option>`).join('');
    sel.value = val;
    refreshCustomSelect(sel);
}

// ===== Report modals =====

function initLandlordsReportModal() {
    const modal = document.getElementById('landlords-report-modal');
    const openBtn = document.getElementById('landlords-report-btn');
    const closeBtn = document.getElementById('landlords-report-close');
    const cancelBtn = document.getElementById('landlords-report-cancel');
    const downloadBtn = document.getElementById('landlords-report-download');
    const overlay = modal?.querySelector('.modal-overlay');
    const searchInput = document.getElementById('landlords-report-search');
    const suggestions = document.getElementById('landlords-report-suggestions');
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
                const matches = landlordsCache.filter(l =>
                    l.full_name.toLowerCase().includes(value.toLowerCase())
                );
                suggestions.innerHTML = '';
                if (!matches.length) {
                    suggestions.classList.add('hidden');
                    return;
                }
                matches.forEach(l => {
                    const item = document.createElement('div');
                    item.className = 'suggestion-item';
                    item.textContent = l.full_name;
                    item.addEventListener('click', () => {
                        searchInput.value = l.full_name;
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
        const path = `/leases/landlords/export${params.toString() ? `?${params}` : ''}`;
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
        link.download = 'landlords_report.xlsx';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showToast('Звіт сформовано', 'success');
        closeModal();
    });
}

function initContractsReportModal() {
    const modal = document.getElementById('contracts-report-modal');
    const openBtn = document.getElementById('contracts-report-btn');
    const closeBtn = document.getElementById('contracts-report-close');
    const cancelBtn = document.getElementById('contracts-report-cancel');
    const downloadBtn = document.getElementById('contracts-report-download');
    const overlay = modal?.querySelector('.modal-overlay');
    const startInput = document.getElementById('contracts-report-start');
    const endInput = document.getElementById('contracts-report-end');
    const startNative = document.getElementById('contracts-report-start-native');
    const endNative = document.getElementById('contracts-report-end-native');
    const startBtn = document.getElementById('contracts-report-start-btn');
    const endBtn = document.getElementById('contracts-report-end-btn');
    if (!modal || !openBtn || !downloadBtn) return;

    const openModal = () => modal.classList.remove('hidden');
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
        const statusVal = document.getElementById('contracts-report-status')?.value;
        if (statusVal) params.append('is_active', statusVal);
        if (startIso) params.append('start_date', startIso);
        if (endIso) params.append('end_date', endIso);

        const path = `/leases/contracts/export${params.toString() ? `?${params}` : ''}`;
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
        link.download = 'contracts_report.xlsx';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showToast('Звіт сформовано', 'success');
        closeModal();
    });
}

function initPaymentsReportModal() {
    const modal = document.getElementById('payments-report-modal');
    const openBtn = document.getElementById('payments-report-btn');
    const closeBtn = document.getElementById('payments-report-close');
    const cancelBtn = document.getElementById('payments-report-cancel');
    const downloadBtn = document.getElementById('payments-report-download');
    const overlay = modal?.querySelector('.modal-overlay');
    const startInput = document.getElementById('payments-report-start');
    const endInput = document.getElementById('payments-report-end');
    const startNative = document.getElementById('payments-report-start-native');
    const endNative = document.getElementById('payments-report-end-native');
    const startBtn = document.getElementById('payments-report-start-btn');
    const endBtn = document.getElementById('payments-report-end-btn');
    if (!modal || !openBtn || !downloadBtn) return;

    const openModal = async () => {
        // Якщо кеш порожній — перезавантажити орендодавців
        if (!landlordsCache.length) {
            const resp = await apiFetch('/leases/landlords');
            if (resp.ok) landlordsCache = await resp.json();
        }
        const landlordSel = document.getElementById('payments-report-landlord');
        if (landlordSel) {
            landlordSel.innerHTML = '<option value="">Всі</option>' +
                landlordsCache.map(l => `<option value="${l.id}">${l.full_name}</option>`).join('');
            refreshCustomSelect(landlordSel);
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
        const landlordId = document.getElementById('payments-report-landlord')?.value;
        const typeVal = document.getElementById('payments-report-type')?.value;
        const showCancelled = document.getElementById('payments-report-show-cancelled')?.checked;
        if (landlordId) params.append('landlord_id', landlordId);
        if (typeVal) params.append('payment_type', typeVal);
        if (startIso) params.append('start_date', startIso);
        if (endIso) params.append('end_date', endIso);
        if (showCancelled) params.append('show_cancelled', 'true');

        const path = `/leases/payments/export${params.toString() ? `?${params}` : ''}`;
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
        link.download = 'payments_report.xlsx';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showToast('Звіт сформовано', 'success');
        closeModal();
    });
}

// ═══════════════════════════════════════════════════════════
// ═════ Хлібний завод (Талони на зерно) ═════
// ═══════════════════════════════════════════════════════════

let vouchersCache = [];
let voucherPaymentsCache = [];
let currentVoucherPaymentId = null;

async function loadVouchersData() {
    try {
        const [vResp, pResp, sResp] = await Promise.all([
            apiFetch('/vouchers'),
            apiFetch('/vouchers/payments'),
            apiFetch('/vouchers/summary')
        ]);
        vouchersCache = vResp.ok ? await vResp.json() : [];
        voucherPaymentsCache = pResp.ok ? await pResp.json() : [];
        const summary = sResp.ok ? await sResp.json() : null;
        renderVoucherStats(summary);
        renderVouchersTable();
        renderVoucherPaymentsTable();
    } catch (e) {
        console.error('Помилка завантаження талонів:', e);
    }
}

function renderVoucherStats(s) {
    if (!s) return;
    const el = (id, val) => {
        const e = document.getElementById(id);
        if (e) e.textContent = val;
    };
    el('v-stat-count', s.vouchers_count);
    el('v-stat-qty', formatAmount(s.total_quantity_kg));
    el('v-stat-remaining', formatAmount(s.total_remaining_uah));
    el('v-stat-paid', formatAmount(s.total_paid_uah));

    // Disable pay button if nothing to pay
    const payBtn = document.getElementById('voucher-pay-total-btn');
    if (payBtn) {
        payBtn.disabled = s.total_remaining_uah <= 0.01;
    }
}

function renderVouchersTable() {
    const tbody = document.querySelector('#vouchers-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!vouchersCache.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="table-empty-message">Талонів ще немає</td></tr>';
        return;
    }
    vouchersCache.forEach(v => {
        const tr = document.createElement('tr');
        const dateStr = v.created_at ? new Date(v.created_at).toLocaleDateString('uk-UA') : '—';
        tr.innerHTML = `
            <td class="td-mono">${v.id}</td>
            <td><a href="#" class="td-link link-contract" data-contract-id="${v.farmer_contract_id}">#${v.farmer_contract_id}</a></td>
            <td><strong>${v.owner_name}</strong></td>
            <td class="td-weight">${formatAmount(v.quantity_kg)} кг</td>
            <td class="td-mono">${formatAmount(v.price_per_kg)} ₴/кг</td>
            <td class="td-weight">${formatAmount(v.total_value_uah)} ₴</td>
            <td>${dateStr}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderVoucherPaymentsTable() {
    const tbody = document.querySelector('#voucher-payments-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!voucherPaymentsCache.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="table-empty-message">Виплат ще немає</td></tr>';
        return;
    }
    voucherPaymentsCache.forEach(p => {
        const tr = document.createElement('tr');
        if (p.is_cancelled) tr.classList.add('row-cancelled');
        const dateStr = p.created_at ? new Date(p.created_at).toLocaleDateString('uk-UA') : '—';
        const currSymbols = { UAH: '₴', USD: '$', EUR: '€' };
        const currSymbol = currSymbols[p.currency] || p.currency;
        tr.innerHTML = `
            <td class="td-mono">${p.id}</td>
            <td><strong>${p.currency}</strong></td>
            <td class="td-weight">${formatAmount(p.amount)} ${currSymbol}</td>
            <td class="td-mono">${p.exchange_rate != 1 ? formatAmount(p.exchange_rate) : '—'}</td>
            <td class="td-weight">${formatAmount(p.amount_uah)} ₴</td>
            <td>${p.description || '<span class="td-secondary">—</span>'}</td>
            <td>${p.created_by}</td>
            <td>${dateStr}</td>
            <td class="actions-cell">
                ${!p.is_cancelled
                    ? `<button class="btn-icon btn-icon-danger vp-cancel-btn" data-payment-id="${p.id}" title="Скасувати">${ICONS.cancel}</button>`
                    : '<span class="status-badge danger">Скасовано</span>'}
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Bind cancel buttons
    tbody.querySelectorAll('.vp-cancel-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentVoucherPaymentId = parseInt(btn.dataset.paymentId);
            document.getElementById('voucher-cancel-modal')?.classList.remove('hidden');
        });
    });
}

async function openVoucherPaymentModal() {
    // Fetch current total remaining
    try {
        const resp = await apiFetch('/vouchers/summary');
        if (resp.ok) {
            const s = await resp.json();
            const remainEl = document.getElementById('vp-total-remaining');
            if (remainEl) remainEl.textContent = formatAmount(s.total_remaining_uah) + ' грн';
        }
    } catch (e) { /* ignore */ }

    document.getElementById('vp-currency').value = 'UAH';
    document.getElementById('vp-exchange-rate').value = '1';
    document.getElementById('vp-exchange-rate').readOnly = true;
    document.getElementById('vp-amount').value = '';
    document.getElementById('vp-amount-uah').value = '';
    document.getElementById('vp-description').value = '';

    document.getElementById('voucher-payment-modal')?.classList.remove('hidden');
}

function initVouchers() {
    // Open payment modal from the main button
    const payTotalBtn = document.getElementById('voucher-pay-total-btn');
    if (payTotalBtn) {
        payTotalBtn.addEventListener('click', () => openVoucherPaymentModal());
    }

    // Payment modal — auto-calculate UAH amount
    const amountInput = document.getElementById('vp-amount');
    const rateInput = document.getElementById('vp-exchange-rate');
    const currencySelect = document.getElementById('vp-currency');
    const amountUahDisplay = document.getElementById('vp-amount-uah');

    function updateAmountUah() {
        const amount = parseFloat(amountInput?.value) || 0;
        const rate = parseFloat(rateInput?.value) || 1;
        if (amountUahDisplay) {
            amountUahDisplay.value = formatAmount(amount * rate) + ' грн';
        }
    }

    if (amountInput) amountInput.addEventListener('input', updateAmountUah);
    if (rateInput) rateInput.addEventListener('input', updateAmountUah);
    if (currencySelect) {
        currencySelect.addEventListener('change', () => {
            if (currencySelect.value === 'UAH') {
                rateInput.value = '1';
                rateInput.readOnly = true;
            } else {
                rateInput.readOnly = false;
            }
            updateAmountUah();
        });
    }

    const hidePaymentModal = () => document.getElementById('voucher-payment-modal')?.classList.add('hidden');
    const hideCancelModal = () => document.getElementById('voucher-cancel-modal')?.classList.add('hidden');

    // Payment modal — close & overlay
    const closeBtn = document.getElementById('voucher-payment-close');
    const cancelBtn = document.getElementById('voucher-payment-cancel-btn');
    const payOverlay = document.querySelector('#voucher-payment-modal .modal-overlay');
    if (closeBtn) closeBtn.addEventListener('click', hidePaymentModal);
    if (cancelBtn) cancelBtn.addEventListener('click', hidePaymentModal);
    if (payOverlay) payOverlay.addEventListener('click', hidePaymentModal);

    const cancelOverlay = document.querySelector('#voucher-cancel-modal .modal-overlay');
    if (cancelOverlay) cancelOverlay.addEventListener('click', hideCancelModal);

    // Payment modal — confirm (pays from total debt, not specific voucher)
    const confirmBtn = document.getElementById('voucher-payment-confirm-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            const currency = document.getElementById('vp-currency').value;
            const amount = parseFloat(document.getElementById('vp-amount').value);
            const exchangeRate = parseFloat(document.getElementById('vp-exchange-rate').value) || 1;
            const description = document.getElementById('vp-description').value;

            if (!amount || amount <= 0) {
                showToast('Вкажіть суму', 'error');
                return;
            }

            confirmBtn.disabled = true;
            try {
                const resp = await apiFetch('/vouchers/payments', {
                    method: 'POST',
                    body: JSON.stringify({
                        currency,
                        amount,
                        exchange_rate: exchangeRate,
                        description: description || null
                    })
                });
                if (!resp.ok) {
                    const err = await resp.json().catch(() => null);
                    showToast(err?.detail || 'Помилка створення виплати', 'error');
                    return;
                }
                const result = await resp.json();
                showToast(result.message || 'Виплату створено', 'success');
                hidePaymentModal();
                await loadVouchersData();
                await loadCashBalance();
            } catch (e) {
                showToast(e.message || 'Помилка', 'error');
            } finally {
                confirmBtn.disabled = false;
            }
        });
    }

    // Cancel payment modal
    const cancelCloseBtn = document.getElementById('voucher-cancel-close');
    const cancelNoBtn = document.getElementById('voucher-cancel-no-btn');
    const cancelYesBtn = document.getElementById('voucher-cancel-yes-btn');

    if (cancelCloseBtn) cancelCloseBtn.addEventListener('click', hideCancelModal);
    if (cancelNoBtn) cancelNoBtn.addEventListener('click', hideCancelModal);
    if (cancelYesBtn) {
        cancelYesBtn.addEventListener('click', async () => {
            if (!currentVoucherPaymentId) return;
            cancelYesBtn.disabled = true;
            try {
                const resp = await apiFetch(`/vouchers/payments/${currentVoucherPaymentId}/cancel`, {
                    method: 'POST'
                });
                if (!resp.ok) {
                    const err = await resp.json().catch(() => null);
                    showToast(err?.detail || 'Помилка скасування', 'error');
                    return;
                }
                const result = await resp.json();
                showToast(result.message || 'Виплату скасовано', 'success');
                hideCancelModal();
                await loadVouchersData();
                await loadCashBalance();
            } catch (e) {
                showToast(e.message || 'Помилка', 'error');
            } finally {
                cancelYesBtn.disabled = false;
                currentVoucherPaymentId = null;
            }
        });
    }
}
