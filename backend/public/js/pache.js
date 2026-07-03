import { state, subscribe } from './state.js';

let activeTheme = '';

export async function initPache() {
  console.log("🦝 Initializing Pache Mascot...");
  
  // 1. Create Pache container statically or dynamically
  let container = document.getElementById('pache-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'pache-container';
    container.className = 'fixed bottom-4 left-4 z-40 w-20 md:w-28 pointer-events-none select-none transition-all duration-500';
    
    // Add hover lift effect and pointer events for avatar
    container.innerHTML = `
      <div class="relative group pointer-events-auto cursor-pointer">
        <!-- Speech Bubble -->
        <div id="pache-bubble" class="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-slate-800/95 dark:bg-slate-900/95 backdrop-blur-sm text-white text-3xs md:text-2xs font-semibold px-2.5 py-1.5 rounded-xl shadow-xl border border-slate-700/50 dark:border-white/[0.08] opacity-0 scale-90 translate-y-2 pointer-events-none transition-all duration-300 whitespace-normal w-36 text-center leading-normal">
          <span id="pache-bubble-text">¡Hola! Soy Pache 🦝</span>
          <div class="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 dark:bg-slate-900 rotate-45 border-r border-b border-slate-700/50 dark:border-white/[0.08]"></div>
        </div>
        
        <!-- Pache Avatar Wrapper -->
        <div id="pache-avatar" class="w-full h-full transition-transform duration-300 hover:scale-110 active:scale-95"></div>
      </div>
    `;
    document.body.appendChild(container);
  }

  // 2. Inject CSS animations dynamically
  const styleId = 'pache-styles';
  if (!document.getElementById(styleId)) {
    const styleBlock = document.createElement('style');
    styleBlock.id = styleId;
    styleBlock.textContent = `
      /* Idle swaying / breathing animation */
      @keyframes pache-idle-anim {
        0%, 100% {
          transform: translateY(0) scale(1);
        }
        50% {
          transform: translateY(-2px) scale(0.98);
        }
      }
      .pache-idle {
        animation: pache-idle-anim 4s ease-in-out infinite;
      }

      /* Groovy music dancing animation */
      @keyframes pache-groovy-anim {
        0%, 100% {
          transform: translateY(0) rotate(0deg);
        }
        25% {
          transform: translateY(-6px) rotate(-4deg);
        }
        50% {
          transform: translateY(1px) rotate(0deg);
        }
        75% {
          transform: translateY(-6px) rotate(4deg);
        }
      }
      .pache-groovy {
        animation: pache-groovy-anim 0.9s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      }

      /* Eye blinking animation */
      @keyframes pache-blink-anim {
        0%, 90%, 94%, 98%, 100% {
          transform: scaleY(1);
        }
        92%, 96% {
          transform: scaleY(0.15);
        }
      }
      /* Target the eyes in the SVG paths */
      #pache-avatar svg #path22-8,
      #pache-avatar svg #path25-2 {
        transform-box: fill-box !important;
        transform-origin: center !important;
        animation: pache-blink-anim 6s ease-in-out infinite !important;
      }
    `;
    document.head.appendChild(styleBlock);
  }

  // 3. Load appropriate theme SVG
  await loadPacheSvg();

  // 4. Set up hover listeners to update speech bubble content
  const group = container.querySelector('.group');
  if (group) {
    group.addEventListener('mouseenter', updateBubbleText);
    group.addEventListener('mouseleave', hideBubble);
  }

  // 5. Watch for class mutations on documentElement (dark mode toggles)
  const themeObserver = new MutationObserver(() => {
    const isDark = document.documentElement.classList.contains('dark');
    const currentThemeMode = isDark ? 'dark' : 'light';
    if (activeTheme !== currentThemeMode) {
      loadPacheSvg();
    }
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  // 6. Subscribe to reactive state updates for animation class toggling
  subscribe(() => {
    updateAnimationState();
  });

  // Initial animation state update
  updateAnimationState();
}

async function loadPacheSvg() {
  const isDark = document.documentElement.classList.contains('dark');
  activeTheme = isDark ? 'dark' : 'light';
  const url = isDark ? 'pache_dark.svg' : 'pache_light.svg';
  
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const svgText = await res.text();
    const avatarEl = document.getElementById('pache-avatar');
    if (avatarEl) {
      avatarEl.innerHTML = svgText;
      
      // Make SVG scale to container width properly
      const svgElement = avatarEl.querySelector('svg');
      if (svgElement) {
        svgElement.setAttribute('width', '100%');
        svgElement.setAttribute('height', '100%');
        svgElement.removeAttribute('width');
        svgElement.removeAttribute('height');
        svgElement.style.display = 'block';
      }
    }
  } catch (err) {
    console.error("❌ Failed to load Pache SVG:", err);
  }
}

function updateAnimationState() {
  const container = document.getElementById('pache-container');
  if (!container) return;

  const isPlaying = state.isStreaming && !state.isPaused;
  if (isPlaying) {
    container.classList.add('pache-groovy');
    container.classList.remove('pache-idle');
  } else {
    container.classList.add('pache-idle');
    container.classList.remove('pache-groovy');
  }
}

function updateBubbleText() {
  const bubble = document.getElementById('pache-bubble');
  const bubbleText = document.getElementById('pache-bubble-text');
  if (!bubble || !bubbleText) return;

  let message = "¡Hola! Soy Pache 🦝";

  if (!state.isStreaming) {
    message = "La radio está apagada. ¿Prendemos el stream? 📻";
  } else if (state.isPaused) {
    message = "Radio pausada. Zzz... esperando rolitas 😴";
  } else if (state.isFallback) {
    message = "Escuchando el canal de relax... ¡Qué chill! 💤";
  } else if (state.currentTrack) {
    const title = state.currentTrack.title || "música";
    message = `Escuchando: "${title}" 🎵🕺`;
  }

  bubbleText.textContent = message;
  
  // Show bubble
  bubble.classList.remove('opacity-0', 'scale-90', 'translate-y-2');
  bubble.classList.add('opacity-100', 'scale-100', 'translate-y-0');
}

function hideBubble() {
  const bubble = document.getElementById('pache-bubble');
  if (!bubble) return;
  
  // Hide bubble
  bubble.classList.remove('opacity-100', 'scale-100', 'translate-y-0');
  bubble.classList.add('opacity-0', 'scale-90', 'translate-y-2');
}
