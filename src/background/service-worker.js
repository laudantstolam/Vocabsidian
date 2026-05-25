import { MSG } from '../shared/constants.js';
import { parseEntries, serializeEntry, rewriteSection } from '../shared/markdown-parser.js';
import { getSettings, saveSettings, setCachedEntries, getMetadata, setMetadata, getMetadataKey } from './storage.js';
import { readVocabNote, appendToNote, rewriteNote, testConnection } from './obsidian-api.js';
import { translate } from './translation-api.js';
import { isJapanese, fetchReading } from './japanese-utils.js';

// ── Install: register context menu ──────────────────────────────────────────
console.log('[VV:sw] Service worker loaded');

chrome.runtime.onInstalled.addListener(() => {
  console.log('[VV:sw] onInstalled — creating context menu');
  chrome.contextMenus.create({
    id: 'vocab-translate',
    title: 'Translate & Save to Vault',
    contexts: ['selection'],
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function hostnameFrom(url) {
  try {
    return new URL(url).hostname;
  } catch (_) {
    return url || '';
  }
}

async function translateWord(word, sourceUrl) {
  const settings = await getSettings();
  const japanese = isJapanese(word);

  const [definition, reading] = await Promise.all([
    translate(word, settings.targetLang, settings.deeplApiKey),
    japanese ? fetchReading(word) : Promise.resolve(''),
  ]);

  return {
    word,
    reading: reading || '-',
    definition,
    source: hostnameFrom(sourceUrl),
    date: todayISO(),
  };
}

async function saveEntry(entry) {
  const rawMarkdown = await readVocabNote();
  const entries = parseEntries(rawMarkdown);
  entries.push(entry);
  const newMarkdown = rewriteSection(rawMarkdown, entries);
  await rewriteNote(newMarkdown);
  await setCachedEntries(entries);

  // Store metadata (date, source) separately
  const metadata = await getMetadata();
  const key = getMetadataKey(entry.word, entry.reading);
  metadata[key] = { date: entry.date, source: entry.source };
  await setMetadata(metadata);
}

async function getAllEntries() {
  const rawMarkdown = await readVocabNote();
  const entries = parseEntries(rawMarkdown);
  const metadata = await getMetadata();

  // Attach metadata to entries
  const enriched = entries.map(e => {
    const key = getMetadataKey(e.word, e.reading);
    return { ...e, ...(metadata[key] || {}) };
  });

  await setCachedEntries(enriched);
  return enriched;
}

async function deleteEntry({ word, reading }) {
  const rawMarkdown = await readVocabNote();
  const entries = parseEntries(rawMarkdown).filter(
    (e) => !(e.word === word && e.reading === reading)
  );
  const newMarkdown = rewriteSection(rawMarkdown, entries);
  await rewriteNote(newMarkdown);
  await setCachedEntries(entries);

  // Remove metadata for this entry
  const metadata = await getMetadata();
  const key = getMetadataKey(word, reading);
  delete metadata[key];
  await setMetadata(metadata);
}

async function updateEntry({ oldEntry, newEntry }) {
  const rawMarkdown = await readVocabNote();
  const entries = parseEntries(rawMarkdown).map((e) =>
    e.word === oldEntry.word && e.reading === oldEntry.reading ? newEntry : e
  );
  const newMarkdown = rewriteSection(rawMarkdown, entries);
  await rewriteNote(newMarkdown);
  await setCachedEntries(entries);

  // Update metadata: keep date/source from old entry
  const metadata = await getMetadata();
  const oldKey = getMetadataKey(oldEntry.word, oldEntry.reading);
  const newKey = getMetadataKey(newEntry.word, newEntry.reading);
  const oldMeta = metadata[oldKey] || { date: newEntry.date, source: newEntry.source };
  delete metadata[oldKey];
  metadata[newKey] = oldMeta; // preserve date, update source if provided
  if (newEntry.source) metadata[newKey].source = newEntry.source;
  if (newEntry.date) metadata[newKey].date = newEntry.date;
  await setMetadata(metadata);
}

// ── Message router ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  console.log('[VV:sw] Message received:', msg.type, JSON.stringify(msg).slice(0, 200));
  (async () => {
    try {
      switch (msg.type) {
        case MSG.TRANSLATE_WORD: {
          const result = await translateWord(msg.word, msg.sourceUrl);
          sendResponse({ ok: true, data: result });
          break;
        }
        case MSG.SAVE_ENTRY: {
          await saveEntry(msg.entry);
          sendResponse({ ok: true });
          break;
        }
        case MSG.GET_ALL_ENTRIES: {
          const entries = await getAllEntries();
          sendResponse({ ok: true, data: entries });
          break;
        }
        case MSG.DELETE_ENTRY: {
          await deleteEntry({ word: msg.word, date: msg.date });
          sendResponse({ ok: true });
          break;
        }
        case MSG.UPDATE_ENTRY: {
          await updateEntry({ oldEntry: msg.oldEntry, newEntry: msg.newEntry });
          sendResponse({ ok: true });
          break;
        }
        case MSG.GET_SETTINGS: {
          const settings = await getSettings();
          sendResponse({ ok: true, data: settings });
          break;
        }
        case MSG.SAVE_SETTINGS: {
          await saveSettings(msg.settings);
          sendResponse({ ok: true });
          break;
        }
        case MSG.TEST_CONNECTION: {
          const result = await testConnection();
          sendResponse({ ok: true, data: result });
          break;
        }
        default:
          sendResponse({ ok: false, error: `Unknown message type: ${msg.type}` });
      }
    } catch (err) {
      console.error('[VV:sw] Handler error for', msg.type, ':', err);
      sendResponse({ ok: false, error: err.message || String(err) });
    }
  })();

  // Return true to keep the message channel open for async sendResponse
  return true;
});

// ── Context menu handler ─────────────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'vocab-translate') return;

  const word = info.selectionText?.trim();
  if (!word) return;

  try {
    const data = await translateWord(word, tab.url);
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'SHOW_TOOLTIP', data });
    }
  } catch (err) {
    console.error('[VocabVault] context menu translation failed:', err);
  }
});
