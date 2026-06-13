import { state } from './state.js';
import { apiCall } from './api.js';
import { elements, showToast, applyRolePrivileges } from './ui.js';

/**
 * Checks authentication status and displays appropriate forms (setup, login, or main).
 */
export async function checkAuthStatus() {
  try {
    const setupStatus = await apiCall('/api/auth/setup-status');
    const me = await apiCall('/api/auth/me');
    state.currentUser = me.user;

    if (!setupStatus.isSetup) {
      // Setup master owner
      elements.authOverlay.classList.remove('hidden');
      elements.setupCard.classList.remove('hidden');
      elements.loginCard.classList.add('hidden');
    } else if (!state.currentUser && !localStorage.getItem('guestMode')) {
      // Require Login
      elements.authOverlay.classList.remove('hidden');
      elements.loginCard.classList.remove('hidden');
      elements.setupCard.classList.add('hidden');
    } else {
      // Authenticated or continuing as Guest
      elements.authOverlay.classList.add('hidden');
    }
    applyRolePrivileges();
  } catch (err) {
    console.error("Auth status verification error:", err.message);
  }
}

/**
 * Logs out the current user, clearing credentials and reloading the page.
 */
export async function handleLogout() {
  if (confirm('¿Quieres cerrar sesión?')) {
    try {
      await apiCall('/api/auth/logout', 'POST');
    } catch (err) {
      console.warn("Logout API request failed:", err.message);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('guestMode');
    state.currentUser = null;
    window.location.reload();
  }
}

/**
 * Sets guest mode, bypasses authentication, and loads public access UI.
 */
export function handleGuestLogin() {
  localStorage.setItem('guestMode', 'true');
  localStorage.removeItem('token');
  state.currentUser = null;
  elements.authOverlay.classList.add('hidden');
  applyRolePrivileges();
}

/**
 * Fetches and displays registered collaborators in the user settings tab.
 */
export async function loadUsersList() {
  if (!state.currentUser) return;
  try {
    const data = await apiCall('/api/auth/users');
    if (data && data.users) {
      elements.usersListContainer.innerHTML = data.users.map((u) => {
        const isSelf = u.username === state.currentUser.username;
        const isOwner = u.role === 'owner';
        
        let canDelete = false;
        // Rules:
        // - Owner can delete admins and operators
        // - Admin can delete operators
        // - Cannot delete self or owner
        if (!isSelf && !isOwner) {
          if (state.currentUser.role === 'owner') {
            canDelete = true;
          } else if (state.currentUser.role === 'admin' && u.role === 'operator') {
            canDelete = true;
          }
        }

        let roleLabel = 'Operador';
        if (u.role === 'owner') roleLabel = 'Dueño';
        if (u.role === 'admin') roleLabel = 'Administrador';

        return `
          <li class="flex justify-between items-center bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.04] px-3 py-2 rounded-xl text-xs">
            <div>
              <span class="font-bold text-slate-700 dark:text-slate-200">${u.username}</span>
              <span class="text-[10px] text-slate-400 dark:text-slate-500 italic ml-2">(${roleLabel})</span>
            </div>
            ${canDelete ? `
              <button class="text-red-500 hover:text-red-700 font-bold" data-action="delete-user" data-username="${u.username}">Eliminar</button>
            ` : ''}
          </li>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Error loading users list:', err.message);
  }
}

/**
 * Deletes a collaborator user by username.
 */
export async function deleteUser(username) {
  if (confirm(`¿Estás seguro de que quieres eliminar al usuario '${username}'?`)) {
    try {
      await apiCall(`/api/auth/users/delete/${username}`, 'DELETE');
      await loadUsersList();
      showToast(`Usuario ${username} eliminado.`);
    } catch (err) {
      showToast(`Error al eliminar usuario: ${err.message}`, 'error');
    }
  }
}

// ─── Event Setup for Forms ─────────────────────────────────────────
export function initAuthEvents() {
  // Setup Form Handler
  if (elements.setupForm) {
    elements.setupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      elements.setupError.classList.add('hidden');
      
      const username = elements.setupUsernameInput.value.trim();
      const password = elements.setupPasswordInput.value;
      const confirmPassword = elements.setupConfirmInput.value;

      if (password !== confirmPassword) {
        elements.setupError.textContent = "Las contraseñas no coinciden.";
        elements.setupError.classList.remove('hidden');
        return;
      }

      try {
        const data = await apiCall('/api/auth/setup', 'POST', { username, password });
        if (data.success) {
          // Auto-login after registration
          const loginData = await apiCall('/api/auth/login', 'POST', { username, password });
          localStorage.setItem('token', loginData.token);
          localStorage.removeItem('guestMode');
          elements.setupForm.reset();
          await checkAuthStatus();
        }
      } catch (err) {
        elements.setupError.textContent = err.message;
        elements.setupError.classList.remove('hidden');
      }
    });
  }

  // Login Form Handler
  if (elements.loginForm) {
    elements.loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      elements.loginError.classList.add('hidden');

      const username = elements.loginUsernameInput.value.trim();
      const password = elements.loginPasswordInput.value;

      try {
        const data = await apiCall('/api/auth/login', 'POST', { username, password });
        localStorage.setItem('token', data.token);
        localStorage.removeItem('guestMode');
        elements.loginForm.reset();
        await checkAuthStatus();
      } catch (err) {
        elements.loginError.textContent = err.message;
        elements.loginError.classList.remove('hidden');
      }
    });
  }

  // Guest Login Button
  if (elements.btnLoginGuest) {
    elements.btnLoginGuest.addEventListener('click', handleGuestLogin);
  }

  // Creator form for collaborators inside settings
  if (elements.newUserForm) {
    elements.newUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      elements.newUserError.classList.add('hidden');

      const username = elements.newUsernameInput.value.trim();
      const password = elements.newUserPasswordInput.value;
      const role = elements.newUserRoleSelect.value;

      try {
        await apiCall('/api/auth/users/create', 'POST', { username, password, role });
        elements.newUserForm.reset();
        await loadUsersList();
        showToast(`Usuario ${username} creado con éxito.`);
      } catch (err) {
        elements.newUserError.textContent = err.message;
        elements.newUserError.classList.remove('hidden');
      }
    });
  }
}
