/**
 * FloodChat
 * Unified Content Script supporting Telegram Web & WhatsApp Web
 * With Native Chrome i18n Localization Support
 */

(() => {
  if (window.__CHAT_LOAD_TESTER_LOADED__) return;
  window.__CHAT_LOAD_TESTER_LOADED__ = true;

  // Localization helper for content script
  const i18n = (key, substitutions) => {
    try {
      const msg = chrome.i18n?.getMessage(key, substitutions);
      return msg || key;
    } catch (e) {
      return key;
    }
  };

  // Platform Detection
  const hostname = window.location.hostname;
  const isWhatsApp = hostname.includes('whatsapp.com');
  const isTelegram = hostname.includes('telegram.org');
  const platformName = isWhatsApp ? i18n('whatsappWeb') : (isTelegram ? i18n('telegramWeb') : 'Web Chat');

  let isRunning = false;
  let shouldStop = false;
  let currentIndex = 0;
  let messagesList = [];
  let intervalMs = 50;
  let loopEnabled = false;
  let sentCount = 0;
  let lastError = null;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // ==========================================
  // Platform Adapters
  // ==========================================

  const TelegramAdapter = {
    findInput() {
      return (
        document.querySelector('#editable-message-text') ||
        document.querySelector('div.input-message-input[contenteditable="true"]') ||
        document.querySelector('.input-scroller div[contenteditable="true"]') ||
        document.querySelector('.input-message-container div[contenteditable="true"]') ||
        document.querySelector('.Composer div[contenteditable="true"]') ||
        document.querySelector('.chat-input-message') ||
        document.querySelector('div[contenteditable="true"]')
      );
    },

    findSendButton() {
      return (
        document.querySelector('button.main-button.send') ||
        document.querySelector('button.send') ||
        document.querySelector('button.tgico-send') ||
        document.querySelector('button.chat-input-main-button') ||
        document.querySelector('button[title*="Send" i]') ||
        document.querySelector('button[aria-label*="Send" i]') ||
        document.querySelector('button[title*="Enviar" i]') ||
        document.querySelector('button[aria-label*="Enviar" i]') ||
        document.querySelector('button[title*="Отправить" i]') ||
        document.querySelector('button[aria-label*="Отправить" i]') ||
        document.querySelector('button.Button.send') ||
        document.querySelector('button.btn-send')
      );
    },

    detectRateLimit() {
      const selectors = [
        '.toast',
        '.Notification',
        '.modal-dialog',
        '.popup',
        'div[role="alert"]',
        'div[class*="toast"]',
        'div[class*="notification"]'
      ];

      for (const sel of selectors) {
        const elements = document.querySelectorAll(sel);
        for (const el of elements) {
          if (!el || !el.offsetParent) continue;
          const text = (el.innerText || el.textContent || '').toLowerCase();
          if (
            text.includes('too many requests') ||
            text.includes('flood') ||
            text.includes('wait') ||
            text.includes('aguarde') ||
            text.includes('espera') ||
            text.includes('подождите') ||
            text.includes('слишком много') ||
            text.includes('muitas tentativas') ||
            text.includes('limite') ||
            text.includes('slow mode') ||
            text.includes('modo lento')
          ) {
            return el.innerText || el.textContent || i18n('floodWaitDetected', [platformName]);
          }
        }
      }
      return null;
    }
  };

  const WhatsAppAdapter = {
    findInput() {
      return (
        document.querySelector('div[data-testid="conversation-compose-box-input"]') ||
        document.querySelector('#main footer div[contenteditable="true"]') ||
        document.querySelector('footer div[contenteditable="true"][data-tab="10"]') ||
        document.querySelector('footer div[contenteditable="true"]') ||
        document.querySelector('div[role="textbox"][contenteditable="true"]')
      );
    },

    findSendButton() {
      const testIdBtn = document.querySelector('button[data-testid="compose-btn-send"]');
      if (testIdBtn && !testIdBtn.disabled) return testIdBtn;

      const sendIcons = document.querySelectorAll('span[data-icon="send"], span[data-icon="send-light"]');
      for (const icon of sendIcons) {
        const btn = icon.closest('button');
        if (btn && !btn.disabled) return btn;
      }

      return (
        document.querySelector('footer button[aria-label*="Send" i]') ||
        document.querySelector('footer button[aria-label*="Enviar" i]') ||
        document.querySelector('footer button[aria-label*="Отправить" i]') ||
        document.querySelector('button[data-tab="11"]')
      );
    },

    detectRateLimit() {
      const modals = document.querySelectorAll('div[data-animate-modal-popup="true"], div[role="alert"], div[role="dialog"]');
      for (const modal of modals) {
        if (!modal || !modal.offsetParent) continue;
        const text = (modal.innerText || modal.textContent || '').toLowerCase();
        if (
          text.includes('waiting for message') ||
          text.includes('bloqueado') ||
          text.includes('ban') ||
          text.includes('limite') ||
          text.includes('aguarde') ||
          text.includes('desconectado') ||
          text.includes('disconnected') ||
          text.includes('отключен')
        ) {
          return modal.innerText || modal.textContent || i18n('floodWaitDetected', [platformName]);
        }
      }
      return null;
    }
  };

  const activeAdapter = isWhatsApp ? WhatsAppAdapter : TelegramAdapter;

  // ==========================================
  // DOM Manipulation & Dispatch Logic
  // ==========================================

  function insertText(inputEl, text) {
    inputEl.focus();

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(inputEl);
    selection.removeAllRanges();
    selection.addRange(range);

    let success = false;
    try {
      success = document.execCommand('insertText', false, text);
    } catch (e) {
      success = false;
    }

    if (!success || (inputEl.innerText || '').trim() !== text.trim()) {
      inputEl.innerHTML = '';
      inputEl.appendChild(document.createTextNode(text));
      inputEl.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        composed: true,
        inputType: 'insertText',
        data: text
      }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  }

  async function triggerSend(inputEl) {
    const enterDown = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
      composed: true
    });
    inputEl.dispatchEvent(enterDown);

    const enterUp = new KeyboardEvent('keyup', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
      composed: true
    });
    inputEl.dispatchEvent(enterUp);

    await sleep(25);

    if ((inputEl.innerText || '').trim().length > 0) {
      const sendBtn = activeAdapter.findSendButton();
      if (sendBtn && !sendBtn.disabled) {
        sendBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        sendBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        sendBtn.click();
      }
    }
  }

  function persistState(extraStatus) {
    const state = {
      isRunning,
      currentIndex,
      total: messagesList.length,
      sentCount,
      lastError,
      intervalMs,
      loopEnabled,
      platform: isWhatsApp ? 'whatsapp' : 'telegram',
      extraStatus: extraStatus || (isRunning ? i18n('sendingProgress', ['...']) : (lastError ? lastError : i18n('readyToStart')))
    };

    try {
      chrome.storage.local.set({ tg_spam_state: state });
    } catch (e) {
      // Ignored if extension context reloaded
    }
    return state;
  }

  // ==========================================
  // Execution Engine
  // ==========================================

  async function runSender() {
    if (isRunning) return;
    isRunning = true;
    shouldStop = false;
    lastError = null;

    persistState(i18n('startingDispatch'));

    while (!shouldStop && currentIndex < messagesList.length) {
      const rateLimitMsg = activeAdapter.detectRateLimit();
      if (rateLimitMsg) {
        lastError = i18n('pausedByError', [rateLimitMsg]);
        isRunning = false;
        persistState(lastError);
        return;
      }

      const input = activeAdapter.findInput();
      if (!input) {
        lastError = i18n('errorChatNotFound', [platformName]);
        isRunning = false;
        persistState(lastError);
        return;
      }

      const currentMsg = messagesList[currentIndex];
      if (!currentMsg || currentMsg.trim().length === 0) {
        currentIndex++;
        continue;
      }

      insertText(input, currentMsg);
      await triggerSend(input);
      sentCount++;
      currentIndex++;

      if (loopEnabled && currentIndex >= messagesList.length) {
        currentIndex = 0;
      }

      persistState(i18n('sendingMessageIndex', [String(currentIndex), String(messagesList.length)]));

      if (intervalMs > 0) {
        await sleep(intervalMs);
      } else {
        await sleep(15);
      }

      if (shouldStop) break;
    }

    isRunning = false;
    if (shouldStop) {
      persistState(i18n('sendInterrupted'));
    } else if (currentIndex >= messagesList.length) {
      persistState(i18n('sendCompleted'));
    } else {
      persistState();
    }
  }

  // ==========================================
  // Popup Message Listener
  // ==========================================

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case 'PING':
        sendResponse({
          ok: true,
          platform: isWhatsApp ? 'whatsapp' : 'telegram',
          platformName
        });
        break;

      case 'START':
        if (isRunning) {
          sendResponse({ ok: false, error: 'Already running' });
          return true;
        }

        messagesList = (request.messages || [])
          .map((m) => (typeof m === 'string' ? m.trim() : ''))
          .filter((m) => m.length > 0);

        intervalMs = parseInt(request.interval, 10) || 0;
        loopEnabled = Boolean(request.loop);

        if (request.resetIndex) {
          currentIndex = 0;
          sentCount = 0;
        }
        lastError = null;

        if (messagesList.length === 0) {
          sendResponse({ ok: false, error: i18n('errorNoMessages') });
          return true;
        }

        const inputEl = activeAdapter.findInput();
        if (!inputEl) {
          sendResponse({
            ok: false,
            error: i18n('errorChatNotFound', [platformName])
          });
          return true;
        }

        runSender();
        sendResponse({ ok: true });
        break;

      case 'STOP':
        shouldStop = true;
        isRunning = false;
        persistState(i18n('sendInterrupted'));
        sendResponse({ ok: true });
        break;

      case 'GET_STATUS':
        sendResponse({
          ok: true,
          state: {
            isRunning,
            currentIndex,
            total: messagesList.length,
            sentCount,
            lastError,
            intervalMs,
            loopEnabled,
            platform: isWhatsApp ? 'whatsapp' : 'telegram'
          }
        });
        break;

      default:
        sendResponse({ ok: false, error: 'Unknown action' });
    }
    return true;
  });
})();
