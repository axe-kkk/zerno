// ═══════════════════════════════════════════════════════════
// Оренда землі (Landlords + Contracts + Lease Payments)
// landlordsCache читається в quick-add-helper-і у dashboard.js
// (populateLandlordSelect/getLandlordQuickAdd) — лишається cross-file видимою.
// Залежності з dashboard.js: populateLandlordSelect, getLandlordQuickAdd,
// refreshAfterMutation, bindDatePicker, initCustomSelects, refreshCustomSelect,
// culturesCache, ICONS і набір core-утиліт.
// cancelPayment(...) викликається з HTML onclick — лишається глобально доступною
// як top-level function у classic-script realm.
// ═══════════════════════════════════════════════════════════

let landlordsCache = [];
let contractsCache = [];
let paymentsCache = [];
let editingLandlordId = null;
let deletingLandlordId = null;
let editingContractId = null;
let deletingContractId = null;
let cancellingPaymentId = null;

/** Перевипуск дозволений лише після останнього дня дії (включно з end_date ще діє) */
function isLeaseContractTermEndedStrict(contract) {
    if (!contract.end_date) return false;
    const end = toLocalDateOnly(contract.end_date);
    return todayLocalDateOnly().getTime() > end.getTime();
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

function getFieldName(fieldId) {
    if (!fieldId) return '-';
    const found = fieldsCache.find(f => f.id === fieldId);
    return found ? found.name : '-';
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
    // Перезаповнюємо всі landlord-селекти
    ['contract-landlord-select', 'payment-landlord-select'].forEach(id => {
        if (document.getElementById(id) && typeof populateLandlordSelect === 'function') {
            populateLandlordSelect(id);
        }
    });
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
            <td>${landlord.phone || emptyValueHtml()}</td>
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
    const lf = document.getElementById('landlord-form');
    if (lf) {
        clearFormValidationState(lf, 'landlord-message');
        lf.reset();
    }
    document.getElementById('landlord-modal').classList.remove('hidden');
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
    
    if (!modal || !form || !closeBtn || !overlay) {
        return;
    }

    formBindInvalidHighlightClearing(form);
    
    const closeLandlordModal = () => {
        clearFormValidationState(form, 'landlord-message');
        modal.classList.add('hidden');
    };

    closeBtn.addEventListener('click', closeLandlordModal);
    overlay.addEventListener('click', closeLandlordModal);
    document.getElementById('landlord-modal-cancel')?.addEventListener('click', closeLandlordModal);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const fullName = document.getElementById('landlord-full-name').value.trim();
        const phone = document.getElementById('landlord-phone').value.trim();
        
        if (!fullName) {
            formShowValidationError(form, 'landlord-message', 'Вкажіть ПІБ', ['landlord-full-name']);
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
            clearFormValidationState(form, 'landlord-message');
            closeLandlordModal();
            await refreshAfterMutation(['landlords', 'contracts']);
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
            await refreshAfterMutation(['landlords', 'contracts', 'fields', 'payments']);
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
}

function renderContractsTable() {
    const tableBody = document.querySelector('#contracts-table tbody');
    if (!tableBody) {
        return;
    }
    tableBody.innerHTML = '';
    const filterLandlord = document.getElementById('contracts-filter-landlord')?.value || '';
    const filterStatus = document.getElementById('contracts-filter-status')?.value || '';
    const filterSearch = (document.getElementById('contracts-filter-search')?.value || '').trim().toLowerCase();
    const filtered = contractsCache.filter(c => {
        if (filterLandlord && String(c.landlord_id) !== filterLandlord) return false;
        if (filterStatus === 'active' && !c.is_active) return false;
        if (filterStatus === 'inactive' && c.is_active) return false;
        if (filterStatus === 'due' && !(c.has_debt || (c.remaining_cash_uah && c.remaining_cash_uah > 0.01))) return false;
        if (filterSearch) {
            const hay = `${c.landlord_full_name || ''} ${c.field_name || ''} #${c.id}`.toLowerCase();
            if (!hay.includes(filterSearch)) return false;
        }
        return true;
    });
    if (!filtered.length) {
        tableBody.innerHTML = '<tr><td colspan="5" class="table-empty-message">Контрактів не знайдено</td></tr>';
        return;
    }
    filtered.forEach(contract => {
        const row = document.createElement('tr');
        if (!contract.is_active) row.classList.add('row-muted');
        if (contract.is_overdue) row.classList.add('row-overdue');

        const expired = contract.is_expired;
        let statusBadge;
        if (contract.is_overdue) {
            statusBadge = '<span class="status-badge danger">Не виплачено</span>';
        } else if (expired) {
            statusBadge = '<span class="status-badge warning">Завершений</span>';
        } else if (contract.is_active) {
            statusBadge = '<span class="status-badge success">Активний</span>';
        } else {
            statusBadge = '<span class="status-badge muted">Неактивний</span>';
        }

        const endDateStr = contract.end_date ? formatDateOnly(contract.end_date) : emptyValueHtml();
        const dateRange = `${formatDateOnly(contract.contract_date)} — ${endDateStr}`;

        const termEndedStrict = isLeaseContractTermEndedStrict(contract);
        const canRenew = Boolean(contract.is_active && termEndedStrict);
        let renewTitle = 'Перевипустити';
        if (!contract.is_active) {
            renewTitle = 'Контракт не активний';
        } else if (!contract.end_date) {
            renewTitle = 'Вкажіть дату закінчення контракту для перевипуску';
        } else if (!termEndedStrict) {
            renewTitle = 'Доступно після закінчення строку дії контракту';
        }

        const renewBtnClass = canRenew ? 'btn-icon-primary' : 'btn-icon-secondary';
        const renewDisabled = canRenew ? '' : ' disabled';

        let actionsHtml = `
            <button type="button" class="btn-icon btn-icon-secondary" data-view="${contract.id}" title="Переглянути">${ICONS.view}</button>
            <button type="button" class="btn-icon btn-icon-secondary" data-edit="${contract.id}" title="Редагувати">${ICONS.edit}</button>
            <button type="button" class="btn-icon ${renewBtnClass}" data-renew="${contract.id}" title="${renewTitle}"${renewDisabled}>${ICONS.renew}</button>
            <button type="button" class="btn-icon btn-icon-danger" data-delete="${contract.id}" title="Видалити">${ICONS.delete}</button>`;

        row.innerHTML = `
            <td><strong>${contract.landlord_full_name}</strong></td>
            <td>${contract.field_name}</td>
            <td>${dateRange}</td>
            <td>${statusBadge}</td>
            <td class="actions-cell">${actionsHtml}</td>
        `;
        row.querySelector(`[data-view="${contract.id}"]`).addEventListener('click', () => {
            openContractViewModal(contract);
        });
        row.querySelector(`[data-edit="${contract.id}"]`).addEventListener('click', () => {
            openContractEditModal(contract);
        });
        const renewBtn = row.querySelector(`[data-renew="${contract.id}"]`);
        if (renewBtn && canRenew) {
            renewBtn.addEventListener('click', () => openContractRenewModal(contract));
        }
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
    initContractRenewModal();
    initContractLandlordSearch();
    initContractsFilter();
    initContractsReportModal();
    initContractsDebtReportBtn();
    
    const addItemBtn = document.getElementById('contract-add-item');
    if (addItemBtn) {
        addItemBtn.addEventListener('click', addContractItem);
    }
}

let renewingContractId = null;

function openContractRenewModal(contract) {
    const modal = document.getElementById('contract-renew-modal');
    if (!modal) return;

    renewingContractId = contract.id;

    const info = document.getElementById('contract-renew-info');
    info.textContent = `Перевипуск контракту: ${contract.landlord_full_name} — ${contract.field_name}`;

    const dateInput = document.getElementById('contract-renew-date');
    const dateNative = document.getElementById('contract-renew-date-native');
    if (contract.end_date) {
        const d = new Date(contract.end_date);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        dateInput.value = `${dd}.${mm}.${yyyy}`;
        dateNative.value = `${yyyy}-${mm}-${dd}`;
    } else {
        dateInput.value = '';
        dateNative.value = '';
    }

    document.getElementById('contract-renew-note').value = '';

    const tbody = document.getElementById('contract-renew-items-tbody');
    const items = contract.contract_items || [];
    tbody.innerHTML = items.map(item => `
        <tr data-culture-id="${item.culture_id}">
            <td>${item.culture_name || 'Культура #' + item.culture_id}</td>
            <td><input type="number" class="renew-qty" value="${item.quantity_kg}" min="0" step="0.01" style="width:120px;"></td>
            <td><input type="number" class="renew-price" value="${item.price_per_kg_uah}" min="0" step="0.01" style="width:120px;"></td>
        </tr>
    `).join('');

    const msg = document.getElementById('contract-renew-message');
    if (msg) { msg.classList.add('hidden'); msg.textContent = ''; }

    modal.classList.remove('hidden');
}

function initContractRenewModal() {
    const modal = document.getElementById('contract-renew-modal');
    const closeBtn = document.getElementById('contract-renew-close');
    const cancelBtn = document.getElementById('contract-renew-cancel');
    const submitBtn = document.getElementById('contract-renew-submit');
    const overlay = modal?.querySelector('.modal-overlay');
    const dateInput = document.getElementById('contract-renew-date');
    const dateNative = document.getElementById('contract-renew-date-native');
    const dateBtn = document.getElementById('contract-renew-date-btn');

    if (!modal || !submitBtn) return;

    const close = () => modal.classList.add('hidden');
    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);
    overlay?.addEventListener('click', close);
    if (dateInput && dateNative && dateBtn) {
        bindDatePicker(dateInput, dateNative, dateBtn);
    }

    submitBtn.addEventListener('click', async () => {
        const dateIso = parseDateInput(dateInput.value, 'дата початку');
        if (dateIso === undefined) return;
        if (!dateIso) {
            setFormMessage('contract-renew-message', 'Вкажіть дату початку', true);
            return;
        }

        const rows = document.querySelectorAll('#contract-renew-items-tbody tr');
        const items = [];
        for (const row of rows) {
            const cultureId = parseInt(row.dataset.cultureId);
            const qty = parseFloat(row.querySelector('.renew-qty').value);
            const price = parseFloat(row.querySelector('.renew-price').value);
            if (!qty || qty <= 0 || !price || price <= 0) {
                setFormMessage('contract-renew-message', 'Вкажіть кількість і ціну для кожної позиції', true);
                return;
            }
            items.push({ culture_id: cultureId, quantity_kg: qty, price_per_kg_uah: price });
        }

        const note = document.getElementById('contract-renew-note').value.trim();

        submitBtn.disabled = true;
        submitBtn.textContent = 'Збереження...';
        try {
            const response = await apiFetch(`/leases/contracts/${renewingContractId}/renew`, {
                method: 'POST',
                body: JSON.stringify({
                    contract_date: new Date(dateIso).toISOString(),
                    contract_items: items,
                    note: note || null
                })
            });
            if (response.ok) {
                showToast('Контракт перевипущено');
                close();
                await refreshAfterMutation(['contracts', 'fields', 'landlords', 'dashboard']);
            } else {
                const err = await response.json().catch(() => ({}));
                setFormMessage('contract-renew-message', err.detail || 'Помилка перевипуску', true);
            }
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Перевипустити';
        }
    });
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
    const cform = document.getElementById('contract-form');
    if (cform) {
        clearFormValidationState(cform, 'contract-message');
        cform.reset();
    }
    document.getElementById('contract-landlord-id').value = '';
    const landlordSel = document.getElementById('contract-landlord-select');
    if (landlordSel) {
        if (typeof populateLandlordSelect === 'function') populateLandlordSelect('contract-landlord-select');
        landlordSel.value = '';
        if (typeof refreshCustomSelect === 'function') refreshCustomSelect(landlordSel);
    }
    document.getElementById('contract-is-active').checked = true;
    resetContractItems();
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
    const landlordSelE = document.getElementById('contract-landlord-select');
    if (landlordSelE) {
        if (typeof populateLandlordSelect === 'function') populateLandlordSelect('contract-landlord-select');
        landlordSelE.value = String(contract.landlord_id || '');
        if (typeof refreshCustomSelect === 'function') refreshCustomSelect(landlordSelE);
    }
    document.getElementById('contract-landlord-id').value = contract.landlord_id;
    document.getElementById('contract-field-name').value = contract.field_name;
    const contractDate = new Date(contract.contract_date);
    document.getElementById('contract-date-native').value = contractDate.toISOString().split('T')[0];
    document.getElementById('contract-date').value = formatDateInput(contractDate);
    document.getElementById('contract-note').value = contract.note || '';
    document.getElementById('contract-is-active').checked = contract.is_active;
    const cform = document.getElementById('contract-form');
    if (cform) clearFormValidationState(cform, 'contract-message');
    
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

    formBindInvalidHighlightClearing(form);

    const contractItemsTableWrap = document.getElementById('contract-items-table')?.closest('.form-field');
    
    const closeModal = () => {
        clearFormValidationState(form, 'contract-message');
        modal.classList.add('hidden');
        form.reset();
        document.getElementById('contract-landlord-id').value = '';
        const lsel = document.getElementById('contract-landlord-select');
        if (lsel) {
            lsel.value = '';
            if (typeof refreshCustomSelect === 'function') refreshCustomSelect(lsel);
        }
        resetContractItems();
        editingContractId = null;
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
                        await refreshAfterMutation(['contracts', 'payments', 'fields']);
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
        const landlordSelEl = document.getElementById('contract-landlord-select');
        const landlordId = landlordSelEl?.value || document.getElementById('contract-landlord-id').value;
        if (landlordId) document.getElementById('contract-landlord-id').value = landlordId;
        const fieldName = document.getElementById('contract-field-name').value.trim();
        
        // Получаем позиции контракта из таблицы
        const contractItems = [];
        const filledContractRows = [];
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
                filledContractRows.push(row);
            }
        });
        
        const dateNative = document.getElementById('contract-date-native').value;
        const note = document.getElementById('contract-note').value.trim();
        const isActive = document.getElementById('contract-is-active').checked;
        
        if (!landlordId) {
            formShowValidationError(form, 'contract-message', 'Виберіть орендодавця', ['contract-landlord-select']);
            return;
        }
        if (!fieldName) {
            formShowValidationError(form, 'contract-message', 'Вкажіть назву поля', ['contract-field-name']);
            return;
        }
        if (contractItems.length === 0) {
            formShowValidationError(form, 'contract-message', 'Додайте хоча б одну позицію контракту', [], contractItemsTableWrap ? [contractItemsTableWrap] : []);
            return;
        }
        // Проверяем валидность каждой позиции
        for (let i = 0; i < contractItems.length; i++) {
            const item = contractItems[i];
            const errRow = filledContractRows[i];
            if (!item.culture_id || item.culture_id <= 0) {
                formShowValidationError(form, 'contract-message', `Виберіть культуру для позиції ${i + 1}`, [], errRow ? [errRow] : []);
                return;
            }
            if (Number.isNaN(item.quantity_kg) || item.quantity_kg <= 0) {
                formShowValidationError(form, 'contract-message', `Вкажіть коректну кількість для позиції ${i + 1}`, [], errRow ? [errRow] : []);
                return;
            }
            if (Number.isNaN(item.price_per_kg_uah) || item.price_per_kg_uah <= 0) {
                formShowValidationError(form, 'contract-message', `Вкажіть коректну ціну для позиції ${i + 1}`, [], errRow ? [errRow] : []);
                return;
            }
        }
        if (!dateNative) {
            formShowValidationError(form, 'contract-message', 'Вкажіть дату контракту', ['contract-date']);
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
            clearFormValidationState(form, 'contract-message');
            form.reset();
            document.getElementById('contract-landlord-id').value = '';
            const lsel2 = document.getElementById('contract-landlord-select');
            if (lsel2) {
                lsel2.value = '';
                if (typeof refreshCustomSelect === 'function') refreshCustomSelect(lsel2);
            }
            resetContractItems();
            editingContractId = null;
            modal.classList.add('hidden');
            await refreshAfterMutation(['contracts', 'payments', 'fields', 'landlords', 'dashboard']);
        } else {
            const error = await response.json().catch(() => null);
            setFormMessage('contract-message', error?.detail || 'Помилка збереження', true);
        }
    });
}

