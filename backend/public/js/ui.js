import { state } from './state.js';

// ─── DOM Elements Cache ──────────────────────────────────────────
export const elements = {
  streamStatus: document.getElementById('stream-status'),
  streamStatusMobile: document.getElementById('stream-status-mobile'),
  trackThumbnail: document.getElementById('track-thumbnail'),
  trackTitle: document.getElementById('track-title'),
  trackSubtitle: document.getElementById('track-subtitle'),
  progressSlider: document.getElementById('progress-slider'),
  timeCurrent: document.getElementById('time-current'),
  timeTotal: document.getElementById('time-total'),
  
  btnShuffle: document.getElementById('btn-shuffle'),
  btnBack: document.getElementById('btn-back'),
  btnPause: document.getElementById('btn-pause'),
  btnSkip: document.getElementById('btn-skip'),
  btnClear: document.getElementById('btn-clear'),
  btnThemeToggle: document.getElementById('btn-theme-toggle'),
  btnToggleStream: document.getElementById('btn-toggle-stream'),
  btnToggleStreamMobile: document.getElementById('btn-toggle-stream-mobile'),
  streamToggleIconMobile: document.getElementById('stream-toggle-icon-mobile'),
  streamToggleTextMobile: document.getElementById('stream-toggle-text-mobile'),

  // Mobile Menu
  btnMobileMenu: document.getElementById('btn-mobile-menu'),
  mobileMenuDropdown: document.getElementById('mobile-menu-dropdown'),
  mobileMenuIcon: document.getElementById('mobile-menu-icon'),
  userBadgeMobile: document.getElementById('user-badge-mobile'),
  userNameLabelMobile: document.getElementById('user-name-label-mobile'),
  userRoleLabelMobile: document.getElementById('user-role-label-mobile'),
  btnOpenSettingsMobile: document.getElementById('btn-open-settings-mobile'),
  btnThemeToggleMobile: document.getElementById('btn-theme-toggle-mobile'),
  themeToggleIconMobile: document.getElementById('theme-toggle-icon-mobile'),
  themeToggleTextMobile: document.getElementById('theme-toggle-text-mobile'),
  btnAuthActionMobile: document.getElementById('btn-auth-action-mobile'),
  authActionIconMobile: document.getElementById('auth-action-icon-mobile'),
  authActionTextMobile: document.getElementById('auth-action-text-mobile'),

  fadeSlider: document.getElementById('fade-slider'),
  fadeValue: document.getElementById('fade-value'),
  fallbackVolumeSlider: document.getElementById('fallback-volume-slider'),
  fallbackVolumeValue: document.getElementById('fallback-volume-value'),

  addSongForm: document.getElementById('add-song-form'),
  songUrlInput: document.getElementById('song-url'),
  btnAddSong: document.getElementById('btn-add-song'),
  btnAddText: document.getElementById('btn-add-text'),
  btnAddSpinner: document.getElementById('btn-add-spinner'),

  queueList: document.getElementById('queue-list'),
  queueCounter: document.getElementById('queue-counter'),
  queueListWrapper: document.querySelector('.queue-list-wrapper'),

  // Auth DOM Elements
  authOverlay: document.getElementById('auth-overlay'),
  setupCard: document.getElementById('setup-card'),
  loginCard: document.getElementById('login-card'),
  setupForm: document.getElementById('setup-form'),
  loginForm: document.getElementById('login-form'),
  setupUsernameInput: document.getElementById('setup-username'),
  setupPasswordInput: document.getElementById('setup-password'),
  setupConfirmInput: document.getElementById('setup-confirm'),
  loginUsernameInput: document.getElementById('login-username'),
  loginPasswordInput: document.getElementById('login-password'),
  btnLoginGuest: document.getElementById('btn-login-guest'),
  btnAuthAction: document.getElementById('btn-auth-action'),
  userBadge: document.getElementById('user-badge'),
  userNameLabel: document.getElementById('user-name-label'),
  userRoleLabel: document.getElementById('user-role-label'),
  setupError: document.getElementById('setup-error'),
  loginError: document.getElementById('login-error'),

  // Settings DOM Elements
  btnOpenSettings: document.getElementById('btn-open-settings'),
  btnCloseSettings: document.getElementById('btn-close-settings'),
  settingsModal: document.getElementById('settings-modal'),
  btnSaveSettings: document.getElementById('btn-save-settings'),

  tabBtnStream: document.getElementById('tab-btn-stream'),
  tabBtnUsers: document.getElementById('tab-btn-users'),
  tabBtnGeneral: document.getElementById('tab-btn-general'),
  tabStream: document.getElementById('tab-stream'),
  tabUsers: document.getElementById('tab-users'),
  tabGeneral: document.getElementById('tab-general'),

  settingsOutputMode: document.getElementById('settings-output-mode'),
  settingsGroupYoutube: document.getElementById('settings-group-youtube'),
  settingsGroupIcecast: document.getElementById('settings-group-icecast'),
  settingsYtUrl: document.getElementById('settings-yt-url'),
  settingsYtKey: document.getElementById('settings-yt-key'),
  btnToggleKeyVisibility: document.getElementById('btn-toggle-key-visibility'),
  toggleKeyIcon: document.getElementById('toggle-key-icon'),

  // Icecast
  settingsIceType: document.getElementById('settings-ice-type'),
  settingsIceHost: document.getElementById('settings-ice-host'),
  settingsIcePort: document.getElementById('settings-ice-port'),
  settingsIcePassword: document.getElementById('settings-ice-password'),
  btnToggleIcePasswordVisibility: document.getElementById('btn-toggle-ice-password-visibility'),
  toggleIcePasswordIcon: document.getElementById('toggle-ice-password-icon'),
  settingsIceMountpoint: document.getElementById('settings-ice-mountpoint'),
  settingsIceMountGroup: document.getElementById('settings-ice-mount-group'),
  settingsIceFormat: document.getElementById('settings-ice-format'),
  settingsIceBitrate: document.getElementById('settings-ice-bitrate'),

  settingsPort: document.getElementById('settings-port'),
  settingsGuestAdd: document.getElementById('settings-guest-add'),
  settingsPotUrl: document.getElementById('settings-pot-url'),

  searchResultsDropdown: document.getElementById('search-results-dropdown'),
  persistentAlertsContainer: document.getElementById('persistent-alerts-container'),

  // Cloudflare
  settingsExposeServer: document.getElementById('settings-expose-server'),
  settingsTunnelStatusGroup: document.getElementById('settings-tunnel-status-group'),
  settingsTunnelWebUrl: document.getElementById('settings-tunnel-web-url'),
  settingsTunnelStreamUrl: document.getElementById('settings-tunnel-stream-url'),
  btnCopySettingsTunnelStream: document.getElementById('btn-copy-settings-tunnel-stream'),

  tunnelBanner: document.getElementById('tunnel-banner'),
  tunnelWebLink: document.getElementById('tunnel-web-link'),
  btnCopyTunnelStream: document.getElementById('btn-copy-tunnel-stream'),

  newUserForm: document.getElementById('new-user-form'),
  newUsernameInput: document.getElementById('new-user-username'),
  newUserPasswordInput: document.getElementById('new-user-password'),
  newUserRoleSelect: document.getElementById('new-user-role'),
  newUserError: document.getElementById('new-user-error'),
  usersListContainer: document.getElementById('users-list-container'),
  
  toastContainer: document.getElementById('toast-container')
};

