import { state, subscribe } from './state.js';
import { 
  fetchStatus, 
  addTrack, 
  searchTracks, 
  skipTrack, 
  goBackTrack,
  pauseTrack, 
  resumeTrack, 
  shuffleQueue, 
  clearQueue, 
  removeTrack, 
  moveTrack, 
  seekTrack, 
  getSettings, 
  saveSettings, 
  startStream, 
  stopStream,
  playTrack 
} from './api.js';
import { 
  elements, 
  showToast, 
  formatTime, 
  getYouTubeThumbnail,
  initTheme, 
  toggleTheme, 
  updateUI, 
  interpolateProgress, 
  showSearchResults,
  setIsDraggingSlider,
  setIsDraggingSettings,
  setLocalElapsed,
  setLastUpdateTimestamp,
  applyRolePrivileges,
  updateQueueScrollEffect
} from './ui.js';
import { 
  checkAuthStatus, 
  handleLogout, 
  loadUsersList, 
  deleteUser, 
  initAuthEvents 
} from './auth.js';

let dragSrcIndex = null;

// ─── Shoutcast / Icecast URL Helpers ─────────────────────────────────
function parseShoutcastUrl(url) {
  const defaultVal = {
    type: 'icecast',
    host: '',
    port: '',
    password: '',
    mountpoint: 'stream'
  };
  if (!url) return defaultVal;
  
  const iceMatch = url.match(/^icecast:\/\/(?:([^:]+):)?([^@]+)@([^:]+):(\d+)(.*)$/i);
  if (iceMatch) {
    return {
      type: 'icecast',
      password: iceMatch[2],
      host: iceMatch[3],
      port: iceMatch[4],
      mountpoint: iceMatch[5] || '/stream'
    };
  }

  const match = url.match(/^(shoutcast):\/\/(?:([^:]+):)?([^@]+)@([^:]+):(\d+)$/i);
  if (match) {
    return {
      type: match[1].toLowerCase(),
      password: match[3],
      host: match[4],
      port: match[5],
      mountpoint: ''
    };
  }

  const matchNoProtocol = url.match(/^(?:([^:]+):)?([^@]+)@([^:]+):(\d+)$/i);
  if (matchNoProtocol) {
    return {
      type: 'shoutcast',
      password: matchNoProtocol[2],
      host: matchNoProtocol[3],
      port: matchNoProtocol[4],
      mountpoint: ''
    };
  }

  return {
    type: 'shoutcast',
    host: url,
    port: '',
    password: '',
    mountpoint: ''
  };
}

function formatShoutcastUrl(type, host, port, password, mountpoint = '') {
  const cleanHost = host.trim();
  const cleanPort = port.toString().trim();
  const cleanPassword = password.trim();
  
  if (!cleanHost && !cleanPort && !cleanPassword) return '';
  
  if (type === 'icecast') {
    let cleanMount = mountpoint.trim();
    if (cleanMount && !cleanMount.startsWith('/')) {
      cleanMount = '/' + cleanMount;
    }
    if (!cleanMount) {
      cleanMount = '/stream';
    }
    return `icecast://source:${cleanPassword}@${cleanHost}:${cleanPort}${cleanMount}`;
  } else {
    return `shoutcast://source:${cleanPassword}@${cleanHost}:${cleanPort}`;
  }
}

// ─── Settings Tab Switching ──────────────────────────────────────────
function switchSettingsTab(tabName) {
  if (elements.tabBtnStream) elements.tabBtnStream.className = 'pb-2 border-b-2 border-transparent hover:text-slate-800 dark:hover:text-white';
  if (elements.tabBtnUsers) elements.tabBtnUsers.className = 'pb-2 border-b-2 border-transparent hover:text-slate-800 dark:hover:text-white';
  if (elements.tabBtnGeneral) elements.tabBtnGeneral.className = 'pb-2 border-b-2 border-transparent hover:text-slate-800 dark:hover:text-white';
  
  if (elements.tabStream) elements.tabStream.classList.add('hidden');
  if (elements.tabUsers) elements.tabUsers.classList.add('hidden');
  if (elements.tabGeneral) elements.tabGeneral.classList.add('hidden');

  if (tabName === 'stream') {
    if (elements.tabBtnStream) elements.tabBtnStream.className = 'pb-2 border-b-2 border-procyon-lightIndigo dark:border-procyon-indigo text-procyon-lightIndigo dark:text-procyon-indigo';
    if (elements.tabStream) elements.tabStream.classList.remove('hidden');
  } else if (tabName === 'users') {
    if (elements.tabBtnUsers) elements.tabBtnUsers.className = 'pb-2 border-b-2 border-procyon-lightIndigo dark:border-procyon-indigo text-procyon-lightIndigo dark:text-procyon-indigo';
    if (elements.tabUsers) {
      elements.tabUsers.classList.remove('hidden');
      loadUsersList();
    }
  } else if (tabName === 'general') {
    if (elements.tabBtnGeneral) elements.tabBtnGeneral.className = 'pb-2 border-b-2 border-procyon-lightIndigo dark:border-procyon-indigo text-procyon-lightIndigo dark:text-procyon-indigo';
    if (elements.tabGeneral) elements.tabGeneral.classList.remove('hidden');
  }
}

