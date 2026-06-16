// ═══════════════════════════════════════════════════════════
// Оренда землі: орендодавці → ділянки (parcels) → роки (periods) → виплати.
// Одна картка орендодавця містить кілька ділянок; у кожній ділянці —
// річні періоди (вкладки), баланс накопичувальний. Залежності з dashboard.js:
// populateLandlordSelect, refreshAfterMutation, bindDatePicker, parseDateInput,
// formatDateInput, formatDateOnly, formatDate, initCustomSelects,
// refreshCustomSelect, culturesCache, ICONS і core-утиліти
// (apiFetch, apiFetchBlob, showToast, escapeHtml, emptyValueHtml, formatWeight,
//  formatAmount, setFormMessage, clearFormValidationState, formShowValidationError,
//  formBindInvalidHighlightClearing).
// cancelPayment(...) викликається з HTML onclick — лишається глобальною.
// ═══════════════════════════════════════════════════════════

let landlordsCache = [];
let parcelsCache = [];
let paymentsCache = [];
let editingLandlordId = null;
let deletingLandlordId = null;
let editingParcelId = null;
let cancellingPaymentId = null;
let onLandlordCreated = null;   // hook: викликається після створення орендодавця (inline «+ Новий»)

// Стан картки орендодавця
let cardLandlordId = null;
let cardParcels = [];
let cardPayments = [];
let cardActivePeriod = {};   // parcelId -> periodId

const TERMS_LABEL = { grain: 'Лише зерно', cash: 'Лише гроші', grain_cash: 'Гроші + зерно' };
const TERMS_BADGE = {
    grain: '<span class="inline-badge grain">Зерно</span>',
    cash: '<span class="inline-badge cash">Гроші</span>',
    grain_cash: '<span class="inline-badge grain">Зерно</span> <span class="inline-badge cash">Гроші</span>',
};

function getCultureName(cultureId) {
    const found = (culturesCache || []).find(c => c.id === cultureId);
    return found ? found.name : '-';
}

