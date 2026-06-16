// ═══════════════════════════════════════════════════════════
// Люди (звичайні клієнти, не фермери)
// peopleCache читається з кількох розділів (intake views, contract
// dropdowns, farmer movements) — лишається видимим cross-file через
// спільний script realm.
// ═══════════════════════════════════════════════════════════

let peopleCache = [];
let personActionsCache = [];
let editingPersonId = null;

async function loadPeople() {
    const response = await apiFetch('/people');
    if (!response.ok) return;
    peopleCache = await response.json();
    renderPeopleTable();
    refreshPeopleActionsFilterOptions();
    refreshPeopleSelectors();
    // Якщо контракти фермерів вже відрендерені без людських імен (race-condition),
    // перемалюємо таблицю — тепер `peopleMap` побачить імена з peopleCache.
    if (typeof renderFarmerContractsTable === 'function' && Array.isArray(farmerContractsCache) && farmerContractsCache.length) {
        renderFarmerContractsTable(typeof applyFarmerContractsFilters === 'function' ? applyFarmerContractsFilters(farmerContractsCache) : farmerContractsCache);
    }
    if (typeof renderFarmerContractPaymentsTable === 'function' && Array.isArray(farmerContractPaymentsCache) && farmerContractPaymentsCache.length) {
        renderFarmerContractPaymentsTable(typeof applyFarmerContractPaymentsFilters === 'function' ? applyFarmerContractPaymentsFilters(farmerContractPaymentsCache) : farmerContractPaymentsCache);
    }
}

async function loadPeopleActions() {
    // Завантажуємо дії по всіх людях паралельно та об'єднуємо.
    if (!peopleCache.length) {
        personActionsCache = [];
        renderPeopleActionsTable();
        return;
    }
    const results = await Promise.allSettled(
        peopleCache.map(p =>
            apiFetch(`/people/${p.id}/actions`)
                .then(r => r.ok ? r.json() : [])
                .then(arr => arr.map(a => ({ ...a, person_id: p.id, person_name: p.full_name })))
        )
    );
    const merged = [];
    for (const r of results) {
        if (r.status === 'fulfilled') merged.push(...r.value);
    }
    merged.sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
    });
    personActionsCache = merged;
    renderPeopleActionsTable();
}