// ─── Stream Toggle Action ────────────────────────────────────────────
async function handleStreamToggle() {
  const isStreaming = state.isStreaming;
  const action = isStreaming ? 'stop' : 'start';
  const confirmMsg = isStreaming 
    ? '¿Estás seguro de que deseas DETENER la transmisión del servidor? Esto cortará el streaming live.'
    : '¿Deseas INICIAR la transmisión del servidor y conectar con el destino configurado?';
    
  if (confirm(confirmMsg)) {
    try {
      if (action === 'start') {
        const data = await startStream();
        showToast(data.message || 'Transmisión iniciada con éxito.');
      } else {
        const data = await stopStream();
        showToast(data.message || 'Transmisión detenida con éxito.');
      }
    } catch (err) {
      showToast(`Error al gestionar transmisión: ${err.message}`, 'error');
    }
  }
}

// ─── Mobile Menu Helpers ─────────────────────────────────────────────
function closeMobileMenu() {
  if (elements.mobileMenuDropdown && elements.mobileMenuIcon) {
    elements.mobileMenuDropdown.classList.add('hidden');
    elements.mobileMenuIcon.className = 'fa-solid fa-bars text-sm';
  }
}

// ─── Drag and Drop Events ────────────────────────────────────────────
function initDragAndDrop() {
  if (!elements.queueList) return;
  elements.queueList.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.queue-item');
    if (!item || state.currentUser?.role === 'guest') return;
    
    item.classList.add('dragging');
    const items = Array.from(elements.queueList.querySelectorAll('.queue-item'));
    dragSrcIndex = items.indexOf(item);
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragSrcIndex);
  });
  
  elements.queueList.addEventListener('dragover', (e) => {
    e.preventDefault();
    const item = e.target.closest('.queue-item');
    if (!item || item.classList.contains('dragging') || state.currentUser?.role === 'guest') return;
    e.dataTransfer.dropEffect = 'move';
  });
  
  elements.queueList.addEventListener('dragenter', (e) => {
    const item = e.target.closest('.queue-item');
    if (!item || item.classList.contains('dragging') || state.currentUser?.role === 'guest') return;
    item.classList.add('drag-over');
  });
  
  elements.queueList.addEventListener('dragleave', (e) => {
    const item = e.target.closest('.queue-item');
    if (!item || state.currentUser?.role === 'guest') return;
    if (e.relatedTarget && item.contains(e.relatedTarget)) return;
    item.classList.remove('drag-over');
  });
  
  elements.queueList.addEventListener('drop', async (e) => {
    e.preventDefault();
    const item = e.target.closest('.queue-item');
    if (!item || state.currentUser?.role === 'guest') return;
    item.classList.remove('drag-over');
    
    const items = Array.from(elements.queueList.querySelectorAll('.queue-item'));
    const dragTargetIndex = items.indexOf(item);
    
    if (dragSrcIndex !== null && dragSrcIndex !== dragTargetIndex && dragTargetIndex !== -1) {
      try {
        await moveTrack(dragSrcIndex, dragTargetIndex);
      } catch (err) {
        showToast(`Error al reordenar: ${err.message}`, 'error');
      }
    }
    dragSrcIndex = null;
  });
  
  elements.queueList.addEventListener('dragend', (e) => {
    const item = e.target.closest('.queue-item');
    if (item) {
      item.classList.remove('dragging');
    }
    elements.queueList.querySelectorAll('.queue-item').forEach(el => el.classList.remove('drag-over'));
    dragSrcIndex = null;
  });
}

