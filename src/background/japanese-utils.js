const HIRAGANA = /[぀-ゟ]/;
const KATAKANA = /[゠-ヿ]/;
const CJK = /[一-鿿]/;
const ALL_HIRAGANA = /^[぀-ゟ]+$/;

export function isJapanese(text) {
  const result = HIRAGANA.test(text) || KATAKANA.test(text) || CJK.test(text);
  console.log('[VV:jp] isJapanese("' + text + '"):', result);
  return result;
}

export async function fetchReading(word) {
  if (ALL_HIRAGANA.test(word)) {
    console.log('[VV:jp] word is already hiragana:', word);
    return word;
  }

  try {
    const url = `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`;
    console.log('[VV:jp] fetchReading:', url);
    const res = await fetch(url);
    console.log('[VV:jp] Jisho response:', res.status);
    if (!res.ok) return '';
    const data = await res.json();
    const reading = data?.data?.[0]?.japanese?.[0]?.reading ?? '';
    console.log('[VV:jp] reading:', reading);
    return reading;
  } catch (err) {
    console.error('[VV:jp] fetchReading failed:', err.message);
    return '';
  }
}
