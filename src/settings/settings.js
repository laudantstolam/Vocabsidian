import { MSG } from '../shared/constants.js';

function sendMsg(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

function showStatus(el, text, type) {
  el.textContent = text;
  el.className = 'status-msg ' + type;
  el.hidden = false;
}

function hideStatus(el) {
  el.hidden = true;
  el.textContent = '';
  el.className = 'status-msg';
}

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('settings-form');
  const connectionStatus = document.getElementById('connection-status');
  const saveStatus = document.getElementById('save-status');

  // Populate form from saved settings
  try {
    const resp = await sendMsg({ type: MSG.GET_SETTINGS });
    console.log('[VV:settings] loaded:', JSON.stringify(resp));
    const settings = resp?.data ?? resp ?? {};
    if (settings.deeplApiKey != null) {
      document.getElementById('deepl-api-key').value = settings.deeplApiKey;
    }
    if (settings.targetLang != null) {
      document.getElementById('target-lang').value = settings.targetLang;
    }
    if (settings.obsidianPort != null) {
      document.getElementById('obsidian-port').value = settings.obsidianPort;
    }
    if (settings.obsidianApiKey != null) {
      document.getElementById('obsidian-api-key').value = settings.obsidianApiKey;
    }
    if (settings.vaultNotePath != null) {
      document.getElementById('vault-note-path').value = settings.vaultNotePath;
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }

  // Toggle password visibility
  document.querySelectorAll('.toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (input.type === 'password') {
        input.type = 'text';
        btn.setAttribute('aria-label', 'Hide');
        btn.querySelector('.eye-icon').innerHTML = `
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        `;
      } else {
        input.type = 'password';
        btn.setAttribute('aria-label', 'Toggle visibility');
        btn.querySelector('.eye-icon').innerHTML = `
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        `;
      }
    });
  });

  // Test connection
  document.getElementById('test-connection-btn').addEventListener('click', async () => {
    hideStatus(connectionStatus);
    try {
      const result = await sendMsg({ type: MSG.TEST_CONNECTION });
      console.log('[VV:settings] test connection result:', JSON.stringify(result));
      if (result?.ok && result?.data?.ok) {
        showStatus(connectionStatus, `Connected (${result.data.entryCount} entries)`, 'success');
      } else {
        const err = result?.data?.error || result?.error || 'Unknown error';
        showStatus(connectionStatus, `Error: ${err}`, 'error');
      }
    } catch (err) {
      showStatus(connectionStatus, `Error: ${err.message}`, 'error');
    }
  });

  // Save settings
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideStatus(saveStatus);

    const settings = {
      deeplApiKey: document.getElementById('deepl-api-key').value,
      targetLang: document.getElementById('target-lang').value,
      obsidianPort: Number(document.getElementById('obsidian-port').value),
      obsidianApiKey: document.getElementById('obsidian-api-key').value,
      vaultNotePath: document.getElementById('vault-note-path').value,
    };

    try {
      await sendMsg({ type: MSG.SAVE_SETTINGS, settings });
      showStatus(saveStatus, 'Saved!', 'success');
      setTimeout(() => hideStatus(saveStatus), 2000);
    } catch (err) {
      showStatus(saveStatus, `Error: ${err.message}`, 'error');
    }
  });
});