// ─── Document-level Event Delegation ──────────────────────────────────
function initEventDelegation() {
  document.addEventListener('click', async (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    
    const action = actionEl.dataset.action;
    
    switch (action) {
      case 'close-alert': {
        actionEl.parentElement.remove();
        break;
      }
      
      case 'delete-user': {
        const username = actionEl.dataset.username;
        if (username) {
          await deleteUser(username);
        }
        break;
      }
      
      case 'select-search-result': {
        const id = actionEl.dataset.id;
        if (elements.searchResultsDropdown) {
          elements.searchResultsDropdown.classList.add('hidden');
        }
        elements.songUrlInput.value = '';
        
        try {
          const data = await addTrack(`https://www.youtube.com/watch?v=${id}`);
          if (data) {
            showToast('Canción agregada a la cola.');
          }
        } catch (err) {
          showToast(`Error al agregar: ${err.message}`, 'error');
        }
        break;
      }
      
      case 'remove-track': {
        const uuid = actionEl.dataset.uuid;
        try {
          await removeTrack(uuid);
          showToast('Canción eliminada de la cola.');
        } catch (err) {
          showToast(`No se pudo eliminar la canción: ${err.message}`, 'error');
        }
        break;
      }
      
      case 'play-track': {
        const uuid = actionEl.dataset.uuid;
        try {
          await playTrack(uuid);
          showToast('Reproduciendo canción seleccionada.');
        } catch (err) {
          showToast(`No se pudo reproducir la canción: ${err.message}`, 'error');
        }
        break;
      }
      
      case 'move-up': {
        const index = parseInt(actionEl.dataset.index);
        try {
          await moveTrack(index, index - 1);
        } catch (err) {
          showToast(`No se pudo mover la canción: ${err.message}`, 'error');
        }
        break;
      }
      
      case 'move-down': {
        const index = parseInt(actionEl.dataset.index);
        try {
          await moveTrack(index, index + 1);
        } catch (err) {
          showToast(`No se pudo mover la canción: ${err.message}`, 'error');
        }
        break;
      }
    }
  });

  // Close search dropdown on click outside
  document.addEventListener('click', (e) => {
    if (elements.searchResultsDropdown && !e.target.closest('#add-song-form')) {
      elements.searchResultsDropdown.classList.add('hidden');
    }
  });
}

