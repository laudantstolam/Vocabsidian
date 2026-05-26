// VocabVault Content Script
// Runs on every page. No ES modules (MV3 content script limitation).

(function () {
  'use strict';
  console.log('[VV:content] Content script loaded on', location.href);

  // ── Shadow DOM host setup ──────────────────────────────────────────────────
  let host = document.getElementById('vocabvault-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'vocabvault-host';
    host.style.cssText = 'all: initial; position: fixed; top: 0; left: 0; z-index: 2147483647; pointer-events: none;';
    document.documentElement.appendChild(host);
  }
  const shadow = host.attachShadow({ mode: 'open' });

  // ── Inject styles into shadow root ────────────────────────────────────────
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; }

    #vv-btn {
      position: fixed;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #2563EB;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      pointer-events: all;
      opacity: 0;
      transition: opacity 150ms ease;
    }
    #vv-btn.visible { opacity: 1; }
    #vv-btn svg { width: 18px; height: 18px; fill: #fff; }

    #vv-tooltip {
      position: fixed;
      z-index: 2147483647;
      background: #1a1a2e;
      color: #e0e0e0;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      max-width: 320px;
      min-width: 220px;
      padding: 14px 16px 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      line-height: 1.5;
      pointer-events: all;
      opacity: 0;
      transition: opacity 150ms ease;
    }
    #vv-tooltip.visible { opacity: 1; }

    .vv-word {
      font-weight: 700;
      font-size: 18px;
      color: #e0e0e0;
      margin-bottom: 6px;
      line-height: 1.8;
    }
    .vv-word ruby {
      ruby-align: center;
    }
    .vv-word rt {
      font-size: 10px;
      font-weight: 400;
      color: #94a3b8;
      letter-spacing: 0.5px;
    }
    .vv-definition {
      color: #e0e0e0;
      margin-bottom: 8px;
    }
    .vv-meta {
      color: #6b7280;
      font-size: 12px;
      margin-bottom: 10px;
    }
    .vv-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .vv-btn-save, .vv-btn-close {
      border: none;
      border-radius: 6px;
      padding: 5px 14px;
      font-size: 13px;
      cursor: pointer;
      font-family: inherit;
      transition: opacity 100ms;
    }
    .vv-btn-save {
      background: #2563EB;
      color: #fff;
    }
    .vv-btn-save:hover { opacity: 0.85; }
    .vv-btn-close {
      background: #6b7280;
      color: #fff;
    }
    .vv-btn-close:hover { opacity: 0.85; }

    /* Spinner */
    .vv-spinner {
      width: 24px;
      height: 24px;
      border: 3px solid #2563EB33;
      border-top-color: #2563EB;
      border-radius: 50%;
      animation: vv-spin 0.7s linear infinite;
      margin: 8px auto;
    }
    @keyframes vv-spin {
      to { transform: rotate(360deg); }
    }

    /* Checkmark */
    .vv-check {
      color: #22c55e;
      font-size: 22px;
      text-align: center;
      padding: 6px 0;
    }
    .vv-btn-speak {
      background: transparent;
      border: none;
      cursor: pointer;
      color: #2563EB;
      padding: 0 4px;
      font-size: 14px;
      opacity: 0.7;
      transition: opacity 100ms;
    }
    .vv-btn-speak:hover { opacity: 1; }
  `;
  shadow.appendChild(styleEl);

  // ── Floating translate button ──────────────────────────────────────────────
  const btn = document.createElement('button');
  btn.id = 'vv-btn';
  btn.title = 'Translate with VocabVault';
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
  </svg>`;
  shadow.appendChild(btn);

  // ── Tooltip ────────────────────────────────────────────────────────────────
  const tooltip = document.createElement('div');
  tooltip.id = 'vv-tooltip';
  shadow.appendChild(tooltip);

  // ── State ──────────────────────────────────────────────────────────────────
  let lastWord = '';
  let lastX = 0;
  let lastY = 0;
  let btnVisible = false;
  let tooltipVisible = false;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function hideBtn() {
    btn.classList.remove('visible');
    btnVisible = false;
  }

  function showBtn(x, y) {
    btn.style.left = Math.min(x, window.innerWidth - 40) + 'px';
    btn.style.top = Math.min(y, window.innerHeight - 40) + 'px';
    btn.classList.add('visible');
    btnVisible = true;
  }

  function hideTooltip() {
    tooltip.classList.remove('visible');
    tooltipVisible = false;
    setTimeout(() => { tooltip.innerHTML = ''; }, 160);
  }

  function positionTooltip(x, y) {
    tooltip.style.left = '0px';
    tooltip.style.top = '0px';
    // Measure after inserting content
    requestAnimationFrame(() => {
      const tw = tooltip.offsetWidth || 320;
      const th = tooltip.offsetHeight || 160;
      let tx = x;
      let ty = y + 8;
      if (tx + tw > window.innerWidth - 8) tx = window.innerWidth - tw - 8;
      if (ty + th > window.innerHeight - 8) ty = y - th - 8;
      if (tx < 8) tx = 8;
      if (ty < 8) ty = 8;
      tooltip.style.left = tx + 'px';
      tooltip.style.top = ty + 'px';
    });
  }

  function showLoading(x, y) {
    tooltip.innerHTML = `<div class="vv-spinner"></div>`;
    positionTooltip(x, y);
    tooltip.classList.add('visible');
    tooltipVisible = true;
  }

  function showTooltipData(data, x, y) {
    const word = data.word || '';
    const rawReading = data.reading || '';
    const reading = (!rawReading || rawReading.trim() === '-') ? '' : rawReading;
    const definition = data.definition || '(no definition found)';
    const sourceHost = data.source || '';
    const date = data.date || new Date().toISOString().slice(0, 10);
    const ttsLang = data.ttsLang || '';
    const ttsSupported = data.ttsSupported !== false;
    const sourceLangLabel = data.sourceLangLabel || data.sourceLang || 'unknown';

    const wordHtml = data.readingPairs
      ? buildFuriganaFromPairs(data.readingPairs)
      : (reading ? buildFuriganaHtml(word, reading) : escHtml(word));
    tooltip.innerHTML = `
      <div class="vv-word">${wordHtml}</div>
      <div class="vv-definition">${escHtml(definition)}</div>
      <div class="vv-meta">${escHtml(date)}</div>
      <div class="vv-actions">
        <button class="vv-btn-speak" title="Speak">🔊</button>
        <button class="vv-btn-close">Close</button>
        <button class="vv-btn-save">Save</button>
      </div>
    `;

    shadow.querySelector('.vv-btn-speak').addEventListener('click', (e) => {
      e.stopPropagation();
      const speakResult = speak(word, ttsLang, { sourceLangLabel, supported: ttsSupported });
      if (!speakResult.ok) {
        tooltip.innerHTML = `<div class="vv-check" style="color:#ef4444">✕ ${escHtml(speakResult.error)}</div>`;
        setTimeout(() => showTooltipData(data, x, y), 1400);
      }
    });

    shadow.querySelector('.vv-btn-close').addEventListener('click', (e) => {
      e.stopPropagation();
      hideTooltip();
    });

    shadow.querySelector('.vv-btn-save').addEventListener('click', (e) => {
      e.stopPropagation();
      const entry = {
        word,
        reading: reading || '-',
        definition,
        source: data.source || '',
        date,
        sourceLang: data.sourceLang || '',
        sourceLangLabel: data.sourceLangLabel || '',
        ttsLang: data.ttsLang || '',
        ttsSupported: data.ttsSupported !== false,
      };
      console.log('[VV:content] saving entry:', JSON.stringify(entry));
      chrome.runtime.sendMessage({ type: 'SAVE_ENTRY', entry }, (resp) => {
        console.log('[VV:content] save response:', JSON.stringify(resp));
        if (resp && resp.ok) {
          tooltip.innerHTML = `<div class="vv-check">✓ Saved</div>`;
        } else {
          tooltip.innerHTML = `<div class="vv-check" style="color:#ef4444">✕ ${(resp && resp.error) || 'Save failed'}</div>`;
        }
        setTimeout(hideTooltip, 1000);
      });
    });

    positionTooltip(x, y);
    tooltip.classList.add('visible');
    tooltipVisible = true;
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const KANJI_RE = /[一-龯㐀-䶿]/;

  function rubyTag(kanji, rt) {
    return `<ruby>${escHtml(kanji)}<rp>(</rp><rt>${escHtml(rt)}</rt><rp>)</rp></ruby>`;
  }

  function buildFuriganaFromPairs(pairs) {
    return pairs.map(p => {
      if (!p.reading) return escHtml(p.text);
      return rubyTag(p.text, p.reading);
    }).join('');
  }

  function buildFuriganaHtml(word, reading) {
    if (!reading || !word) return escHtml(word);

    const segments = [];
    let i = 0;
    while (i < word.length) {
      if (KANJI_RE.test(word[i])) {
        let j = i;
        while (j < word.length && KANJI_RE.test(word[j])) j++;
        segments.push({ type: 'kanji', text: word.slice(i, j) });
        i = j;
      } else {
        let j = i;
        while (j < word.length && !KANJI_RE.test(word[j])) j++;
        segments.push({ type: 'kana', text: word.slice(i, j) });
        i = j;
      }
    }

    let remainingReading = reading;
    const resolved = [];
    for (let s = 0; s < segments.length; s++) {
      const seg = segments[s];
      if (seg.type === 'kana') {
        const idx = remainingReading.indexOf(seg.text);
        if (idx >= 0) {
          if (idx > 0 && resolved.length > 0 && resolved[resolved.length - 1].type === 'kanji') {
            resolved[resolved.length - 1].reading = remainingReading.slice(0, idx);
          }
          remainingReading = remainingReading.slice(idx + seg.text.length);
        }
        resolved.push({ type: 'kana', text: seg.text });
      } else {
        resolved.push({ type: 'kanji', text: seg.text, reading: '' });
      }
    }
    if (remainingReading) {
      for (let r = resolved.length - 1; r >= 0; r--) {
        if (resolved[r].type === 'kanji' && !resolved[r].reading) {
          resolved[r].reading = remainingReading;
          break;
        }
      }
    }

    return resolved.map(seg => {
      if (seg.type === 'kana') return escHtml(seg.text);
      if (!seg.reading) return escHtml(seg.text);
      return rubyTag(seg.text, seg.reading);
    }).join('');
  }

  function hasVoiceForLang(lang) {
    const synth = window.speechSynthesis;
    if (!synth || !lang) return false;
    const wanted = String(lang).toLowerCase();
    const base = wanted.split('-')[0];
    const voices = synth.getVoices();
    if (!voices.length) return null;
    return voices.some((voice) => {
      const voiceLang = String(voice.lang || '').toLowerCase();
      return voiceLang === wanted || voiceLang.startsWith(wanted + '-') || voiceLang.split('-')[0] === base;
    });
  }

  function inferSpeechLang(text) {
    const sample = String(text || '').trim();
    if (!sample) return '';
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(sample)) return 'ja-JP';
    if (/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(sample)) return 'en-US';
    return '';
  }

  function speak(text, lang, options = {}) {
    if (!window.speechSynthesis) {
      console.warn('[VV:content] speechSynthesis not available');
      return { ok: false, error: 'Speech synthesis not available in this browser.' };
    }

    const effectiveLang = lang || inferSpeechLang(text);
    if (!options.supported || !effectiveLang) {
      return { ok: false, error: `TTS not supported for ${options.sourceLangLabel || 'this language'}.` };
    }

    const voiceAvailability = hasVoiceForLang(effectiveLang);
    if (voiceAvailability === false) {
      return { ok: false, error: `No installed voice for ${options.sourceLangLabel || lang}.` };
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = effectiveLang;
    utterance.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
    return { ok: true };
  }

  // ── Mouseup: detect selection ──────────────────────────────────────────────
  document.addEventListener('mouseup', (e) => {
    const sel = window.getSelection();
    const word = sel ? sel.toString().trim() : '';

    if (word && word.length < 100) {
      console.log('[VV:content] selection:', word);
      lastWord = word;
      lastX = e.clientX;
      lastY = e.clientY;

      // Position button at bottom-right of selection bounding rect
      const range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
      if (range) {
        const rect = range.getBoundingClientRect();
        showBtn(rect.right + 4, rect.bottom + 4);
      } else {
        showBtn(e.clientX + 4, e.clientY + 4);
      }
    } else {
      // Clicked away — hide button if not clicking within shadow DOM
      if (!shadow.contains(e.composedPath()[0])) {
        hideBtn();
      }
    }
  });

  // ── Translate button click ─────────────────────────────────────────────────
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    hideBtn();
    showLoading(lastX, lastY);

    chrome.runtime.sendMessage(
      { type: 'TRANSLATE_WORD', word: lastWord, sourceUrl: location.href },
      (response) => {
        if (chrome.runtime.lastError) {
          showTooltipData({ word: lastWord, definition: 'Error: ' + chrome.runtime.lastError.message, sourceUrl: location.href }, lastX, lastY);
          return;
        }
        if (response && response.ok) {
          console.log('[VV:content] translate result:', JSON.stringify(response.data));
          showTooltipData({ ...response.data, sourceUrl: location.href }, lastX, lastY);
        } else {
          console.error('[VV:content] translate failed:', response);
          showTooltipData({ word: lastWord, definition: (response && response.error) || 'Translation failed.', sourceUrl: location.href }, lastX, lastY);
        }
      }
    );
  });

  // ── Click outside: dismiss ─────────────────────────────────────────────────
  document.addEventListener('mousedown', (e) => {
    const path = e.composedPath();
    const inShadow = path.some(n => n === host || n === btn || n === tooltip);
    if (!inShadow) {
      hideBtn();
      if (tooltipVisible) hideTooltip();
    }
  });

  // ── Scroll: hide button ────────────────────────────────────────────────────
  document.addEventListener('scroll', () => {
    hideBtn();
  }, true);

  // ── Message from background (context menu flow) ───────────────────────────
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'SHOW_TOOLTIP') {
      const data = msg.data || {};
      const x = lastX || window.innerWidth / 2;
      const y = lastY || window.innerHeight / 2;
      showTooltipData({ ...data, sourceUrl: data.sourceUrl || location.href }, x, y);
      sendResponse({ ok: true });
    }
    return false;
  });

})();
