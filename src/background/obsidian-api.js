import { getSettings } from './storage.js';
import { parseEntries } from '../shared/markdown-parser.js';

function buildUrl(port, vaultNotePath) {
  const encodedPath = vaultNotePath
    .split('/')
    .map(encodeURIComponent)
    .join('/');
  return `http://localhost:${port}/vault/${encodedPath}`;
}

export async function readVocabNote() {
  const { obsidianPort, obsidianApiKey, vaultNotePath } = await getSettings();
  const url = buildUrl(obsidianPort, vaultNotePath);
  console.log('[VV:obsidian] READ', url);
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${obsidianApiKey}`,
        Accept: 'text/markdown',
      },
    });
    console.log('[VV:obsidian] READ response:', res.status, res.statusText);
    if (res.status === 404) return '';
    if (!res.ok) {
      const body = await res.text();
      console.error('[VV:obsidian] READ error body:', body);
      throw new Error(`HTTP ${res.status}: ${body}`);
    }
    const text = await res.text();
    console.log('[VV:obsidian] READ got', text.length, 'chars');
    return text;
  } catch (err) {
    console.error('[VV:obsidian] READ failed:', err);
    if (err.message && err.message.includes('404')) return '';
    throw err;
  }
}

export async function appendToNote(content) {
  const { obsidianPort, obsidianApiKey, vaultNotePath } = await getSettings();
  const url = buildUrl(obsidianPort, vaultNotePath);
  console.log('[VV:obsidian] POST (append)', url, 'body:', content.slice(0, 100));
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${obsidianApiKey}`,
      'Content-Type': 'text/markdown',
    },
    body: content,
  });
  console.log('[VV:obsidian] POST response:', res.status, res.statusText);
  if (!res.ok) {
    const body = await res.text();
    console.error('[VV:obsidian] POST error body:', body);
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
}

export async function rewriteNote(fullMarkdown) {
  const { obsidianPort, obsidianApiKey, vaultNotePath } = await getSettings();
  const url = buildUrl(obsidianPort, vaultNotePath);
  console.log('[VV:obsidian] PUT (rewrite)', url, 'body length:', fullMarkdown.length);
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${obsidianApiKey}`,
      'Content-Type': 'text/markdown',
    },
    body: fullMarkdown,
  });
  console.log('[VV:obsidian] PUT response:', res.status, res.statusText);
  if (!res.ok) {
    const body = await res.text();
    console.error('[VV:obsidian] PUT error body:', body);
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
}

export async function testConnection() {
  console.log('[VV:obsidian] testConnection starting...');
  try {
    const markdown = await readVocabNote();
    const entries = parseEntries(markdown);
    console.log('[VV:obsidian] testConnection OK, entries:', entries.length);
    return { ok: true, entryCount: entries.length };
  } catch (err) {
    console.error('[VV:obsidian] testConnection FAILED:', err);
    return { ok: false, error: err.message || String(err) };
  }
}
