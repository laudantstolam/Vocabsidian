export async function translate(word, sourceLang, targetLang, deeplApiKey) {
  console.log('[VV:translate]', sourceLang || 'auto', word, '→', targetLang, 'key:', deeplApiKey ? 'present' : 'MISSING');

  const normalizedSourceLang = sourceLang || undefined;

  try {
    if (deeplApiKey) {
      console.log('[VV:translate] Trying DeepL...');
      const res = await fetch('https://api-free.deepl.com/v2/translate', {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${deeplApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: [word],
          target_lang: targetLang,
          ...(normalizedSourceLang ? { source_lang: normalizedSourceLang } : {}),
        }),
      });
      console.log('[VV:translate] DeepL response:', res.status);
      if (!res.ok) {
        const body = await res.text();
        console.error('[VV:translate] DeepL error:', body);
        throw new Error(`DeepL HTTP ${res.status}: ${body}`);
      }
      const data = await res.json();
      console.log('[VV:translate] DeepL result:', data.translations[0].text);
      return data.translations[0].text;
    }
  } catch (err) {
    console.warn('[VV:translate] DeepL failed, falling back to MyMemory:', err.message);
  }

  try {
    console.log('[VV:translate] Trying MyMemory...');
    const source = normalizedSourceLang || 'en';
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=${encodeURIComponent(source)}|${encodeURIComponent(targetLang)}`;
    const res = await fetch(url);
    console.log('[VV:translate] MyMemory response:', res.status);
    if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
    const data = await res.json();
    console.log('[VV:translate] MyMemory result:', data.responseData.translatedText);
    return data.responseData.translatedText;
  } catch (err) {
    console.error('[VV:translate] All translation failed:', err.message);
    return '[translation unavailable]';
  }
}
