/**
 * FloodChat
 * Multiplatform Adaptive Controller (Telegram Blue / WhatsApp Green)
 * Full Native Chrome i18n Localization Support
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Localization Helper
  function i18n(key, substitutions) {
    try {
      const msg = chrome.i18n.getMessage(key, substitutions);
      return msg || key;
    } catch (e) {
      return key;
    }
  }

  // Translate all DOM elements tagged with data-i18n attributes
  function applyLocalization() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const msg = i18n(key);
      if (msg) el.textContent = msg;
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      const msg = i18n(key);
      if (msg) el.placeholder = msg;
    });

    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      const msg = i18n(key);
      if (msg) el.title = msg;
    });
  }

  // Apply initial translations
  applyLocalization();

  // DOM Elements
  const brandGlyphEl = document.getElementById('brand-glyph');
  const brandTagEl = document.getElementById('brand-tag');
  const unsupportedBannerEl = document.getElementById('unsupported-banner');
  const fileInputEl = document.getElementById('file-input');
  const btnBrowseEl = document.getElementById('btn-browse');
  const fileNameEl = document.getElementById('file-name');
  const messagesInputEl = document.getElementById('messages-input');
  const linesCountBadgeEl = document.getElementById('lines-count-badge');
  const intervalInputEl = document.getElementById('interval-input');
  const loopCheckboxEl = document.getElementById('loop-checkbox');
  const statusTextEl = document.getElementById('status-text');
  const progressCountEl = document.getElementById('progress-count');
  const progressFillEl = document.getElementById('progress-fill');
  const btnStartEl = document.getElementById('btn-start');
  const btnStartLabelEl = document.getElementById('btn-start-label');
  const btnStopEl = document.getElementById('btn-stop');
  const btnClearEl = document.getElementById('btn-clear');
  const presetButtons = document.querySelectorAll('.preset-btn');
  const dropZoneEl = document.getElementById('drop-zone');
  const telemetryCardEl = document.querySelector('.telemetry-card');

  let activeTabId = null;
  let isSupportedTab = false;
  let currentPlatform = null; // 'telegram' | 'whatsapp' | null
  let currentFileName = null; // real imported filename
  let pollInterval = null;

  // Platform Glyphs
  const GLYPHS = {
    telegram: `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
    `,
    whatsapp: `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1 3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
      </svg>
    `,
    neutral: `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M3 5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-5l-4 3.5V17H6a3 3 0 0 1-3-3V5zm10.5 1.5L9 11.5h3.2L11 16l4.5-5h-3.2l1.2-4.5z"/>
      </svg>
    `
  };

  // 1. Audit Active Tab & Set Theme (Telegram Blue / WhatsApp Green / Idle)
  async function checkCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) {
        setPlatformState(null);
        return;
      }

      activeTabId = tab.id;
      const url = tab.url.toLowerCase();

      if (url.includes('web.whatsapp.com')) {
        setPlatformState('whatsapp');
      } else if (url.includes('web.telegram.org')) {
        setPlatformState('telegram');
      } else {
        setPlatformState(null);
      }
    } catch (err) {
      console.error('Falha ao auditar aba ativa:', err);
      setPlatformState(null);
    }
  }

  function setPlatformState(platform) {
    currentPlatform = platform;
    isSupportedTab = platform !== null;

    if (btnStartLabelEl) {
      btnStartLabelEl.textContent = i18n('btnSend');
    }

    if (platform === 'whatsapp') {
      document.body.className = 'theme-whatsapp';
      if (brandGlyphEl) brandGlyphEl.innerHTML = GLYPHS.whatsapp;
      if (brandTagEl) brandTagEl.textContent = i18n('whatsappWeb');
      if (unsupportedBannerEl) unsupportedBannerEl.style.display = 'none';
      btnStartEl.disabled = false;
    } else if (platform === 'telegram') {
      document.body.className = 'theme-telegram';
      if (brandGlyphEl) brandGlyphEl.innerHTML = GLYPHS.telegram;
      if (brandTagEl) brandTagEl.textContent = i18n('telegramWeb');
      if (unsupportedBannerEl) unsupportedBannerEl.style.display = 'none';
      btnStartEl.disabled = false;
    } else {
      document.body.className = 'theme-idle';
      if (brandGlyphEl) brandGlyphEl.innerHTML = GLYPHS.neutral;
      if (brandTagEl) brandTagEl.textContent = i18n('waitingChat');
      if (unsupportedBannerEl) unsupportedBannerEl.style.display = 'flex';
      btnStartEl.disabled = true;
    }
  }

  // 2. Parse text lines into array of valid messages (ignoring blank lines)
  function getLines() {
    const raw = messagesInputEl.value || '';
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  function updateLinesBadge() {
    const lines = getLines();
    const count = lines.length;
    if (count === 0) {
      linesCountBadgeEl.textContent = i18n('counterZero');
    } else if (count === 1) {
      linesCountBadgeEl.textContent = i18n('counterSingular', ['1']);
    } else {
      linesCountBadgeEl.textContent = i18n('counterPlural', [String(count)]);
    }
  }

  function processLoadedText(content, name) {
    const cleanLines = (content || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    messagesInputEl.value = cleanLines.join('\n');
    if (name) {
      currentFileName = name;
      fileNameEl.textContent = name;
    }
    updateLinesBadge();
    saveDraft();
  }

  // 3. File Browser Trigger & Reader
  btnBrowseEl.addEventListener('click', () => {
    fileInputEl.click();
  });

  fileInputEl.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      processLoadedText(event.target.result, file.name);
    };
    reader.readAsText(file);
  });

  // Drag and Drop support on editor
  if (dropZoneEl) {
    dropZoneEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZoneEl.classList.add('dragover');
    });

    dropZoneEl.addEventListener('dragleave', () => {
      dropZoneEl.classList.remove('dragover');
    });

    dropZoneEl.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZoneEl.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.txt') || file.type.includes('text'))) {
        const reader = new FileReader();
        reader.onload = (event) => {
          processLoadedText(event.target.result, file.name);
        };
        reader.readAsText(file);
      }
    });
  }

  messagesInputEl.addEventListener('input', () => {
    updateLinesBadge();
    saveDraft();
  });

  // 4. Presets & Interval sync
  function syncActivePreset(val) {
    const strVal = String(val).trim();
    presetButtons.forEach((btn) => {
      if (btn.getAttribute('data-ms') === strVal) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  presetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const ms = btn.getAttribute('data-ms');
      intervalInputEl.value = ms;
      syncActivePreset(ms);
      saveDraft();
    });
  });

  intervalInputEl.addEventListener('input', () => {
    syncActivePreset(intervalInputEl.value);
    saveDraft();
  });

  loopCheckboxEl.addEventListener('change', saveDraft);

  // 5. State Persistence
  function saveDraft() {
    chrome.storage.local.set({
      tg_draft_text: messagesInputEl.value,
      tg_draft_interval: intervalInputEl.value,
      tg_draft_loop: loopCheckboxEl.checked,
      tg_draft_filename: currentFileName
    });
  }

  async function restoreDraft() {
    const data = await chrome.storage.local.get([
      'tg_draft_text',
      'tg_draft_interval',
      'tg_draft_loop',
      'tg_draft_filename',
      'tg_spam_state'
    ]);

    if (data.tg_draft_text !== undefined) {
      messagesInputEl.value = data.tg_draft_text;
    }
    if (data.tg_draft_interval !== undefined) {
      intervalInputEl.value = data.tg_draft_interval;
      syncActivePreset(data.tg_draft_interval);
    } else {
      syncActivePreset(50);
    }
    if (data.tg_draft_loop !== undefined) {
      loopCheckboxEl.checked = data.tg_draft_loop;
    }

    const defaultNoFileTexts = [
      'Nenhum arquivo importado',
      'No file imported',
      'Ningún archivo importado',
      'Файл не импортирован'
    ];

    if (data.tg_draft_filename && !defaultNoFileTexts.includes(data.tg_draft_filename.trim())) {
      currentFileName = data.tg_draft_filename;
      fileNameEl.textContent = data.tg_draft_filename;
    } else {
      currentFileName = null;
      fileNameEl.textContent = i18n('noFileLoaded');
      chrome.storage.local.remove('tg_draft_filename');
    }

    updateLinesBadge();

    if (data.tg_spam_state) {
      renderState(data.tg_spam_state);
    }
  }

  // 6. UI Telemetry Rendering
  function renderState(state) {
    if (!state) return;

    const { isRunning, currentIndex, total, lastError, extraStatus, platform } = state;

    if (platform && !isSupportedTab) {
      setPlatformState(platform);
    }

    if (isRunning) {
      btnStartEl.disabled = true;
      btnStopEl.disabled = false;
      telemetryCardEl.className = 'telemetry-card running';

      const pct = total > 0 ? Math.min(100, Math.round((currentIndex / total) * 100)) : 0;
      progressFillEl.style.width = `${pct}%`;
      progressCountEl.textContent = `${currentIndex} / ${total}`;
      statusTextEl.textContent = extraStatus || i18n('sendingProgress', [String(pct)]);
    } else {
      btnStartEl.disabled = !isSupportedTab;
      btnStopEl.disabled = true;

      if (lastError) {
        telemetryCardEl.className = 'telemetry-card error';
        statusTextEl.textContent = lastError;
      } else {
        telemetryCardEl.className = 'telemetry-card';
        if (extraStatus) {
          statusTextEl.textContent = extraStatus;
          if (extraStatus === i18n('sendCompleted') || extraStatus.includes('concluído') || extraStatus.includes('completed')) {
            telemetryCardEl.classList.add('completed');
          }
        } else {
          statusTextEl.textContent = i18n('readyToStart');
        }
      }

      if (total > 0) {
        const pct = Math.min(100, Math.round((currentIndex / total) * 100));
        progressFillEl.style.width = `${pct}%`;
        progressCountEl.textContent = `${currentIndex} / ${total}`;
      }
    }
  }

  // 7. Communication with Content Script
  async function sendMessageToTab(payload) {
    if (!activeTabId) return null;
    try {
      return await chrome.tabs.sendMessage(activeTabId, payload);
    } catch (err) {
      console.warn('Falha na ponte com content script:', err);
      return null;
    }
  }

  async function pollStatus() {
    if (!activeTabId || !isSupportedTab) return;
    const res = await sendMessageToTab({ action: 'GET_STATUS' });
    if (res && res.ok && res.state) {
      renderState(res.state);
    } else {
      const data = await chrome.storage.local.get('tg_spam_state');
      if (data && data.tg_spam_state) {
        renderState(data.tg_spam_state);
      }
    }
  }

  // 8. Start Execution
  btnStartEl.addEventListener('click', async () => {
    const lines = getLines();
    if (lines.length === 0) {
      telemetryCardEl.className = 'telemetry-card error';
      statusTextEl.textContent = i18n('errorNoMessages');
      return;
    }

    const interval = parseInt(intervalInputEl.value, 10) || 0;
    const loop = loopCheckboxEl.checked;

    btnStartEl.disabled = true;
    telemetryCardEl.className = 'telemetry-card running';
    statusTextEl.textContent = i18n('startingDispatch');

    const res = await sendMessageToTab({
      action: 'START',
      messages: lines,
      interval: interval,
      loop: loop,
      resetIndex: true
    });

    if (res && res.ok) {
      btnStopEl.disabled = false;
      statusTextEl.textContent = i18n('sendStarted');
    } else {
      btnStartEl.disabled = false;
      telemetryCardEl.className = 'telemetry-card error';
      const defaultPlatformName = currentPlatform === 'whatsapp' ? i18n('whatsappWeb') : i18n('telegramWeb');
      const errMsg = res ? res.error : i18n('errorTabNotResponding', [defaultPlatformName]);
      statusTextEl.textContent = errMsg;
    }
  });

  // 9. Stop Execution
  btnStopEl.addEventListener('click', async () => {
    btnStopEl.disabled = true;
    await sendMessageToTab({ action: 'STOP' });
    btnStartEl.disabled = !isSupportedTab;
    telemetryCardEl.className = 'telemetry-card';
    statusTextEl.textContent = i18n('sendInterrupted');
  });

  // 10. Clear Editor
  btnClearEl.addEventListener('click', () => {
    messagesInputEl.value = '';
    currentFileName = null;
    fileNameEl.textContent = i18n('noFileLoaded');
    chrome.storage.local.remove('tg_draft_filename');
    fileInputEl.value = '';
    updateLinesBadge();
    saveDraft();
    progressFillEl.style.width = '0%';
    progressCountEl.textContent = '0 / 0';
    telemetryCardEl.className = 'telemetry-card';
    statusTextEl.textContent = i18n('editorCleared');
  });

  // Storage listener for state synchronization
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.tg_spam_state) {
      renderState(changes.tg_spam_state.newValue);
    }
  });

  // Initial Boot
  await checkCurrentTab();
  await restoreDraft();

  pollInterval = setInterval(pollStatus, 300);
  window.addEventListener('unload', () => {
    if (pollInterval) clearInterval(pollInterval);
  });
});