function initContractLandlordSearch() {
    const select = document.getElementById('contract-landlord-select');
    const landlordIdInput = document.getElementById('contract-landlord-id');
    if (!select || !landlordIdInput) return;

    if (typeof populateLandlordSelect === 'function') populateLandlordSelect('contract-landlord-select');

    select.addEventListener('change', () => {
        landlordIdInput.value = select.value || '';
    });
}

function updateContractLandlordBadge() {
    // Заглушка для обратной совместимости — старый бейдж видалено,
    // селект сам показує обраного орендодавця.
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
            await refreshAfterMutation(['contracts', 'payments', 'fields', 'dashboard']);
        } else {
            const error = await response.json().catch(() => null);
            showToast(error?.detail || 'Помилка видалення', 'error');
        }
    });
}

async function openContractViewModal(contract) {
    document.getElementById('view-contract-landlord').textContent = contract.landlord_full_name;
    document.getElementById('view-contract-field').textContent = contract.field_name;
    document.getElementById('view-contract-date').textContent = formatDateOnly(contract.contract_date);
    const setStatusBadge = (html) => {
        const el = document.getElementById('view-contract-status');
        if (el) el.innerHTML = html;
    };
    // Початковий статус — з кешу (потім оновимо за актуальним балансом).
    if (contract.is_overdue) {
        setStatusBadge('<span class="status-badge danger">Не виплачено</span>');
    } else if (contract.is_expired) {
        setStatusBadge('<span class="status-badge warning">Завершений</span>');
    } else if (contract.is_active) {
        setStatusBadge('<span class="status-badge success">Активний</span>');
    } else {
        setStatusBadge('<span class="status-badge muted">Неактивний</span>');
    }
    const noteEl = document.getElementById('view-contract-note');
    if (noteEl) {
        noteEl.innerHTML = contract.note ? escapeHtml(contract.note) : emptyValueHtml();
    }
    
    // Заполняем позиции контракта
    const itemsTbody = document.getElementById('view-contract-items-tbody');
    itemsTbody.innerHTML = '';
    if (contract.contract_items && contract.contract_items.length > 0) {
        contract.contract_items.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.culture_name ? escapeHtml(item.culture_name) : emptyValueHtml()}</td>
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

        // Оновлюємо статус у модалці за актуальним залишком/прострочкою.
        const totalRemainingUah = (balance.items || []).reduce((acc, it) => acc + (parseFloat(it.remaining_cash_uah) || 0), 0);
        const hasDebt = totalRemainingUah > 0.01;
        if (balance.is_expired && hasDebt) {
            setStatusBadge('<span class="status-badge danger">Не виплачено</span>');
        } else if (balance.is_expired) {
            setStatusBadge('<span class="status-badge warning">Завершений</span>');
        } else if (contract.is_active) {
            setStatusBadge('<span class="status-badge success">Активний</span>');
        } else {
            setStatusBadge('<span class="status-badge muted">Неактивний</span>');
        }
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

    const periodText = `${fmtDate(balance.period_start)} — ${fmtDate(balance.period_end)}`;
    const expired = balance.is_expired;

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
            <div class="contract-balance-period">${periodText}${expired ? ' <span class="status-badge warning" style="margin-left:8px;">Завершений</span>' : ''}</div>
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
        let sumText = emptyValueHtml();
        if (payment.grain_items && payment.grain_items.length > 0) {
            const grainParts = payment.grain_items.map(item =>
                `<span class="inline-badge grain">${formatWeight(item.quantity_kg)} ${item.culture_name ? escapeHtml(item.culture_name) : emptyValueHtml()}</span>`
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
            <td><strong>${payment.landlord_full_name ? escapeHtml(payment.landlord_full_name) : emptyValueHtml()}</strong></td>
            <td>${payment.contract_field_name ? escapeHtml(payment.contract_field_name) : emptyValueHtml()}</td>
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
                const scopes = ['payments', 'contracts', 'dashboard'];
                if (cancelled.payment_type === 'grain') {
                    scopes.push('stock', 'stockAdjustments');
                } else {
                    scopes.push('cash', 'cashTransactions');
                }
                await refreshAfterMutation(scopes);
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
    const paymentForm = document.getElementById('payment-form');
    if (paymentForm) {
        clearFormValidationState(paymentForm, 'payment-message');
        paymentForm.reset();
    }
    const psel = document.getElementById('payment-landlord-select');
    if (psel) {
        if (typeof populateLandlordSelect === 'function') populateLandlordSelect('payment-landlord-select');
        psel.value = '';
        if (typeof refreshCustomSelect === 'function') refreshCustomSelect(psel);
    }
    document.getElementById('payment-landlord-id').value = '';
    const contractSel = document.getElementById('payment-contract');
    if (contractSel) {
        contractSel.value = '';
        contractSel.disabled = true;
        contractSel.innerHTML = '<option value="">Спочатку оберіть орендодавця</option>';
    }
    document.getElementById('payment-type').value = 'grain';
    document.getElementById('payment-currency').value = 'UAH';
    document.getElementById('payment-rate').value = '';
    document.getElementById('payment-rate-field').classList.add('hidden');
    paymentBalance = null;
    document.getElementById('payment-balance-card').classList.add('hidden');
    document.getElementById('payment-grain-items-list').innerHTML =
        '<div class="grain-items-placeholder">Оберіть контракт</div>';
    updatePaymentFields();

    document.getElementById('payment-modal').classList.remove('hidden');

    setTimeout(() => {
        const contractSelect = document.getElementById('payment-contract');
        const typeSelect = document.getElementById('payment-type');
        if (contractSelect && typeof initCustomSelects === 'function') initCustomSelects(contractSelect);
        if (typeSelect && typeof initCustomSelects === 'function') initCustomSelects(typeSelect);
    }, 100);
}

let paymentLandlordContractsCache = [];

function updatePaymentContractSelectForLandlord() {
    const select = document.getElementById('payment-contract');
    if (!select) return;
    if (!paymentLandlordContractsCache.length) {
        select.disabled = true;
        select.innerHTML = '<option value="">Немає контрактів з боргом</option>';
        if (typeof refreshCustomSelect === 'function') refreshCustomSelect(select);
        return;
    }
    select.disabled = false;
    select.innerHTML = '<option value="">Оберіть контракт</option>' +
        paymentLandlordContractsCache
            .map(c => {
                const inactive = !c.is_active ? ' [старий]' : '';
                const debt = (c.remaining_cash_uah && c.remaining_cash_uah > 0.01)
                    ? ` — борг ${formatAmount(c.remaining_cash_uah)} грн`
                    : '';
                return `<option value="${c.id}">${c.landlord_full_name} — ${c.field_name}${inactive}${debt}</option>`;
            })
            .join('');
    if (typeof refreshCustomSelect === 'function') refreshCustomSelect(select);
}

async function onPaymentLandlordChange(landlordId) {
    paymentLandlordContractsCache = [];
    const contractSel = document.getElementById('payment-contract');
    if (contractSel) {
        contractSel.value = '';
        contractSel.disabled = true;
        contractSel.innerHTML = '<option value="">Завантаження…</option>';
        if (typeof refreshCustomSelect === 'function') refreshCustomSelect(contractSel);
    }
    paymentBalance = null;
    document.getElementById('payment-balance-card').classList.add('hidden');
    document.getElementById('payment-grain-items-list').innerHTML =
        '<div class="grain-items-placeholder">Оберіть контракт</div>';
    if (!landlordId) {
        if (contractSel) {
            contractSel.innerHTML = '<option value="">Спочатку оберіть орендодавця</option>';
            if (typeof refreshCustomSelect === 'function') refreshCustomSelect(contractSel);
        }
        return;
    }

    try {
        const resp = await apiFetch(`/leases/contracts?landlord_id=${encodeURIComponent(landlordId)}&due_only=true`);
        if (!resp.ok) throw new Error();
        paymentLandlordContractsCache = await resp.json();
    } catch (e) {
        paymentLandlordContractsCache = [];
    }
    updatePaymentContractSelectForLandlord();
}

function initPaymentLandlordSearch() {
    const select = document.getElementById('payment-landlord-select');
    const idInput = document.getElementById('payment-landlord-id');
    if (!select || !idInput) return;

    if (typeof populateLandlordSelect === 'function') populateLandlordSelect('payment-landlord-select');

    select.addEventListener('change', async () => {
        const id = select.value;
        idInput.value = id || '';
        await onPaymentLandlordChange(id || '');
    });
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
    periodEl.textContent = `${fmtDate(paymentBalance.period_start)} — ${fmtDate(paymentBalance.period_end)}`;

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

    formBindInvalidHighlightClearing(form);

    const closePaymentModal = () => {
        clearFormValidationState(form, 'payment-message');
        modal.classList.add('hidden');
    };
    closeBtn.addEventListener('click', closePaymentModal);
    overlay.addEventListener('click', closePaymentModal);

    initPaymentLandlordSearch();

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
            formShowValidationError(form, 'payment-message', 'Виберіть контракт', ['payment-contract']);
            return;
        }
        if (!paymentBalance) {
            formShowValidationError(form, 'payment-message', 'Зачекайте, завантажується залишок', ['payment-contract']);
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
                    formShowValidationError(form, 'payment-message',
                        `Перевищено залишок: макс. ${maxQty} кг`, [], [row]);
                    return;
                }
                payload.grain_items.push({
                    culture_id: parseInt(cultureId),
                    quantity_kg: qty
                });
            }
            if (payload.grain_items.length === 0) {
                const grainBlock = document.getElementById('payment-grain-fields');
                formShowValidationError(form, 'payment-message',
                    'Вкажіть кількість хоча б для однієї культури', [], [grainBlock].filter(Boolean));
                return;
            }
        } else {
            // Cash
            const cultureId = document.getElementById('payment-cash-culture').value;
            const amount = parseFloat(document.getElementById('payment-amount').value);
            const currency = document.getElementById('payment-currency').value;
            const rate = parseFloat(document.getElementById('payment-rate').value) || 0;

            if (!cultureId) {
                formShowValidationError(form, 'payment-message', 'Виберіть культуру', ['payment-cash-culture']);
                return;
            }
            if (isNaN(amount) || amount <= 0) {
                formShowValidationError(form, 'payment-message', 'Вкажіть суму', ['payment-amount']);
                return;
            }
            if (currency !== 'UAH' && (!rate || rate <= 0)) {
                formShowValidationError(form, 'payment-message', `Вкажіть курс ${currency} до грн`, ['payment-rate']);
                return;
            }

            const amountUah = currency === 'UAH' ? amount : amount * rate;

            const balItem = paymentBalance.items.find(i => i.culture_id == cultureId);
            if (!balItem) {
                formShowValidationError(form, 'payment-message', 'Культуру не знайдено', ['payment-cash-culture']);
                return;
            }
            const equivKg = balItem.price_per_kg_uah > 0
                ? amountUah / balItem.price_per_kg_uah : 0;
            if (equivKg > balItem.remaining_kg + 0.01) {
                const maxMsg = currency === 'UAH'
                    ? `макс. ${balItem.remaining_cash_uah} грн`
                    : `макс. ${(balItem.remaining_cash_uah / rate).toFixed(2)} ${currency}`;
                formShowValidationError(form, 'payment-message',
                    `Сума перевищує залишок: ${maxMsg}`, ['payment-amount']);
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
            clearFormValidationState(form, 'payment-message');
            modal.classList.add('hidden');
            const scopes = ['payments', 'contracts', 'dashboard'];
            if (paymentType === 'grain') {
                scopes.push('stock', 'stockAdjustments');
            } else {
                scopes.push('cash', 'cashTransactions');
            }
            await refreshAfterMutation(scopes);
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

// NOTE: список контрактів для виплат формується після вибору орендодавця (див. initPaymentLandlordSearch).


// formatDateInput — у core.js

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
    const searchInput = document.getElementById('contracts-filter-search');
    if (landlordSel) landlordSel.addEventListener('change', () => renderContractsTable());
    if (statusSel) statusSel.addEventListener('change', () => renderContractsTable());
    if (searchInput) {
        let timer;
        searchInput.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(renderContractsTable, 150);
        });
    }
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

function initContractsDebtReportBtn() {
    const btn = document.getElementById('contracts-debt-report-btn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        const response = await apiFetchBlob('/leases/contracts/debt-export');
        if (!response.ok) {
            const error = await response.json().catch(() => null);
            showToast(error?.detail || 'Не вдалося сформувати звіт по боргу', 'error');
            return;
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `lease_debt_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showToast('Звіт по боргу сформовано', 'success');
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
