import { DEFAULTS } from '../shared/constants.js';

const SETTINGS_KEY = 'vocabSettings';
const CACHE_KEY = 'vocabCache';
const METADATA_KEY = 'vocabMetadata'; // {word+reading: {date, source}}

export async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(SETTINGS_KEY, (result) => {
      const settings = { ...DEFAULTS, ...(result[SETTINGS_KEY] || {}) };
      console.log('[VV:storage] getSettings:', JSON.stringify(settings));
      resolve(settings);
    });
  });
}

export async function saveSettings(settings) {
  console.log('[VV:storage] saveSettings:', JSON.stringify(settings));
  return new Promise((resolve) => {
    chrome.storage.local.set({ [SETTINGS_KEY]: settings }, resolve);
  });
}

export async function getCachedEntries() {
  return new Promise((resolve) => {
    chrome.storage.local.get(CACHE_KEY, (result) => {
      const entries = result[CACHE_KEY] || [];
      console.log('[VV:storage] getCachedEntries:', entries.length);
      resolve(entries);
    });
  });
}

export async function setCachedEntries(entries) {
  console.log('[VV:storage] setCachedEntries:', entries.length);
  return new Promise((resolve) => {
    chrome.storage.local.set({ [CACHE_KEY]: entries }, resolve);
  });
}

export async function getMetadata() {
  return new Promise((resolve) => {
    chrome.storage.local.get(METADATA_KEY, (result) => {
      resolve(result[METADATA_KEY] || {});
    });
  });
}

export async function setMetadata(metadata) {
  console.log('[VV:storage] setMetadata:', Object.keys(metadata).length);
  return new Promise((resolve) => {
    chrome.storage.local.set({ [METADATA_KEY]: metadata }, resolve);
  });
}

export function getMetadataKey(word, reading) {
  return `${word}|${reading}`;
}
