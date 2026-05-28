import { KeyMode, GeneratedKey, AlphaConfig, PassphraseConfig, PinConfig } from './types';
import { handleSliderWarp, triggerGenerateAnimation } from './animation';
import { generateAlphanumeric, generatePassphrase, generatePin } from './generator';

// State containment
let currentKey: GeneratedKey | null = null;
const historyVault: GeneratedKey[] = [];
const favoritesVault: GeneratedKey[] = [];
let currentMode: KeyMode = 'alphanumeric';

// Clipboard security timers
let copyResetTimeout: number | null = null;
let clipboardClearTimeout: number | null = null;
let countdownInterval: number | null = null;

// Element Cache
let elTabIndicator: HTMLElement;
let elUnscrambleContainer: HTMLElement;
let elEntropyVal: HTMLElement;
let elKeyspaceVal: HTMLElement;
let elCrackTimeVal: HTMLElement;
let elStrengthVal: HTMLElement;
let elCopyBtn: HTMLButtonElement;
let elCopyBtnText: HTMLElement;
let elCopyIconDefault: HTMLElement;
let elCopyIconSuccess: HTMLElement;
let elHistoryList: HTMLElement;
let elFavoritesList: HTMLElement;

/**
 * Initializes and binds all UI events and DOM interactions
 */
export function initUI(): void {
  // 1. Elements Cache Assignment
  elTabIndicator = document.getElementById('tab-indicator') as HTMLElement;
  elUnscrambleContainer = document.getElementById('unscramble-container') as HTMLElement;
  elEntropyVal = document.getElementById('val-entropy') as HTMLElement;
  elKeyspaceVal = document.getElementById('val-keyspace') as HTMLElement;
  elCrackTimeVal = document.getElementById('val-crack-time') as HTMLElement;
  elStrengthVal = document.getElementById('val-strength') as HTMLElement;

  elCopyBtn = document.getElementById('btn-copy-key') as HTMLButtonElement;
  elCopyBtnText = document.getElementById('copy-btn-text') as HTMLElement;
  elCopyIconDefault = document.getElementById('copy-icon-default') as HTMLElement;
  elCopyIconSuccess = document.getElementById('copy-icon-success') as HTMLElement;

  elHistoryList = document.getElementById('history-list') as HTMLElement;
  elFavoritesList = document.getElementById('favorites-list') as HTMLElement;

  // 2. Bind Tabs
  const tabs = document.querySelectorAll('#algorithm-tabs .tab-btn');
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      switchTab(tab as HTMLButtonElement, index);
    });
  });

  // 3. Bind Sliders
  setupSlider('slider-alpha-length', 'badge-alpha-length', 'fill-alpha-length', true);
  setupSlider('slider-phrase-words', 'badge-phrase-words', 'fill-phrase-words', false);

  // 4. Bind Character pill toggles
  const toggles = document.querySelectorAll('.pill-toggle');
  toggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      // Toggle active state
      toggle.classList.toggle('active');

      // Edge case: ensure at least one remains active
      const activeToggles = document.querySelectorAll('.pill-toggle.active');
      if (activeToggles.length === 0) {
        toggle.classList.add('active'); // Re-enable last active
      }
    });
  });

  // 5. Segmented controls binding
  const segments = document.querySelectorAll('.segmented-control .segment-btn');
  segments.forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.parentElement;
      if (parent) {
        parent.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }
    });
  });

  // 6. Bind collapsible vaults
  setupCollapsible('history-toggle', 'history-content');
  setupCollapsible('favorites-toggle', 'favorites-content');

  // 7. Bind Key Copy Actions
  elCopyBtn.addEventListener('click', handleCopyAction);

  // 8. Bind Central Trigger Key Generation
  const btnGenerate = document.getElementById('btn-generate-key') as HTMLButtonElement;
  btnGenerate.addEventListener('click', executeKeyGeneration);

  // 9. Bind Credentials Dialog
  setupSettingsDialog();
}

/**
 * Configure slider badge updates and WebGL warping
 */