// Годинник у шапці (викликається з dashboard.js initializeDashboard)
function updateTime() {
    const el = document.getElementById('current-time');
    if (!el) return;
    const now = new Date();
    const timeString = now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateString = now.toLocaleDateString('uk-UA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    el.textContent = `${dateString} - ${timeString}`;
}

function getCulturePrice(cultureId) {
    const found = (culturesCache || []).find(c => c.id === cultureId);
    return found ? (found.price_per_kg || 1) : 1;
}

// ═══════════════ Орендодавці ═══════════════

async function loadLandlords() {
    const response = await apiFetch('/leases/landlords');
    if (!response.ok) {
        console.error('Помилка завантаження орендодавців');
        return;
    }
    landlordsCache = await response.json();
    renderLandlordsTable();
    updatePaymentsFilterLandlords();
    ['parcel-landlord-select', 'payment-landlord-select'].forEach(id => {
        if (document.getElementById(id) && typeof populateLandlordSelect === 'function') {
            populateLandlordSelect(id);
        }
    });
}

function renderLandlordsTable() {
    const tableBody = document.querySelector('#landlords-table tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    const searchVal = (document.getElementById('landlords-filter-search')?.value || '').toLowerCase();
    const fStatus = document.getElementById('landlords-filter-status')?.value || '';

    // Агрегати по ділянках (кількість + накопич. борг) на орендодавця
    const agg = {};
    (parcelsCache || []).forEach(p => {
        const a = agg[p.landlord_id] || (agg[p.landlord_id] = { count: 0, debt: 0 });
        a.count++;
        a.debt += (p.cumulative_balance_uah || 0);
    });

    let filtered = landlordsCache.filter(l => !searchVal || l.full_name.toLowerCase().includes(searchVal));
    if (fStatus === 'due') filtered = filtered.filter(l => (agg[l.id]?.debt || 0) > 0.01);

    if (!filtered.length) {
        tableBody.innerHTML = '<tr><td colspan="5" class="table-empty-message">Орендодавців не знайдено</td></tr>';
        return;
    }
    filtered.forEach(landlord => {
        const a = agg[landlord.id] || { count: 0, debt: 0 };
        const hasDebt = a.debt > 0.01;
        const row = document.createElement('tr');
        if (hasDebt) row.classList.add('row-overdue');
        const balanceHtml = hasDebt
            ? `<strong style="color:var(--danger)">${formatAmount(a.debt)} грн</strong>`
            : (a.count ? '<span class="status-badge success">Виплачено</span>' : emptyValueHtml());
        row.innerHTML = `
            <td><strong>${escapeHtml(landlord.full_name)}</strong></td>
            <td>${landlord.phone ? escapeHtml(landlord.phone) : emptyValueHtml()}</td>
            <td>${a.count || 0}</td>
            <td>${balanceHtml}</td>
            <td class="actions-cell">
                <button class="btn-icon btn-icon-secondary" data-card="${landlord.id}" title="Відкрити картку">${ICONS.view}</button>
                <button class="btn-icon btn-icon-secondary" data-edit="${landlord.id}" title="Редагувати">${ICONS.edit}</button>
                <button class="btn-icon btn-icon-danger" data-delete="${landlord.id}" title="Видалити">${ICONS.delete}</button>
            </td>
        `;
        row.querySelector('[data-card]').addEventListener('click', () => openLandlordCard(landlord.id));
        row.querySelector('[data-edit]').addEventListener('click', () => openLandlordEditModal(landlord));
        row.querySelector('[data-delete]').addEventListener('click', () => openLandlordDeleteModal(landlord));
        tableBody.appendChild(row);
    });
}

function initLandlords() {
    document.getElementById('landlord-add-btn')?.addEventListener('click', openLandlordAddModal);
    initLandlordModal();
    initLandlordDeleteModal();
    initLandlordsFilter();
    initLandlordsReportModal();
}

function openLandlordAddModal() {
    editingLandlordId = null;
    document.getElementById('landlord-modal-title').textContent = 'Додати орендодавця';
    const lf = document.getElementById('landlord-form');
    if (lf) { clearFormValidationState(lf, 'landlord-message'); lf.reset(); }
    const lm = document.getElementById('landlord-modal');
    lm.style.zIndex = '';   // звичайне відкриття — скидаємо підняття z-index
    lm.classList.remove('hidden');
}

function openLandlordEditModal(landlord) {
    editingLandlordId = landlord.id;
    document.getElementById('landlord-modal-title').textContent = 'Редагувати орендодавця';
    document.getElementById('landlord-full-name').value = landlord.full_name;
    document.getElementById('landlord-phone').value = landlord.phone || '';
    const lf = document.getElementById('landlord-form');
    if (lf) clearFormValidationState(lf, 'landlord-message');
    document.getElementById('landlord-modal').classList.remove('hidden');
}

function initLandlordModal() {
    const modal = document.getElementById('landlord-modal');
    const form = document.getElementById('landlord-form');
    const closeBtn = document.getElementById('landlord-modal-close');
    const overlay = modal?.querySelector('.modal-overlay');
    if (!modal || !form || !closeBtn || !overlay) return;

    formBindInvalidHighlightClearing(form);
    const close = () => {
        clearFormValidationState(form, 'landlord-message');
        modal.classList.add('hidden');
        modal.style.zIndex = '';
        onLandlordCreated = null;
    };
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', close);
    document.getElementById('landlord-modal-cancel')?.addEventListener('click', close);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const fullName = document.getElementById('landlord-full-name').value.trim();
        const phone = document.getElementById('landlord-phone').value.trim();
        if (!fullName) {
            formShowValidationError(form, 'landlord-message', 'Вкажіть ПІБ', ['landlord-full-name']);
            return;
        }
        const wasEditing = editingLandlordId;
        const url = editingLandlordId ? `/leases/landlords/${editingLandlordId}` : '/leases/landlords';
        const method = editingLandlordId ? 'PATCH' : 'POST';
        const response = await apiFetch(url, { method, body: JSON.stringify({ full_name: fullName, phone: phone || null }) });
        if (response.ok) {
            const saved = await response.json().catch(() => null);
            const cb = onLandlordCreated;
            showToast(wasEditing ? 'Орендодавця оновлено' : 'Орендодавця додано', 'success');
            close();
            await refreshAfterMutation(['landlords', 'parcels', 'payments']);
            if (!wasEditing && cb && saved) cb(saved);   // inline-додавання: підставити нового у форму договору
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
    if (!modal || !closeBtn || !cancelBtn || !confirmBtn || !overlay) return;

    const close = () => { modal.classList.add('hidden'); deletingLandlordId = null; };
    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', close);

    confirmBtn.addEventListener('click', async () => {
        if (!deletingLandlordId) return;
        const response = await apiFetch(`/leases/landlords/${deletingLandlordId}`, { method: 'DELETE' });
        if (response.ok) {
            showToast('Орендодавця видалено', 'success');
            close();
            await refreshAfterMutation(['landlords', 'parcels', 'payments']);
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

// ═══════════════ Ділянки (parcels) ═══════════════

async function loadParcels() {
    const response = await apiFetch('/leases/parcels');
    if (!response.ok) { console.error('Помилка завантаження ділянок'); return; }
    parcelsCache = await response.json();
    renderLandlordsTable();   // картка-центрична: ділянки агрегуються в таблиці орендодавців
}

function initParcels() {
    document.getElementById('parcel-add-btn')?.addEventListener('click', () => openContractCreateModal());
    initParcelModal();
    initLandlordCardModal();
    initPeriodModal();
    initParcelsReportModal();
    initParcelsDebtReportBtn();
}

// ── Спільні хелпери «умов року» (використовують і форма договору, і модалка року) ──
function leaseAddGrainRow(tbody, item) {
    const tr = document.createElement('tr');
    tr.className = 'lease-grain-row';
    const opts = '<option value="">Культура</option>' +
        (culturesCache || []).map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    tr.innerHTML = `
        <td><select class="g-culture">${opts}</select></td>
        <td><input type="number" class="g-qty" min="0" step="0.01" placeholder="кг"></td>
        <td><input type="number" class="g-price" min="0" step="0.01" placeholder="грн/кг"></td>
        <td><button type="button" class="btn btn-danger btn-small g-remove">×</button></td>`;
    tbody.appendChild(tr);
    const sel = tr.querySelector('.g-culture');
    const qty = tr.querySelector('.g-qty');
    const price = tr.querySelector('.g-price');
    if (item) {
        sel.value = item.culture_id;
        qty.value = item.quantity_kg;
        price.value = (item.price_per_kg_uah != null ? item.price_per_kg_uah : '');
    }
    sel.addEventListener('change', () => { if (!price.value && sel.value) price.value = getCulturePrice(parseInt(sel.value)); });
    tr.querySelector('.g-remove').addEventListener('click', () => tr.remove());
    if (typeof initCustomSelects === 'function') setTimeout(() => initCustomSelects(sel), 30);
}

function leaseToggleRate(prefix) {
    const cur = document.getElementById(`${prefix}-cash-currency`).value;
    const field = document.getElementById(`${prefix}-cash-rate-field`);
    const input = document.getElementById(`${prefix}-cash-rate`);
    if (cur === 'UAH') { field.classList.add('hidden'); input.value = 1; }
    else field.classList.remove('hidden');
}

function leaseSetupYear(prefix, terms, period) {
    const showGrain = terms === 'grain' || terms === 'grain_cash';
    const showCash = terms === 'cash' || terms === 'grain_cash';
    document.getElementById(`${prefix}-grain-section`).classList.toggle('hidden', !showGrain);
    document.getElementById(`${prefix}-cash-section`).classList.toggle('hidden', !showCash);
    const tbody = document.getElementById(`${prefix}-grain-tbody`);
    tbody.innerHTML = '';
    if (showGrain) {
        const items = (period && period.grain_items && period.grain_items.length) ? period.grain_items : [null];
        items.forEach(it => leaseAddGrainRow(tbody, it));
    }
    if (showCash) {
        document.getElementById(`${prefix}-cash-amount`).value = period ? period.cash_amount : '';
        const cur = document.getElementById(`${prefix}-cash-currency`);
        cur.value = period ? (period.cash_currency || 'UAH') : 'UAH';
        document.getElementById(`${prefix}-cash-rate`).value = period ? (period.cash_rate || 1) : 1;
        if (typeof refreshCustomSelect === 'function') refreshCustomSelect(cur);
        leaseToggleRate(prefix);
    }
}

function leaseReadYear(prefix, terms, form, msgId, includeYear) {
    const showGrain = terms === 'grain' || terms === 'grain_cash';
    const showCash = terms === 'cash' || terms === 'grain_cash';
    const out = { cash_amount: 0, cash_currency: 'UAH', cash_rate: 1, grain_items: [] };
    if (includeYear) {
        const year = parseInt(document.getElementById(`${prefix}-year`).value);
        if (!year || year < 1900) { formShowValidationError(form, msgId, 'Вкажіть коректний рік', [`${prefix}-year`]); return null; }
        out.year = year;
    }
    if (showGrain) {
        const rows = document.querySelectorAll(`#${prefix}-grain-tbody .lease-grain-row`);
        for (const row of rows) {
            const cid = row.querySelector('.g-culture').value;
            const qty = parseFloat(row.querySelector('.g-qty').value);
            const price = parseFloat(row.querySelector('.g-price').value);
            if (!cid) continue;
            if (!qty || qty <= 0) { formShowValidationError(form, msgId, 'Вкажіть кількість для кожної культури', [], [row]); return null; }
            out.grain_items.push({ culture_id: parseInt(cid), quantity_kg: qty, price_per_kg_uah: (price && price > 0) ? price : null });
        }
        if (!out.grain_items.length) { formShowValidationError(form, msgId, 'Додайте хоча б одну культуру', [`${prefix}-add-grain`]); return null; }
    }
    if (showCash) {
        out.cash_amount = parseFloat(document.getElementById(`${prefix}-cash-amount`).value);
        out.cash_currency = document.getElementById(`${prefix}-cash-currency`).value;
        out.cash_rate = parseFloat(document.getElementById(`${prefix}-cash-rate`).value) || 1;
        if (!out.cash_amount || out.cash_amount <= 0) { formShowValidationError(form, msgId, 'Вкажіть річну грошову суму', [`${prefix}-cash-amount`]); return null; }
        if (out.cash_currency !== 'UAH' && (!out.cash_rate || out.cash_rate <= 0)) { formShowValidationError(form, msgId, `Вкажіть курс ${out.cash_currency} до грн`, [`${prefix}-cash-rate`]); return null; }
    }
    return out;
}

// Комбінована форма «Новий договір»: орендодавець + ділянка + перший рік разом
function openContractCreateModal(presetLandlordId = null) {
    editingParcelId = null;
    document.getElementById('parcel-modal-title').textContent = presetLandlordId ? 'Нова ділянка' : 'Новий договір';
    const form = document.getElementById('parcel-form');
    if (form) { clearFormValidationState(form, 'parcel-message'); form.reset(); }
    const sel = document.getElementById('parcel-landlord-select');
    if (sel) {
        if (typeof populateLandlordSelect === 'function') populateLandlordSelect('parcel-landlord-select');
        sel.value = presetLandlordId ? String(presetLandlordId) : '';
        sel.disabled = !!presetLandlordId;
        if (typeof refreshCustomSelect === 'function') refreshCustomSelect(sel);
    }
    document.getElementById('parcel-landlord-add-btn')?.classList.toggle('hidden', !!presetLandlordId);
    document.getElementById('parcel-terms').value = 'grain';
    if (typeof refreshCustomSelect === 'function') refreshCustomSelect(document.getElementById('parcel-terms'));
    const today = new Date();
    document.getElementById('parcel-start-date').value = formatDateInput(today);
    document.getElementById('parcel-start-date-native').value = today.toISOString().split('T')[0];
    document.getElementById('parcel-year').value = today.getFullYear();
    document.getElementById('parcel-year-section').classList.remove('hidden');
    leaseSetupYear('parcel', 'grain', null);
    document.getElementById('parcel-modal').classList.remove('hidden');
    setTimeout(() => {
        ['parcel-terms', 'parcel-cash-currency'].forEach(id => {
            const el = document.getElementById(id);
            if (el && typeof initCustomSelects === 'function') initCustomSelects(el);
        });
    }, 60);
}

function openParcelEditModal(parcel) {
    editingParcelId = parcel.id;
    document.getElementById('parcel-modal-title').textContent = 'Редагувати ділянку';
    const form = document.getElementById('parcel-form');
    if (form) clearFormValidationState(form, 'parcel-message');
    const sel = document.getElementById('parcel-landlord-select');
    if (sel) {
        if (typeof populateLandlordSelect === 'function') populateLandlordSelect('parcel-landlord-select');
        sel.value = String(parcel.landlord_id);
        sel.disabled = true;
        if (typeof refreshCustomSelect === 'function') refreshCustomSelect(sel);
    }
    document.getElementById('parcel-landlord-add-btn')?.classList.add('hidden');
    document.getElementById('parcel-area-ha').value = parcel.area_ha;
    document.getElementById('parcel-label').value = parcel.label || '';
    document.getElementById('parcel-terms').value = parcel.payment_terms;
    if (typeof refreshCustomSelect === 'function') refreshCustomSelect(document.getElementById('parcel-terms'));
    const d = new Date(parcel.start_date);
    document.getElementById('parcel-start-date').value = formatDateInput(d);
    document.getElementById('parcel-start-date-native').value = d.toISOString().split('T')[0];
    document.getElementById('parcel-note').value = parcel.note || '';
    document.getElementById('parcel-year-section').classList.add('hidden');   // редагування — лише метадані
    document.getElementById('parcel-modal').classList.remove('hidden');
}

function initParcelModal() {
    const modal = document.getElementById('parcel-modal');
    const form = document.getElementById('parcel-form');
    const closeBtn = document.getElementById('parcel-modal-close');
    const overlay = modal?.querySelector('.modal-overlay');
    const dateInput = document.getElementById('parcel-start-date');
    const dateNative = document.getElementById('parcel-start-date-native');
    const dateBtn = document.getElementById('parcel-start-date-btn');
    if (!modal || !form) return;

    formBindInvalidHighlightClearing(form);
    if (dateInput && dateNative && dateBtn) bindDatePicker(dateInput, dateNative, dateBtn);

    const close = () => {
        clearFormValidationState(form, 'parcel-message');
        modal.classList.add('hidden');
        const sel = document.getElementById('parcel-landlord-select');
        if (sel) sel.disabled = false;
        editingParcelId = null;
    };
    closeBtn?.addEventListener('click', close);
    overlay?.addEventListener('click', close);
    document.getElementById('parcel-modal-cancel')?.addEventListener('click', close);

    // умови → показ полів першого року (лише у режимі створення)
    document.getElementById('parcel-terms')?.addEventListener('change', (e) => {
        if (!editingParcelId && !document.getElementById('parcel-year-section').classList.contains('hidden')) {
            leaseSetupYear('parcel', e.target.value, null);
        }
    });
    document.getElementById('parcel-add-grain')?.addEventListener('click', () =>
        leaseAddGrainRow(document.getElementById('parcel-grain-tbody'), null));
    document.getElementById('parcel-cash-currency')?.addEventListener('change', () => leaseToggleRate('parcel'));

    // inline «+ Новий орендодавець»
    document.getElementById('parcel-landlord-add-btn')?.addEventListener('click', () => {
        onLandlordCreated = (created) => {
            if (typeof populateLandlordSelect === 'function') populateLandlordSelect('parcel-landlord-select');
            const s = document.getElementById('parcel-landlord-select');
            if (s) { s.value = String(created.id); if (typeof refreshCustomSelect === 'function') refreshCustomSelect(s); }
        };
        openLandlordAddModal();
        const lm = document.getElementById('landlord-modal');
        if (lm) lm.style.zIndex = '100050';   // над модалкою договору
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const landlordId = document.getElementById('parcel-landlord-select')?.value;
        const areaHa = parseFloat(document.getElementById('parcel-area-ha').value);
        const label = document.getElementById('parcel-label').value.trim();
        const terms = document.getElementById('parcel-terms').value;
        const startIso = parseDateInput(dateInput.value, 'дата початку');
        const note = document.getElementById('parcel-note').value.trim();

        if (!landlordId) { formShowValidationError(form, 'parcel-message', 'Виберіть орендодавця', ['parcel-landlord-select']); return; }
        if (!areaHa || areaHa <= 0) { formShowValidationError(form, 'parcel-message', 'Вкажіть кількість га', ['parcel-area-ha']); return; }
        if (startIso === undefined) return;
        if (!startIso) { formShowValidationError(form, 'parcel-message', 'Вкажіть дату початку', ['parcel-start-date']); return; }

        const payload = {
            area_ha: areaHa,
            label: label || null,
            payment_terms: terms,
            start_date: new Date(startIso).toISOString(),
            note: note || null,
        };
        let url, method;
        if (editingParcelId) {
            url = `/leases/parcels/${editingParcelId}`; method = 'PATCH';
        } else {
            payload.landlord_id = parseInt(landlordId);
            const fp = leaseReadYear('parcel', terms, form, 'parcel-message', true);
            if (!fp) return;
            payload.first_period = fp;
            url = '/leases/parcels'; method = 'POST';
        }
        const response = await apiFetch(url, { method, body: JSON.stringify(payload) });
        if (response.ok) {
            showToast(editingParcelId ? 'Ділянку оновлено' : 'Договір створено', 'success');
            close();
            await refreshAfterMutation(['parcels', 'payments', 'landlords']);
            if (cardLandlordId) await refreshLandlordCard();
        } else {
            const error = await response.json().catch(() => null);
            setFormMessage('parcel-message', error?.detail || 'Помилка збереження', true);
        }
    });
}

async function deleteParcel(parcel) {
    if (!confirm(`Видалити ділянку ${formatAmount(parcel.area_ha)} га (${parcel.landlord_full_name})?\nУсі її роки буде видалено.`)) return;
    const response = await apiFetch(`/leases/parcels/${parcel.id}`, { method: 'DELETE' });
    if (response.ok) {
        showToast('Ділянку видалено', 'success');
        await refreshAfterMutation(['parcels', 'payments', 'landlords']);
        if (cardLandlordId) await refreshLandlordCard();
    } else {
        const error = await response.json().catch(() => null);
        showToast(error?.detail || 'Помилка видалення', 'error');
    }
}

// ═══════════════ Картка орендодавця (ділянки + роки) ═══════════════

async function openLandlordCard(landlordId, focusParcelId = null) {
    cardLandlordId = landlordId;
    document.getElementById('landlord-card-modal').classList.remove('hidden');
    const container = document.getElementById('card-parcels');
    if (container) container.innerHTML = '<div class="contract-balance-loading">Завантаження…</div>';
    await refreshLandlordCard(focusParcelId);
}

async function refreshLandlordCard(focusParcelId = null) {
    if (!cardLandlordId) return;
    const landlord = landlordsCache.find(l => l.id === cardLandlordId);
    const [pResp, payResp] = await Promise.all([
        apiFetch(`/leases/parcels?landlord_id=${cardLandlordId}`),
        apiFetch(`/leases/payments?landlord_id=${cardLandlordId}`),
    ]);
    cardParcels = pResp.ok ? await pResp.json() : [];
    cardPayments = payResp.ok ? await payResp.json() : [];
    // default active period = найновіший рік кожної ділянки
    cardParcels.forEach(p => {
        if (focusParcelId && p.id === focusParcelId && p.periods.length) {
            cardActivePeriod[p.id] = p.periods[p.periods.length - 1].id;
        }
        if (!cardActivePeriod[p.id] || !p.periods.some(per => per.id === cardActivePeriod[p.id])) {
            cardActivePeriod[p.id] = p.periods.length ? p.periods[p.periods.length - 1].id : null;
        }
    });
    renderLandlordCard(landlord);
}

function renderLandlordCard(landlord) {
    document.getElementById('card-landlord-name').textContent = landlord ? landlord.full_name : '-';
    document.getElementById('card-landlord-phone').textContent = landlord && landlord.phone ? landlord.phone : '—';
    const total = cardParcels.reduce((acc, p) => acc + (p.cumulative_balance_uah || 0), 0);
    const totalEl = document.getElementById('card-total-balance');
    totalEl.innerHTML = total > 0.01
        ? `<strong style="color:var(--danger)">${formatAmount(total)} грн</strong>`
        : '<span class="status-badge success">Боргів немає</span>';

    const container = document.getElementById('card-parcels');
    if (!cardParcels.length) {
        container.innerHTML = '<div class="grain-items-placeholder">Ділянок ще немає. Додайте першу.</div>';
        return;
    }
    container.innerHTML = cardParcels.map(p => renderParcelBlock(p)).join('');
    attachCardHandlers();
}

function renderParcelBlock(parcel) {
    const balance = parcel.cumulative_balance_uah > 0.01
        ? `<span class="lease-parcel-debt">Борг: ${formatAmount(parcel.cumulative_balance_uah)} грн</span>`
        : '<span class="status-badge success">Виплачено</span>';

    const tabs = parcel.periods.map(per => {
        const active = cardActivePeriod[parcel.id] === per.id ? ' active' : '';
        const debt = per.remaining_cash_uah > 0.01 ? ' lease-period-tab-debt' : '';
        return `<button class="lease-period-tab${active}${debt}" data-tab-parcel="${parcel.id}" data-tab-period="${per.id}">${per.year}</button>`;
    }).join('');

    const activePeriod = parcel.periods.find(per => per.id === cardActivePeriod[parcel.id]);
    const panel = activePeriod ? renderPeriodPanel(parcel, activePeriod)
        : '<div class="grain-items-placeholder">Рік ще не відкрито. Натисніть «Відкрити рік».</div>';

    return `
    <div class="lease-parcel-card" data-parcel="${parcel.id}">
        <div class="lease-parcel-head">
            <div class="lease-parcel-title">
                <strong>${formatAmount(parcel.area_ha)} га</strong>
                ${parcel.label ? `<span class="lease-parcel-label">${escapeHtml(parcel.label)}</span>` : ''}
                ${TERMS_BADGE[parcel.payment_terms] || ''}
                ${parcel.is_active ? '' : '<span class="status-badge muted">Неактивна</span>'}
            </div>
            <div class="lease-parcel-balance">${balance}</div>
        </div>
        <div class="lease-parcel-actions">
            <button class="btn btn-primary btn-small" data-open-period="${parcel.id}">+ Відкрити рік</button>
            <button class="btn btn-secondary btn-small" data-add-payment="${parcel.id}">Додати виплату</button>
            <button class="btn-icon btn-icon-secondary" data-edit-parcel="${parcel.id}" title="Редагувати ділянку">${ICONS.edit}</button>
            <button class="btn-icon btn-icon-danger" data-delete-parcel="${parcel.id}" title="Видалити ділянку">${ICONS.delete}</button>
        </div>
        ${parcel.periods.length ? `<div class="lease-period-tabs">${tabs}</div>` : ''}
        <div class="lease-period-panel">${panel}</div>
    </div>`;
}

function renderPeriodPanel(parcel, period) {
    let html = '';
    // Зернова частина
    if ((parcel.payment_terms === 'grain' || parcel.payment_terms === 'grain_cash') && period.grain_items.length) {
        html += `<div class="lease-table-scroll"><table class="data-table lease-period-table"><thead><tr>
            <th>Культура</th><th>Зобов'язання</th><th>Сплачено</th><th>Залишок</th>
            <th>Поточна ціна</th><th>Залишок, грн</th></tr></thead><tbody>`;
        period.grain_items.forEach(gi => {
            const done = gi.remaining_kg <= 0.01;
            html += `<tr${done ? ' class="balance-item-done"' : ''}>
                <td>${escapeHtml(gi.culture_name || '-')}</td>
                <td>${formatWeight(gi.quantity_kg)} кг</td>
                <td>${formatWeight(gi.paid_kg)} кг</td>
                <td><strong>${formatWeight(gi.remaining_kg)} кг</strong></td>
                <td>${formatAmount(gi.current_price_per_kg_uah)} грн/кг</td>
                <td>${formatAmount(gi.remaining_cash_uah)} грн</td>
            </tr>`;
        });
        html += '</tbody></table></div>';
    }
    // Грошова частина
    if (parcel.payment_terms === 'cash' || parcel.payment_terms === 'grain_cash') {
        const oblig = (period.cash_amount || 0);
        html += `<div class="lease-cash-line">
            Грошова частина: <strong>${formatAmount(period.cash_paid_uah)} / ${formatAmount(oblig * (period.cash_rate || 1))} грн</strong>
            ${period.cash_currency && period.cash_currency !== 'UAH' ? `(${formatAmount(oblig)} ${period.cash_currency} × ${period.cash_rate})` : ''}
            — залишок <strong>${formatAmount(period.cash_remaining_uah)} грн</strong>
        </div>`;
    }
    // Разом по періоду
    html += `<div class="lease-period-total">Залишок за ${period.year}: <strong>${formatAmount(period.remaining_cash_uah)} грн</strong>
        <span class="lease-period-actions">
            <button class="btn-icon btn-icon-secondary" data-edit-period="${period.id}" title="Редагувати рік">${ICONS.edit}</button>
            <button class="btn-icon btn-icon-danger" data-delete-period="${period.id}" title="Видалити рік">${ICONS.delete}</button>
        </span></div>`;

    // Виплати за цей рік
    const payments = cardPayments.filter(p => p.parcel_id === parcel.id && p.period_id === period.id);
    if (payments.length) {
        html += '<div class="lease-payments-list"><div class="lease-payments-title">Виплати:</div>';
        payments.forEach(p => {
            let sum;
            if (p.payment_type === 'cash') {
                sum = `${formatAmount(p.amount || 0)} ${p.currency || '₴'}`;
                if (p.applies_to === 'grain') sum += ' → зерно';
            } else {
                sum = (p.grain_items || []).map(g => `${formatWeight(g.quantity_kg)} ${escapeHtml(g.culture_name || '')}`).join(', ');
            }
            const typeBadge = p.payment_type === 'grain'
                ? '<span class="inline-badge grain">Зерном</span>'
                : '<span class="inline-badge cash">Грошима</span>';
            const cancelled = p.is_cancelled ? ' <span class="status-badge danger">Скасовано</span>' : '';
            const cancelBtn = p.is_cancelled ? '' :
                `<button class="btn-icon btn-icon-danger" data-cancel-payment="${p.id}" title="Скасувати">${ICONS.cancel}</button>`;
            html += `<div class="lease-payment-row${p.is_cancelled ? ' row-cancelled' : ''}">
                <span>${formatDate(p.payment_date)}</span>
                <span>${typeBadge}${cancelled}</span>
                <span>${sum}</span>
                <span class="lease-payment-actions">${cancelBtn}</span>
            </div>`;
        });
        html += '</div>';
    }
    return html;
}

function attachCardHandlers() {
    const container = document.getElementById('card-parcels');
    if (!container) return;
    container.querySelectorAll('.lease-period-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            cardActivePeriod[parseInt(btn.dataset.tabParcel)] = parseInt(btn.dataset.tabPeriod);
            const landlord = landlordsCache.find(l => l.id === cardLandlordId);
            renderLandlordCard(landlord);
        });
    });
    container.querySelectorAll('[data-open-period]').forEach(btn =>
        btn.addEventListener('click', () => openPeriodModal(parseInt(btn.dataset.openPeriod))));
    container.querySelectorAll('[data-add-payment]').forEach(btn =>
        btn.addEventListener('click', () => {
            const parcelId = parseInt(btn.dataset.addPayment);
            openPaymentAddModal(cardLandlordId, parcelId, cardActivePeriod[parcelId]);
        }));
    container.querySelectorAll('[data-edit-parcel]').forEach(btn =>
        btn.addEventListener('click', () => {
            const p = cardParcels.find(x => x.id === parseInt(btn.dataset.editParcel));
            if (p) openParcelEditModal(p);
        }));
    container.querySelectorAll('[data-delete-parcel]').forEach(btn =>
        btn.addEventListener('click', () => {
            const p = cardParcels.find(x => x.id === parseInt(btn.dataset.deleteParcel));
            if (p) deleteParcel(p);
        }));
    container.querySelectorAll('[data-edit-period]').forEach(btn =>
        btn.addEventListener('click', () => openPeriodEditModal(parseInt(btn.dataset.editPeriod))));
    container.querySelectorAll('[data-delete-period]').forEach(btn =>
        btn.addEventListener('click', () => deletePeriod(parseInt(btn.dataset.deletePeriod))));
    container.querySelectorAll('[data-cancel-payment]').forEach(btn =>
        btn.addEventListener('click', () => cancelPayment(parseInt(btn.dataset.cancelPayment))));
}

function initLandlordCardModal() {
    const modal = document.getElementById('landlord-card-modal');
    if (!modal) return;
    const close = () => { modal.classList.add('hidden'); cardLandlordId = null; };
    document.getElementById('card-modal-close')?.addEventListener('click', close);
    document.getElementById('card-modal-close-btn')?.addEventListener('click', close);
    modal.querySelector('.modal-overlay')?.addEventListener('click', close);
    document.getElementById('card-add-parcel-btn')?.addEventListener('click', () => openContractCreateModal(cardLandlordId));
}

// ═══════════════ Роки (periods) ═══════════════

let periodParcelForModal = null;
let editingPeriodId = null;

function findParcel(parcelId) {
    return cardParcels.find(p => p.id === parcelId) || parcelsCache.find(p => p.id === parcelId);
}

function openPeriodModal(parcelId) {
    editingPeriodId = null;
    const parcel = findParcel(parcelId);
    if (!parcel) return;
    periodParcelForModal = parcel;
    document.getElementById('period-modal-title').textContent = 'Відкрити рік';
    const form = document.getElementById('period-form');
    if (form) { clearFormValidationState(form, 'period-message'); form.reset(); }
    document.getElementById('period-parcel-id').value = parcelId;
    const years = parcel.periods.map(p => p.year);
    const nextYear = years.length ? Math.max(...years) + 1 : new Date(parcel.start_date).getFullYear();
    document.getElementById('period-year').value = nextYear;
    document.getElementById('period-year').disabled = false;
    // Копія минулого року: ті самі культури/кг та сума; ціна — поточна ринкова
    const latest = parcel.periods.length ? parcel.periods[parcel.periods.length - 1] : null;
    const prefill = latest ? {
        grain_items: (latest.grain_items || []).map(gi => ({
            culture_id: gi.culture_id, quantity_kg: gi.quantity_kg, price_per_kg_uah: getCulturePrice(gi.culture_id)
        })),
        cash_amount: latest.cash_amount,
        cash_currency: latest.cash_currency,
        cash_rate: latest.cash_rate,
    } : null;
    leaseSetupYear('period', parcel.payment_terms, prefill);
    document.getElementById('period-modal').classList.remove('hidden');
    setTimeout(() => {
        const c = document.getElementById('period-cash-currency');
        if (c && typeof initCustomSelects === 'function') initCustomSelects(c);
    }, 60);
}

function openPeriodEditModal(periodId) {
    let parcel = null, period = null;
    for (const p of cardParcels) {
        const per = p.periods.find(x => x.id === periodId);
        if (per) { parcel = p; period = per; break; }
    }
    if (!parcel || !period) return;
    editingPeriodId = periodId;
    periodParcelForModal = parcel;
    document.getElementById('period-modal-title').textContent = `Рік ${period.year}`;
    const form = document.getElementById('period-form');
    if (form) clearFormValidationState(form, 'period-message');
    document.getElementById('period-parcel-id').value = parcel.id;
    document.getElementById('period-year').value = period.year;
    document.getElementById('period-year').disabled = true;
    leaseSetupYear('period', parcel.payment_terms, period);
    document.getElementById('period-modal').classList.remove('hidden');
}

function initPeriodModal() {
    const modal = document.getElementById('period-modal');
    const form = document.getElementById('period-form');
    if (!modal || !form) return;
    formBindInvalidHighlightClearing(form);

    const close = () => {
        clearFormValidationState(form, 'period-message');
        modal.classList.add('hidden');
        document.getElementById('period-year').disabled = false;
        editingPeriodId = null;
    };
    document.getElementById('period-modal-close')?.addEventListener('click', close);
    document.getElementById('period-modal-cancel')?.addEventListener('click', close);
    modal.querySelector('.modal-overlay')?.addEventListener('click', close);
    document.getElementById('period-add-grain')?.addEventListener('click', () =>
        leaseAddGrainRow(document.getElementById('period-grain-tbody'), null));
    document.getElementById('period-cash-currency')?.addEventListener('change', () => leaseToggleRate('period'));

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const parcelId = parseInt(document.getElementById('period-parcel-id').value);
        const parcel = periodParcelForModal;
        const data = leaseReadYear('period', parcel.payment_terms, form, 'period-message', true);
        if (!data) return;
        const note = document.getElementById('period-note').value.trim();
        const body = JSON.stringify({ ...data, note: note || null });
        let url, method;
        if (editingPeriodId) {
            url = `/leases/periods/${editingPeriodId}`; method = 'PATCH';
        } else {
            url = `/leases/parcels/${parcelId}/periods`; method = 'POST';
        }
        const response = await apiFetch(url, { method, body });
        if (response.ok) {
            showToast(editingPeriodId ? 'Рік оновлено' : 'Рік відкрито', 'success');
            const newPeriod = await response.json();
            close();
            await refreshAfterMutation(['parcels', 'payments', 'landlords']);
            cardActivePeriod[parcelId] = newPeriod.id;
            if (cardLandlordId) await refreshLandlordCard();
        } else {
            const error = await response.json().catch(() => null);
            setFormMessage('period-message', error?.detail || 'Помилка збереження', true);
        }
    });
}

async function deletePeriod(periodId) {
    if (!confirm('Видалити цей рік? Дію не можна скасувати.')) return;
    const response = await apiFetch(`/leases/periods/${periodId}`, { method: 'DELETE' });
    if (response.ok) {
        showToast('Рік видалено', 'success');
        await refreshAfterMutation(['parcels', 'payments']);
        if (cardLandlordId) await refreshLandlordCard();
    } else {
        const error = await response.json().catch(() => null);
        showToast(error?.detail || 'Помилка видалення', 'error');
    }
}

// ═══════════════ Виплати ═══════════════

async function loadPayments() {
    const response = await apiFetch('/leases/payments');
    if (!response.ok) { console.error('Помилка завантаження виплат'); return; }
    paymentsCache = await response.json();
    renderPaymentsTable();
}

function renderPaymentsTable() {
    const tableBody = document.querySelector('#payments-table tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    const fLandlord = document.getElementById('payments-filter-landlord')?.value || '';
    const fType = document.getElementById('payments-filter-type')?.value || '';
    const fStatus = document.getElementById('payments-filter-status')?.value || '';
    const showCancelled = fStatus === 'all';
    const landlordName = landlordsCache.find(l => String(l.id) === fLandlord)?.full_name;
    const filtered = paymentsCache.filter(p => {
        if (fLandlord && p.landlord_full_name !== landlordName) return false;
        if (fType && p.payment_type !== fType) return false;
        if (!showCancelled && p.is_cancelled) return false;
        return true;
    });
    if (!filtered.length) {
        tableBody.innerHTML = '<tr><td colspan="6" class="table-empty-message">Виплат не знайдено</td></tr>';
        return;
    }
    filtered.forEach(payment => {
        const row = document.createElement('tr');
        if (payment.is_cancelled) row.classList.add('row-cancelled');
        let sumText = emptyValueHtml();
        if (payment.payment_type === 'cash') {
            sumText = `<strong>${formatAmount(payment.amount || 0)} ${payment.currency || '₴'}</strong>`;
            if (payment.applies_to === 'grain') sumText += ' <span class="inline-badge grain">в зерно</span>';
        } else if (payment.grain_items && payment.grain_items.length) {
            sumText = payment.grain_items.map(g =>
                `<span class="inline-badge grain">${formatWeight(g.quantity_kg)} ${escapeHtml(g.culture_name || '')}</span>`
            ).join(' ');
        }
        const typeBadge = payment.payment_type === 'grain'
            ? '<span class="inline-badge grain">Зерном</span>'
            : '<span class="inline-badge cash">Грошима</span>';
        const statusBadge = payment.is_cancelled ? ' <span class="status-badge danger">Скасовано</span>' : '';
        const parcelText = payment.area_ha != null
            ? `${formatAmount(payment.area_ha)} га${payment.label ? ' · ' + escapeHtml(payment.label) : ''}${payment.period_year ? ' · ' + payment.period_year : ''}`
            : emptyValueHtml();
        const cancelBtn = payment.is_cancelled ? '' :
            `<button class="btn-icon btn-icon-danger" onclick="cancelPayment(${payment.id})" title="Скасувати виплату">${ICONS.cancel}</button>`;
        row.innerHTML = `
            <td>${formatDate(payment.payment_date)}</td>
            <td><strong>${payment.landlord_full_name ? escapeHtml(payment.landlord_full_name) : emptyValueHtml()}</strong></td>
            <td>${parcelText}</td>
            <td>${typeBadge}${statusBadge}</td>
            <td>${sumText}</td>
            <td class="actions-cell">${cancelBtn}</td>
        `;
        tableBody.appendChild(row);
    });
}

function cancelPayment(paymentId) {
    const payment = (cardPayments.find(p => p.id === paymentId)) || paymentsCache.find(p => p.id === paymentId);
    if (!payment) return;
    cancellingPaymentId = paymentId;
    const info = document.getElementById('payment-cancel-info');
    if (info) {
        let details = `${formatDate(payment.payment_date)} — ${payment.landlord_full_name || '?'}`;
        if (payment.payment_type === 'grain' && payment.grain_items?.length) {
            details += ` (${payment.grain_items.map(i => `${formatWeight(i.quantity_kg)} ${i.culture_name || ''}`).join(', ')})`;
        } else if (payment.payment_type === 'cash') {
            details += ` (${formatAmount(payment.amount || 0)} ${payment.currency || 'грн'})`;
        }
        info.textContent = details;
    }
    document.getElementById('payment-cancel-modal').classList.remove('hidden');
}

function initPaymentCancelModal() {
    const modal = document.getElementById('payment-cancel-modal');
    const confirmBtn = document.getElementById('payment-cancel-confirm');
    if (!modal || !confirmBtn) return;
    const close = () => { modal.classList.add('hidden'); cancellingPaymentId = null; };
    document.getElementById('payment-cancel-close')?.addEventListener('click', close);
    document.getElementById('payment-cancel-cancel')?.addEventListener('click', close);
    modal.querySelector('.modal-overlay')?.addEventListener('click', close);

    confirmBtn.addEventListener('click', async () => {
        if (!cancellingPaymentId) return;
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Скасування...';
        try {
            const response = await apiFetch(`/leases/payments/${cancellingPaymentId}/cancel`, { method: 'POST' });
            if (response.ok) {
                const cancelled = await response.json();
                showToast('Виплату скасовано', 'success');
                close();
                const scopes = ['payments', 'parcels', 'dashboard'];
                if (cancelled.payment_type === 'grain') scopes.push('stock', 'stockAdjustments');
                else scopes.push('cash', 'cashTransactions');
                await refreshAfterMutation(scopes);
                if (cardLandlordId) await refreshLandlordCard();
            } else {
                const error = await response.json().catch(() => null);
                showToast(error?.detail || 'Не вдалося скасувати виплату', 'error');
            }
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Так, скасувати';
        }
    });
}

function initPayments() {
    document.getElementById('payment-add-btn')?.addEventListener('click', () => openPaymentAddModal());
    initPaymentModal();
    initPaymentCancelModal();
    initPaymentsFilter();
    initPaymentsReportModal();
}

// Стан платіжної модалки
let payParcels = [];          // ділянки обраного орендодавця
let payPeriodBalance = null;  // баланс обраного періоду
let payParcel = null;         // обрана ділянка

function openPaymentAddModal(presetLandlordId = null, presetParcelId = null, presetPeriodId = null) {
    const form = document.getElementById('payment-form');
    if (form) { clearFormValidationState(form, 'payment-message'); form.reset(); }
    payParcels = []; payPeriodBalance = null; payParcel = null;

    const lsel = document.getElementById('payment-landlord-select');
    if (lsel) {
        if (typeof populateLandlordSelect === 'function') populateLandlordSelect('payment-landlord-select');
        lsel.value = presetLandlordId ? String(presetLandlordId) : '';
        if (typeof refreshCustomSelect === 'function') refreshCustomSelect(lsel);
    }
    resetSelect('payment-parcel-select', 'Спочатку оберіть орендодавця');
    resetSelect('payment-period-select', 'Спочатку оберіть ділянку');
    document.getElementById('payment-balance-card').classList.add('hidden');
    document.getElementById('payment-grain-fields').classList.add('hidden');
    document.getElementById('payment-cash-fields').classList.add('hidden');
    document.getElementById('payment-grain-items-list').innerHTML = '';
    document.getElementById('payment-modal').classList.remove('hidden');

    setTimeout(async () => {
        ['payment-parcel-select', 'payment-period-select', 'payment-cash-culture', 'payment-currency']
            .forEach(id => { const el = document.getElementById(id); if (el && typeof initCustomSelects === 'function') initCustomSelects(el); });
        if (presetLandlordId) {
            await onPaymentLandlordChange(presetLandlordId);
            if (presetParcelId) {
                const psel = document.getElementById('payment-parcel-select');
                psel.value = String(presetParcelId);
                if (typeof refreshCustomSelect === 'function') refreshCustomSelect(psel);
                await onPaymentParcelChange(presetParcelId, !presetPeriodId);
                if (presetPeriodId) {
                    const persel = document.getElementById('payment-period-select');
                    persel.value = String(presetPeriodId);
                    if (typeof refreshCustomSelect === 'function') refreshCustomSelect(persel);
                    await onPaymentPeriodChange();
                }
            }
        }
    }, 80);
}

function resetSelect(id, placeholder) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = `<option value="">${placeholder}</option>`;
    sel.disabled = true;
    if (typeof refreshCustomSelect === 'function') refreshCustomSelect(sel);
}

async function onPaymentLandlordChange(landlordId) {
    payParcels = []; payParcel = null; payPeriodBalance = null;
    resetSelect('payment-parcel-select', 'Завантаження…');
    resetSelect('payment-period-select', 'Спочатку оберіть ділянку');
    document.getElementById('payment-balance-card').classList.add('hidden');
    if (!landlordId) { resetSelect('payment-parcel-select', 'Спочатку оберіть орендодавця'); return; }
    try {
        const resp = await apiFetch(`/leases/parcels?landlord_id=${encodeURIComponent(landlordId)}`);
        payParcels = resp.ok ? await resp.json() : [];
    } catch (e) { payParcels = []; }
    const sel = document.getElementById('payment-parcel-select');
    if (!payParcels.length) {
        resetSelect('payment-parcel-select', 'Немає ділянок');
        return;
    }
    sel.disabled = false;
    sel.innerHTML = '<option value="">Оберіть ділянку</option>' + payParcels.map(p => {
        const debt = p.cumulative_balance_uah > 0.01 ? ` — борг ${formatAmount(p.cumulative_balance_uah)} грн` : '';
        return `<option value="${p.id}">${formatAmount(p.area_ha)} га${p.label ? ' · ' + escapeHtml(p.label) : ''} (${TERMS_LABEL[p.payment_terms]})${debt}</option>`;
    }).join('');
    if (typeof refreshCustomSelect === 'function') refreshCustomSelect(sel);
}

async function onPaymentParcelChange(parcelId, autoPick = true) {
    payParcel = payParcels.find(p => p.id === parseInt(parcelId)) || null;
    payPeriodBalance = null;
    document.getElementById('payment-balance-card').classList.add('hidden');
    const persel = document.getElementById('payment-period-select');
    document.getElementById('payment-grain-fields').classList.add('hidden');
    document.getElementById('payment-cash-fields').classList.add('hidden');
    if (!payParcel || !payParcel.periods.length) {
        resetSelect('payment-period-select', 'Немає відкритих років');
        return;
    }
    persel.disabled = false;
    persel.innerHTML = '<option value="">Оберіть рік</option>' + payParcel.periods.map(per => {
        const debt = per.remaining_cash_uah > 0.01 ? ` — залишок ${formatAmount(per.remaining_cash_uah)} грн` : ' — виплачено';
        return `<option value="${per.id}">${per.year}${debt}</option>`;
    }).join('');
    if (typeof refreshCustomSelect === 'function') refreshCustomSelect(persel);
    // Авто-вибір року: один період → він; кілька → останній із боргом (інакше останній).
    if (autoPick) {
        const withDebt = payParcel.periods.filter(p => p.remaining_cash_uah > 0.01);
        const target = withDebt.length ? withDebt[withDebt.length - 1] : payParcel.periods[payParcel.periods.length - 1];
        persel.value = String(target.id);
        if (typeof refreshCustomSelect === 'function') refreshCustomSelect(persel);
        await onPaymentPeriodChange();
    }
}

// Режим грошової виплати: для «лише зерно» гроші йдуть у рахунок зерна (потрібна культура),
// для cash / grain_cash — у грошову частину.
function paymentMoneyMode() {
    return (payParcel && payParcel.payment_terms === 'grain') ? 'grain' : 'cash';
}

// Показ блоків «Зерном» / «Грошима» одночасно (без перемикача типу).
function setupPaymentSections() {
    const grainFields = document.getElementById('payment-grain-fields');
    const cashFields = document.getElementById('payment-cash-fields');
    const cultureField = document.getElementById('payment-cash-culture-field');
    const cashLabel = document.getElementById('payment-cash-label');
    if (!payParcel) { grainFields.classList.add('hidden'); cashFields.classList.add('hidden'); return; }
    const terms = payParcel.payment_terms;
    const showGrain = (terms === 'grain' || terms === 'grain_cash');
    grainFields.classList.toggle('hidden', !showGrain);
    cashFields.classList.remove('hidden');   // гроші можна завжди
    const moneyToGrain = (terms === 'grain');
    cultureField.classList.toggle('hidden', !moneyToGrain);
    if (cashLabel) cashLabel.textContent = moneyToGrain ? 'Виплата грошима (в рахунок зерна)' : 'Виплата грошима';
    updatePaymentCashEquivalent();
}

async function onPaymentPeriodChange() {
    const periodId = document.getElementById('payment-period-select').value;
    const balanceCard = document.getElementById('payment-balance-card');
    if (!periodId) {
        balanceCard.classList.add('hidden');
        document.getElementById('payment-grain-fields').classList.add('hidden');
        document.getElementById('payment-cash-fields').classList.add('hidden');
        payPeriodBalance = null;
        return;
    }
    try {
        const resp = await apiFetch(`/leases/periods/${periodId}/balance`);
        if (!resp.ok) throw new Error();
        payPeriodBalance = await resp.json();
        renderPaymentBalance();
        populatePaymentGrainItems();
        populatePaymentCashCulture();
        balanceCard.classList.remove('hidden');
        setupPaymentSections();
    } catch (e) {
        payPeriodBalance = null;
        balanceCard.classList.add('hidden');
    }
}

function renderPaymentBalance() {
    if (!payPeriodBalance) return;
    document.getElementById('payment-balance-period').textContent = `Рік ${payPeriodBalance.year}`;
    const itemsEl = document.getElementById('payment-balance-items');
    let html = (payPeriodBalance.grain_items || []).map(item => {
        const pct = item.quantity_kg > 0 ? Math.round((item.paid_kg / item.quantity_kg) * 100) : 0;
        const done = item.remaining_kg <= 0.01;
        return `<div class="balance-item${done ? ' balance-item-done' : ''}">
            <div class="balance-item-header">
                <span class="balance-culture-name">${escapeHtml(item.culture_name || '')}</span>
                <span class="balance-culture-stats">${formatWeight(item.paid_kg)} / ${formatWeight(item.quantity_kg)} кг</span>
            </div>
            <div class="balance-bar"><div class="balance-bar-fill${done ? ' balance-bar-done' : ''}" style="width:${Math.min(pct, 100)}%"></div></div>
            <div class="balance-item-footer">${done ? '<span style="color:var(--primary)">✓ Виплачено</span>'
                : `Залишок: <strong>${formatWeight(item.remaining_kg)} кг</strong> (${formatAmount(item.remaining_cash_uah)} грн)`}</div>
        </div>`;
    }).join('');
    const cashPaid = payPeriodBalance.cash_paid_uah || 0;
    const cashRem = payPeriodBalance.cash_remaining_uah || 0;
    const cashOblig = cashPaid + cashRem;
    if (cashOblig > 0.01) {
        const pct = cashOblig > 0 ? Math.round((cashPaid / cashOblig) * 100) : 0;
        const done = cashRem <= 0.01;
        html += `<div class="balance-item${done ? ' balance-item-done' : ''}">
            <div class="balance-item-header">
                <span class="balance-culture-name">Гроші</span>
                <span class="balance-culture-stats">${formatAmount(cashPaid)} / ${formatAmount(cashOblig)} грн</span>
            </div>
            <div class="balance-bar"><div class="balance-bar-fill${done ? ' balance-bar-done' : ''}" style="width:${Math.min(pct, 100)}%"></div></div>
            <div class="balance-item-footer">${done ? '<span style="color:var(--primary)">✓ Виплачено</span>' : `Залишок: <strong>${formatAmount(cashRem)} грн</strong>`}</div>
        </div>`;
    }
    const total = payPeriodBalance.remaining_cash_uah || 0;
    html += `<div class="payment-balance-total">${total > 0.01
        ? `Разом залишок: <strong>${formatAmount(total)} грн</strong>`
        : '<span style="color:var(--primary)">✓ Рік повністю виплачено</span>'}</div>`;
    itemsEl.innerHTML = html;
}

function populatePaymentGrainItems() {
    if (!payPeriodBalance) return;
    const list = document.getElementById('payment-grain-items-list');
    if (!list) return;
    const available = (payPeriodBalance.grain_items || []).filter(item => item.remaining_kg > 0);
    if (!available.length) {
        list.innerHTML = '<div class="grain-items-done">✓ Зерно за цей рік виплачено</div>';
        return;
    }
    list.innerHTML = available.map(item => `
        <div class="grain-pay-card" data-culture-id="${item.culture_id}">
            <div class="grain-pay-header">
                <span class="grain-pay-name">${escapeHtml(item.culture_name || '')}</span>
                <span class="grain-pay-stats">${formatWeight(item.paid_kg)} / ${formatWeight(item.quantity_kg)} кг</span>
            </div>
            <div class="grain-pay-input-row">
                <input type="number" class="grain-item-quantity" min="0" max="${item.remaining_kg}" step="0.01" placeholder="0" data-max="${item.remaining_kg}">
                <span class="grain-pay-separator">із</span>
                <span class="grain-pay-max">${formatWeight(item.remaining_kg)} кг</span>
            </div>
        </div>`).join('');
}

function populatePaymentCashCulture() {
    if (!payPeriodBalance) return;
    const select = document.getElementById('payment-cash-culture');
    if (!select) return;
    select.innerHTML = '<option value="">Оберіть культуру</option>' +
        (payPeriodBalance.grain_items || []).filter(item => item.remaining_kg > 0).map(item =>
            `<option value="${item.culture_id}" data-remaining-kg="${item.remaining_kg}" data-price="${item.current_price_per_kg_uah}" data-max-cash="${item.remaining_cash_uah}">
                ${escapeHtml(item.culture_name || '')} (залишок: ${formatWeight(item.remaining_kg)} кг)
            </option>`).join('');
    if (typeof initCustomSelects === 'function') setTimeout(() => initCustomSelects(select), 30);
    updatePaymentCashEquivalent();
}

function updatePaymentCashEquivalent() {
    const appliesTo = paymentMoneyMode();
    const equivEl = document.getElementById('payment-cash-equivalent');
    const uahEquivEl = document.getElementById('payment-uah-equiv');
    const amountInput = document.getElementById('payment-amount');
    const currencySelect = document.getElementById('payment-currency');
    const rateInput = document.getElementById('payment-rate');
    const select = document.getElementById('payment-cash-culture');
    if (!amountInput) return;
    const currency = currencySelect ? currencySelect.value : 'UAH';
    const rate = rateInput ? (parseFloat(rateInput.value) || 0) : 0;
    const amount = parseFloat(amountInput.value) || 0;

    if (uahEquivEl) {
        if (currency !== 'UAH' && rate > 0 && amount > 0) {
            uahEquivEl.innerHTML = `= <strong>${formatAmount(amount * rate)} грн</strong>`;
            uahEquivEl.classList.remove('hidden');
        } else { uahEquivEl.classList.add('hidden'); }
    }

    if (!equivEl) return;
    if (appliesTo === 'cash') {
        // гасимо грошову частину
        const remaining = payPeriodBalance ? payPeriodBalance.cash_remaining_uah : 0;
        const amountUah = currency === 'UAH' ? amount : amount * rate;
        equivEl.innerHTML = amountUah > 0
            ? `${formatAmount(amountUah)} грн з ${formatAmount(remaining)} грн залишку`
            : `Залишок грошової частини: <strong>${formatAmount(remaining)} грн</strong>`;
        return;
    }
    // гасимо зерновий борг грошима
    const opt = select?.options[select.selectedIndex];
    if (!opt || !opt.value) { equivEl.innerHTML = ''; return; }
    const remainingKg = parseFloat(opt.dataset.remainingKg);
    const price = parseFloat(opt.dataset.price);
    const maxCash = parseFloat(opt.dataset.maxCash);
    const amountUah = currency === 'UAH' ? amount : amount * rate;
    if (amountUah > 0 && price > 0) {
        const equivKg = (amountUah / price).toFixed(2);
        const over = parseFloat(equivKg) > remainingKg;
        equivEl.innerHTML = `Еквівалент: <strong${over ? ' style="color:var(--danger)"' : ''}>${equivKg} кг</strong> з ${formatWeight(remainingKg)} кг (${formatAmount(price)} грн/кг)`;
    } else {
        equivEl.innerHTML = `Максимум: <strong>${formatAmount(maxCash)} грн</strong> (${formatWeight(remainingKg)} кг × ${formatAmount(price)} грн/кг)`;
    }
}

function initPaymentModal() {
    const modal = document.getElementById('payment-modal');
    const form = document.getElementById('payment-form');
    if (!modal || !form) return;
    formBindInvalidHighlightClearing(form);
    const close = () => { clearFormValidationState(form, 'payment-message'); modal.classList.add('hidden'); };
    document.getElementById('payment-modal-close')?.addEventListener('click', close);
    modal.querySelector('.modal-overlay')?.addEventListener('click', close);

    document.getElementById('payment-landlord-select')?.addEventListener('change', (e) => {
        document.getElementById('payment-landlord-id').value = e.target.value || '';
        onPaymentLandlordChange(e.target.value || '');
    });
    document.getElementById('payment-parcel-select')?.addEventListener('change', (e) => onPaymentParcelChange(e.target.value));
    document.getElementById('payment-period-select')?.addEventListener('change', onPaymentPeriodChange);
    document.getElementById('payment-cash-culture')?.addEventListener('change', updatePaymentCashEquivalent);
    document.getElementById('payment-amount')?.addEventListener('input', updatePaymentCashEquivalent);
    document.getElementById('payment-rate')?.addEventListener('input', updatePaymentCashEquivalent);

    // «Весь залишок» — зерном: заповнити всі позиції максимумом
    document.getElementById('payment-grain-fill-all')?.addEventListener('click', () => {
        document.querySelectorAll('#payment-grain-items-list .grain-pay-card .grain-item-quantity').forEach(inp => {
            inp.value = inp.dataset.max;
        });
    });
    // «Весь залишок» — грошима: підставити повний залишок у суму
    document.getElementById('payment-cash-fill-all')?.addEventListener('click', () => {
        if (!payPeriodBalance) return;
        const appliesTo = paymentMoneyMode();
        const currency = document.getElementById('payment-currency').value;
        const rate = parseFloat(document.getElementById('payment-rate').value) || 1;
        let remainingUah = 0;
        if (appliesTo === 'cash') {
            remainingUah = payPeriodBalance.cash_remaining_uah || 0;
        } else {
            const sel = document.getElementById('payment-cash-culture');
            const opt = sel.options[sel.selectedIndex];
            remainingUah = (opt && opt.dataset.maxCash) ? parseFloat(opt.dataset.maxCash) : 0;
        }
        const amount = currency === 'UAH' ? remainingUah : (rate > 0 ? remainingUah / rate : 0);
        document.getElementById('payment-amount').value = (Math.round(amount * 100) / 100) || '';
        updatePaymentCashEquivalent();
    });
    document.getElementById('payment-currency')?.addEventListener('change', () => {
        const cur = document.getElementById('payment-currency').value;
        const rateField = document.getElementById('payment-rate-field');
        const rateInput = document.getElementById('payment-rate');
        if (cur === 'UAH') { rateField.classList.add('hidden'); rateInput.value = ''; }
        else rateField.classList.remove('hidden');
        updatePaymentCashEquivalent();
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const parcelId = document.getElementById('payment-parcel-select').value;
        const periodId = document.getElementById('payment-period-select').value;
        const note = document.getElementById('payment-note').value.trim();
        if (!parcelId) { formShowValidationError(form, 'payment-message', 'Виберіть ділянку', ['payment-parcel-select']); return; }
        if (!periodId) { formShowValidationError(form, 'payment-message', 'Виберіть рік', ['payment-period-select']); return; }
        if (!payPeriodBalance) { formShowValidationError(form, 'payment-message', 'Зачекайте, завантажується залишок', ['payment-period-select']); return; }

        const terms = payParcel ? payParcel.payment_terms : 'grain';
        const moneyMode = paymentMoneyMode();
        const base = {
            parcel_id: parseInt(parcelId),
            period_id: parseInt(periodId),
            payment_date: new Date().toISOString(),
            note: note || null,
        };
        const payloads = [];

        // 1) Зерном — окремий запис
        if (terms === 'grain' || terms === 'grain_cash') {
            const grain_items = [];
            for (const row of document.querySelectorAll('#payment-grain-items-list .grain-pay-card')) {
                const input = row.querySelector('.grain-item-quantity');
                const qty = parseFloat(input.value);
                if (isNaN(qty) || qty <= 0) continue;
                const maxQty = parseFloat(input.dataset.max);
                if (qty > maxQty + 0.01) {
                    formShowValidationError(form, 'payment-message', `Перевищено залишок: макс. ${formatWeight(maxQty)} кг`, [], [row]);
                    return;
                }
                grain_items.push({ culture_id: parseInt(row.dataset.cultureId), quantity_kg: qty });
            }
            if (grain_items.length) payloads.push({ ...base, payment_type: 'grain', applies_to: 'grain', grain_items });
        }

        // 2) Грошима — окремий запис
        const amount = parseFloat(document.getElementById('payment-amount').value);
        if (!isNaN(amount) && amount > 0) {
            const currency = document.getElementById('payment-currency').value;
            const rate = parseFloat(document.getElementById('payment-rate').value) || 0;
            if (currency !== 'UAH' && (!rate || rate <= 0)) { formShowValidationError(form, 'payment-message', `Вкажіть курс ${currency} до грн`, ['payment-rate']); return; }
            const cashPayload = { ...base, payment_type: 'cash', currency, amount, exchange_rate: currency === 'UAH' ? 1 : rate, grain_items: [] };
            if (moneyMode === 'grain') {
                const cultureId = document.getElementById('payment-cash-culture').value;
                if (!cultureId) { formShowValidationError(form, 'payment-message', 'Виберіть культуру для зарахування грошей', ['payment-cash-culture']); return; }
                cashPayload.applies_to = 'grain';
                cashPayload.grain_items.push({ culture_id: parseInt(cultureId), quantity_kg: 0.01 });  // бекенд порахує кг
            } else {
                cashPayload.applies_to = 'cash';
            }
            payloads.push(cashPayload);
        }

        if (!payloads.length) {
            formShowValidationError(form, 'payment-message', 'Вкажіть кількість зерна та/або суму грошей', []);
            return;
        }

        // POST кожну (зерно + гроші = два окремі записи)
        const scopes = new Set(['payments', 'parcels', 'dashboard', 'landlords']);
        let okCount = 0;
        for (const pl of payloads) {
            const response = await apiFetch('/leases/payments', { method: 'POST', body: JSON.stringify(pl) });
            if (!response.ok) {
                const error = await response.json().catch(() => null);
                const msg = error?.detail || 'Помилка збереження';
                if (okCount > 0) {
                    showToast('Частину збережено. ' + msg, 'error');
                    close();
                    await refreshAfterMutation([...scopes]);
                    if (cardLandlordId) await refreshLandlordCard();
                } else {
                    setFormMessage('payment-message', msg, true);
                }
                return;
            }
            okCount++;
            if (pl.payment_type === 'grain') { scopes.add('stock'); scopes.add('stockAdjustments'); }
            else { scopes.add('cash'); scopes.add('cashTransactions'); }
        }
        showToast(okCount > 1 ? 'Виплати додано' : 'Виплату додано', 'success');
        close();
        await refreshAfterMutation([...scopes]);
        if (cardLandlordId) await refreshLandlordCard();
    });
}

// ═══════════════ Фільтри ═══════════════

function initLandlordsFilter() {
    document.getElementById('landlords-filter-search')?.addEventListener('input', () => renderLandlordsTable());
    document.getElementById('landlords-filter-status')?.addEventListener('change', () => renderLandlordsTable());
}

function initPaymentsFilter() {
    document.getElementById('payments-filter-landlord')?.addEventListener('change', renderPaymentsTable);
    document.getElementById('payments-filter-type')?.addEventListener('change', renderPaymentsTable);
    document.getElementById('payments-filter-status')?.addEventListener('change', renderPaymentsTable);
}

function updatePaymentsFilterLandlords() {
    const sel = document.getElementById('payments-filter-landlord');
    if (!sel) return;
    const val = sel.value;
    sel.innerHTML = '<option value="">Всі орендодавці</option>' +
        landlordsCache.map(l => `<option value="${l.id}">${escapeHtml(l.full_name)}</option>`).join('');
    sel.value = val;
    if (typeof refreshCustomSelect === 'function') refreshCustomSelect(sel);
}

// ═══════════════ Звіти ═══════════════
// downloadBlob(response, filename) визначено у core.js (приймає Response).

function initLandlordsReportModal() {
    const modal = document.getElementById('landlords-report-modal');
    const openBtn = document.getElementById('landlords-report-btn');
    const downloadBtn = document.getElementById('landlords-report-download');
    const overlay = modal?.querySelector('.modal-overlay');
    const searchInput = document.getElementById('landlords-report-search');
    const suggestions = document.getElementById('landlords-report-suggestions');
    if (!modal || !openBtn || !downloadBtn) return;

    let timeout;
    const open = () => {
        if (searchInput) searchInput.value = '';
        if (suggestions) { suggestions.innerHTML = ''; suggestions.classList.add('hidden'); }
        modal.classList.remove('hidden');
    };
    const close = () => modal.classList.add('hidden');
    openBtn.addEventListener('click', open);
    document.getElementById('landlords-report-close')?.addEventListener('click', close);
    document.getElementById('landlords-report-cancel')?.addEventListener('click', close);
    overlay?.addEventListener('click', close);

    if (searchInput && suggestions) {
        searchInput.addEventListener('input', () => {
            clearTimeout(timeout);
            const value = searchInput.value.trim();
            if (!value) { suggestions.innerHTML = ''; suggestions.classList.add('hidden'); return; }
            timeout = setTimeout(() => {
                const matches = landlordsCache.filter(l => l.full_name.toLowerCase().includes(value.toLowerCase()));
                suggestions.innerHTML = '';
                if (!matches.length) { suggestions.classList.add('hidden'); return; }
                matches.forEach(l => {
                    const item = document.createElement('div');
                    item.className = 'suggestion-item';
                    item.textContent = l.full_name;
                    item.addEventListener('click', () => { searchInput.value = l.full_name; suggestions.classList.add('hidden'); });
                    suggestions.appendChild(item);
                });
                suggestions.classList.remove('hidden');
            }, 150);
        });
    }

    downloadBtn.addEventListener('click', async () => {
        const search = searchInput?.value || '';
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        const response = await apiFetchBlob(`/leases/landlords/export${params.toString() ? `?${params}` : ''}`);
        if (!response.ok) { showToast('Не вдалося сформувати звіт', 'error'); return; }
        downloadBlob(response,'landlords_report.xlsx');
        showToast('Звіт сформовано', 'success');
        close();
    });
}

function initParcelsDebtReportBtn() {
    document.getElementById('parcels-debt-report-btn')?.addEventListener('click', async () => {
        const response = await apiFetchBlob('/leases/parcels/debt-export');
        if (!response.ok) { showToast('Не вдалося сформувати звіт по боргу', 'error'); return; }
        downloadBlob(response,`lease_debt_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('Звіт по боргу сформовано', 'success');
    });
}

function initParcelsReportModal() {
    const openBtn = document.getElementById('parcels-report-btn');
    if (!openBtn) return;
    openBtn.addEventListener('click', async () => {
        const landlordId = document.getElementById('parcels-filter-landlord')?.value;
        const params = new URLSearchParams();
        if (landlordId) params.append('landlord_id', landlordId);
        const response = await apiFetchBlob(`/leases/parcels/export${params.toString() ? `?${params}` : ''}`);
        if (!response.ok) { showToast('Не вдалося сформувати звіт', 'error'); return; }
        downloadBlob(response,'parcels_report.xlsx');
        showToast('Звіт сформовано', 'success');
    });
}

function initPaymentsReportModal() {
    const modal = document.getElementById('payments-report-modal');
    const openBtn = document.getElementById('payments-report-btn');
    const downloadBtn = document.getElementById('payments-report-download');
    const overlay = modal?.querySelector('.modal-overlay');
    const startInput = document.getElementById('payments-report-start');
    const endInput = document.getElementById('payments-report-end');
    const startNative = document.getElementById('payments-report-start-native');
    const endNative = document.getElementById('payments-report-end-native');
    const startBtn = document.getElementById('payments-report-start-btn');
    const endBtn = document.getElementById('payments-report-end-btn');
    if (!modal || !openBtn || !downloadBtn) return;

    const open = async () => {
        if (!landlordsCache.length) {
            const resp = await apiFetch('/leases/landlords');
            if (resp.ok) landlordsCache = await resp.json();
        }
        const landlordSel = document.getElementById('payments-report-landlord');
        if (landlordSel) {
            landlordSel.innerHTML = '<option value="">Всі</option>' +
                landlordsCache.map(l => `<option value="${l.id}">${escapeHtml(l.full_name)}</option>`).join('');
            if (typeof refreshCustomSelect === 'function') refreshCustomSelect(landlordSel);
        }
        modal.classList.remove('hidden');
    };
    const close = () => modal.classList.add('hidden');
    openBtn.addEventListener('click', open);
    document.getElementById('payments-report-close')?.addEventListener('click', close);
    document.getElementById('payments-report-cancel')?.addEventListener('click', close);
    overlay?.addEventListener('click', close);
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
        const response = await apiFetchBlob(`/leases/payments/export${params.toString() ? `?${params}` : ''}`);
        if (!response.ok) { showToast('Не вдалося сформувати звіт', 'error'); return; }
        downloadBlob(response,'payments_report.xlsx');
        showToast('Звіт сформовано', 'success');
        close();
    });
}
