// ═══════════════════════════════════════════════════════════
// Контракти фермерів (Farmer Contracts + Payments + Reserve activation)
// farmerContractsCache, farmerContractPaymentsCache читаються журналом
// дій по людях у people.js — лишаються cross-file видимими.
// openFarmerContractPaymentModal — callback, що ставиться init-ом
// initFarmerContractPaymentModal і викликається з інших розділів (Owners, Vouchers).
// Залежності: ownersCache, culturesCache, purchaseStockCache, peopleCache,
// usersCache, ICONS, refreshAfterMutation, bindDatePicker, initCustomSelects,
// refreshCustomSelect, getOwnerName, getCultureName, populateOwnerSelect,
// formatAmount/formatDate/escapeHtml/etc — з dashboard.js та core.js.
// ═══════════════════════════════════════════════════════════

let farmerContractsCache = [];
let farmerContractPaymentsCache = [];
let currentFarmerContractId = null;
let openFarmerContractPaymentModal = null;

async function openReserveActivateModal(contractId) {
    const modal = document.getElementById('reserve-activate-modal');
    const idEl = document.getElementById('reserve-activate-id');
    const itemsContainer = document.getElementById('reserve-activate-items');
    const closeBtn = document.getElementById('reserve-activate-close');
    const cancelBtn = document.getElementById('reserve-activate-cancel');
    const confirmBtn = document.getElementById('reserve-activate-confirm');
    const overlay = modal?.querySelector('.modal-overlay');

    idEl.textContent = `#${contractId}`;
    itemsContainer.innerHTML = '';
    modal.classList.remove('hidden');

    const close = () => modal.classList.add('hidden');

    let contractData = null;
    try {
        const resp = await apiFetch(`/farmer-contracts/${contractId}`);
        if (!resp.ok) {
            showToast('Не вдалося завантажити контракт', 'error');
            close();
            return;
        }
        contractData = await resp.json();
    } catch (e) {
        showToast('Помилка завантаження', 'error');
        close();
        return;
    }

    const items = (contractData.items || []).filter(it => it.direction === 'from_company');
    if (items.length === 0) {
        itemsContainer.innerHTML = '<p class="text-muted">Немає позицій для вказання ціни.</p>';
    } else {
        const table = document.createElement('table');
        table.className = 'table reserve-activate-table';
        table.innerHTML = '<thead><tr><th>Позиція</th><th>Кількість</th><th>Ціна за кг, ₴</th></tr></thead><tbody></tbody>';
        const tbody = table.querySelector('tbody');
        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.item_name ? escapeHtml(item.item_name) : emptyValueHtml()}</td>
                <td>${Number(item.quantity_kg).toFixed(2)} кг</td>
                <td><input type="number" step="0.01" min="0" class="form-input reserve-activate-price" data-item-id="${item.id}" placeholder="0.00" value=""></td>
            `;
            tbody.appendChild(tr);
        });
        itemsContainer.appendChild(table);
    }

    const onConfirm = async () => {
        const priceInputs = itemsContainer.querySelectorAll('.reserve-activate-price');
        const payloadItems = [];
        let valid = true;
        priceInputs.forEach(input => {
            const id = parseInt(input.dataset.itemId, 10);
            const val = input.value.trim();
            const num = val === '' ? NaN : parseFloat(val);
            if (isNaN(num) || num < 0) {
                valid = false;
                input.classList.add('input-error');
            } else {
                input.classList.remove('input-error');
                payloadItems.push({ contract_item_id: id, price_per_kg: num });
            }
        });
        if (!valid) {
            showToast('Вкажіть коректну ціну (≥ 0) для всіх позицій', 'error');
            return;
        }
        if (payloadItems.length === 0 && items.length > 0) {
            showToast('Вкажіть ціни для позицій', 'error');
            return;
        }

        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Активація...';
        try {
            const resp = await apiFetch(`/farmer-contracts/${contractId}/activate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: payloadItems })
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => null);
                showToast(err?.detail || 'Помилка активації', 'error');
                return;
            }
            showToast('Контракт активовано', 'success');
            close();
            await refreshAfterMutation(['farmerContracts', 'stock', 'purchaseStock', 'stockAdjustments', 'dashboard']);
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Активувати';
        }
    };

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
            await refreshAfterMutation(['farmerContracts', 'stock', 'purchaseStock', 'stockAdjustments', 'dashboard']);
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
            await refreshAfterMutation([
                'farmerContracts', 'farmerContractPayments',
                'stock', 'purchaseStock', 'stockAdjustments',
                'cash', 'cashTransactions', 'vouchers', 'owners',
                'people', 'peopleActions', 'dashboard'
            ]);
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
    const peopleMap = new Map((peopleCache || []).map(p => [p.id, p.full_name]));
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

        let ownerName;
        if (contract.person_id) {
            const pname = peopleMap.get(contract.person_id);
            ownerName = pname ? `${pname} (людина)` : `#${contract.person_id} (людина)`;
        } else {
            ownerName = ownersMap.get(contract.owner_id) || `#${contract.owner_id}`;
        }
        const st = statusMap[contract.status] || { label: contract.status, cls: 'warning' };
        let typeLabel = typeLabels[contract.contract_type] || contract.contract_type;
        if (contract.was_reserve) typeLabel += ' (резерв)';

        document.getElementById('fc-detail-owner').textContent = ownerName;
        document.getElementById('fc-detail-type').textContent = typeLabel;
        const hasUndelivered = contract.items && contract.items.some(
            i => i.item_type !== 'voucher' && (i.delivered_kg || 0) < (i.quantity_kg || 0) - 0.01
        );
        const detailStatusLabel = (contract.balance_uah <= 0.01 && contract.status === 'open' && hasUndelivered)
            ? 'Не відвантажено' : st.label;
        document.getElementById('fc-detail-status').innerHTML = `<span class="status-badge ${st.cls}">${detailStatusLabel}</span>`;
        document.getElementById('fc-detail-date').textContent = formatDate(contract.created_at);
        document.getElementById('fc-detail-total').textContent = formatAmount(contract.total_value_uah);
        document.getElementById('fc-detail-balance').textContent = formatAmount(contract.balance_uah);
        const balanceHintEl = document.getElementById('fc-detail-balance-hint');
        if (balanceHintEl) { balanceHintEl.textContent = ''; balanceHintEl.classList.add('hidden'); }
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
                const isLand = item.item_type === 'land_service';
                const isCash = item.item_type === 'cash';
                const qty = (isCash || isLand) ? formatAmount(item.quantity_kg) : formatWeight(item.quantity_kg);
                const delivered = (isCash || isLand) ? formatAmount(item.delivered_kg || 0) : formatWeight(item.delivered_kg || 0);
                const unitSuffix = isLand ? ' га' : '';
                const priceSuffix = isLand ? ' /га' : '';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${dirLabels[item.direction] || item.direction}</td>
                    <td>${item.item_name ? escapeHtml(item.item_name) : emptyValueHtml()}</td>
                    <td>${qty}${unitSuffix}</td>
                    <td>${formatAmount(item.price_per_kg)}${priceSuffix}</td>
                    <td>${formatAmount(item.total_value_uah)}</td>
                    <td>${delivered}${unitSuffix}</td>
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
                    <td>${p.item_name ? escapeHtml(p.item_name) : emptyValueHtml()}</td>
                    <td>${p.quantity_kg != null ? formatWeight(p.quantity_kg) : emptyValueHtml()}</td>
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
    const peopleMap = new Map((peopleCache || []).map(p => [p.id, p.full_name]));
    const contractsMap = new Map(farmerContractsCache.map(c => [c.id, c]));
    const typeLabels = {
        'goods_issue': 'Видача', 'goods_receive': 'Прийом',
        'cash': 'Гроші', 'grain': 'Зерно', 'settlement': 'Розрахунок'
    };

    const contract = contractsMap.get(payment.contract_id);
    let ownerName;
    if (!contract) {
        ownerName = EMPTY_VALUE_UA;
    } else if (contract.person_id) {
        const pname = peopleMap.get(contract.person_id);
        ownerName = pname ? `${pname} (людина)` : `#${contract.person_id} (людина)`;
    } else {
        ownerName = ownersMap.get(contract.owner_id) || `#${contract.owner_id}`;
    }

    document.getElementById('fc-pay-detail-id').textContent = `#${payment.id}`;
    document.getElementById('fc-pay-detail-date').textContent = formatDate(payment.payment_date);
    document.getElementById('fc-pay-detail-type').textContent = typeLabels[payment.payment_type] || payment.payment_type;
    document.getElementById('fc-pay-detail-owner').textContent = ownerName;
    document.getElementById('fc-pay-detail-contract').textContent = `#${payment.contract_id}`;
    const itemEl = document.getElementById('fc-pay-detail-item');
    if (itemEl) {
        itemEl.innerHTML = payment.item_name ? escapeHtml(payment.item_name) : emptyValueHtml();
    }
    const qtyEl = document.getElementById('fc-pay-detail-qty');
    if (qtyEl) {
        qtyEl.innerHTML = payment.quantity_kg != null
            ? escapeHtml(formatWeight(payment.quantity_kg) + ' кг')
            : emptyValueHtml();
    }

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
    const peopleMap = new Map((peopleCache || []).map(p => [p.id, p.full_name]));
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
        let ownerName;
        if (contract.person_id) {
            ownerName = `${peopleMap.get(contract.person_id) || '#' + contract.person_id} (людина)`;
        } else {
            ownerName = ownersMap.get(contract.owner_id) || `#${contract.owner_id}`;
        }
        const st = statusMap[contract.status] || { label: contract.status, cls: 'warning' };
        let typeLabel = typeLabels[contract.contract_type] || contract.contract_type;
        if (contract.was_reserve) typeLabel += ' (резерв)';
        const balanceColor = contract.balance_uah > 0.01 ? '#dc2626' : '#16a34a';
        const isSettledButOpen = contract.status === 'open' && contract.balance_uah <= 0.01;
        const statusLabel = isSettledButOpen ? 'Не відвантажено' : st.label;
        row.innerHTML = `
            <td class="td-mono">#${contract.id}</td>
            <td><strong>${ownerName}</strong></td>
            <td>${typeLabel}</td>
            <td class="td-weight">${formatAmount(contract.total_value_uah)} ₴</td>
            <td><strong style="color:${balanceColor}">${formatAmount(contract.balance_uah)} ₴</strong></td>
            <td><span class="status-badge ${st.cls}">${statusLabel}</span></td>
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
    const peopleMap = new Map((peopleCache || []).map(p => [p.id, p.full_name]));
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
        let ownerName;
        if (!contract) {
            ownerName = emptyValueHtml();
        } else if (contract.person_id) {
            const pname = peopleMap.get(contract.person_id);
            ownerName = pname ? `${pname} (людина)` : `#${contract.person_id} (людина)`;
        } else {
            ownerName = ownersMap.get(contract.owner_id) || `#${contract.owner_id}`;
        }
        const typeInfo = typeLabels[payment.payment_type] || { text: payment.payment_type, cls: '' };
        let amountLabel = '';
        if (payment.payment_type === 'goods_issue' || payment.payment_type === 'goods_receive') {
            const itemName = payment.item_name ? escapeHtml(payment.item_name) : emptyValueHtml();
            const isCash = payment.item_name === 'Готівка';
            const amt = isCash ? (payment.amount ?? payment.quantity_kg ?? 0) : (payment.quantity_kg || 0);
            const unit = isCash ? ((payment.currency || 'UAH').toUpperCase()) : 'кг';
            const fmtAmt = isCash ? formatAmount(amt) : formatWeight(amt);
            amountLabel = `<strong>${itemName}</strong>: ${fmtAmt} ${unit} <span class="td-secondary">(${formatAmount(payment.amount_uah)} ₴)</span>`;
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
    const ownerSelectFC = document.getElementById('farmer-contract-owner-select');
    const ownerIdInput = document.getElementById('farmer-contract-owner-id');
    const typeSelect = document.getElementById('farmer-contract-type');
    const noteInput = document.getElementById('farmer-contract-note');
    const farmerItemsBody = document.getElementById('farmer-contract-items-farmer');
    const companyItemsBody = document.getElementById('farmer-contract-items-company');
    const farmerTotalLabel = document.getElementById('farmer-contract-total-farmer');
    const companyTotalLabel = document.getElementById('farmer-contract-total-company');
    const balanceTotalLabel = document.getElementById('farmer-contract-total-balance');
    if (!modal || !openBtn || !saveBtn || !addFarmerItemBtn || !addCompanyItemBtn || !ownerSelectFC || !ownerIdInput || !farmerItemsBody || !companyItemsBody || !farmerTotalLabel || !companyTotalLabel || !balanceTotalLabel) return;

    const fcFormRoot = modal.querySelector('.modal-body');
    if (fcFormRoot) formBindInvalidHighlightClearing(fcFormRoot);

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

    // Завантажує баланс зерна контрагента — фермера (з grain/owners) або людини (з people).
    // У відповіді API однакова форма: [{culture_id, culture_name, quantity_kg}, ...]
    const loadCounterpartyBalance = async (kind, id) => {
        const placeholder = kind === 'person' ? 'Оберіть людину' : 'Оберіть фермера';
        if (!id) {
            fcFarmerBalanceCards.innerHTML = `<div class="fcp-grain-empty">${placeholder}</div>`;
            fcFarmerBalanceTotal.innerHTML = emptyValueHtml();
            paymentFarmerBalance = [];
            return;
        }
        const endpoint = kind === 'person' ? `/people/${id}/balance` : `/grain/owners/${id}/balance`;
        try {
            const resp = await apiFetch(endpoint);
            paymentFarmerBalance = resp.ok ? await resp.json() : [];
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

    // Залишаємо стару назву як alias для зворотної сумісності з рештою коду в файлі
    const loadFarmerBalanceForPayment = (ownerId) => loadCounterpartyBalance('farmer', ownerId);

    const applyContractType = () => {
        const type = typeSelect.value;
        const isDebt = type === 'debt';
        const isPayment = type === 'payment';
        const isReserve = type === 'reserve';

        // Контрагент: для людини блок балансу теж показуємо (зерно, переказане їй
        // фермером, лежить у нас на складі — людина може ним розплатитись за контрактом).
        const cpChecked = modal.querySelector('input[name="fc-counterparty"]:checked');
        const isPerson = cpChecked && cpChecked.value === 'person';

        // Balance section — visible for payment (фермер) і для debt (фермер або людина).
        // Для людини payment-контракт заборонений у applyCounterparty → лишається debt.
        fcFarmerBalanceSection.classList.toggle('hidden', !isPayment && !isDebt);

        // Payment options (currency/rate) — only for payment type
        paymentOptions.classList.toggle('hidden', !isPayment);
        if (isPayment && fcPaymentRateField) {
            const isForeign = fcPaymentCurrency?.value !== 'UAH';
            fcPaymentRateField.classList.toggle('hidden', !isForeign);
        }

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

        // Labels — «Фермер» / «Людина» залежно від обраного контрагента.
        const role = isPerson ? 'Людина' : 'Фермер';
        const roleGen = isPerson ? 'людини' : 'фермера';
        if (isDebt || isReserve) {
            companyTitle.textContent = isReserve ? 'Резерв позицій' : `${role} отримує`;
            totalCompanyLabel.textContent = isReserve ? 'Резерв' : `${role} отримує`;
            totalBalanceLabel.textContent = isReserve ? 'Сума резерву' : `Борг ${roleGen}`;
        }

        // Company section hint
        const hintEl = document.getElementById('fc-company-hint');
        if (hintEl) {
            hintEl.textContent = isReserve
                ? 'Вкажіть назву, кількість та ціну. Якщо позиції немає на складі — вона буде створена.'
                : 'Позиції бронюються на складі після створення контракту';
        }

        // Farmer section title — для PAYMENT однаково («Зерно для обміну на гроші»),
        // для решти — «Від фермера/людини».
        const farmerTitle = farmerSection?.querySelector('.fc-section__title');
        if (farmerTitle) {
            const badge = farmerTitle.querySelector('.fc-section__badge');
            farmerTitle.innerHTML = '';
            if (badge) farmerTitle.appendChild(badge);
            if (isPayment) {
                farmerTitle.append(' Зерно для обміну на гроші');
            } else {
                farmerTitle.append(` Від ${roleGen}`);
            }
        }

        // Load farmer balance for payment and contract (debt) types
        if ((isPayment || isDebt) && ownerIdInput.value) {
            loadFarmerBalanceForPayment(parseInt(ownerIdInput.value, 10));
        }

        // Для типу «Контракт» (debt) ціна в позиціях «Фермер отримує» — редагована
        if (companyItemsBody) {
            companyItemsBody.querySelectorAll('.fc-item').forEach(card => {
                const typeSel = card.querySelector('.farmer-contract-item-type');
                const priceInput = card.querySelector('.farmer-contract-item-price');
                if (!typeSel || !priceInput) return;
                if (typeSel.value === 'cash') return;
                priceInput.readOnly = !isDebt;
            });
        }

        updateContractTotal();
    };

    const resetForm = () => {
        if (fcFormRoot) clearFormValidationState(fcFormRoot, 'farmer-contract-message');
        if (ownerSelectFC) {
            ownerSelectFC.value = '';
            if (typeof refreshCustomSelect === 'function') refreshCustomSelect(ownerSelectFC);
        }
        ownerIdInput.value = '';
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
        if (fcFarmerBalanceTotal) fcFarmerBalanceTotal.innerHTML = emptyValueHtml();
        // Скинути радіо контрагента
        const farmerRadio = modal.querySelector('input[name="fc-counterparty"][value="farmer"]');
        if (farmerRadio) farmerRadio.checked = true;
        const personSel = document.getElementById('farmer-contract-person');
        if (personSel) personSel.value = '';
        applyCounterparty?.();
        applyContractType();
    };

    const openModal = () => {
        resetForm();
        modal.classList.remove('hidden');
    };
    const closeModal = () => {
        if (fcFormRoot) clearFormValidationState(fcFormRoot, 'farmer-contract-message');
        modal.classList.add('hidden');
    };

    openBtn.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);
    addFarmerItemBtn.addEventListener('click', () => addContractItemRow(farmerItemsBody, 'farmer'));
    addCompanyItemBtn.addEventListener('click', () => addContractItemRow(companyItemsBody, 'company'));
    typeSelect.addEventListener('change', applyContractType);

    // ── Counterparty toggle: фермер ↔ людина ──
    const personSelect = document.getElementById('farmer-contract-person');
    const fcOwnerField = document.getElementById('fc-owner-field');
    const fcPersonField = document.getElementById('fc-person-field');
    const fcPaymentTypeOption = typeSelect.querySelector('option[value="payment"]');
    const fcReserveTypeOption = typeSelect.querySelector('option[value="reserve"]');

    const getCounterparty = () => {
        const checked = modal.querySelector('input[name="fc-counterparty"]:checked');
        return checked ? checked.value : 'farmer';
    };

    const applyCounterparty = () => {
        const kind = getCounterparty();
        const isPerson = kind === 'person';
        fcOwnerField?.classList.toggle('hidden', isPerson);
        fcPersonField?.classList.toggle('hidden', !isPerson);

        // Перейменовуємо «Фермер ...» → «Людина ...» в усіх місцях контрактної модалки.
        // Використовуємо id-шні span'и (додані у dashboard.html), щоб не зачепити інших розділів.
        const role = isPerson ? 'Людина' : 'Фермер';
        const roleGenitive = isPerson ? 'людини' : 'фермера';
        const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
        setText('fc-payment-money-label', `${role} отримає гроші:`);
        setText('fc-farmer-section-title', `Від ${isPerson ? 'людини' : 'фермера'}`);
        setText('fc-company-title', `${role} отримує`);
        setText('fc-total-farmer-label', `Від ${isPerson ? 'людини' : 'фермера'}`);
        setText('fc-total-company-label', `${role} отримує`);
        setText('fc-total-balance-label', `Борг ${roleGenitive}`);
        // Для людини доступні «Контракт» (debt) і «Виплата/Викуп» (payment) — у людини
        // на нашому складі може лежати зерно (переказ від фермера), яке вона може нам
        // продати. Резерв — заборонений (це попереднє бронювання, для людини не має сенсу).
        const restrictedOptions = [fcReserveTypeOption].filter(Boolean);
        restrictedOptions.forEach(opt => {
            opt.disabled = isPerson;
            opt.hidden = isPerson;
        });
        // Якщо обрано заборонений тип — переключаємо на debt
        if (isPerson && typeSelect.value === 'reserve') {
            typeSelect.value = 'debt';
        }
        // ОБОВ'ЯЗКОВО перебудовуємо кастомний select, бо він кешує опції
        // окремо від native <option>: hidden/disabled на native сам по собі
        // не приховає кнопку у dropdown'і.
        if (typeof refreshCustomSelect === 'function') refreshCustomSelect(typeSelect);
        applyContractType();
        // Очистити невикористане поле і одразу підвантажити баланс контрагента у блок
        if (isPerson) {
            if (ownerSelectFC) {
                ownerSelectFC.value = '';
                if (typeof refreshCustomSelect === 'function') refreshCustomSelect(ownerSelectFC);
            }
            ownerIdInput.value = '';
            // Скидаємо placeholder балансу на «Оберіть людину» або підтягуємо балас вибраної людини
            const pid = personSelect?.value ? parseInt(personSelect.value, 10) : null;
            loadCounterpartyBalance('person', pid);
        } else {
            if (personSelect) {
                personSelect.value = '';
                if (typeof refreshCustomSelect === 'function') refreshCustomSelect(personSelect);
            }
            // Для фермера повертаємо стандартний placeholder/балас (якщо вже вибраний)
            const oid = ownerIdInput.value ? parseInt(ownerIdInput.value, 10) : null;
            loadCounterpartyBalance('farmer', oid);
        }
    };

    modal.querySelectorAll('input[name="fc-counterparty"]').forEach(r => {
        r.addEventListener('change', applyCounterparty);
    });

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
        const counterparty = getCounterparty();
        const isPersonContract = counterparty === 'person';
        let ownerId = null;
        let personId = null;
        if (isPersonContract) {
            personId = personSelect?.value ? parseInt(personSelect.value, 10) : null;
            if (!personId) {
                formShowValidationError(fcFormRoot, 'farmer-contract-message', 'Оберіть людину', ['farmer-contract-person']);
                return;
            }
        } else {
            const fromSelect = ownerSelectFC?.value;
            ownerId = fromSelect ? parseInt(fromSelect, 10)
                                 : (ownerIdInput.value ? parseInt(ownerIdInput.value, 10) : null);
            if (!ownerId) {
                formShowValidationError(fcFormRoot, 'farmer-contract-message', 'Оберіть фермера зі списку', ['farmer-contract-owner-select']);
                return;
            }
        }
        const type = typeSelect.value;
        // Для людини дозволені «Контракт» (debt) і «Виплата/Викуп» (payment).
        // Резерв заборонений (зерно бронюється на складі — для людини сенсу немає).
        if (isPersonContract && type === 'reserve') {
            formShowValidationError(fcFormRoot, 'farmer-contract-message', 'Тип «Резерв» недоступний для контракту з людиною', []);
            return;
        }
        const isPayment = type === 'payment';
        const isDebt = type === 'debt';
        const isReserve = type === 'reserve';

        const farmerItems = (isDebt || isReserve) ? [] : getContractItems(farmerItemsBody, 'farmer');
        const companyItems = isPayment ? [] : getContractItems(companyItemsBody, 'company');

        if (isPayment) {
            if (!farmerItems.length) {
                formShowValidationError(fcFormRoot, 'farmer-contract-message', 'Вкажіть зерно для обміну на гроші', [], [farmerSection].filter(Boolean));
                return;
            }
        } else {
            if (!companyItems.length && (!farmerItems.length)) {
                formShowValidationError(fcFormRoot, 'farmer-contract-message', 'Додайте позиції контракту', [], [companySection, farmerSection].filter(Boolean));
                return;
            }
            if (!companyItems.length) {
                formShowValidationError(fcFormRoot, 'farmer-contract-message', 'Додайте що фермер отримує', [], [companySection].filter(Boolean));
                return;
            }
        }

        const payload = {
            owner_id: ownerId,
            person_id: personId,
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
                    formShowValidationError(fcFormRoot, 'farmer-contract-message', 'Вкажіть курс валюти', ['fc-payment-rate']);
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
                setFormMessage('farmer-contract-message', error?.detail || 'Не вдалося створити контракт', true);
                return;
            }
            showToast(isPayment ? 'Контракт виплати створено та оплачено' : 'Контракт створено', 'success');
            if (fcFormRoot) clearFormValidationState(fcFormRoot, 'farmer-contract-message');
            closeModal();
            await refreshAfterMutation([
                'farmerContracts', 'farmerContractPayments',
                'stock', 'purchaseStock', 'stockAdjustments',
                'cash', 'cashTransactions', 'farmerMovements', 'owners',
                'people', 'peopleActions', 'dashboard'
            ]);
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
            // Reserve: тип, назва, кількість — без ціни (ціна вказується при активації)
            card.classList.add('fc-item--reserve');
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
                <span class="fc-item__price-placeholder">${emptyValueHtml()}</span>
                <span class="fc-item__total farmer-contract-item-total">${emptyValueHtml()}</span>
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
                           <option value="voucher">Талон</option>
                           <option value="land_service">Обробка землі</option>`;
            } else {
                typeOptions = `<option value="grain">Зерно</option>
                           <option value="cash">Гроші</option>`;
            }
            const isCompany = direction === 'company';
            card.innerHTML = `
                <select class="farmer-contract-item-type">
                    ${typeOptions}
                </select>
                ${isCompany ? `
                <div class="fc-item-pos-cell">
                    <select class="farmer-contract-item-select"></select>
                    <div class="fc-item-cash-wrap hidden">
                        <select class="farmer-contract-item-currency" title="Валюта">
                            <option value="UAH">UAH</option>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                        </select>
                        <input type="number" class="farmer-contract-item-rate" min="0" step="0.01" placeholder="Курс до грн" title="Курс до гривні" />
                    </div>
                </div>
                ` : '<select class="farmer-contract-item-select"></select>'}
                <input type="number" class="farmer-contract-item-qty" min="0" step="0.01" placeholder="0">
                <input type="number" class="farmer-contract-item-price" min="0" step="0.01" placeholder="0.00" readonly>
                <span class="fc-item__total farmer-contract-item-total">0 грн</span>
                <button class="fc-item__remove farmer-contract-item-remove" title="Видалити">×</button>
            `;
            targetBody.appendChild(card);
            const typeSel = card.querySelector('.farmer-contract-item-type');
            initCustomSelects(typeSel);
            if (isCompany) {
                const currencySel = card.querySelector('.farmer-contract-item-currency');
                if (currencySel) initCustomSelects(currencySel);
            }
            wireItemRow(card, direction);
        }
        updateContractTotal();
    }

    // Owner picker (dropdown + search). Створення нових фермерів —
    // лише через картку приходу (там кнопка «+ Новий»).
    if (ownerSelectFC) {
        populateOwnerSelect('farmer-contract-owner-select');
        ownerSelectFC.addEventListener('change', () => {
            const id = ownerSelectFC.value;
            ownerIdInput.value = id || '';
            if (id) {
                const t = typeSelect.value;
                if (t === 'payment' || t === 'debt') {
                    loadFarmerBalanceForPayment(parseInt(id, 10));
                }
            }
        });
    }

    // Те саме для людини — при виборі підтягуємо баланс і рендеримо у тому ж блоці.
    if (personSelect) {
        personSelect.addEventListener('change', () => {
            const id = personSelect.value ? parseInt(personSelect.value, 10) : null;
            loadCounterpartyBalance('person', id);
        });
    }

    function wireItemRow(card, direction) {
        const typeSel = card.querySelector('.farmer-contract-item-type');
        const itemSel = card.querySelector('.farmer-contract-item-select');
        const posCell = card.querySelector('.fc-item-pos-cell');
        const cashWrap = card.querySelector('.fc-item-cash-wrap');
        const currencySel = card.querySelector('.farmer-contract-item-currency');
        const rateInput = card.querySelector('.farmer-contract-item-rate');
        const qtyInput = card.querySelector('.farmer-contract-item-qty');
        const priceInput = card.querySelector('.farmer-contract-item-price');
        const removeBtn = card.querySelector('.farmer-contract-item-remove');

        const updateItemOptions = () => {
            const type = typeSel.value;
            const isDebtContract = typeSelect && typeSelect.value === 'debt';
            if (direction === 'company' && cashWrap && posCell) {
                // Початковий <select> загорнутий у .custom-select. Щоб справді
                // приховати елемент — ховаємо wrapper, а не нативний select.
                const innerSelect = posCell.querySelector('.farmer-contract-item-select');
                const wrapperToHide = innerSelect ? (innerSelect.closest('.custom-select') || innerSelect) : null;
                if (type === 'cash') {
                    card.classList.add('fc-item--cash');
                    if (wrapperToHide) wrapperToHide.classList.add('hidden');
                    cashWrap.classList.remove('hidden');
                    const isForeign = currencySel && currencySel.value !== 'UAH';
                    if (rateInput) rateInput.classList.toggle('hidden', !isForeign);
                    if (currencySel && currencySel.value === 'UAH') {
                        if (rateInput) rateInput.value = '';
                        priceInput.value = '1';
                    } else {
                        const rate = parseFloat(rateInput?.value || '0') || 0;
                        priceInput.value = rate > 0 ? String(rate) : '1';
                    }
                    priceInput.readOnly = true;
                } else {
                    card.classList.remove('fc-item--cash');
                    cashWrap.classList.add('hidden');
                    if (wrapperToHide) wrapperToHide.classList.remove('hidden');
                }
            }
            if (type === 'grain') {
                if (itemSel) {
                    itemSel.innerHTML = '<option value="">Оберіть</option>' +
                        culturesCache.map(c => `<option value="${c.id}" data-price="${c.price_per_kg}">${c.name}</option>`).join('');
                }
                priceInput.value = '';
                priceInput.readOnly = !isDebtContract;
            } else if (type === 'purchase') {
                if (direction === 'farmer') {
                    if (itemSel) itemSel.innerHTML = `<option value="">${EMPTY_VALUE_UA}</option>`;
                    priceInput.value = '';
                    priceInput.readOnly = true;
                } else {
                    if (itemSel) {
                        itemSel.innerHTML = '<option value="">Оберіть</option>' +
                            purchaseStockCache.map(p => `<option value="${p.id}" data-price="${p.sale_price_per_kg}">${p.name}</option>`).join('');
                    }
                    priceInput.value = '';
                    priceInput.readOnly = !isDebtContract;
                }
            } else if (type === 'voucher') {
                const wheat = culturesCache.find(c => c.name === 'Пшениця');
                if (wheat) {
                    if (itemSel) itemSel.innerHTML = `<option value="${wheat.id}" data-price="${wheat.price_per_kg}" selected>Пшениця</option>`;
                    priceInput.value = parseFloat(wheat.price_per_kg).toFixed(2);
                } else {
                    if (itemSel) itemSel.innerHTML = '<option value="">Пшениця не знайдена</option>';
                    priceInput.value = '';
                }
                priceInput.readOnly = !isDebtContract;
            } else if (type === 'land_service') {
                // Обробка землі: ім'я фіксоване, qty = гектари, price = грн/га.
                // Складських залишків не задіємо. Курсу теж не треба — ховаємо cash-блок.
                if (itemSel) {
                    itemSel.innerHTML = '<option value="land_service">Обробка землі</option>';
                }
                qtyInput.placeholder = 'га';
                priceInput.placeholder = 'грн/га';
                priceInput.value = '';
                priceInput.readOnly = false;
            } else {
                // Гроші
                if (itemSel) itemSel.innerHTML = '<option value="cash">Готівка</option>';
                if (direction !== 'company' || !currencySel) {
                    priceInput.value = '1';
                    priceInput.readOnly = false;
                }
            }
            // Скидаємо placeholder у qty/price на дефолтний для не-land_service типів
            if (type !== 'land_service') {
                qtyInput.placeholder = '0';
                priceInput.placeholder = '0.00';
            }
            if (itemSel) refreshCustomSelect(itemSel);
            updateRowTotal();
        };

        const syncCashPrice = () => {
            if (typeSel.value !== 'cash' || direction !== 'company') return;
            const curr = currencySel?.value || 'UAH';
            if (curr === 'UAH') {
                priceInput.value = '1';
            } else {
                const rate = parseFloat(rateInput?.value || '0') || 0;
                priceInput.value = rate > 0 ? String(rate) : '';
            }
            updateRowTotal();
        };
        if (currencySel) currencySel.addEventListener('change', () => {
            const isForeign = currencySel.value !== 'UAH';
            if (rateInput) {
                rateInput.classList.toggle('hidden', !isForeign);
                if (!isForeign) rateInput.value = '';
            }
            syncCashPrice();
        });
        if (rateInput) rateInput.addEventListener('input', syncCashPrice);

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
        const removeBtn = card.querySelector('.farmer-contract-item-remove');

        const updateRowTotal = () => {
            card.querySelector('.farmer-contract-item-total').innerHTML = emptyValueHtml();
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
            updateRowTotal();
        });

        qtyInput.addEventListener('input', updateRowTotal);
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
            // Show equiv: "1 USD = X грн" when foreign currency and rate set
            if (fcPaymentEquiv) {
                if (currency !== 'UAH' && rate > 0) {
                    fcPaymentEquiv.textContent = `1 ${currency} = ${formatAmount(rate)} грн`;
                    fcPaymentEquiv.classList.remove('hidden');
                } else {
                    fcPaymentEquiv.textContent = currency === 'UAH' ? 'Виплата в гривнях' : 'Вкажіть курс до гривні';
                    fcPaymentEquiv.classList.remove('hidden');
                }
            }
        } else {
            if (fcPaymentEquiv) { fcPaymentEquiv.textContent = ''; }
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
            if (!type || qty <= 0) return;
            // Резерв: ціна не вказується при створенні (буде при активації)
            const isCashCompany = direction === 'company' && type === 'cash';
            let priceVal = price;
            if (isReserve) {
                priceVal = 0;
            } else if (isCashCompany) {
                const curr = card.querySelector('.farmer-contract-item-currency')?.value || 'UAH';
                const rateInput = card.querySelector('.farmer-contract-item-rate');
                priceVal = curr === 'UAH' ? 1 : (parseFloat(rateInput?.value || '0') || 0);
                if (curr !== 'UAH' && (!priceVal || priceVal <= 0)) return; // курс обов'язковий для USD/EUR
            } else if (price <= 0) return;
            const entry = { direction: direction === 'company' ? 'from_company' : 'from_farmer', item_type: type, quantity_kg: qty, price_per_kg: priceVal };
            if (isCashCompany) entry.currency = card.querySelector('.farmer-contract-item-currency')?.value || 'UAH';

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

    const fcpFormRoot = modal.querySelector('.modal-body');
    if (fcpFormRoot) formBindInvalidHighlightClearing(fcpFormRoot);

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
        if (type === 'grain') updateGrainRecommend();
    };

    const grainRecommendEl = document.getElementById('fcp-grain-recommend');
    function updateGrainRecommend() {
        if (!grainRecommendEl) return;
        const balance = contractDetail?.balance_uah;
        if (balance == null || balance <= 0) {
            grainRecommendEl.innerHTML = '';
            return;
        }
        const list = farmerBalanceData || [];
        if (!list.length) {
            grainRecommendEl.innerHTML = `<div class="fcp-grain-recommend__hint">Борг по контракту: <strong>${formatAmount(balance)} грн</strong>. Немає зерна на балансі фермера.</div>`;
            return;
        }
        const lines = list.map(item => {
            const culture = culturesCache.find(c => c.id === item.culture_id);
            const price = culture ? culture.price_per_kg : 0;
            if (!price || price <= 0) return null;
            const recommendedKg = balance / price;
            const cultureName = item.culture_name ? item.culture_name : emptyValueHtml();
            return { culture_id: item.culture_id, cultureName, price, recommendedKg };
        }).filter(Boolean);

        if (!lines.length) {
            grainRecommendEl.innerHTML = `<div class="fcp-grain-recommend__hint">Борг по контракту: <strong>${formatAmount(balance)} грн</strong>. Немає цін на культури.</div>`;
            return;
        }

        grainRecommendEl.innerHTML = `
            <div class="fcp-grain-recommend__intro">Щоб покрити борг <strong>${formatAmount(balance)} грн</strong> повністю потрібно:</div>
            <ul class="fcp-grain-recommend__list">
                ${lines.map(l => `
                    <li class="fcp-grain-recommend__item">
                        <span class="fcp-grain-recommend__item-text"><strong>${formatWeight(l.recommendedKg)} кг</strong> ${l.cultureName} (ціна ${formatAmount(l.price)} грн/кг)</span>
                        <button type="button" class="btn btn-secondary btn-small fcp-grain-recommend__btn" data-culture-id="${l.culture_id}" data-qty="${l.recommendedKg.toFixed(2)}">Підставити</button>
                    </li>
                `).join('')}
            </ul>
        `;
        grainRecommendEl.querySelectorAll('.fcp-grain-recommend__btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cultureId = btn.dataset.cultureId;
                const qty = btn.dataset.qty;
                if (grainCultureSelect && cultureId) {
                    grainCultureSelect.value = cultureId;
                    refreshCustomSelect(grainCultureSelect);
                }
                if (grainQtyInput && qty) grainQtyInput.value = qty;
                grainCardsContainer?.querySelectorAll('.fcp-grain-card').forEach(c => {
                    c.classList.toggle('selected', c.dataset.cultureId === cultureId);
                });
                updateGrainEquiv();
            });
        });
    }

    const resetForm = () => {
        if (fcpFormRoot) clearFormValidationState(fcpFormRoot, 'fcp-validation-message');
        selectedIssueItemId = null;
        selectedReceiveItemId = null;
        issueSelectedEl.innerHTML = emptyValueHtml();
        issueQtyInput.value = '';
        issueQtyInput.placeholder = '0.00';
        const qtyLabel = document.getElementById('fcp-issue-qty-label');
        if (qtyLabel) qtyLabel.textContent = 'Кількість';
        issueEquiv.textContent = '';
        receiveSelectedEl.innerHTML = emptyValueHtml();
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
        const typeLabels = { grain: 'Зерно', purchase: 'Товар', cash: 'Гроші', voucher: 'Талон', land_service: 'Обробка землі' };
        filtered.forEach(item => {
            const isVoucher = item.item_type === 'voucher';
            const isLandService = item.item_type === 'land_service';
            const remaining = Math.max(0, item.quantity_kg - (item.delivered_kg || 0));
            const pct = item.quantity_kg > 0 ? ((item.delivered_kg || 0) / item.quantity_kg * 100) : 0;
            const done = remaining < 0.01;
            const isCash = item.item_type === 'cash';
            const currency = (isCash && item.currency) ? item.currency : (isCash ? 'UAH' : null);
            const unit = isLandService ? 'га' : (isCash ? (currency || 'UAH') : 'кг');
            const fmtQty = (isCash || isLandService) ? formatAmount(item.quantity_kg) : formatWeight(item.quantity_kg);
            const fmtRem = (isCash || isLandService) ? formatAmount(remaining) : formatWeight(remaining);
            const metaPrice = isCash && currency !== 'UAH'
                ? `курс ${formatAmount(item.price_per_kg)} грн`
                : (isCash ? '' : (isLandService ? `${formatAmount(item.price_per_kg)} грн/га` : `${formatAmount(item.price_per_kg)} грн`));

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
                const metaStr = isCash
                    ? (metaPrice ? `${typeLabels[item.item_type]} • ${fmtQty} ${unit} (${metaPrice})` : `${typeLabels[item.item_type]} • ${fmtQty} ${unit}`)
                    : `${typeLabels[item.item_type] || item.item_type} • ${fmtQty} ${unit} × ${formatAmount(item.price_per_kg)} грн`;
                card.innerHTML = `
                    <div class="fcp-ci-info">
                        <span class="fcp-ci-name">${item.item_name ? escapeHtml(item.item_name) : emptyValueHtml()}</span>
                        <span class="fcp-ci-meta">${metaStr}</span>
                    </div>
                    <div class="fcp-ci-progress">
                        <span class="fcp-ci-remaining">${done ? '✓ Видано' : `${fmtRem} ${unit}`}</span>
                        <div class="fcp-ci-bar"><div class="fcp-ci-bar__fill" style="width:${Math.min(100, pct)}%"></div></div>
                    </div>
                `;
                if (!done) {
                    card.addEventListener('click', () => {
                        container.querySelectorAll('.fcp-ci-card').forEach(c => c.classList.remove('selected'));
                        card.classList.add('selected');
                        if (direction === 'from_company') {
                            selectedIssueItemId = item.id;
                            issueSelectedEl.textContent = `${item.item_name} (залишок: ${fmtRem} ${unit})`;
                            issueQtyInput.max = remaining;
                            if (isCash) {
                                issueQtyInput.placeholder = `Сума, ${unit}`;
                            } else if (isLandService) {
                                issueQtyInput.placeholder = 'Гектари';
                            } else {
                                issueQtyInput.placeholder = '0.00';
                            }
                            const qtyLabel = document.getElementById('fcp-issue-qty-label');
                            if (qtyLabel) {
                                qtyLabel.textContent = isCash
                                    ? `Сума, ${unit}`
                                    : (isLandService ? 'Гектари' : 'Кількість');
                            }
                            issueQtyInput.focus();
                        } else {
                            selectedReceiveItemId = item.id;
                            receiveSelectedEl.textContent = `${item.item_name} (залишок: ${fmtRem} ${unit})`;
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
                            await loadContractData({ id: currentFarmerContractId, owner_id: contractDetail?.owner_id });
                            await refreshAfterMutation([
                                'farmerContracts', 'farmerContractPayments',
                                'stock', 'vouchers', 'peopleActions', 'dashboard'
                            ]);
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
                if (currentPaymentType === 'grain') updateGrainRecommend();
            }
        } catch {}
        // Завантажуємо баланс зерна контрагента — фермера або людини.
        // У людини баланс = переказів - GRAIN-оплат (зерно лежить у нас на складі
        // у person_quantity_kg і може йти в оплату контракту).
        const balanceEndpoint = contract.owner_id
            ? `/grain/owners/${contract.owner_id}/balance`
            : (contract.person_id ? `/people/${contract.person_id}/balance` : null);
        if (balanceEndpoint) {
            try {
                const resp = await apiFetch(balanceEndpoint);
                farmerBalanceData = resp.ok ? await resp.json() : [];
            } catch { farmerBalanceData = []; }
        } else {
            farmerBalanceData = [];
        }

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
            if (currentPaymentType === 'grain') updateGrainRecommend();
        }

        // Voucher items are now rendered as part of renderContractItems in the Issue tab
    };

    // ── Open modal ──
    const openModal = (contract) => {
        currentFarmerContractId = contract.id;
        const isPersonContract = !!contract.person_id;
        let counterpartyName;
        if (isPersonContract) {
            const person = (peopleCache || []).find(p => p.id === contract.person_id);
            counterpartyName = person ? `${person.full_name} (людина)` : `#${contract.person_id} (людина)`;
        } else {
            counterpartyName = ownersCache.find(o => o.id === contract.owner_id)?.full_name || `#${contract.owner_id}`;
        }
        const typeLabels = { 'debt': 'Контракт', 'payment': 'Виплата', 'reserve': 'Резерв' };

        contractIdEl.textContent = `#${contract.id}`;
        farmerNameEl.textContent = counterpartyName;
        contractTypeEl.textContent = typeLabels[contract.contract_type] || contract.contract_type;
        if (contract.was_reserve) contractTypeEl.textContent += ' (з резерву)';
        balanceEl.textContent = formatAmount(contract.balance_uah) + ' грн';

        // Show/hide tabs.
        // Звичайний контракт фермера: видача, гроші, зерно.
        // Контракт з людиною: видача, гроші, зерно (якщо є на балансі переказ від фермера).
        // Прийом товару від людини досі заборонений (бекенд відхиляє).
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

    const closeModal = () => {
        if (fcpFormRoot) clearFormValidationState(fcpFormRoot, 'fcp-validation-message');
        modal.classList.add('hidden');
    };

    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);

    // Tab clicks
    allTabs.forEach(tab => {
        tab?.addEventListener('click', () => {
            if (tab.classList.contains('fcp-tab--hidden')) return;
            if (fcpFormRoot) clearFormValidationState(fcpFormRoot, 'fcp-validation-message');
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
            const isCash = item.item_type === 'cash';
            const isLandService = item.item_type === 'land_service';
            const curr = (isCash && item.currency) ? item.currency : 'UAH';
            const unit = isLandService ? 'га' : (isCash ? curr : 'кг');
            const uahEquiv = qty * (item.price_per_kg || 1);
            let text;
            if (isCash && curr !== 'UAH') {
                text = `= ${formatAmount(qty)} ${curr} (≈ ${formatAmount(uahEquiv)} грн)`;
            } else {
                text = `= ${formatAmount(uahEquiv)} грн`;
            }
            const fmtMax = (isCash || isLandService) ? formatAmount(remaining) : formatWeight(remaining);
            if (qty > remaining) text += ` (макс: ${fmtMax} ${unit})`;
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
        updateGrainRecommend();
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
            if (!selectedIssueItemId) {
                formShowValidationError(fcpFormRoot, 'fcp-validation-message', 'Оберіть позицію для видачі', [], [sectionIssue].filter(Boolean));
                return;
            }
            const qty = parseFloat(issueQtyInput.value) || 0;
            if (!qty) {
                formShowValidationError(fcpFormRoot, 'fcp-validation-message', 'Вкажіть кількість', ['fcp-issue-qty']);
                return;
            }
            payload.contract_item_id = selectedIssueItemId;
            payload.quantity_kg = qty;
        } else if (type === 'goods_receive') {
            if (!selectedReceiveItemId) {
                formShowValidationError(fcpFormRoot, 'fcp-validation-message', 'Оберіть позицію для прийому', [], [sectionReceive].filter(Boolean));
                return;
            }
            const qty = parseFloat(receiveQtyInput.value) || 0;
            if (!qty) {
                formShowValidationError(fcpFormRoot, 'fcp-validation-message', 'Вкажіть кількість', ['fcp-receive-qty']);
                return;
            }
            payload.contract_item_id = selectedReceiveItemId;
            payload.quantity_kg = qty;
        } else if (type === 'cash') {
            const amount = parseFloat(cashAmountInput.value) || 0;
            if (!amount) {
                formShowValidationError(fcpFormRoot, 'fcp-validation-message', 'Вкажіть суму', ['fcp-cash-amount']);
                return;
            }
            payload.amount = amount;
            payload.currency = cashCurrencySelect.value;
            if (payload.currency !== 'UAH') {
                const rate = parseFloat(cashRateInput.value) || 0;
                if (!rate) {
                    formShowValidationError(fcpFormRoot, 'fcp-validation-message', 'Вкажіть курс', ['fcp-cash-rate']);
                    return;
                }
                payload.exchange_rate = rate;
            }
        } else if (type === 'grain') {
            const cultureId = grainCultureSelect.value ? parseInt(grainCultureSelect.value, 10) : null;
            const qty = parseFloat(grainQtyInput.value) || 0;
            if (!cultureId || !qty) {
                const msg = !cultureId ? 'Оберіть культуру' : 'Вкажіть кількість';
                const ids = !cultureId ? ['fcp-grain-culture'] : ['fcp-grain-qty'];
                formShowValidationError(fcpFormRoot, 'fcp-validation-message', msg, ids);
                return;
            }
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
                setFormMessage('fcp-validation-message', error?.detail || 'Не вдалося зберегти', true);
                return;
            }
            showToast('Операцію збережено', 'success');
            if (fcpFormRoot) clearFormValidationState(fcpFormRoot, 'fcp-validation-message');
            closeModal();
            await refreshAfterMutation([
                'farmerContracts', 'farmerContractPayments',
                'stock', 'purchaseStock', 'stockAdjustments',
                'cash', 'cashTransactions', 'vouchers', 'farmerMovements', 'owners',
                'people', 'peopleActions', 'dashboard'
            ]);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Зберегти';
        }
    });
}
