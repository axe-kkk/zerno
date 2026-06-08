// ═══════════════════════════════════════════════════════════
// Користувачі (адмінка користувачів)
// Завантажується ПІСЛЯ core.js і ПЕРЕД dashboard.js.
// usersCache доступна іншим файлам через спільний script realm
// (читає getUserName/getUserNameHtml у dashboard.js).
// ═══════════════════════════════════════════════════════════

let usersCache = [];
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
        const isManager = user.role === 'manager';
        const roleBadge = isAdmin
            ? '<span class="status-badge danger">Супер адмін</span>'
            : isManager
                ? '<span class="status-badge warning">Менеджер</span>'
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
                    await refreshAfterMutation(['users']);
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
    const roleSelect = document.getElementById('user-edit-role');
    if (roleSelect) {
        if (user.role === 'super_admin') {
            // Усі опції disabled, показуємо «Супер адмін»
            const opt = roleSelect.querySelector('option[value="super_admin"]');
            if (opt) opt.hidden = false;
            roleSelect.value = 'super_admin';
            roleSelect.disabled = true;
        } else {
            const opt = roleSelect.querySelector('option[value="super_admin"]');
            if (opt) opt.hidden = true;
            roleSelect.value = user.role || 'user';
            roleSelect.disabled = false;
        }
    }
    const passwordInput = document.getElementById('user-edit-password');
    passwordInput.value = user.password_plain || '';
    passwordInput.type = 'text';
    const passwordToggle = document.getElementById('user-edit-password-toggle');
    if (passwordToggle) {
        passwordToggle.textContent = 'Сховати';
    }
    document.getElementById('user-edit-is-active').checked = user.is_active;
    updateUserStatusLabel(user.is_active);
    const uf = document.getElementById('user-edit-form');
    if (uf) clearFormValidationState(uf, 'user-edit-message');
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

    formBindInvalidHighlightClearing(form);

    const closeModal = () => {
        editingUserId = null;
        clearFormValidationState(form, 'user-edit-message');
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
        const roleSelect = document.getElementById('user-edit-role');
        const role = roleSelect?.value;

        if (!fullName) {
            formShowValidationError(form, 'user-edit-message', 'Вкажіть ПІБ', ['user-edit-full-name']);
            return;
        }

        const payload = {
            full_name: fullName,
            is_active: isActive
        };

        // Передаємо роль лише якщо вона змінилася й це не супер адмін
        const editing = usersCache.find(u => u.id === editingUserId);
        if (role && editing && editing.role !== 'super_admin' && role !== editing.role) {
            payload.role = role;
        }

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
            clearFormValidationState(form, 'user-edit-message');
            await refreshAfterMutation(['users']);
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
            await refreshAfterMutation(['users']);
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
        await refreshAfterMutation(['users']);
        showToast('Користувача видалено', 'success');
    } else {
        showToast('Не вдалося видалити', 'error');
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
