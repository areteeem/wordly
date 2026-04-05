// Translation service with Google Translate primary + MyMemory fallback

interface TranslationResult {
  translation: string
  detectedLang?: string
  source: 'google' | 'mymemory' | 'none'
}

// Translation cache to avoid repeated API calls
const translationCache = new Map<string, TranslationResult>()

function cacheKey(word: string, from: string, to: string) {
  return `${from}:${to}:${word.toLowerCase().trim()}`
}

async function googleTranslate(
  word: string,
  sourceLang: string,
  targetLang: string,
): Promise<TranslationResult | null> {
  try {
    const sl = sourceLang === 'auto' ? 'auto' : sourceLang
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${targetLang}&dt=t&q=${encodeURIComponent(word)}`
    const res = await fetch(url)
    if (!res.ok) return null

    const data = await res.json()
    const translated = data?.[0]?.[0]?.[0]
    const detected = data?.[2] || undefined

    if (!translated || translated.toLowerCase() === word.toLowerCase()) {
      return null
    }

    return { translation: translated, detectedLang: detected, source: 'google' }
  } catch {
    return null
  }
}

async function myMemoryTranslate(
  word: string,
  sourceLang: string,
  targetLang: string,
): Promise<TranslationResult | null> {
  try {
    const langPair =
      sourceLang === 'auto'
        ? `autodetect|${targetLang}`
        : `${sourceLang}|${targetLang}`

    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=${encodeURIComponent(langPair)}`
    const res = await fetch(url)
    if (!res.ok) return null

    const data = await res.json()
    const translated = data?.responseData?.translatedText

    if (!translated || translated.toLowerCase() === word.toLowerCase()) {
      return null
    }

    return {
      translation: translated,
      detectedLang: data?.responseData?.detectedLanguage || undefined,
      source: 'mymemory',
    }
  } catch {
    return null
  }
}

export async function translateWord(
  word: string,
  sourceLang = 'auto',
  targetLang = 'en',
): Promise<TranslationResult> {
  const key = cacheKey(word, sourceLang, targetLang)
  const cached = translationCache.get(key)
  if (cached) return cached

  // Try Google first, then MyMemory fallback
  const googleResult = await googleTranslate(word, sourceLang, targetLang)
  if (googleResult) {
    translationCache.set(key, googleResult)
    return googleResult
  }

  const mmResult = await myMemoryTranslate(word, sourceLang, targetLang)
  if (mmResult) {
    translationCache.set(key, mmResult)
    return mmResult
  }

  const empty: TranslationResult = { translation: '', source: 'none' }
  return empty
}