function setupSlider(sliderId: string, badgeId: string, fillId: string, isAlpha: boolean): void {
  const slider = document.getElementById(sliderId) as HTMLInputElement;
  const badge = document.getElementById(badgeId) as HTMLElement;
  const fill = document.getElementById(fillId) as HTMLElement;

  if (!slider || !badge || !fill) return;

  const update = () => {
    const val = parseInt(slider.value);
    badge.innerText = val.toString();

    // Calculate percent for fills
    const min = parseInt(slider.min) || 0;
    const max = parseInt(slider.max) || 100;
    const pct = ((val - min) / (max - min)) * 100;
    fill.style.width = `${pct}%`;

    // Fire reactive vertex morphing in WebGL
    if (isAlpha) {
      handleSliderWarp(val);
    } else {
      handleSliderWarp(val * 20); // Scale up words slider values
    }
  };

  slider.addEventListener('input', update);
  // Initial draw
  update();
}

/**
 * Switch algorithm modes and translate the tab underline indicator
 */
function switchTab(btn: HTMLButtonElement, index: number): void {
  const tabs = document.querySelectorAll('#algorithm-tabs .tab-btn');
  tabs.forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });

  btn.classList.add('active');
  btn.setAttribute('aria-selected', 'true');

  // Slide active indicator: translateX based on index (0, 100%, 200%)
  elTabIndicator.style.transform = `translateX(${index * 100}%)`;

  // Toggle Control Panels
  const mode = btn.id.replace('tab-', '') as KeyMode;
  currentMode = mode;

  const panels = document.querySelectorAll('.control-panel');
  panels.forEach(p => p.classList.remove('active'));

  const activePanel = document.getElementById(`panel-${mode}`);
  if (activePanel) {
    activePanel.classList.add('active');
  }
}

/**
 * Initialize accordion collapses
 */
function setupCollapsible(toggleId: string, contentId: string): void {
  const toggle = document.getElementById(toggleId) as HTMLButtonElement;
  const content = document.getElementById(contentId) as HTMLElement;

  if (!toggle || !content) return;

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    content.classList.toggle('collapsed');
  });
}

/**
 * Settings modal credentials binding
 */
function setupSettingsDialog(): void {
  const dialog = document.getElementById('settings-dialog') as HTMLDialogElement;
  const openBtn = document.getElementById('settings-open-btn') as HTMLButtonElement;
  const closeBtn = document.getElementById('settings-close-btn') as HTMLButtonElement;
  const saveBtn = document.getElementById('btn-save-key') as HTMLButtonElement;
  const clearBtn = document.getElementById('btn-clear-key') as HTMLButtonElement;
  const inputKey = document.getElementById('gemini-api-key') as HTMLInputElement;
  const visToggle = document.getElementById('btn-toggle-key-visibility') as HTMLButtonElement;

  if (!dialog || !openBtn || !closeBtn || !saveBtn || !clearBtn || !inputKey) return;

  // Retrieve saved key
  const saved = localStorage.getItem('VAULTAURA_GEMINI_KEY') || "";
  inputKey.value = saved;

  openBtn.addEventListener('click', () => dialog.showModal());
  closeBtn.addEventListener('click', () => dialog.close());

  // Password visibility
  visToggle.addEventListener('click', () => {
    if (inputKey.type === 'password') {
      inputKey.type = 'text';
      visToggle.innerText = 'Hide';
    } else {
      inputKey.type = 'password';
      visToggle.innerText = 'Show';
    }
  });

  saveBtn.addEventListener('click', () => {
    localStorage.setItem('VAULTAURA_GEMINI_KEY', inputKey.value.trim());
    dialog.close();
    window.location.reload(); // Reload to re-fire image generation calls with new key
  });

  clearBtn.addEventListener('click', () => {
    localStorage.removeItem('VAULTAURA_GEMINI_KEY');
    inputKey.value = "";
    dialog.close();
    window.location.reload();
  });
}

/**
 * Primary key cryptographic generation director
 */