function renderPeopleTable() {
    const tbody = document.querySelector('#people-table tbody');
    if (!tbody) return;
    const search = (document.getElementById('people-search')?.value || '').trim().toLowerCase();
    const filtered = !search
        ? peopleCache
        : peopleCache.filter(p =>
            (p.full_name || '').toLowerCase().includes(search) ||
            (p.phone || '').toLowerCase().includes(search)
        );
    tbody.innerHTML = '';
    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Немає людей</td></tr>';
        return;
    }
    filtered.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(p.full_name)}</td>
            <td>${escapeHtml(p.phone || '—')}</td>
            <td class="actions-cell">
                <button class="btn-icon btn-icon-secondary" data-balance-person="${p.id}" title="Баланс зерна">${ICONS?.balance || '⚖'}</button>
                <button class="btn-icon btn-icon-secondary" data-edit-person="${p.id}" title="Редагувати">${ICONS?.edit || '✎'}</button>
            </td>
        `;
        tr.querySelector(`[data-edit-person="${p.id}"]`)?.addEventListener('click', () => openPersonEditModal(p));
        tr.querySelector(`[data-balance-person="${p.id}"]`)?.addEventListener('click', () => {
            if (typeof openFarmerBalanceModal === 'function') {
                openFarmerBalanceModal(p.id, { kind: 'person' });
            }
        });
        tbody.appendChild(tr);
    });
}

function applyPeopleActionsFilters() {
    const personFilter = document.getElementById('people-actions-filter-person')?.value || '';
    const typeFilter = document.getElementById('people-actions-filter-type')?.value || '';
    let filtered = [...personActionsCache];
    if (personFilter) {
        const pid = parseInt(personFilter, 10);
        filtered = filtered.filter(a => a.person_id === pid);
    }
    if (typeFilter) {
        filtered = filtered.filter(a => a.action_type === typeFilter);
    }
    return filtered;
}

function actionTypeLabel(type) {
    return ({
        contract: 'Контракт',
        contract_payment: 'Оплата',
        transfer: 'Переказ зерна',
    })[type] || type;
}

function renderPeopleActionsTable() {
    const tbody = document.querySelector('#people-actions-table tbody');
    const hint = document.getElementById('people-actions-hint');
    if (!tbody) return;
    const filtered = applyPeopleActionsFilters();
    tbody.innerHTML = '';
    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Немає дій</td></tr>';
        if (hint) hint.textContent = 'Поки що дій немає.';
        return;
    }
    if (hint) hint.textContent = '';
    filtered.forEach(a => {
        const tr = document.createElement('tr');
        const culture = a.culture_name ? ` (${escapeHtml(a.culture_name)})` : '';
        const qty = a.quantity_kg != null ? formatAmount(a.quantity_kg) : '—';
        const sum = a.amount_uah != null ? formatAmount(a.amount_uah) : '—';
        tr.innerHTML = `
            <td>${formatDate(a.created_at)}</td>
            <td>${escapeHtml(a.person_name || '—')}</td>
            <td>${escapeHtml(actionTypeLabel(a.action_type))}</td>
            <td>${escapeHtml(a.description || '')}${culture}</td>
            <td class="td-weight">${qty}</td>
            <td class="td-amount">${sum}</td>
        `;
        tbody.appendChild(tr);
    });
}

function refreshPeopleActionsFilterOptions() {
    const select = document.getElementById('people-actions-filter-person');
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">Усі люди</option>'
        + peopleCache.map(p => `<option value="${p.id}">${escapeHtml(p.full_name)}</option>`).join('');
    if (currentValue && peopleCache.some(p => String(p.id) === currentValue)) {
        select.value = currentValue;
    }
    if (typeof refreshCustomSelect === 'function') refreshCustomSelect(select);
}

/** Оновити опції людини в інших селектах (контракт, трансфер). */
function refreshPeopleSelectors() {
    const targets = [
        'farmer-contract-person',
        'farmer-transfer-person',
    ];
    for (const id of targets) {
        const sel = document.getElementById(id);
        if (!sel) continue;
        const current = sel.value;
        sel.innerHTML = '<option value="">Оберіть людину</option>'
            + peopleCache.map(p => `<option value="${p.id}">${escapeHtml(p.full_name)}${p.phone ? ' (' + escapeHtml(p.phone) + ')' : ''}</option>`).join('');
        if (current && peopleCache.some(p => String(p.id) === current)) sel.value = current;
        if (typeof refreshCustomSelect === 'function') refreshCustomSelect(sel);
    }
}

function openPersonAddModal() {
    editingPersonId = null;
    const modal = document.getElementById('person-modal');
    if (!modal) return;
    document.getElementById('person-modal-title').textContent = 'Додати людину';
    document.getElementById('person-edit-id').value = '';
    document.getElementById('person-name').value = '';
    document.getElementById('person-phone').value = '';
    const msg = document.getElementById('person-message');
    if (msg) { msg.textContent = ''; msg.classList.remove('error', 'success'); }
    modal.classList.remove('hidden');
}

function openPersonEditModal(person) {
    editingPersonId = person.id;
    const modal = document.getElementById('person-modal');
    if (!modal) return;
    document.getElementById('person-modal-title').textContent = 'Редагувати людину';
    document.getElementById('person-edit-id').value = person.id;
    document.getElementById('person-name').value = person.full_name || '';
    document.getElementById('person-phone').value = person.phone || '';
    const msg = document.getElementById('person-message');
    if (msg) { msg.textContent = ''; msg.classList.remove('error', 'success'); }
    modal.classList.remove('hidden');
}

function initPeopleSection() {
    document.getElementById('person-add-btn')?.addEventListener('click', openPersonAddModal);

    const modal = document.getElementById('person-modal');
    const closeBtn = document.getElementById('person-modal-close');
    const cancelBtn = document.getElementById('person-modal-cancel');
    const overlay = modal?.querySelector('.modal-overlay');
    const closeModal = () => { modal?.classList.add('hidden'); editingPersonId = null; };
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);

    const form = document.getElementById('person-form');
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('person-edit-id').value;
        const name = document.getElementById('person-name').value.trim();
        const phone = document.getElementById('person-phone').value.trim() || null;
        if (!name) {
            const msg = document.getElementById('person-message');
            if (msg) { msg.textContent = 'Вкажіть ПІБ'; msg.classList.add('error'); }
            return;
        }
        const url = id ? `/people/${id}` : '/people';
        const method = id ? 'PATCH' : 'POST';
        const response = await apiFetch(url, {
            method,
            body: JSON.stringify({ full_name: name, phone })
        });
        if (response.ok) {
            closeModal();
            await refreshAfterMutation(['people', 'peopleActions']);
            showToast(id ? 'Людину оновлено' : 'Людину додано', 'success');
        } else {
            const error = await response.json().catch(() => null);
            const msg = document.getElementById('person-message');
            if (msg) { msg.textContent = error?.detail || 'Помилка збереження'; msg.classList.add('error'); }
        }
    });

    let searchTimer;
    document.getElementById('people-search')?.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(renderPeopleTable, 150);
    });
    document.getElementById('people-actions-filter-person')?.addEventListener('change', renderPeopleActionsTable);
    document.getElementById('people-actions-filter-type')?.addEventListener('change', renderPeopleActionsTable);

    // Експорти
    document.getElementById('people-list-export-btn')?.addEventListener('click', async () => {
        try {
            const resp = await apiFetchBlob('/people/export');
            if (!resp.ok) {
                showToast('Не вдалося згенерувати звіт', 'error');
                return;
            }
            await downloadBlob(resp, `people_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (e) {
            showToast('Помилка експорту', 'error');
        }
    });

    // Звіт залишків зерна у людей (зведена таблиця + Excel)
    document.getElementById('people-balances-export-btn')?.addEventListener('click', () => {
        if (typeof openPeopleBalancesModal === 'function') openPeopleBalancesModal();
    });
    const pbModal = document.getElementById('people-balances-modal');
    if (pbModal) {
        const closePb = () => pbModal.classList.add('hidden');
        document.getElementById('people-balances-close')?.addEventListener('click', closePb);
        document.getElementById('people-balances-close-btn')?.addEventListener('click', closePb);
        pbModal.querySelector('.modal-overlay')?.addEventListener('click', closePb);
        document.getElementById('people-balances-download-btn')?.addEventListener('click', async (event) => {
            const btn = event.currentTarget;
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Готується...';
            try {
                const response = await apiFetchBlob('/grain/persons/balances/export');
                if (!response.ok) {
                    const err = await response.json().catch(() => null);
                    showToast(err?.detail || 'Не вдалося сформувати звіт', 'error');
                    return;
                }
                await downloadBlob(response, `persons_balances_${new Date().toISOString().slice(0, 10)}.xlsx`);
                showToast('Звіт сформовано', 'success');
            } catch (e) {
                showToast('Помилка експорту', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    }

    document.getElementById('people-actions-export-btn')?.addEventListener('click', async () => {
        // Поважаємо поточні фільтри з UI
        const personId = document.getElementById('people-actions-filter-person')?.value || '';
        const actionType = document.getElementById('people-actions-filter-type')?.value || '';
        const params = new URLSearchParams();
        if (personId) params.set('person_id', personId);
        if (actionType) params.set('action_type', actionType);
        const path = `/people/actions/export${params.toString() ? `?${params}` : ''}`;
        try {
            const resp = await apiFetchBlob(path);
            if (!resp.ok) {
                showToast('Не вдалося згенерувати звіт', 'error');
                return;
            }
            await downloadBlob(resp, `people_actions_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (e) {
            showToast('Помилка експорту', 'error');
        }
    });
}
