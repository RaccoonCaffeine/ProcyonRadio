import { state } from './state.js';

/**
 * Standardized wrapper for API fetch requests.
 * @param {string} endpoint
 * @param {string} method
 * @param {object|null} body
 */
export async function apiCall(endpoint, method = 'GET', body = null) {
  try {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const config = {
      method,
      headers
    };
    if (body) {
      config.body = JSON.stringify(body);
    }
    const response = await fetch(endpoint, config);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Error de API: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error en petición ${endpoint}:`, error.message);
    throw error;
  }
}

/** Fetches server status and updates the reactive state. */
export async function fetchStatus() {
  const data = await apiCall('/api/status');
  if (data) {
    state.isStreaming = data.isStreaming;
    state.isFallback = data.isFallback;
    state.isPaused = data.isPaused;
    state.fadeDuration = data.fadeDuration;
    state.fallbackVolume = data.fallbackVolume;
    state.outputMode = data.outputMode;
    state.allowGuestAdd = data.allowGuestAdd;
    state.publicUrl = data.publicUrl;
    state.currentTrack = data.currentTrack;
    state.queue = data.queue;
    state.hasHistory = data.hasHistory;
  }
  return data;
}

/** Adds a track URL or search selection to the queue. */
export async function addTrack(url) {
  const data = await apiCall('/api/queue/add', 'POST', { url });
  if (data && data.queue) {
    state.queue = data.queue;
    await fetchStatus();
  }
  return data;
}

/** Performs YouTube track search. */
export async function searchTracks(query) {
  return await apiCall(`/api/search?q=${encodeURIComponent(query)}`);
}

/** Skips the currently playing track. */
export async function skipTrack() {
  const data = await apiCall('/api/queue/skip', 'POST');
  await fetchStatus();
  return data;
}

/** Plays the previously played track from history. */
export async function goBackTrack() {
  const data = await apiCall('/api/queue/back', 'POST');
  await fetchStatus();
  return data;
}

/** Pauses current track playback. */
export async function pauseTrack() {
  const data = await apiCall('/api/queue/pause', 'POST');
  state.isPaused = true;
  await fetchStatus();
  return data;
}

/** Resumes track playback. */
export async function resumeTrack() {
  const data = await apiCall('/api/queue/resume', 'POST');
  state.isPaused = false;
  await fetchStatus();
  return data;
}

/** Shuffles the queue list. */
export async function shuffleQueue() {
  const data = await apiCall('/api/queue/shuffle', 'POST');
  if (data && data.queue) {
    state.queue = data.queue;
  }
  return data;
}

/** Empties the queue. */
export async function clearQueue() {
  const data = await apiCall('/api/queue/clear', 'POST');
  if (data && data.queue) {
    state.queue = data.queue;
  }
  return data;
}

/** Removes a track from the queue by UUID. */
export async function removeTrack(uuid) {
  const data = await apiCall(`/api/queue/remove/${uuid}`, 'DELETE');
  if (data && data.queue) {
    state.queue = data.queue;
  }
  return data;
}

/** Moves a track from one index to another in the queue. */
export async function moveTrack(fromIndex, toIndex) {
  const data = await apiCall('/api/queue/reorder', 'POST', { fromIndex, toIndex });
  if (data && data.queue) {
    state.queue = data.queue;
  }
  return data;
}

/** Seeks to a specific second of the playing track. */
export async function seekTrack(seconds) {
  const data = await apiCall('/api/queue/seek', 'POST', { seconds });
  return data;
}

/** Fetches server configuration settings. */
export async function getSettings() {
  return await apiCall('/api/settings');
}

/** Saves updated server configurations. */
export async function saveSettings(settingsData) {
  const data = await apiCall('/api/settings', 'POST', settingsData);
  if (data && data.settings) {
    state.outputMode = data.settings.outputMode;
    state.allowGuestAdd = data.settings.allowGuestAdd;
    state.fadeDuration = data.settings.fadeDuration;
    state.fallbackVolume = data.settings.fallbackVolume;
    await fetchStatus();
  }
  return data;
}

/** Starts the ffmpeg live stream. */
export async function startStream() {
  const data = await apiCall('/api/stream/start', 'POST');
  await fetchStatus();
  return data;
}

/** Stops the ffmpeg live stream. */
export async function stopStream() {
  const data = await apiCall('/api/stream/stop', 'POST');
  await fetchStatus();
  return data;
}