// ─── Form Bindings & Click Handlers ──────────────────────────────────
function initStaticListeners() {
  // Theme Toggles
  if (elements.btnThemeToggle) {
    elements.btnThemeToggle.addEventListener('click', toggleTheme);
  }
  if (elements.btnThemeToggleMobile) {
    elements.btnThemeToggleMobile.addEventListener('click', () => {
      closeMobileMenu();
      toggleTheme();
    });
  }

  // Mobile Menu Button
  if (elements.btnMobileMenu && elements.mobileMenuDropdown && elements.mobileMenuIcon) {
    elements.btnMobileMenu.addEventListener('click', () => {
      const isHidden = elements.mobileMenuDropdown.classList.toggle('hidden');
      elements.mobileMenuIcon.className = isHidden ? 'fa-solid fa-bars text-sm' : 'fa-solid fa-xmark text-sm';
    });
  }

  // Open settings from mobile dropdown
  if (elements.btnOpenSettingsMobile) {
    elements.btnOpenSettingsMobile.addEventListener('click', () => {
      closeMobileMenu();
      if (elements.btnOpenSettings) elements.btnOpenSettings.click();
    });
  }

  // Auth Action (login/logout) click triggers
  if (elements.btnAuthAction) {
    elements.btnAuthAction.addEventListener('click', async () => {
      if (state.currentUser) {
        await handleLogout();
      } else {
        localStorage.removeItem('guestMode');
        await checkAuthStatus();
      }
    });
  }
  if (elements.btnAuthActionMobile) {
    elements.btnAuthActionMobile.addEventListener('click', async () => {
      closeMobileMenu();
      if (state.currentUser) {
        await handleLogout();
      } else {
        localStorage.removeItem('guestMode');
        await checkAuthStatus();
      }
    });
  }

  // Stream Toggle
  if (elements.btnToggleStream) {
    elements.btnToggleStream.addEventListener('click', handleStreamToggle);
  }
  if (elements.btnToggleStreamMobile) {
    elements.btnToggleStreamMobile.addEventListener('click', () => {
      closeMobileMenu();
      handleStreamToggle();
    });
  }

  // Settings password fields toggling
  if (elements.btnToggleKeyVisibility && elements.settingsYtKey) {
    elements.btnToggleKeyVisibility.addEventListener('click', () => {
      if (elements.settingsYtKey.type === 'password') {
        elements.settingsYtKey.type = 'text';
        if (elements.toggleKeyIcon) elements.toggleKeyIcon.className = 'fa-solid fa-eye-slash';
      } else {
        elements.settingsYtKey.type = 'password';
        if (elements.toggleKeyIcon) elements.toggleKeyIcon.className = 'fa-solid fa-eye';
      }
    });
  }
  if (elements.btnToggleIcePasswordVisibility && elements.settingsIcePassword) {
    elements.btnToggleIcePasswordVisibility.addEventListener('click', () => {
      if (elements.settingsIcePassword.type === 'password') {
        elements.settingsIcePassword.type = 'text';
        if (elements.toggleIcePasswordIcon) elements.toggleIcePasswordIcon.className = 'fa-solid fa-eye-slash';
      } else {
        elements.settingsIcePassword.type = 'password';
        if (elements.toggleIcePasswordIcon) elements.toggleIcePasswordIcon.className = 'fa-solid fa-eye';
      }
    });
  }

  // Settings Tabs switching
  if (elements.tabBtnStream) {
    elements.tabBtnStream.addEventListener('click', () => switchSettingsTab('stream'));
  }
  if (elements.tabBtnUsers) {
    elements.tabBtnUsers.addEventListener('click', () => switchSettingsTab('users'));
  }
  if (elements.tabBtnGeneral) {
    elements.tabBtnGeneral.addEventListener('click', () => switchSettingsTab('general'));
  }

  // Settings Output Mode select change
  if (elements.settingsOutputMode) {
    elements.settingsOutputMode.addEventListener('change', () => {
      if (elements.settingsGroupYoutube && elements.settingsGroupIcecast) {
        if (elements.settingsOutputMode.value === 'youtube') {
          elements.settingsGroupYoutube.classList.remove('hidden');
          elements.settingsGroupIcecast.classList.add('hidden');
        } else {
          elements.settingsGroupYoutube.classList.add('hidden');
          elements.settingsGroupIcecast.classList.remove('hidden');
        }
      }
    });
  }

  // Settings Icecast Type select change
  if (elements.settingsIceType && elements.settingsIceMountGroup) {
    elements.settingsIceType.addEventListener('change', () => {
      if (elements.settingsIceType.value === 'icecast') {
        elements.settingsIceMountGroup.classList.remove('hidden');
      } else {
        elements.settingsIceMountGroup.classList.add('hidden');
      }
    });
  }

  // Settings Expose Server (Cloudflare Tunnel) checkbox change
  if (elements.settingsExposeServer) {
    elements.settingsExposeServer.addEventListener('change', () => {
      const isExposed = elements.settingsExposeServer.checked;
      if (elements.settingsUseCloudflare) {
        elements.settingsUseCloudflare.checked = isExposed;
      }
      if (elements.settingsLocalBitrateGroup) {
        if (isExposed) {
          elements.settingsLocalBitrateGroup.classList.add('hidden');
        } else {
          elements.settingsLocalBitrateGroup.classList.remove('hidden');
        }
      }
    });
  }

  // Copy Tunnel stream links
  if (elements.btnCopyTunnelStream) {
    elements.btnCopyTunnelStream.addEventListener('click', () => {
      if (state.publicUrl) {
        const streamUrl = `${state.publicUrl}/api/stream/proxy`;
        navigator.clipboard.writeText(streamUrl)
          .then(() => showToast('¡Enlace de audio copiado para FiveM!'))
          .catch(() => showToast('Error al copiar el enlace', 'error'));
      }
    });
  }
  if (elements.btnCopySettingsTunnelStream) {
    elements.btnCopySettingsTunnelStream.addEventListener('click', () => {
      if (state.publicUrl) {
        const streamUrl = `${state.publicUrl}/api/stream/proxy`;
        navigator.clipboard.writeText(streamUrl)
          .then(() => showToast('¡Enlace de audio copiado!'))
          .catch(() => showToast('Error al copiar el enlace', 'error'));
      }
    });
  }

  // Update dynamic stream port label text on input
  if (elements.settingsStreamPort) {
    elements.settingsStreamPort.addEventListener('input', () => {
      const val = elements.settingsStreamPort.value || 8000;
      const label = document.getElementById('label-stream-port');
      if (label) label.textContent = val;
    });
  }

  // Settings modal toggle loaders
  if (elements.btnOpenSettings) {
    elements.btnOpenSettings.addEventListener('click', async () => {
      try {
        const data = await getSettings();
        if (data) {
          if (elements.settingsOutputMode) elements.settingsOutputMode.value = data.outputMode;
          if (elements.settingsYtUrl) elements.settingsYtUrl.value = data.youtube.rtmpUrl;
          if (elements.settingsYtKey) elements.settingsYtKey.value = data.youtube.streamKey;
          
          const iceParams = parseShoutcastUrl(data.icecast.serverUrl);
          if (elements.settingsIceType) {
            elements.settingsIceType.value = iceParams.type;
          }
          if (elements.settingsIceHost) elements.settingsIceHost.value = iceParams.host;
          if (elements.settingsIcePort) elements.settingsIcePort.value = iceParams.port;
          if (elements.settingsIcePassword) elements.settingsIcePassword.value = iceParams.password;
          if (elements.settingsIceMountpoint) {
            elements.settingsIceMountpoint.value = iceParams.mountpoint;
          }
          if (elements.settingsIceFormat) elements.settingsIceFormat.value = data.icecast.format;
          if (elements.settingsIceBitrate) elements.settingsIceBitrate.value = data.icecast.bitrate;
          if (elements.settingsPort) elements.settingsPort.value = data.port;
          if (elements.settingsStreamPort) {
            elements.settingsStreamPort.value = data.streamPort || 8000;
            const portLabel = document.getElementById('label-stream-port');
            if (portLabel) portLabel.textContent = data.streamPort || 8000;
          }
          if (elements.settingsGuestAdd) elements.settingsGuestAdd.value = data.allowGuestAdd.toString();
          if (elements.settingsPotUrl) elements.settingsPotUrl.value = data.potProviderUrl;
          
          if (elements.settingsExposeServer) {
            elements.settingsExposeServer.checked = data.exposeServer || false;
          }
          if (elements.settingsUseCloudflare) {
            elements.settingsUseCloudflare.checked = data.useCloudflare || false;
          }
          if (elements.settingsLocalBitrate) {
            elements.settingsLocalBitrate.value = data.localBitrate || "320k";
          }
          if (elements.settingsStreamServerEnabled) {
            elements.settingsStreamServerEnabled.checked = data.streamServerEnabled !== false;
          }

          if (elements.settingsOutputMode) {
            elements.settingsOutputMode.dispatchEvent(new Event('change'));
          }
          if (elements.settingsIceType) {
            elements.settingsIceType.dispatchEvent(new Event('change'));
          }
          if (elements.settingsExposeServer) {
            elements.settingsExposeServer.dispatchEvent(new Event('change'));
          }
          
          switchSettingsTab('stream');
          if (elements.settingsModal) elements.settingsModal.classList.remove('hidden');
        }
      } catch (err) {
        showToast(`Error al cargar configuraciones: ${err.message}`, 'error');
      }
    });
  }

  if (elements.btnCloseSettings) {
    elements.btnCloseSettings.addEventListener('click', () => {
      if (elements.settingsModal) elements.settingsModal.classList.add('hidden');
    });
  }

  // Save Settings Modal
  if (elements.btnSaveSettings) {
    elements.btnSaveSettings.addEventListener('click', async () => {
      const settingsData = {
        port: elements.settingsPort ? parseInt(elements.settingsPort.value) : 3000,
        streamPort: elements.settingsStreamPort ? (parseInt(elements.settingsStreamPort.value) || 8000) : 8000,
        useCloudflare: elements.settingsExposeServer ? elements.settingsExposeServer.checked : false,
        localBitrate: elements.settingsLocalBitrate ? elements.settingsLocalBitrate.value : '320k',
        streamServerEnabled: elements.settingsStreamServerEnabled ? elements.settingsStreamServerEnabled.checked : true,
        outputMode: elements.settingsOutputMode ? elements.settingsOutputMode.value : 'icecast',
        allowGuestAdd: elements.settingsGuestAdd ? (elements.settingsGuestAdd.value === 'true') : true,
        exposeServer: elements.settingsExposeServer ? elements.settingsExposeServer.checked : false,
        youtube: {
          rtmpUrl: elements.settingsYtUrl ? elements.settingsYtUrl.value.trim() : '',
          streamKey: elements.settingsYtKey ? elements.settingsYtKey.value.trim() : ''
        },
        icecast: {
          serverUrl: formatShoutcastUrl(
            elements.settingsIceType ? elements.settingsIceType.value : 'shoutcast',
            elements.settingsIceHost ? elements.settingsIceHost.value : '',
            elements.settingsIcePort ? elements.settingsIcePort.value : '',
            elements.settingsIcePassword ? elements.settingsIcePassword.value : '',
            elements.settingsIceMountpoint ? elements.settingsIceMountpoint.value : ''
          ),
          format: elements.settingsIceFormat ? elements.settingsIceFormat.value : 'mp3',
          bitrate: elements.settingsIceBitrate ? elements.settingsIceBitrate.value : '128k'
        },
        fadeDuration: state.fadeDuration,
        potProviderUrl: elements.settingsPotUrl ? elements.settingsPotUrl.value.trim() : ''
      };

      try {
        const data = await saveSettings(settingsData);
        if (data.success) {
          if (elements.settingsModal) elements.settingsModal.classList.add('hidden');
          showToast('Configuración guardada exitosamente. Si modificó el puerto, reinicie el servidor para aplicar.');
        }
      } catch (err) {
        showToast(`Error al guardar configuración: ${err.message}`, 'error');
      }
    });
  }

  // Track Player command click events
  if (elements.btnPause) {
    elements.btnPause.addEventListener('click', async () => {
      try {
        if (state.isPaused) {
          await resumeTrack();
        } else {
          await pauseTrack();
        }
      } catch (err) {
        console.error("Pause toggle error:", err.message);
      }
    });
  }

  if (elements.btnSkip) {
    elements.btnSkip.addEventListener('click', async () => {
      try {
        await skipTrack();
      } catch (err) {
        console.error("Skip track error:", err.message);
      }
    });
  }

  if (elements.btnBack) {
    elements.btnBack.addEventListener('click', async () => {
      try {
        await goBackTrack();
      } catch (err) {
        console.error("Back track error:", err.message);
      }
    });
  }

  if (elements.btnShuffle) {
    elements.btnShuffle.addEventListener('click', async () => {
      try {
        const data = await shuffleQueue();
        if (data) {
          if (elements.queueList) elements.queueList.style.opacity = '0.3';
          setTimeout(() => {
            if (elements.queueList) elements.queueList.style.opacity = '1';
          }, 150);
        }
      } catch (err) {
        console.error("Shuffle queue error:", err.message);
      }
    });
  }

  if (elements.btnClear) {
    elements.btnClear.addEventListener('click', async () => {
      if (confirm('¿Estás seguro de que quieres vaciar la cola de reproducción?')) {
        try {
          await clearQueue();
        } catch (err) {
          console.error("Clear queue error:", err.message);
        }
      }
    });
  }

  // Progress Bar Seek slider events
  if (elements.progressSlider) {
    elements.progressSlider.addEventListener('input', () => {
      setIsDraggingSlider(true);
      const currentDuration = state.currentTrack ? state.currentTrack.duration : 0;
      if (currentDuration > 0) {
        const targetSeconds = (parseFloat(elements.progressSlider.value) / 100) * currentDuration;
        if (elements.timeCurrent) elements.timeCurrent.textContent = formatTime(targetSeconds);
        elements.progressSlider.style.backgroundSize = `${elements.progressSlider.value}% 100%`;
      }
    });

    elements.progressSlider.addEventListener('change', async () => {
      if (state.currentTrack && state.currentTrack.duration > 0) {
        const targetSeconds = (parseFloat(elements.progressSlider.value) / 100) * state.currentTrack.duration;
        try {
          await seekTrack(targetSeconds);
          setLocalElapsed(targetSeconds);
          setLastUpdateTimestamp(Date.now());
        } catch (err) {
          console.error("Seek track error:", err.message);
        }
      }
      setIsDraggingSlider(false);
    });
  }

  // Fade Duration slider events
  if (elements.fadeSlider) {
    elements.fadeSlider.addEventListener('input', () => {
      setIsDraggingSettings(true);
      if (elements.fadeValue) elements.fadeValue.textContent = `${elements.fadeSlider.value}s`;
      const fadePercent = (elements.fadeSlider.value / 10) * 100;
      elements.fadeSlider.style.backgroundSize = `${fadePercent}% 100%`;
    });

    elements.fadeSlider.addEventListener('change', async () => {
      const value = parseInt(elements.fadeSlider.value);
      try {
        const data = await saveSettings({ fadeDuration: value });
        if (data) {
          if (elements.fadeValue) elements.fadeValue.textContent = `${state.fadeDuration}s`;
        }
      } catch (err) {
        console.error("Fade duration save error:", err.message);
      }
      setIsDraggingSettings(false);
    });
  }

  // Fallback Volume slider events
  if (elements.fallbackVolumeSlider) {
    elements.fallbackVolumeSlider.addEventListener('input', () => {
      setIsDraggingSettings(true);
      if (elements.fallbackVolumeValue) elements.fallbackVolumeValue.textContent = `${elements.fallbackVolumeSlider.value}%`;
      elements.fallbackVolumeSlider.style.backgroundSize = `${elements.fallbackVolumeSlider.value}% 100%`;
    });

    elements.fallbackVolumeSlider.addEventListener('change', async () => {
      const value = parseInt(elements.fallbackVolumeSlider.value);
      try {
        const data = await saveSettings({ fallbackVolume: value });
        if (data) {
          if (elements.fallbackVolumeValue) elements.fallbackVolumeValue.textContent = `${state.fallbackVolume}%`;
        }
      } catch (err) {
        console.error("Fallback volume save error:", err.message);
      }
      setIsDraggingSettings(false);
    });
  }

  // Add Song Form submissions
  if (elements.addSongForm) {
    elements.addSongForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const val = elements.songUrlInput ? elements.songUrlInput.value.trim() : '';
      if (!val) return;

      const isUrl = val.startsWith('http') || val.includes('youtube.com') || val.includes('youtu.be') || val.includes('listen2myradio.com');

      if (elements.songUrlInput) elements.songUrlInput.disabled = true;
      if (elements.btnAddSong) elements.btnAddSong.disabled = true;
      if (elements.btnAddText) elements.btnAddText.classList.add('hidden');
      if (elements.btnAddSpinner) elements.btnAddSpinner.classList.remove('hidden');

      try {
        if (isUrl) {
          const data = await addTrack(val);
          if (data) {
            if (elements.songUrlInput) elements.songUrlInput.value = '';
            showToast('Enlace agregado a la cola.');
          }
        } else {
          const data = await searchTracks(val);
          if (data && data.results) {
            showSearchResults(data.results);
          } else {
            showToast('No se encontraron resultados.', 'error');
          }
        }
      } catch (err) {
        showToast(`Error al procesar petición: ${err.message}`, 'error');
      } finally {
        if (elements.songUrlInput) elements.songUrlInput.disabled = false;
        if (elements.btnAddSong) elements.btnAddSong.disabled = false;
        if (elements.btnAddText) elements.btnAddText.classList.remove('hidden');
        if (elements.btnAddSpinner) elements.btnAddSpinner.classList.add('hidden');
        applyRolePrivileges();
      }
    });
  }
}

// ─── Bootstrap & Main Polling ────────────────────────────────────────
async function init() {
  initTheme();
  
  // Wire auth event handlers
  initAuthEvents();

  // Wire static event click listeners
  initStaticListeners();

  // Wire drag and drop listeners
  initDragAndDrop();

  // Wire search results and delete delegations
  initEventDelegation();

  // Wire scroll effect listener for 3D queue carousel
  if (elements.queueListWrapper) {
    elements.queueListWrapper.addEventListener('scroll', updateQueueScrollEffect);
  }
  
  // 🔗 REACTIVE PROXY BINDING: Update UI whenever state object triggers a trap set
  subscribe((property, value, target) => {
    updateUI();
  });

  // Verify auth session cookies/tokens
  await checkAuthStatus();
  
  // Load initial status payload
  await fetchStatus();
  
  // Poll API status every 1.5 seconds
  setInterval(fetchStatus, 1500);
  
  // Local high-frequency progress interpolation for silky slider animations
  setInterval(interpolateProgress, 150);
}

// Kickstart when DOM is ready
document.addEventListener('DOMContentLoaded', init);