function executeKeyGeneration(): void {
  let key: GeneratedKey;

  if (currentMode === 'alphanumeric') {
    const length = parseInt((document.getElementById('slider-alpha-length') as HTMLInputElement).value);
    const uppercase = document.getElementById('toggle-alpha-upper')?.classList.contains('active') || false;
    const lowercase = document.getElementById('toggle-alpha-lower')?.classList.contains('active') || false;
    const numbers = document.getElementById('toggle-alpha-numbers')?.classList.contains('active') || false;
    const symbols = document.getElementById('toggle-alpha-symbols')?.classList.contains('active') || false;
    const excludeAmbiguous = (document.getElementById('toggle-alpha-ambiguous') as HTMLInputElement).checked;

    const config: AlphaConfig = { length, uppercase, lowercase, numbers, symbols, excludeAmbiguous };
    key = generateAlphanumeric(config);
  } else if (currentMode === 'passphrase') {
    const wordCount = parseInt((document.getElementById('slider-phrase-words') as HTMLInputElement).value);
    
    // Separator segmented btn active value
    const sepActive = document.querySelector('#control-phrase-separator .segment-btn.active') as HTMLElement;
    const separator = sepActive ? sepActive.getAttribute('data-value') || "" : "-";

    // Capitalization active value
    const capActive = document.querySelector('#control-phrase-capitalization .segment-btn.active') as HTMLElement;
    const capitalization = (capActive ? capActive.getAttribute('data-value') : 'lowercase') as 'lowercase' | 'titlecase' | 'uppercase';

    const config: PassphraseConfig = { wordCount, separator, capitalization };
    key = generatePassphrase(config);
  } else {
    // PIN Block
    const lenActive = document.querySelector('#control-pin-length .segment-btn.active') as HTMLElement;
    const length = lenActive ? parseInt(lenActive.getAttribute('data-value') || "6") : 6;

    const formatActive = document.querySelector('#control-pin-format .segment-btn.active') as HTMLElement;
    const format = (formatActive ? formatActive.getAttribute('data-value') : 'contiguous') as 'contiguous' | 'grouped';

    const excludeSequential = (document.getElementById('toggle-pin-sequential') as HTMLInputElement).checked;
    const excludeRepeated = (document.getElementById('toggle-pin-repeated') as HTMLInputElement).checked;

    const config: PinConfig = { length, format, excludeSequential, excludeRepeated };
    key = generatePin(config);
  }

  currentKey = key;

  // Clear any active copy count-downs if active to prevent overlapping labels
  resetCopyState();

  // Run Three.js cinematic camera sweep and trigger unscramble
  triggerGenerateAnimation(() => {
    runUnscrambleAnimation(key.value);
    updateTelemetryUI(key);
    addToHistory(key);
  });
}

/**
 * Runs the staggered 1.2s character-unscramble animation
 */
function runUnscrambleAnimation(targetValue: string): void {
  const length = targetValue.length;
  elUnscrambleContainer.innerHTML = "";

  // Calculate dynamic stagger so total animation finishes precisely within 1.2 seconds (1200ms)
  const targetDuration = 1200;
  const maxStagger = 18;
  const stagger = Math.min(maxStagger, targetDuration / length);

  const spans: HTMLSpanElement[] = [];

  // Create spans for each position
  for (let i = 0; i < length; i++) {
    const span = document.createElement('span');
    span.className = 'char-cycling';
    span.innerText = getRandomNoiseChar();
    elUnscrambleContainer.appendChild(span);
    spans.push(span);
  }

  // Orchestrate character cycles
  spans.forEach((span, index) => {
    let cycles = 8 + Math.floor(Math.random() * 5); // 8 to 12 cycles
    let intervalId: number;

    // Stagger the starts dynamically
    window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        if (cycles > 0) {
          span.innerText = getRandomNoiseChar();
          cycles--;
        } else {
          // Resolve to correct target character
          window.clearInterval(intervalId);
          span.innerText = targetValue[index];
          span.className = 'char-resolved';
        }
      }, 40);
    }, index * stagger);
  });
}

/**
 * Returns a random alphanumeric noise character for the reveal effect
 */
function getRandomNoiseChar(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
  return chars[Math.floor(Math.random() * chars.length)];
}

/**
 * Updates computed metrics in display grid cards
 */