// ─── Local UI State Variables ─────────────────────────────────────
let localElapsed = 0;
let lastUpdateTimestamp = 0;
let isDraggingSlider = false;
let isDraggingSettings = false;
const shownErrors = new Set();

export const getIsDraggingSlider = () => isDraggingSlider;
export const setIsDraggingSlider = (val) => { isDraggingSlider = val; };
export const getIsDraggingSettings = () => isDraggingSettings;
export const setIsDraggingSettings = (val) => { isDraggingSettings = val; };
export const setLocalElapsed = (val) => { localElapsed = val; };
export const setLastUpdateTimestamp = (val) => { lastUpdateTimestamp = val; };

// ─── Toast Notifications ──────────────────────────────────────────
export function showToast(message, type = 'success') {
  const container = elements.toastContainer;
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = '<i class="fa-solid fa-circle-info text-procyon-lightCyan dark:text-procyon-cyan text-sm"></i>';
  if (type === 'success') {
    icon = '<i class="fa-solid fa-circle-check text-emerald-500 text-sm"></i>';
  } else if (type === 'error') {
    icon = '<i class="fa-solid fa-circle-exclamation text-red-500 text-sm"></i>';
  }
  
  toast.innerHTML = `
    ${icon}
    <span class="flex-1">${message}</span>
  `;
  
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 350);
  }, 3500);
}

