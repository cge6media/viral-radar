/**
 * Cheap language guess for titles/descriptions — script detection first, then stop-word voting for Latin-script
 * text. Used only to filter and label (the creator's stated interest is English + Spanish); never to rank.
 * Returns an ISO-639-1 code, 'latin' (Latin script, language unclear) or 'other'.
 */
const SCRIPTS: [RegExp, string][] = [
  [/[ऀ-ॿ]/, 'hi'], // Devanagari (Hindi/Marathi)
  [/[ঀ-৿]/, 'bn'], // Bengali
  [/[਀-੿]/, 'pa'], // Gurmukhi
  [/[઀-૿]/, 'gu'], // Gujarati
  [/[஀-௿]/, 'ta'], // Tamil
  [/[ఀ-౿]/, 'te'], // Telugu
  [/[ಀ-೿]/, 'kn'], // Kannada
  [/[ഀ-ൿ]/, 'ml'], // Malayalam
  [/[؀-ۿ]/, 'ar'], // Arabic (also Urdu/Persian)
  [/[֐-׿]/, 'he'],
  [/[฀-๿]/, 'th'],
  [/[가-힯ᄀ-ᇿ]/, 'ko'],
  [/[぀-ヿ]/, 'ja'], // kana
  [/[一-鿿]/, 'zh'], // CJK ideographs without kana → Chinese
  [/[Ѐ-ӿ]/, 'ru'], // Cyrillic
  [/[Ͱ-Ͽ]/, 'el'],
];