function updateTelemetryUI(key: GeneratedKey): void {
  elEntropyVal.innerText = `${key.entropy.toFixed(1)} bits`;

  // Format keyspace as exponential power if large
  if (key.keyspace > 1000000n) {
    // Keyspace size is poolSize^length. Let's format it nicely
    // If alphanumeric, poolSize is dependent on active set toggles. Let's read log-based estimation
    elKeyspaceVal.innerText = formatBigKeyspace(key.entropy);
  } else {
    elKeyspaceVal.innerText = key.keyspace.toString();
  }

  elCrackTimeVal.innerText = key.crackTime;

  // Strength colors
  elStrengthVal.innerText = key.strength;
  elStrengthVal.className = "telemetry-value"; // reset

  switch (key.strength) {
    case 'WEAK':
      elStrengthVal.classList.add('strength-weak');
      break;
    case 'FAIR':
      elStrengthVal.classList.add('strength-fair');
      break;
    case 'STRONG':
      elStrengthVal.classList.add('strength-strong');
      break;
    case 'UNBREAKABLE':
      elStrengthVal.classList.add('strength-unbreakable');
      break;
  }
}

/**
 * Helper to display enormous numbers as clean base-10 powers
 */
function formatBigKeyspace(entropyBits: number): string {
  // 2^entropyBits = 10^x
  // x = entropyBits * log10(2)
  const power = Math.floor(entropyBits * Math.log10(2));
  return `10^${power}`;
}

/**
 * Clipboard auto-clear security hook & visual confirmation
 */
async function handleCopyAction(): Promise<void> {
  if (!currentKey) return;

  try {
    // Double copy insurance: clear any previous clear sequences first
    resetCopyState();

    await navigator.clipboard.writeText(currentKey.value);

    // 1. Success confirmation states
    elCopyBtn.classList.add('success');
    elCopyBtnText.innerText = "Copied";
    elCopyIconDefault.classList.add('hidden');
    elCopyIconSuccess.classList.remove('hidden');

    // Reset button design back to normal after 2 seconds
    copyResetTimeout = window.setTimeout(() => {
      elCopyIconSuccess.classList.add('hidden');
      elCopyIconDefault.classList.remove('hidden');
      elCopyBtn.classList.remove('success');
    }, 2000);

    // 2. Clipboard Auto-Clear Countdown timer hooks
    let countdown = 30; // 30 seconds count
    elCopyBtnText.innerText = `Clears in ${countdown}s`;

    countdownInterval = window.setInterval(() => {
      countdown--;
      if (countdown > 0) {
        elCopyBtnText.innerText = `Clears in ${countdown}s`;
      } else {
        if (countdownInterval !== null) {
          window.clearInterval(countdownInterval);
          countdownInterval = null;
        }
      }
    }, 1000);

    // Trigger empty-string clipboard clear at exactly 30,000ms
    clipboardClearTimeout = window.setTimeout(async () => {
      try {
        await navigator.clipboard.writeText('');
        elCopyBtnText.innerText = "Cleared ✓";
        
        // Revert count label back to default copy after 1.5s
        window.setTimeout(() => {
          elCopyBtnText.innerText = "Copy";
        }, 1500);
      } catch (err) {
        console.warn("Failed to clear device clipboard automatically.", err);
      }
    }, 30000);

  } catch (err) {
    console.error("Clipboard writing error:", err);
    // Silent degradation: show text area fallback in viewport card if browser fails
    renderClipboardFallback();
  }
}

/**
 * Gracefully render textarea backup for non-HTTPS browser limits
 */
function renderClipboardFallback(): void {
  if (!currentKey) return;
  const existing = document.getElementById('fallback-text-area');
  if (existing) existing.remove();

  const area = document.createElement('textarea');
  area.id = 'fallback-text-area';
  area.className = 'clipboard-fallback-area';
  area.value = currentKey.value;
  area.readOnly = true;
  area.title = "Press Ctrl+C to copy";

  const viewport = document.querySelector('.viewport-card') as HTMLElement;
  viewport.appendChild(area);
  area.select();
}

/**
 * Resets timers to prevent overlapping intervals on duplicate copy events
 */
function resetCopyState(): void {
  if (copyResetTimeout !== null) {
    window.clearTimeout(copyResetTimeout);
    copyResetTimeout = null;
  }
  if (clipboardClearTimeout !== null) {
    window.clearTimeout(clipboardClearTimeout);
    clipboardClearTimeout = null;
  }
  if (countdownInterval !== null) {
    window.clearInterval(countdownInterval);
    countdownInterval = null;
  }

  elCopyBtn.classList.remove('success');
  elCopyIconSuccess.classList.add('hidden');
  elCopyIconDefault.classList.remove('hidden');
  elCopyBtnText.innerText = "Copy";

  const fallback = document.getElementById('fallback-text-area');
  if (fallback) fallback.remove();
}

