const HIRAGANA = /[\u3040-\u309f]/;
const KATAKANA = /[\u30a0-\u30ff]/;
const HANGUL = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/;
const CJK = /[\u4e00-\u9fff]/;
const LATIN = /[A-Za-zÀ-ÖØ-öø-ÿ]/;

const LANGUAGE_PROFILES = {
  ja: { sourceLang: 'JA', ttsLang: 'ja-JP', label: 'Japanese', supportsTts: true },
  en: { sourceLang: 'EN', ttsLang: 'en-US', label: 'English', supportsTts: true },
  zh: { sourceLang: 'ZH', ttsLang: 'zh-CN', label: 'Chinese', supportsTts: true },
  ko: { sourceLang: 'KO', ttsLang: 'ko-KR', label: 'Korean', supportsTts: true },
  de: { sourceLang: 'DE', ttsLang: 'de-DE', label: 'German', supportsTts: true },
  fr: { sourceLang: 'FR', ttsLang: 'fr-FR', label: 'French', supportsTts: true },
  es: { sourceLang: 'ES', ttsLang: 'es-ES', label: 'Spanish', supportsTts: true },
};

export function getLanguageProfile(languageCode) {
  if (!languageCode) return null;
  const base = String(languageCode).toLowerCase().split(/[-_]/)[0];
  return LANGUAGE_PROFILES[base] || null;
}

export function pickDetectedLanguage(result) {
  if (!result?.languages?.length) return '';

  const sorted = [...result.languages]
    .filter((item) => item?.language && item.language !== 'und')
    .sort((a, b) => (b.percentage || 0) - (a.percentage || 0));

  return sorted[0]?.language || '';
}

export function detectLanguageFromTextHeuristic(text) {
  const sample = String(text || '').trim();
  if (!sample) return '';
  if (HIRAGANA.test(sample) || KATAKANA.test(sample)) return 'ja';
  if (HANGUL.test(sample)) return 'ko';
  if (CJK.test(sample)) return 'zh';
  if (LATIN.test(sample)) return 'en';
  return '';
}

export function getLanguageLabel(languageCode) {
  return getLanguageProfile(languageCode)?.label || String(languageCode || 'unknown');
}

export function getSourceTranslationLang(languageCode) {
  return getLanguageProfile(languageCode)?.sourceLang || '';
}

export function getPreferredTtsLang(languageCode) {
  return getLanguageProfile(languageCode)?.ttsLang || '';
}

export function isTtsSupportedLanguage(languageCode) {
  return Boolean(getLanguageProfile(languageCode)?.supportsTts);
}

export function normalizeTtsText(text, languageCode) {
  if (!text) return '';
  const base = String(languageCode || '').toLowerCase().split(/[-_]/)[0];
  if (base === 'zh') {
    return String(text);
  }
  return String(text);
}