export const STOP: Record<string, string[]> = {
  en: ['the', 'and', 'you', 'this', 'that', 'with', 'for', 'when', 'what', 'how', 'why', 'your', 'from', 'have', 'just', 'like', 'into', 'are', 'was', 'not', 'but', 'his', 'her', 'they', 'who', 'does', 'did', 'can', 'will', 'got', 'gets', 'try', 'tries', 'new', 'out', 'me', 'my', 'is', 'it', 'of', 'to', 'in', 'on', 'at', 'be', 'we', 'he', 'she', 'so', 'do'],
  es: ['el', 'la', 'los', 'las', 'de', 'del', 'que', 'por', 'para', 'con', 'una', 'uno', 'es', 'se', 'su', 'sus', 'como', 'más', 'pero', 'este', 'esta', 'esto', 'cuando', 'hay', 'muy', 'todo', 'nada', 'mi', 'tu', 'yo', 'lo', 'le', 'al', 'un', 'en', 'y', 'o', 'si', 'no', 'qué', 'cómo', 'está', 'son', 'ver', 'así'],
  pt: ['o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'que', 'por', 'para', 'com', 'uma', 'um', 'é', 'se', 'seu', 'sua', 'como', 'mais', 'mas', 'este', 'esta', 'isso', 'quando', 'tem', 'muito', 'tudo', 'não', 'meu', 'minha', 'você', 'ele', 'ela', 'em', 'e', 'ou', 'eu', 'vai', 'foi', 'está', 'são', 'ver'],
  fr: ['le', 'la', 'les', 'de', 'des', 'du', 'que', 'qui', 'pour', 'avec', 'une', 'un', 'est', 'se', 'son', 'sa', 'ses', 'comme', 'plus', 'mais', 'ce', 'cette', 'quand', 'il', 'elle', 'très', 'tout', 'pas', 'mon', 'ma', 'je', 'tu', 'vous', 'nous', 'en', 'et', 'ou', 'au', 'aux', 'sur', 'dans', 'toi', 'moi', 'abonne', 'abonnez', 'votre', 'notre', 'ça', 'où', 'pourquoi', 'jamais', 'toujours', "c'est", "j'ai", "n'est", "d'un", "d'une", 'être', 'avoir', 'fait', 'faire', 'suis', 'sont', 'ont', 'voici', 'voilà', 'trop', 'vraiment', 'chez', 'mes', 'tes', 'nos', 'vos', 'leur', 'leurs', 'cet', 'ceux', 'celle', 'celui'],
  de: ['der', 'die', 'das', 'und', 'ist', 'ich', 'nicht', 'mit', 'für', 'auf', 'ein', 'eine', 'wenn', 'wie', 'was', 'wir', 'ihr', 'sie', 'er', 'es', 'zu', 'im', 'den', 'dem', 'des', 'von', 'auch', 'noch', 'nur', 'aber', 'mein', 'dein', 'sich', 'bei', 'nach', 'aus'],
  // Indonesian and Malay share most function words; Malay-only tokens are added so Malay titles stop reading as "latin"
  id: ['yang', 'dan', 'di', 'ini', 'itu', 'dengan', 'untuk', 'tidak', 'dari', 'ke', 'ada', 'saya', 'aku', 'kamu', 'dia', 'kita', 'mereka', 'bisa', 'akan', 'sudah', 'juga', 'lagi', 'banget', 'gak', 'nggak', 'apa', 'siapa', 'kenapa', 'bagaimana', 'jadi', 'orang', 'hari', 'saat', 'viral', 'lucu', 'awak', 'kami', 'adalah', 'boleh', 'tak', 'nak', 'dah', 'pada', 'macam', 'korang', 'bila', 'mana', 'sangat', 'tengok', 'buat', 'jom', 'lah', 'musim', 'penuh', 'episod', 'kepiting', 'ketam', 'kisah', 'cerita', 'sahabat', 'ulang', 'tahun', 'selamat'],
  tl: ['ang', 'ng', 'sa', 'mga', 'na', 'ay', 'ko', 'mo', 'siya', 'ako', 'ikaw', 'kami', 'kayo', 'sila', 'ito', 'iyan', 'hindi', 'kung', 'para', 'pero', 'lang', 'ba', 'yung', 'naman', 'po', 'kasi', 'talaga', 'grabe'],
  vi: ['và', 'của', 'là', 'có', 'không', 'được', 'cho', 'này', 'với', 'một', 'những', 'người', 'khi', 'đã', 'trong', 'như', 'thì', 'tôi', 'bạn', 'anh', 'em', 'quá', 'rất', 'nhất', 'đi', 'về'],
  tr: ['ve', 'bir', 'bu', 'da', 'de', 'ile', 'için', 'ama', 'çok', 'gibi', 'daha', 'ben', 'sen', 'biz', 'siz', 'onlar', 'ne', 'nasıl', 'neden', 'var', 'yok', 'mi', 'mı', 'mu', 'mü', 'değil'],
  it: ['il', 'lo', 'la', 'gli', 'le', 'di', 'che', 'per', 'con', 'una', 'uno', 'è', 'si', 'suo', 'sua', 'come', 'più', 'ma', 'questo', 'questa', 'quando', 'non', 'mio', 'mia', 'io', 'tu', 'noi', 'voi', 'sono', 'del', 'della', 'nel', 'nella', 'anche', 'molto'],
  // 4.0.1: romanised Hindi/Urdu ("Diwali ki raat do logon ki parchhaiyan kaise bani") was passing as English or "latin";
  // only tokens that do not collide with the other lists are used
  hi: ['hai', 'hain', 'nahi', 'nhi', 'nahin', 'kya', 'kyu', 'kyun', 'kaise', 'kaisa', 'kaun', 'kahan', 'aur', 'bhi', 'toh', 'yeh', 'woh', 'mera', 'meri', 'mere', 'tera', 'teri', 'tere', 'uska', 'uski', 'apna', 'apni', 'apne', 'hum', 'tum', 'aap', 'mujhe', 'tujhe', 'maine', 'kar', 'karo', 'karna', 'kiya', 'raha', 'rahi', 'rahe', 'gaya', 'gayi', 'diya', 'liya', 'hoga', 'hogi', 'tha', 'thi', 'hua', 'hui', 'wala', 'wali', 'wale', 'sab', 'sabse', 'bahut', 'bohot', 'kuch', 'koi', 'jab', 'tab', 'phir', 'abhi', 'kal', 'aaj', 'din', 'raat', 'log', 'logon', 'bhai', 'didi', 'mummy', 'papa', 'pyaar', 'pyar', 'dil', 'zindagi', 'duniya', 'ghar', 'paisa', 'paise', 'lagta', 'lagti', 'dekho', 'dekh', 'kyunki', 'agar', 'lekin', 'magar', 'chahiye', 'sakta', 'sakti', 'matlab', 'bilkul', 'sach', 'yaar', 'bhaiya', 'ji', 'ka', 'ki', 'mein', 'hoon', 'achha', 'accha', 'bada', 'badi', 'naya', 'nayi', 'ek', 'kitna', 'kitne', 'jaise', 'aise', 'jo', 'wo', 'kaha', 'rupaye', 'lakh', 'crore', 'kaam', 'baat', 'baar', 'bana', 'banaya', 'banao', 'bani', 'bni', 'khana', 'pani', 'gaadi', 'shaadi', 'ladki', 'ladka', 'bache', 'bachon', 'wahi', 'yahan', 'wahan', 'kahani', 'sapna', 'mast', 'mat', 'jao', 'aao', 'chalo', 'dekhiye', 'dekhe', 'dekha', 'suno', 'bolo', 'bola', 'boli', 'khud', 'sath', 'saath', 'bina', 'liye', 'tak', 'par', 'pe', 'puri', 'pura', 'poora', 'poori', 'sabko', 'sabka', 'unki', 'inki', 'humne', 'tumne', 'usko', 'isko', 'kisi', 'kisne', 'hamare', 'tumhare', 'aapke', 'aapka', 'aapki', 'waala', 'waali', 'karwa', 'chauth', 'navratri', 'dussehra', 'dhanteras', 'chhath', 'ganpati', 'bappa', 'dosto', 'doston', 'bhabhi', 'chacha', 'mausi', 'nani', 'dadi', 'dada', 'nana'],
};

/** stop-word in any supported language (used to recognise title fragments like "siapa yang", "por que") */
const ALL_STOP = new Set(Object.values(STOP).flat());
export function isAnyStopword(tok: string): boolean { return ALL_STOP.has(tok.toLowerCase()); }

export function detectLanguage(text: string, platformHint?: string): string {
  const hint = (platformHint || '').toLowerCase().slice(0, 2);
  if (hint && /^[a-z]{2}$/.test(hint)) return hint;
  const t = text || '';
  const letters = t.replace(/[^\p{L}]/gu, '');
  if (!letters.length) return 'other';
  for (const [re, code] of SCRIPTS) {
    const n = (t.match(new RegExp(re.source, 'gu')) || []).length;
    if (n >= 3 || n / letters.length >= 0.3) return code;
  }
  const tokens = t.toLowerCase().replace(/#\w+/g, ' ').split(/[^\p{L}']+/u).filter(Boolean);
  if (!tokens.length) return 'other';
  const scores = new Map<string, number>();
  for (const [lang, words] of Object.entries(STOP)) {
    const set = new Set(words);
    let s = 0;
    for (const tok of tokens) if (set.has(tok)) s++;
    if (s) scores.set(lang, s);
  }
  if (!scores.size) return 'latin';
  const best = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
  // need at least two hits, or one hit in a very short title, and a margin over the runner-up
  const [lang, n] = best[0];
  const second = best[1]?.[1] || 0;
  if (n >= 2 && n > second) return lang;
  if (n === 1 && tokens.length <= 4 && second === 0) return lang;
  return 'latin';
}

export const LANGUAGE_NAME: Record<string, string> = {
  en: 'English', es: 'Spanish', pt: 'Portuguese', fr: 'French', de: 'German', it: 'Italian', id: 'Indonesian', tl: 'Filipino', vi: 'Vietnamese', tr: 'Turkish',
  hi: 'Hindi', bn: 'Bengali', pa: 'Punjabi', gu: 'Gujarati', ta: 'Tamil', te: 'Telugu', kn: 'Kannada', ml: 'Malayalam', ar: 'Arabic', he: 'Hebrew', th: 'Thai', ko: 'Korean', ja: 'Japanese', zh: 'Chinese', ru: 'Russian', el: 'Greek',
  latin: 'Latin script (unclear)', other: 'Other',
};
