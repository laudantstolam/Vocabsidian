import { MSG } from '../shared/constants.js';

// ── Helpers ───────────────────────────────────────────────

function sendMsg(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toISOString().slice(0, 10);
}

function extractDomain(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function isEmptyReading(r) {
  return !r || r.trim() === '' || r.trim() === '-';
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

function speakEntry(entry) {
  if (!window.speechSynthesis) {
    setStatus('Speech synthesis not available in this browser.', 'err');
    return;
  }

  const lang = entry.ttsLang || inferSpeechLang(entry.word || '');
  const label = entry.sourceLangLabel || entry.sourceLang || 'this language';
  if (entry.ttsSupported === false || !lang) {
    setStatus(`TTS not supported for ${label}.`, 'err');
    return;
  }

  const voiceAvailability = hasVoiceForLang(lang);
  if (voiceAvailability === false) {
    setStatus(`No installed voice for ${label}.`, 'err');
    return;
  }

  const utterance = new SpeechSynthesisUtterance(entry.word || '');
  utterance.lang = lang;
  utterance.rate = 0.9;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
  setStatus(`Speaking ${label}.`, 'ok');
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

// ── SVG Icons ─────────────────────────────────────────────

const ICON_PENCIL = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
</svg>`;

const ICON_TRASH = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="3 6 5 6 21 6"></polyline>
  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
  <path d="M10 11v6"></path>
  <path d="M14 11v6"></path>
  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
</svg>`;

const ICON_SPEAK = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
  <path d="M15.54 5.47a9 9 0 0 1 0 12.06"></path>
  <path d="M19.07 4.93a15 15 0 0 1 0 14.14"></path>
</svg>`;

// ── State ─────────────────────────────────────────────────

let allEntries = [];

// ── DOM refs ──────────────────────────────────────────────

const listEl = document.getElementById('entry-list');
const searchEl = document.getElementById('search-input');
const countEl = document.getElementById('entry-count');
const btnRefresh = document.getElementById('btn-refresh');
const btnSettings = document.getElementById('btn-settings');

// ── Rendering ─────────────────────────────────────────────

function updateCount(n) {
  countEl.textContent = `${n} ${n === 1 ? 'entry' : 'entries'}`;
}

function renderEntries(entries) {
  listEl.innerHTML = '';

  if (!entries || entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No entries yet. Highlight text on any page to save vocabulary.';
    listEl.appendChild(empty);
    updateCount(0);
    return;
  }

  entries.forEach((entry) => {
    listEl.appendChild(buildCard(entry));
  });

  updateCount(entries.length);
}

function buildCard(entry) {
  const card = document.createElement('div');
  card.className = 'entry-card';
  card.dataset.id = entry.id;

  card.appendChild(buildCardView(entry));
  return card;
}

function buildCardView(entry) {
  const frag = document.createDocumentFragment();

  // Top row: word + reading
  const top = document.createElement('div');
  top.className = 'entry-card__top';

  const wordEl = document.createElement('span');
  wordEl.className = 'entry-card__word';
  if (entry.readingPairs) {
    wordEl.innerHTML = buildFuriganaFromPairs(entry.readingPairs);
  } else if (!isEmptyReading(entry.reading)) {
    wordEl.innerHTML = buildFuriganaHtml(entry.word || '', entry.reading);
  } else {
    wordEl.textContent = entry.word || '';
  }
  top.appendChild(wordEl);

  frag.appendChild(top);

  // Definition
  const defEl = document.createElement('div');
  defEl.className = 'entry-card__definition';
  defEl.textContent = entry.definition || '';
  frag.appendChild(defEl);

  // Meta row: date · source + action buttons
  const meta = document.createElement('div');
  meta.className = 'entry-card__meta';

  const dateEl = document.createElement('span');
  dateEl.className = 'entry-card__date-source';
  dateEl.textContent = entry.date ? formatDate(entry.date) : '';
  meta.appendChild(dateEl);

  const actions = document.createElement('div');
  actions.className = 'entry-card__actions';

  const speakBtn = document.createElement('button');
  speakBtn.className = 'entry-card__btn entry-card__btn--speak';
  speakBtn.title = 'Speak';
  speakBtn.innerHTML = ICON_SPEAK;
  speakBtn.addEventListener('click', () => speakEntry(entry));

  const editBtn = document.createElement('button');
  editBtn.className = 'entry-card__btn entry-card__btn--edit';
  editBtn.title = 'Edit';
  editBtn.innerHTML = ICON_PENCIL;
  editBtn.addEventListener('click', () => openEditMode(editBtn.closest('.entry-card'), entry));

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'entry-card__btn entry-card__btn--delete';
  deleteBtn.title = 'Delete';
  deleteBtn.innerHTML = ICON_TRASH;
  deleteBtn.addEventListener('click', () => handleDelete(entry));

  actions.appendChild(speakBtn);
  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);
  meta.appendChild(actions);

  frag.appendChild(meta);

  return frag;
}

// ── Edit mode ─────────────────────────────────────────────

function openEditMode(card, entry) {
  card.classList.add('entry-card--editing');
  card.innerHTML = '';
  card.appendChild(buildEditForm(card, entry));
}

function buildEditForm(card, entry) {
  const form = document.createElement('div');
  form.className = 'edit-form';

  const wordInput = document.createElement('input');
  wordInput.className = 'edit-form__input';
  wordInput.type = 'text';
  wordInput.placeholder = 'Word';
  wordInput.value = entry.word || '';

  const row = document.createElement('div');
  row.className = 'edit-form__row';

  const readingInput = document.createElement('input');
  readingInput.className = 'edit-form__input';
  readingInput.type = 'text';
  readingInput.placeholder = 'Reading (optional)';
  readingInput.value = isEmptyReading(entry.reading) ? '' : entry.reading;
  readingInput.style.flex = '1';

  row.appendChild(readingInput);

  const defInput = document.createElement('input');
  defInput.className = 'edit-form__input';
  defInput.type = 'text';
  defInput.placeholder = 'Definition';
  defInput.value = entry.definition || '';

  const actionsRow = document.createElement('div');
  actionsRow.className = 'edit-form__actions';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn--primary';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', async () => {
    const updated = {
      ...entry,
      word: wordInput.value.trim(),
      reading: readingInput.value.trim() || '-',
      definition: defInput.value.trim(),
    };
    try {
      await sendMsg({ type: MSG.UPDATE_ENTRY, oldEntry: { word: entry.word, reading: entry.reading }, newEntry: updated });
      await fetchAndRender();
    } catch (err) {
      console.error('Update failed:', err);
    }
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn--secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    card.classList.remove('entry-card--editing');
    card.innerHTML = '';
    card.appendChild(buildCardView(entry));
  });

  actionsRow.appendChild(saveBtn);
  actionsRow.appendChild(cancelBtn);

  form.appendChild(wordInput);
  form.appendChild(row);
  form.appendChild(defInput);
  form.appendChild(actionsRow);

  return form;
}

// ── Delete ────────────────────────────────────────────────

async function handleDelete(entry) {
  const label = entry.word || 'this entry';
  const confirmed = window.confirm(`Delete ${label}?`);
  if (!confirmed) return;
  try {
    await sendMsg({ type: MSG.DELETE_ENTRY, word: entry.word, reading: entry.reading });
    await fetchAndRender();
  } catch (err) {
    console.error('Delete failed:', err);
  }
}

// ── Data fetching ─────────────────────────────────────────

async function fetchAndRender() {
  try {
    const response = await sendMsg({ type: MSG.GET_ALL_ENTRIES });
    console.log('[VV:popup] entries response:', JSON.stringify(response).slice(0, 200));
    allEntries = response?.data ?? [];
    applySearch();
  } catch (err) {
    console.error('Failed to fetch entries:', err);
    allEntries = [];
    renderEntries([]);
  }
}

function applySearch() {
  const query = searchEl.value.trim().toLowerCase();
  if (!query) {
    renderEntries(allEntries);
    return;
  }
  const filtered = allEntries.filter((e) => {
    return (
      (e.word && e.word.toLowerCase().includes(query)) ||
      (e.reading && e.reading.toLowerCase().includes(query)) ||
      (e.definition && e.definition.toLowerCase().includes(query))
    );
  });
  renderEntries(filtered);
  // Show total in count with filter note
  countEl.textContent = `${filtered.length} of ${allEntries.length} entries`;
}

// ── Event listeners ───────────────────────────────────────

searchEl.addEventListener('input', applySearch);

btnRefresh.addEventListener('click', fetchAndRender);

btnSettings.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// ── Connection check ─────────────────────────────────────

const statusEl = document.getElementById('connection-status');

let statusResetTimer = null;

function setStatus(text, className) {
  statusEl.textContent = text;
  statusEl.className = `footer__status ${className}`;
  if (statusResetTimer) clearTimeout(statusResetTimer);
  statusResetTimer = setTimeout(() => {
    checkConnection();
  }, 2000);
}

async function checkConnection() {
  try {
    const result = await sendMsg({ type: MSG.TEST_CONNECTION });
    console.log('[VV:popup] connection check:', JSON.stringify(result));
    if (result?.ok && result?.data?.ok) {
      statusEl.textContent = 'Obsidian connected';
      statusEl.className = 'footer__status ok';
    } else {
      statusEl.textContent = 'Obsidian disconnected';
      statusEl.className = 'footer__status err';
    }
  } catch (e) {
    statusEl.textContent = 'Obsidian disconnected';
    statusEl.className = 'footer__status err';
  }
}

// ── Init ──────────────────────────────────────────────────

fetchAndRender();
checkConnection();
