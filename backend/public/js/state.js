const subscribers = [];

/**
 * Registers a callback to be executed when any state property changes.
 * @param {function(string, any, object): void} callback
 */
export function subscribe(callback) {
  subscribers.push(callback);
}

const initialState = {
  isFallback: true,
  isPaused: false,
  fadeDuration: 3,
  fallbackVolume: 5,
  outputMode: 'youtube',
  allowGuestAdd: true,
  currentTrack: null,
  queue: [],
  hasHistory: false,
  currentUser: null, // { username, role }
  publicUrl: null,
  isStreaming: false
};

export const state = new Proxy(initialState, {
  set(target, property, value) {
    // Avoid redundant updates if value is unchanged
    if (JSON.stringify(target[property]) === JSON.stringify(value)) {
      return true;
    }
    
    target[property] = value;
    
    // Notify all subscribers about the state update
    subscribers.forEach((callback) => {
      try {
        callback(property, value, target);
      } catch (err) {
        console.error(`[State Proxy] Error in subscriber callback:`, err);
      }
    });
    
    return true;
  }
});
