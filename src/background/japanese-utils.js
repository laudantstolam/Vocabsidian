const HIRAGANA = /[぀-ゟ]/;
const KATAKANA = /[゠-ヿ]/;
const CJK = /[一-鿿]/;
const ALL_HIRAGANA = /^[぀-ゟ]+$/;
const KANJI_RE = /[一-龯㐀-䶿]/;

export function isJapanese(text) {
  const result = HIRAGANA.test(text) || KATAKANA.test(text) || CJK.test(text);
  console.log('[VV:jp] isJapanese("' + text + '"):', result);
  return result;
}

function segmentText(text) {
  const segs = [];
  let i = 0;
  while (i < text.length) {
    if (KANJI_RE.test(text[i])) {
      let j = i;
      while (j < text.length && KANJI_RE.test(text[j])) j++;
      segs.push({ type: 'kanji', text: text.slice(i, j) });
      i = j;
    } else {
      let j = i;
      while (j < text.length && !KANJI_RE.test(text[j])) j++;
      segs.push({ type: 'kana', text: text.slice(i, j) });
      i = j;
    }
  }
  return segs;
}

async function jishoReading(word) {
  try {
    const url = `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`;
    const res = await fetch(url);
    if (!res.ok) return '';
    const data = await res.json();
    return data?.data?.[0]?.japanese?.[0]?.reading ?? '';
  } catch {
    return '';
  }
}

export async function fetchReading(word) {
  if (ALL_HIRAGANA.test(word)) {
    console.log('[VV:jp] already hiragana:', word);
    return word;
  }

  const segs = segmentText(word);
  const kanjiChunks = segs.filter(s => s.type === 'kanji');

  if (kanjiChunks.length === 0) return word;

  const readings = await Promise.all(kanjiChunks.map(s => jishoReading(s.text)));
  const readingMap = {};
  kanjiChunks.forEach((s, i) => { readingMap[s.text] = readings[i]; });

  const combined = segs.map(s => {
    if (s.type === 'kana') return s.text;
    return readingMap[s.text] || s.text;
  }).join('');

  console.log('[VV:jp] reading:', word, '→', combined);
  return combined;
}

export async function fetchReadingPairs(word) {
  if (ALL_HIRAGANA.test(word)) return [{ text: word, reading: '' }];

  const segs = segmentText(word);
  const kanjiChunks = segs.filter(s => s.type === 'kanji');
  if (kanjiChunks.length === 0) return [{ text: word, reading: '' }];

  const readings = await Promise.all(kanjiChunks.map(s => jishoReading(s.text)));
  const readingMap = {};
  kanjiChunks.forEach((s, i) => { readingMap[s.text] = readings[i]; });

  return segs.map(s => ({
    text: s.text,
    reading: s.type === 'kanji' ? (readingMap[s.text] || '') : '',
  }));
}