/**
 * Adds generated key to the in-session History Vault (last 10 keys max)
 */
function addToHistory(key: GeneratedKey): void {
  // Shift old keys if limit of 10 is hit
  if (historyVault.length >= 10) {
    historyVault.pop();
  }
  historyVault.unshift(key);
  renderHistoryUI();
}

/**
 * Render history vault lists
 */
function renderHistoryUI(): void {
  elHistoryList.innerHTML = "";

  if (historyVault.length === 0) {
    elHistoryList.innerHTML = `<div class="vault-empty-message">No generated keys in history.</div>`;
    return;
  }

  historyVault.forEach((item, index) => {
    const trunc = item.value.length > 24 ? `${item.value.substring(0, 24)}...` : item.value;
    const isStarred = isStarredInVault(item.value);

    const div = document.createElement('div');
    div.className = 'vault-item';
    div.innerHTML = `
      <div class="vault-item-left">
        <span class="vault-item-key" title="${item.value}">${trunc}</span>
        <div class="vault-item-meta">
          <span class="badge-mode">${item.mode === 'alphanumeric' ? 'ALPHA' : item.mode === 'passphrase' ? 'PHRASE' : 'PIN'}</span>
          <span class="vault-item-entropy">${item.entropy} bits</span>
        </div>
      </div>
      <div class="vault-item-actions">
        <button class="vault-action-btn copy-item-btn" data-index="${index}" title="Copy Key">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        </button>
        <button class="vault-action-btn star-item-btn ${isStarred ? 'active' : ''}" data-index="${index}" title="Star/Favorite Key">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="${isStarred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        </button>
      </div>
    `;

    // Bind action events inside history list
    div.querySelector('.copy-item-btn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(item.value);
      // Brief feedback toast placeholder
    });

    div.querySelector('.star-item-btn')?.addEventListener('click', (e) => {
      toggleFavorite(item);
      const btn = e.currentTarget as HTMLElement;
      btn.classList.toggle('active');
    });

    elHistoryList.appendChild(div);
  });
}

/**
 * Stars or unstars items to/from the Favorites Vault (max 5 items)
 */
function toggleFavorite(key: GeneratedKey): void {
  const index = favoritesVault.findIndex(f => f.value === key.value);

  if (index > -1) {
    // Unstar
    favoritesVault.splice(index, 1);
  } else {
    // Star: Max 5 items enforcement
    if (favoritesVault.length >= 5) {
      favoritesVault.pop(); // Remove oldest
    }
    favoritesVault.unshift({ ...key, isStarred: true });
  }

  renderFavoritesUI();
  renderHistoryUI(); // update star fills
}

/**
 * Checks if key exists in favorites
 */
function isStarredInVault(val: string): boolean {
  return favoritesVault.some(f => f.value === val);
}

/**
 * Render favorites vault lists
 */
function renderFavoritesUI(): void {
  elFavoritesList.innerHTML = "";

  if (favoritesVault.length === 0) {
    elFavoritesList.innerHTML = `<div class="vault-empty-message">No starred keys in favorites.</div>`;
    return;
  }

  favoritesVault.forEach((item, index) => {
    const trunc = item.value.length > 24 ? `${item.value.substring(0, 24)}...` : item.value;

    const div = document.createElement('div');
    div.className = 'vault-item';
    div.innerHTML = `
      <div class="vault-item-left">
        <span class="vault-item-key" title="${item.value}">${trunc}</span>
        <div class="vault-item-meta">
          <span class="badge-mode">${item.mode === 'alphanumeric' ? 'ALPHA' : item.mode === 'passphrase' ? 'PHRASE' : 'PIN'}</span>
          <span class="vault-item-entropy">${item.entropy} bits</span>
        </div>
      </div>
      <div class="vault-item-actions">
        <button class="vault-action-btn copy-fav-btn" data-index="${index}" title="Copy Starred Key">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        </button>
        <button class="vault-action-btn remove-fav-btn active" data-index="${index}" title="Unstar Key">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        </button>
      </div>
    `;

    div.querySelector('.copy-fav-btn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(item.value);
    });

    div.querySelector('.remove-fav-btn')?.addEventListener('click', () => {
      toggleFavorite(item);
    });

    elFavoritesList.appendChild(div);
  });
}
