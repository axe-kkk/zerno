// ═══════════════════════════════════════════════════════════
// Поля (Fields)
// fieldsCache читається з кількох розділів (intake form select,
// landlords) — лишається cross-file видимим через шаред script realm.
// Залежності з dashboard.js: getFieldName, getCultureName, intakeOnStock,
// getPeriodRange, openIntakeView, initCustomSelects, intakesCache,
// culturesCache, showNotification (TODO: showNotification не визначений ніде —
// pre-existing bug; зміни не вношу).
// ═══════════════════════════════════════════════════════════

let fieldsCache = [];

async function loadFields() {
    try {
        const res = await apiFetch('/fields');
        if (res.ok) {
            fieldsCache = await res.json();
            renderFieldsTable(fieldsCache);
            // Оновлюємо опції фільтра «Поле» у таблиці «Привезено з полів».
            // Без цього після refreshAfterMutation(['fields']) дропдаун
            // лишається без жодного поля окрім «Всі поля».
            if (typeof updateFieldIntakesFilterOptions === 'function') {
                updateFieldIntakesFilterOptions();
            }
        }
    } catch (e) {
        console.error('loadFields error', e);
    }
}

function renderFieldsTable(data) {
    const tbody = document.querySelector('#fields-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Полів ще немає</td></tr>';
        return;
    }

    data.forEach(f => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(f.name)}</td>
            <td>${f.note ? escapeHtml(f.note) : emptyValueHtml()}</td>
            <td class="actions-cell">
                <button class="btn-icon btn-icon-secondary" onclick="openFieldEditModal(${f.id})" title="Редагувати">${ICONS.edit}</button>
                <button class="btn-icon btn-icon-danger" onclick="deleteField(${f.id})" title="Видалити">${ICONS.delete}</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getFieldIntakesFiltered() {
    let list = (intakesCache || []).filter(i => i.field_id != null);
    const fieldId = document.getElementById('field-intakes-filter-field')?.value;
    const cultureId = document.getElementById('field-intakes-filter-culture')?.value;
    const period = document.getElementById('field-intakes-filter-period')?.value;
    if (fieldId) list = list.filter(i => i.field_id === parseInt(fieldId, 10));
    if (cultureId) list = list.filter(i => i.culture_id === parseInt(cultureId, 10));
    if (period && period !== 'all') {
        const range = getPeriodRange(period);
        if (range) {
            list = list.filter(i => {
                const d = new Date(i.created_at);
                return d >= range.start && d <= range.end;
            });
        }
    }
    return list.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function renderFieldIntakesTable() {
    const tbody = document.querySelector('#field-intakes-table tbody');
    if (!tbody) return;
    const sorted = getFieldIntakesFiltered();
    tbody.innerHTML = '';
    const tfoot = document.getElementById('field-intakes-totals');
    if (!sorted.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Ще немає приходів з полів (зерно підприємства)</td></tr>';
        if (tfoot) tfoot.classList.add('hidden');
        return;
    }
    sorted.forEach(intake => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${getFieldName(intake.field_id)}</td>
            <td><span class="inline-badge grain">${getCultureName(intake.culture_id)}</span></td>
            <td class="td-weight">${intakeOnStock(intake) ? formatWeight(intake.accepted_weight_kg) + ' кг' : emptyValueHtml()}</td>
            <td>${formatDate(intake.created_at)}</td>
            <td class="actions-cell">
                <button class="btn-icon btn-icon-secondary" data-view="${intake.id}" title="Переглянути">${ICONS.view}</button>
            </td>
        `;
        tr.querySelector('[data-view]').addEventListener('click', () => openIntakeView(intake.id));
        tbody.appendChild(tr);
    });
    // Підсумки у стилі сторінки «Прийом зерна» (Σ карток + сірий hint + жирні кг)
    if (tfoot) {
        const onStock = sorted.filter(intakeOnStock);
        const totalKg = onStock.reduce((s, i) => s + (i.accepted_weight_kg || 0), 0);
        const pending = sorted.length - onStock.length;
        const cardsLabel = sorted.length === 1 ? 'картка' : 'карток';
        const pendingHint = pending > 0
            ? ` <span class="td-secondary">(+ ${pending} очікують)</span>`
            : '';
        tfoot.innerHTML = `
            <tr>
                <td><strong>Σ ${sorted.length} ${cardsLabel}</strong>${pendingHint}</td>
                <td class="td-secondary">Підсумок підтверджених</td>
                <td class="td-weight"><strong>${formatWeight(totalKg)} кг</strong></td>
                <td colspan="2"></td>
            </tr>
        `;
        tfoot.classList.remove('hidden');
    }
}

function applyFieldsFilters() {
    const search = (document.getElementById('fields-filter-search')?.value || '').toLowerCase().trim();
    let filtered = fieldsCache;
    if (search) {
        filtered = filtered.filter(f => f.name.toLowerCase().includes(search));
    }
    renderFieldsTable(filtered);
}

function updateFieldIntakesFilterOptions() {
    const fieldSelect = document.getElementById('field-intakes-filter-field');
    const cultureSelect = document.getElementById('field-intakes-filter-culture');
    if (fieldSelect) {
        const v = fieldSelect.value;
        fieldSelect.innerHTML = '<option value="">Всі поля</option>' +
            (fieldsCache || []).map(f => `<option value="${f.id}">${f.name}</option>`).join('');
        if (v) fieldSelect.value = v;
        initCustomSelects(fieldSelect);
    }
    if (cultureSelect) {
        const v = cultureSelect.value;
        cultureSelect.innerHTML = '<option value="">Всі культури</option>' +
            (culturesCache || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        if (v) cultureSelect.value = v;
        initCustomSelects(cultureSelect);
    }
}

function initFieldsSection() {
    const fieldForm = document.getElementById('field-form');
    if (fieldForm) formBindInvalidHighlightClearing(fieldForm);

    document.getElementById('fields-filter-search')?.addEventListener('input', applyFieldsFilters);

    const fieldIntakesFilterField = document.getElementById('field-intakes-filter-field');
    const fieldIntakesFilterCulture = document.getElementById('field-intakes-filter-culture');
    const fieldIntakesFilterPeriod = document.getElementById('field-intakes-filter-period');
    if (fieldIntakesFilterField) fieldIntakesFilterField.addEventListener('change', () => renderFieldIntakesTable());
    if (fieldIntakesFilterCulture) fieldIntakesFilterCulture.addEventListener('change', () => renderFieldIntakesTable());
    if (fieldIntakesFilterPeriod) fieldIntakesFilterPeriod.addEventListener('change', () => renderFieldIntakesTable());

    document.getElementById('fields-report-btn')?.addEventListener('click', async () => {
        const response = await apiFetchBlob('/fields/export');
        if (!response.ok) {
            showToast('Не вдалося сформувати звіт', 'error');
            return;
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `fields_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showToast('Звіт сформовано', 'success');
    });

    document.getElementById('field-intakes-report-btn')?.addEventListener('click', async () => {
        const params = new URLSearchParams();
        params.append('only_field_intakes', 'true');
        const fieldId = document.getElementById('field-intakes-filter-field')?.value;
        const cultureId = document.getElementById('field-intakes-filter-culture')?.value;
        const period = document.getElementById('field-intakes-filter-period')?.value;
        if (fieldId) params.append('field_id', fieldId);
        if (cultureId) params.append('culture_id', cultureId);
        if (period && period !== 'all') {
            const range = getPeriodRange(period);
            if (range) {
                params.append('start_date', range.start.toISOString().slice(0, 10));
                params.append('end_date', range.end.toISOString().slice(0, 10));
            }
        }
        const path = `/grain/intakes/export?${params.toString()}`;
        const response = await apiFetchBlob(path);
        if (!response.ok) {
            showToast('Не вдалося сформувати звіт', 'error');
            return;
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `field_intakes_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showToast('Звіт сформовано', 'success');
    });

    document.getElementById('field-add-btn')?.addEventListener('click', () => {
        if (fieldForm) clearFormValidationState(fieldForm, 'field-message');
        document.getElementById('field-modal-title').textContent = 'Додати поле';
        document.getElementById('field-edit-id').value = '';
        document.getElementById('field-name').value = '';
        document.getElementById('field-note').value = '';
        document.getElementById('field-modal').classList.remove('hidden');
    });

    fieldForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = document.getElementById('field-edit-id').value;
        const name = document.getElementById('field-name').value.trim();
        if (!name) {
            formShowValidationError(fieldForm, 'field-message', 'Вкажіть назву поля', ['field-name']);
            return;
        }
        const payload = {
            name,
            note: document.getElementById('field-note').value.trim() || null
        };

        const url = editId ? `/fields/${editId}` : '/fields';
        const method = editId ? 'PATCH' : 'POST';

        const res = await apiFetch(url, {
            method,
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            closeFieldModal();
            await refreshAfterMutation(['fields', 'allIntakes']);
            showNotification(editId ? 'Поле оновлено' : 'Поле додано', 'success');
        } else {
            const err = await res.json();
            setFormMessage('field-message', err.detail || 'Помилка', true);
        }
    });

    const fieldModal = document.getElementById('field-modal');
    const closeFieldModal = () => {
        if (fieldForm) clearFormValidationState(fieldForm, 'field-message');
        fieldModal?.classList.add('hidden');
    };

    document.getElementById('field-modal-close')?.addEventListener('click', closeFieldModal);
    document.getElementById('field-modal-cancel')?.addEventListener('click', closeFieldModal);
    fieldModal?.querySelector('.modal-overlay')?.addEventListener('click', closeFieldModal);
}

function openFieldEditModal(fieldId) {
    const field = fieldsCache.find(f => f.id === fieldId);
    if (!field) return;

    const fieldForm = document.getElementById('field-form');
    if (fieldForm) clearFormValidationState(fieldForm, 'field-message');

    document.getElementById('field-modal-title').textContent = 'Редагувати поле';
    document.getElementById('field-edit-id').value = field.id;
    document.getElementById('field-name').value = field.name;
    document.getElementById('field-note').value = field.note || '';
    document.getElementById('field-modal').classList.remove('hidden');
}

async function deleteField(fieldId) {
    if (!confirm('Видалити це поле?')) return;

    const res = await apiFetch(`/fields/${fieldId}`, { method: 'DELETE' });
    if (res.ok) {
        await refreshAfterMutation(['fields', 'allIntakes']);
        showNotification('Поле видалено', 'success');
    } else {
        const err = await res.json();
        showNotification(err.detail || 'Помилка видалення', 'error');
    }
}
