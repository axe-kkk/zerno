// ═══════════════════════════════════════════════════════════
// Каса (баланс, транзакції, операції з касою, експорт звіту)
// Завантажується після core.js і перед dashboard.js.
// Залежить від bindDatePicker, isSuperAdmin, currentUser, refreshAfterMutation
// (живуть у dashboard.js, видимі cross-file через єдиний script realm).
// ═══════════════════════════════════════════════════════════

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

        const cashUah = document.getElementById('cash-uah');
        const cashUsd = document.getElementById('cash-usd');
        const cashEur = document.getElementById('cash-eur');
        if (cashUah) cashUah.textContent = formatCurrency(balance.uah_balance, 'UAH');
        if (cashUsd) cashUsd.textContent = formatCurrency(balance.usd_balance, 'USD');
        if (cashEur) cashEur.textContent = formatCurrency(balance.eur_balance, 'EUR');

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

async function loadCashTransactions({ append = false } = {}) {
    if (!append) { cashTransactionsState.offset = 0; cashTransactionsState.items = []; }
    const path = '/cash/transactions' + cashTransactionsState.toQuery();
    const { data, total } = await apiFetchCached(path, { force: !append });
    cashTransactionsState.total = total ?? data.length;
    cashTransactionsState.items = append ? cashTransactionsState.items.concat(data) : data.slice();
    const transactions = cashTransactionsState.items;
    renderPagedHint('cash-transactions-period-hint', cashTransactionsState, loadCashTransactions, 'операцій');
    const tableBody = document.querySelector('#cash-transactions-table tbody');
    if (!tableBody) {
        return;
    }
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
            <td>${item.user_full_name ? escapeHtml(item.user_full_name) : emptyValueHtml()}</td>
            <td><strong>${currSymbol} ${item.currency}</strong></td>
            <td><span class="${isAdd ? 'td-delta-add' : 'td-delta-sub'}">${isAdd ? '+' : '-'}${formatAmount(Math.abs(item.amount))} ${currSymbol}</span></td>
            <td><span class="inline-badge ${isAdd ? 'issue' : 'receive'}">${isAdd ? 'Додано' : 'Віднято'}</span></td>
            <td>${item.description || emptyValueHtml()}</td>
        `;
        tableBody.appendChild(row);
    });
}

function initCashForm() {
    const form = document.getElementById('cash-form');
    if (!form) {
        return;
    }
    formBindInvalidHighlightClearing(form);
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const canEditMoney = isSuperAdmin || currentUser?.role === 'manager';
        if (!canEditMoney) {
            formShowValidationError(form, 'cash-message', 'Доступно лише супер адміну або менеджеру', ['cash-currency']);
            return;
        }
        const currency = document.getElementById('cash-currency').value;
        const amount = parseFloat(document.getElementById('cash-amount').value);
        const transactionType = document.getElementById('cash-type').value;
        const description = document.getElementById('cash-description').value.trim();
        if (Number.isNaN(amount) || amount <= 0) {
            formShowValidationError(form, 'cash-message', 'Вкажіть коректну суму', ['cash-amount']);
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
            clearFormValidationState(form, 'cash-message');
            form.reset();
            await refreshAfterMutation(['cash', 'cashTransactions', 'dashboard']);
        } else {
            const error = await response.json().catch(() => null);
            setFormMessage('cash-message', error?.detail || 'Помилка операції', true);
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
