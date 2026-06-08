// ═══════════════════════════════════════════════════════════
// Хлібний завод (Талони на зерно)
// Завантажується ПІСЛЯ core.js і ПЕРЕД dashboard.js.
// Утиліти (apiFetch, formatAmount, showToast, ICONS, ...) — з core.js.
// refreshAfterMutation — з dashboard.js (доступне через спільний script realm).
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
        const dateCell = v.created_at
            ? new Date(v.created_at).toLocaleDateString('uk-UA')
            : emptyValueHtml();
        tr.innerHTML = `
            <td class="td-mono">${v.id}</td>
            <td><a href="#" class="td-link link-contract" data-contract-id="${v.farmer_contract_id}">#${v.farmer_contract_id}</a></td>
            <td><strong>${v.owner_name}</strong></td>
            <td class="td-weight">${formatAmount(v.quantity_kg)} кг</td>
            <td class="td-mono">${formatAmount(v.price_per_kg)} ₴/кг</td>
            <td class="td-weight">${formatAmount(v.total_value_uah)} ₴</td>
            <td>${dateCell}</td>
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
        const dateCell = p.created_at
            ? new Date(p.created_at).toLocaleDateString('uk-UA')
            : emptyValueHtml();
        const currSymbols = { UAH: '₴', USD: '$', EUR: '€' };
        const currSymbol = currSymbols[p.currency] || p.currency;
        tr.innerHTML = `
            <td class="td-mono">${p.id}</td>
            <td><strong>${p.currency}</strong></td>
            <td class="td-weight">${formatAmount(p.amount)} ${currSymbol}</td>
            <td class="td-mono">${p.exchange_rate != 1 ? formatAmount(p.exchange_rate) : emptyValueHtml()}</td>
            <td class="td-weight">${formatAmount(p.amount_uah)} ₴</td>
            <td>${p.description ? escapeHtml(p.description) : emptyValueHtml()}</td>
            <td>${p.created_by ? escapeHtml(p.created_by) : emptyValueHtml()}</td>
            <td>${dateCell}</td>
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
                await refreshAfterMutation(['vouchers', 'cash', 'cashTransactions', 'dashboard']);
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
                await refreshAfterMutation(['vouchers', 'cash', 'cashTransactions', 'dashboard']);
            } catch (e) {
                showToast(e.message || 'Помилка', 'error');
            } finally {
                cancelYesBtn.disabled = false;
                currentVoucherPaymentId = null;
            }
        });
    }
}