// ─── Format Time Helper ───────────────────────────────────────────
export function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ─── YouTube Thumbnail Helper ─────────────────────────────────────
export function getYouTubeThumbnail(videoId) {
  if (videoId.startsWith('http')) {
    return 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?q=80&w=600';
  }
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

// ─── Persistent Errors ────────────────────────────────────────────
export function showPersistentError(youtubeId, name) {
  const container = elements.persistentAlertsContainer;
  if (!container) return;
  
  const alert = document.createElement('div');
  alert.className = 'toast show toast-error pointer-events-auto shadow-lg border border-red-500/20 bg-red-500/10 flex justify-between items-center gap-3 w-full';
  alert.innerHTML = `
    <div class="flex items-center gap-2 min-w-0 flex-1">
      <i class="fa-solid fa-circle-exclamation text-red-500 text-sm shrink-0"></i>
      <span class="text-xs font-semibold text-slate-800 dark:text-red-300 truncate">Fallo al cargar: ${name}</span>
    </div>
    <button type="button" class="text-slate-400 hover:text-red-500 text-xs px-1 shrink-0" data-action="close-alert">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;
  container.appendChild(alert);
}

export function updateFavicon(isLight) {
  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon) {
    favicon.setAttribute('href', isLight ? 'logo_light.svg' : 'logo_dark.svg');
  }
}

// ─── Theme Management ─────────────────────────────────────────────
export function initTheme() {
  const systemPrefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  const savedTheme = localStorage.getItem('theme') || (systemPrefersLight ? 'light' : 'dark');
  
  if (savedTheme === 'light') {
    document.documentElement.classList.remove('dark');
    updateThemeToggleIcon(true);
    updateFavicon(true);
  } else {
    document.documentElement.classList.add('dark');
    updateThemeToggleIcon(false);
    updateFavicon(false);
  }
}

export function updateThemeToggleIcon(isLight) {
  if (elements.btnThemeToggle) {
    elements.btnThemeToggle.innerHTML = isLight 
      ? '<i class="fa-solid fa-sun text-amber-500 animate-pulse"></i>' 
      : '<i class="fa-solid fa-moon text-indigo-400"></i>';
  }
  if (elements.themeToggleIconMobile && elements.themeToggleTextMobile) {
    elements.themeToggleIconMobile.innerHTML = isLight 
      ? '<i class="fa-solid fa-sun text-amber-500"></i>' 
      : '<i class="fa-solid fa-moon text-indigo-400"></i>';
    elements.themeToggleTextMobile.textContent = isLight ? 'Modo Oscuro' : 'Modo Claro';
  }
}

export function toggleTheme() {
  const isDarkNow = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDarkNow ? 'dark' : 'light');
  updateThemeToggleIcon(!isDarkNow);
  updateFavicon(!isDarkNow);
}

// ─── Role / Privilege UI Enforcement ──────────────────────────────
export function applyRolePrivileges() {
  const user = state.currentUser;
  const role = user ? user.role : 'guest';
  
  // Expose header settings and stream actions button for owner or admin
  const isOwnerOrAdmin = role === 'owner' || role === 'admin';
  const displayStyle = isOwnerOrAdmin ? 'flex' : 'none';
  
  if (elements.btnOpenSettings) {
    elements.btnOpenSettings.style.display = displayStyle;
  }
  if (elements.btnOpenSettingsMobile) {
    elements.btnOpenSettingsMobile.style.display = displayStyle;
  }
  if (elements.btnToggleStream) {
    elements.btnToggleStream.style.display = displayStyle;
  }
  if (elements.btnToggleStreamMobile) {
    elements.btnToggleStreamMobile.style.display = displayStyle;
  }

  // Adjust User Management Tab visibility inside settings
  if (elements.tabBtnUsers) {
    elements.tabBtnUsers.style.display = isOwnerOrAdmin ? 'block' : 'none';
  }

  // Configure playback control buttons based on role permissions
  const isGuest = role === 'guest';
  const isOperator = role === 'operator';
  const canOperate = isOperator || isOwnerOrAdmin;

  // Pause / Resume & Clear require Admin+
  elements.btnPause.disabled = !isOwnerOrAdmin;
  elements.btnPause.style.opacity = isOwnerOrAdmin ? '1' : '0.4';
  elements.btnPause.style.cursor = isOwnerOrAdmin ? 'pointer' : 'not-allowed';
  
  elements.btnClear.disabled = !isOwnerOrAdmin;
  elements.btnClear.style.opacity = isOwnerOrAdmin ? '1' : '0.4';
  elements.btnClear.style.cursor = isOwnerOrAdmin ? 'pointer' : 'not-allowed';

  // Skip, Shuffle, Back require Operator+
  elements.btnSkip.disabled = !canOperate;
  elements.btnSkip.style.opacity = canOperate ? '1' : '0.4';
  elements.btnSkip.style.cursor = canOperate ? 'pointer' : 'not-allowed';

  elements.btnShuffle.disabled = !canOperate;
  elements.btnShuffle.style.opacity = canOperate ? '1' : '0.4';
  elements.btnShuffle.style.cursor = canOperate ? 'pointer' : 'not-allowed';

  elements.btnBack.disabled = !canOperate || !state.hasHistory;
  elements.btnBack.style.opacity = (canOperate && state.hasHistory) ? '1' : '0.4';
  elements.btnBack.style.cursor = (canOperate && state.hasHistory) ? 'pointer' : 'not-allowed';

  // Progress Bar Seek requires Operator+
  elements.progressSlider.disabled = !canOperate;
  elements.progressSlider.style.cursor = canOperate ? 'pointer' : 'not-allowed';

  // Settings Sliders require Admin+
  elements.fadeSlider.disabled = !isOwnerOrAdmin;
  elements.fadeSlider.style.cursor = isOwnerOrAdmin ? 'pointer' : 'not-allowed';
  if (elements.fallbackVolumeSlider) {
    elements.fallbackVolumeSlider.disabled = !isOwnerOrAdmin;
    elements.fallbackVolumeSlider.style.cursor = isOwnerOrAdmin ? 'pointer' : 'not-allowed';
  }

  // Add song input control
  const canAdd = state.allowGuestAdd || canOperate;
  elements.songUrlInput.disabled = !canAdd;
  elements.btnAddSong.disabled = !canAdd;
  elements.songUrlInput.placeholder = canAdd ? "Pega un link de YouTube o radio..." : "Solo operadores pueden añadir música.";
  
  // Render Auth Button badge
  if (user) {
    elements.userBadge.classList.remove('hidden');
    elements.userBadge.classList.add('flex');
    elements.userNameLabel.textContent = user.username;
    
    if (elements.userBadgeMobile && elements.userNameLabelMobile) {
      elements.userBadgeMobile.classList.remove('hidden');
      elements.userBadgeMobile.classList.add('flex');
      elements.userNameLabelMobile.textContent = user.username;
    }
    
    let roleName = 'Invitado';
    if (user.role === 'owner') roleName = 'Dueño';
    if (user.role === 'admin') roleName = 'Admin';
    if (user.role === 'operator') roleName = 'Operador';
    
    elements.userRoleLabel.textContent = roleName;
    if (elements.userRoleLabelMobile) {
      elements.userRoleLabelMobile.textContent = roleName;
    }
    elements.btnAuthAction.innerHTML = '<i class="fa-solid fa-right-from-bracket text-red-500"></i>';
    elements.btnAuthAction.title = 'Cerrar Sesión';
    
    if (elements.btnAuthActionMobile) {
      elements.btnAuthActionMobile.innerHTML = '<i class="fa-solid fa-right-from-bracket text-red-500 w-4"></i> Cerrar Sesión';
    }
  } else {
    elements.userBadge.classList.add('hidden');
    elements.userBadge.classList.remove('flex');
    
    if (elements.userBadgeMobile) {
      elements.userBadgeMobile.classList.add('hidden');
      elements.userBadgeMobile.classList.remove('flex');
    }
    
    elements.btnAuthAction.innerHTML = '<i class="fa-solid fa-right-to-bracket text-procyon-lightIndigo dark:text-procyon-indigo"></i>';
    elements.btnAuthAction.title = 'Iniciar Sesión';
    
    if (elements.btnAuthActionMobile) {
      elements.btnAuthActionMobile.innerHTML = '<i class="fa-solid fa-right-to-bracket text-procyon-lightIndigo dark:text-procyon-indigo w-4"></i> Iniciar Sesión';
    }
  }
}

// ─── Smooth Progress Bar Interpolation ───────────────────────────
export function interpolateProgress() {
  if (state.currentTrack && !state.isPaused && !isDraggingSlider && state.currentTrack.duration > 0) {
    const msSinceLastUpdate = Date.now() - lastUpdateTimestamp;
    const interpolatedElapsed = localElapsed + (msSinceLastUpdate / 1000);
    const displayElapsed = Math.min(interpolatedElapsed, state.currentTrack.duration);
    
    const progressPercent = (displayElapsed / state.currentTrack.duration) * 100;
    elements.progressSlider.value = progressPercent;
    elements.progressSlider.style.backgroundSize = `${progressPercent}% 100%`;
    elements.timeCurrent.textContent = formatTime(displayElapsed);
  }
}

// ─── Render Queue and Player Status ───────────────────────────────
export function updateUI() {
  applyRolePrivileges();

  // 1. Stream Status Badge
  elements.streamStatus.className = 'status-badge';
  if (elements.streamStatusMobile) {
    elements.streamStatusMobile.className = 'status-badge';
  }
  
  if (state.isPaused) {
    elements.streamStatus.classList.add('paused');
    elements.streamStatus.querySelector('.status-text').textContent = 'Pausado';
    if (elements.streamStatusMobile) {
      elements.streamStatusMobile.classList.add('paused');
      elements.streamStatusMobile.querySelector('.status-text').textContent = 'Pausado';
    }
    elements.btnPause.innerHTML = '<i class="fa-solid fa-play"></i>';
    elements.btnPause.title = 'Reanudar';
  } else if (state.isFallback) {
    elements.streamStatus.classList.add('fallback');
    elements.streamStatus.querySelector('.status-text').textContent = 'En Espera';
    if (elements.streamStatusMobile) {
      elements.streamStatusMobile.classList.add('fallback');
      elements.streamStatusMobile.querySelector('.status-text').textContent = 'En Espera';
    }
    elements.btnPause.innerHTML = '<i class="fa-solid fa-pause"></i>';
    elements.btnPause.title = 'Pausar (Deshabilitado)';
  } else {
    elements.streamStatus.classList.add('streaming');
    elements.streamStatus.querySelector('.status-text').textContent = 'Transmitiendo';
    if (elements.streamStatusMobile) {
      elements.streamStatusMobile.classList.add('streaming');
      elements.streamStatusMobile.querySelector('.status-text').textContent = 'Transmitiendo';
    }
    elements.btnPause.innerHTML = '<i class="fa-solid fa-pause"></i>';
    elements.btnPause.title = 'Pausar';
  }

  // Update Stream start/stop toggle buttons
  if (elements.btnToggleStream) {
    if (state.isStreaming) {
      elements.btnToggleStream.classList.remove('text-emerald-500', 'hover:text-emerald-600', 'dark:text-emerald-400', 'dark:hover:text-emerald-300');
      elements.btnToggleStream.classList.add('text-red-500', 'hover:text-red-600', 'dark:text-red-400', 'dark:hover:text-red-300');
      elements.btnToggleStream.title = "Detener Transmisión";
    } else {
      elements.btnToggleStream.classList.remove('text-red-500', 'hover:text-red-600', 'dark:text-red-400', 'dark:hover:text-red-300');
      elements.btnToggleStream.classList.add('text-emerald-500', 'hover:text-emerald-600', 'dark:text-emerald-400', 'dark:hover:text-emerald-300');
      elements.btnToggleStream.title = "Iniciar Transmisión";
    }
  }
  if (elements.btnToggleStreamMobile && elements.streamToggleIconMobile && elements.streamToggleTextMobile) {
    if (state.isStreaming) {
      elements.streamToggleIconMobile.innerHTML = '<i class="fa-solid fa-tower-broadcast text-red-500"></i>';
      elements.streamToggleTextMobile.textContent = 'Detener Transmisión';
    } else {
      elements.streamToggleIconMobile.innerHTML = '<i class="fa-solid fa-tower-broadcast text-emerald-500"></i>';
      elements.streamToggleTextMobile.textContent = 'Iniciar Transmisión';
    }
  }

  // Disable pause if fallback active and not paused
  const role = state.currentUser ? state.currentUser.role : 'guest';
  const isAdminOrOwner = role === 'admin' || role === 'owner';
  if (state.isFallback && !state.currentTrack && isAdminOrOwner) {
    elements.btnPause.disabled = true;
    elements.btnPause.style.opacity = '0.5';
    elements.btnPause.style.cursor = 'not-allowed';
  }

  // 2. Now Playing Track details
  if (state.currentTrack) {
    elements.trackTitle.textContent = state.currentTrack.title;
    elements.trackSubtitle.innerHTML = `${state.currentTrack.artist} <span class="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-mono">(ID: ${state.currentTrack.youtubeId})</span>`;
    elements.trackThumbnail.src = getYouTubeThumbnail(state.currentTrack.youtubeId);
    
    if (state.currentTrack.duration === 0) {
      elements.timeTotal.textContent = '∞';
      elements.progressSlider.disabled = true;
      elements.progressSlider.value = 100;
      elements.progressSlider.style.backgroundSize = '100% 100%';
    } else {
      elements.timeTotal.textContent = formatTime(state.currentTrack.duration);
      if (!isDraggingSlider && (role === 'admin' || role === 'owner' || role === 'operator')) {
        elements.progressSlider.disabled = false;
      }
    }
    
    localElapsed = state.currentTrack.elapsed;
    lastUpdateTimestamp = Date.now();

    if (!isDraggingSlider && state.currentTrack.duration > 0) {
      const progressPercent = (state.currentTrack.elapsed / state.currentTrack.duration) * 100;
      elements.progressSlider.value = progressPercent;
      elements.progressSlider.style.backgroundSize = `${progressPercent}% 100%`;
    }
  } else {
    elements.trackTitle.textContent = 'Música en Espera';
    elements.trackSubtitle.textContent = 'Transmitiendo audio de fondo';
    elements.trackThumbnail.src = 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?q=80&w=600';
    elements.progressSlider.value = 0;
    elements.progressSlider.style.backgroundSize = '0% 100%';
    elements.timeCurrent.textContent = '0:00';
    elements.timeTotal.textContent = '∞';
    elements.progressSlider.disabled = true;
  }

  // 3. Update Settings sliders and trails
  if (elements.fadeSlider && !isDraggingSettings) {
    elements.fadeSlider.value = state.fadeDuration;
    elements.fadeValue.textContent = `${state.fadeDuration}s`;
    const fadePercent = (state.fadeDuration / 10) * 100;
    elements.fadeSlider.style.backgroundSize = `${fadePercent}% 100%`;
  }
  if (elements.fallbackVolumeSlider && !isDraggingSettings) {
    elements.fallbackVolumeSlider.value = state.fallbackVolume;
    elements.fallbackVolumeValue.textContent = `${state.fallbackVolume}%`;
    elements.fallbackVolumeSlider.style.backgroundSize = `${state.fallbackVolume}% 100%`;
  }

  // 3.5. Update Cloudflare Tunnel Banner & settings details
  if (state.publicUrl) {
    if (elements.tunnelBanner) {
      elements.tunnelBanner.classList.remove('hidden');
    }
    if (elements.tunnelWebLink) {
      elements.tunnelWebLink.href = state.publicUrl;
    }
    if (elements.settingsTunnelStatusGroup) {
      elements.settingsTunnelStatusGroup.classList.remove('hidden');
    }
    if (elements.settingsTunnelWebUrl) {
      elements.settingsTunnelWebUrl.href = state.publicUrl;
      elements.settingsTunnelWebUrl.textContent = state.publicUrl;
    }
    if (elements.settingsTunnelStreamUrl) {
      elements.settingsTunnelStreamUrl.textContent = `${state.publicUrl}/api/stream/proxy`;
    }
  } else {
    if (elements.tunnelBanner) {
      elements.tunnelBanner.classList.add('hidden');
    }
    if (elements.settingsTunnelStatusGroup) {
      elements.settingsTunnelStatusGroup.classList.add('hidden');
    }
  }

  // 4. Queue List
  elements.queueCounter.textContent = `${state.queue.length} ${state.queue.length === 1 ? 'canción' : 'canciones'}`;
  
  if (state.queue.length === 0) {
    elements.queueList.innerHTML = `
      <li class="queue-placeholder text-center py-12 text-slate-400 dark:text-slate-500">
        <i class="fa-solid fa-list-ul text-3xl mb-3 opacity-40"></i>
        <p class="text-xs sm:text-sm">La cola está vacía. Añade algunas canciones arriba.</p>
      </li>
    `;
  } else {
    const isGuest = role === 'guest';
    elements.queueList.innerHTML = state.queue.map((item, index) => {
      const isError = item.duration === -1;
      const title = isError ? "No se pudo cargar la canción" : (item.title || "Cargando...");
      const artist = isError ? `Fallo de resolución: ${item.youtubeId}` : (item.artist || "Cargando...");
      
      // Trigger persistent notification if error has not been shown yet
      if (isError && !shownErrors.has(item.uuid)) {
        shownErrors.add(item.uuid);
        showPersistentError(item.youtubeId, item.title || "Canción en cola");
      }

      return `
        <li class="queue-item ${isError ? 'border-red-500/35 bg-red-500/5 dark:bg-red-500/10' : ''}" data-uuid="${item.uuid}" draggable="${!isGuest && !isError}">
          <div class="item-left" style="pointer-events: none;">
            <span class="item-index">${index + 1}</span>
            <div class="item-thumb-wrapper">
              <img class="item-thumb" src="${getYouTubeThumbnail(item.youtubeId)}" alt="Thumb">
            </div>
            <div class="item-details">
              <p class="item-title ${isError ? 'text-red-500 dark:text-red-400 font-semibold' : ''}" title="${title}">${title}</p>
              <p class="item-id">${artist} • ID: ${item.youtubeId}</p>
            </div>
          </div>
          ${!isGuest ? `
            <div class="item-actions flex items-center gap-1.5 shrink-0">
              ${index > 0 ? `
                <button class="text-slate-400 hover:text-procyon-lightIndigo dark:hover:text-procyon-indigo p-1 transition-all" data-action="move-up" data-index="${index}" title="Subir">
                  <i class="fa-solid fa-chevron-up text-xs sm:text-sm"></i>
                </button>
              ` : ''}
              ${index < state.queue.length - 1 ? `
                <button class="text-slate-400 hover:text-procyon-lightIndigo dark:hover:text-procyon-indigo p-1 transition-all" data-action="move-down" data-index="${index}" title="Bajar">
                  <i class="fa-solid fa-chevron-down text-xs sm:text-sm"></i>
                </button>
              ` : ''}
              <button class="btn-remove" data-action="remove-track" data-uuid="${item.uuid}" title="Eliminar canción">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          ` : ''}
        </li>
      `;
    }).join('');
  }
  
  // Apply vertical carousel scroll effect
  updateQueueScrollEffect();
}

// ─── Search Results Dropdown ─────────────────────────────────────
export function showSearchResults(results) {
  const dropdown = elements.searchResultsDropdown;
  if (!dropdown) return;
  
  if (results.length === 0) {
    dropdown.innerHTML = '<div class="p-3 text-center text-xs text-slate-400 dark:text-slate-500">No se encontraron resultados</div>';
    dropdown.classList.remove('hidden');
    return;
  }

  dropdown.innerHTML = results.map(item => {
    return `
      <div class="search-item flex items-center justify-between gap-3 p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg cursor-pointer transition-all duration-200" data-action="select-search-result" data-id="${item.youtubeId}">
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <img class="w-12 h-9 rounded object-cover flex-shrink-0" src="${item.thumbnail}" alt="Thumbnail">
          <div class="min-w-0 flex-1">
            <p class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate leading-snug">${item.title}</p>
            <p class="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">${item.artist}</p>
          </div>
        </div>
        <span class="text-[10px] font-semibold text-slate-400 dark:text-slate-500 shrink-0 font-mono">${formatTime(item.duration)}</span>
      </div>
    `;
  }).join('');

  dropdown.classList.remove('hidden');
}

/**
 * Calculates and applies 3D cylindrical vertical carousel transformations
 * and opacity fades on queue items based on scroll position.
 */
export function updateQueueScrollEffect() {
  const container = elements.queueListWrapper;
  if (!container) return;

  const items = container.querySelectorAll('.queue-item');
  if (items.length === 0) return;

  const containerRect = container.getBoundingClientRect();
  const containerCenterY = containerRect.height / 2;

  items.forEach((item) => {
    if (item.classList.contains('dragging')) {
      item.style.transform = '';
      item.style.opacity = '';
      return;
    }

    const itemRect = item.getBoundingClientRect();
    const itemCenterY = (itemRect.top + itemRect.bottom) / 2 - containerRect.top;
    const distance = itemCenterY - containerCenterY;
    
    // Calculate normalized distance from center of visible container
    const maxDistance = containerRect.height / 2 || 1;
    const normalizedDistance = Math.min(Math.max(distance / maxDistance, -1), 1);

    // Apply cylindrical transform and opacity fade
    const rotateX = normalizedDistance * 30; // 3D rotate
    const translateZ = -Math.abs(normalizedDistance) * 40; // depth
    const scale = 1 - Math.abs(normalizedDistance) * 0.12; // size
    const opacity = 1 - Math.abs(normalizedDistance) * 0.7; // fadeout (min 0.3)

    item.style.transform = `perspective(600px) rotateX(${rotateX}deg) translateZ(${translateZ}px) scale(${scale})`;
    item.style.opacity = opacity;
    item.style.transformOrigin = 'center center';
  });
}
