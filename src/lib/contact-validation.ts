// Deterministic quality-scoring engine shared by the Contact form (client) and
// the /api/contact route (server). Pure — no Node/DOM APIs, safe on both sides.
// Each field scores 0..1; below PASS_THRESHOLD it fails with a machine-readable
// reason and a polite user-facing message.

export type ContactFields = { name: string; email: string; phone: string; message: string };
export type ContactErrors = Partial<Record<keyof ContactFields, string>>;
export type FieldScore = { score: number; reason: string; message?: string };
export type ContactScores = Record<keyof ContactFields, FieldScore>;

export const PASS_THRESHOLD = 0.5;

const MSG = {
  name: 'Please enter your full name.\nThe current name appears incomplete or invalid.',
  email: "Please enter a valid email address.\nThis email doesn't look deliverable.",
  phone: "Please enter a valid phone number.\nThis number doesn't look real.",
  message: "Please describe your enquiry in natural language.\nThe current message appears to contain random text.",
};

const KEYBOARD = ['qwerty', 'qwertyuiop', 'asdf', 'asdfgh', 'asdfghjkl', 'zxcv', 'zxcvbn', 'poiuy', 'lkjh', 'mnbv', 'qazwsx', 'wasd'];
const FAKE_LOCAL = new Set(['test', 'fake', 'fakeemail', 'asdf', 'qwerty', 'abc', 'abc123', 'admin', 'example', 'demo', 'sample', 'noreply', 'nomail']);
// Configurable disposable-domain list (extend via code review, no network calls).
const DISPOSABLE_DOMAINS = new Set(['mailinator.com', 'guerrillamail.com', 'tempmail.com', 'temp-mail.org', '10minutemail.com', 'yopmail.com', 'trashmail.com', 'sharklasers.com', 'getnada.com', 'dispostable.com']);
const VOWEL = new Set(['a', 'e', 'i', 'o', 'u', 'y']);

// Keyboard-row fragments (3+ keys) for short local parts / domain bases.
const KEY_FRAGMENTS = new Set(['qwe', 'wer', 'ert', 'rty', 'tyu', 'yui', 'uio', 'iop', 'asd', 'sdf', 'dfg', 'fgh', 'ghj', 'hjk', 'jkl', 'zxc', 'xcv', 'cvb', 'vbn', 'bnm']);
// Bigrams that are (near-)impossible in Latin-script names. Known tradeoff:
// rare real names containing them (e.g. "Majd") are rejected — documented.
const RARE_BIGRAMS = /jd|jk|jq|jx|jz|qd|qk|qx|qz|vq|wq|xj|xq|zx|xv|fq|pq|bq|gq|hq|kq|mq|nq/;
// Common function words — natural-language messages virtually always contain some.
const FUNCTION_WORDS = new Set(['the', 'a', 'an', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'is', 'are', 'am', 'be', 'we', 'i', 'you', 'it', 'my', 'our', 'your', 'me', 'us', 'this', 'that', 'with', 'about', 'please', 'would', 'like', 'want', 'need', 'can', 'could', 'have', 'has', 'do', 'does', 'will', 'more', 'info', 'information', 'demo', 'help', 'hi', 'hello', 'thanks', 'thank']);

const repeatedChar = (s: string) => /^(.)\1+$/.test(s);
const asciiWord = (t: string) => /^[a-z]+$/i.test(t);
const hasVowelAZ = (t: string) => /[aeiou]/i.test(t);

function sequential(s: string) {
  const l = s.toLowerCase();
  if (l.length < 3) return false;
  let asc = true, desc = true;
  for (let i = 1; i < l.length; i++) {
    const d = l.charCodeAt(i) - l.charCodeAt(i - 1);
    if (d !== 1) asc = false;
    if (d !== -1) desc = false;
  }
  return asc || desc;
}
// e.g. abcabc, xyxyxy — short unit repeated to fill the string.
function patternRepeat(s: string) {
  const l = s.toLowerCase();
  for (let p = 1; p <= 3 && p < l.length; p++) {
    if (l.length % p === 0 && l.slice(0, p).repeat(l.length / p) === l) return true;
  }
  return false;
}
function maxConsonantRun(t: string) {
  let m = 0, c = 0;
  for (const ch of t.toLowerCase()) { if (VOWEL.has(ch)) c = 0; else { c++; if (c > m) m = c; } }
  return m;
}
// Shannon-style: distinct-char ratio too low => unrealistic (aaabbb, kkkkk).
function charDiversity(t: string) {
  const l = t.toLowerCase().replace(/[^a-z]/g, '');
  return l.length ? new Set(l).size / l.length : 1;
}
// Only judges ASCII-Latin tokens; Unicode/accented names bypass (never reject
// legitimate international names on heuristics tuned for English keyboards).
function gibberish(t: string) {
  if (!asciiWord(t)) return false;
  return maxConsonantRun(t) >= 5 || (t.length >= 6 && !hasVowelAZ(t));
}

function scoreName(v: string): FieldScore {
  const s = v.trim();
  const fail = (reason: string, score = 0.2): FieldScore => ({ score, reason, message: MSG.name });
  if (!/^[\p{L}][\p{L}\s'.-]{1,49}$/u.test(s)) return fail('format');
  const letters = s.replace(/[^\p{L}]/gu, '');
  if (letters.length < 2) return fail('too_short');
  const compact = s.replace(/[\s'.-]/g, '');
  if (repeatedChar(letters)) return fail('repeated_chars');
  if (sequential(compact)) return fail('sequential');
  if (patternRepeat(compact)) return fail('repeated_syllables');
  if (KEYBOARD.includes(compact.toLowerCase())) return fail('keyboard_walk');
  if (asciiWord(letters) && !hasVowelAZ(letters)) return fail('no_vowels');
  if (s.split(/[\s'.-]+/).filter(Boolean).some(gibberish)) return fail('gibberish_token');
  if (charDiversity(compact) < 0.3 && compact.length >= 5) return fail('low_entropy', 0.35);
  if (asciiWord(compact) && RARE_BIGRAMS.test(compact.toLowerCase())) return fail('implausible_bigram', 0.3);
  return { score: 1, reason: 'ok' };
}

function scoreEmail(v: string): FieldScore {
  const s = v.trim();
  const fail = (reason: string, score = 0.2): FieldScore => ({ score, reason, message: MSG.email });
  const m = /^([^\s@]+)@([^\s@]+)$/.exec(s);
  if (!m) return fail('syntax');
  const [, localRaw, domain] = m;
  if (!/^[^.\s]+(\.[^.\s]+)+$/.test(domain) || !/\.[A-Za-z]{2,}$/.test(domain)) return fail('domain_format');
  if (DISPOSABLE_DOMAINS.has(domain.toLowerCase())) return fail('disposable_domain');
  const local = localRaw.toLowerCase();
  const domainBase = domain.split('.')[0].toLowerCase();
  if (FAKE_LOCAL.has(local)) return fail('placeholder_local');
  if (gibberish(local)) return fail('gibberish_local');
  if (asciiWord(local) && local.length >= 3 && !hasVowelAZ(local)) return fail('no_vowel_local');
  // Short keyboard-row fragments as local or domain base (asd@xcv.com).
  if (local.length <= 4 && KEY_FRAGMENTS.has(local)) return fail('keyboard_local');
  if (domainBase.length <= 4 && KEY_FRAGMENTS.has(domainBase)) return fail('keyboard_domain');
  return { score: 1, reason: 'ok' };
}

function scorePhone(v: string): FieldScore {
  const s = v.trim();
  const fail = (reason: string, score = 0.2): FieldScore => ({ score, reason, message: MSG.phone });
  const intl = s.startsWith('+');
  const digits = s.replace(/[\s()\-.]/g, '').replace(/^\+/, '');
  if (!/^\d{8,15}$/.test(digits)) return fail('impossible_length');
  // Without '+', only plausible domestic shapes: 8-10 digits, 11 starting 0,
  // or 12 starting 91. Longer international numbers must use '+'.
  if (!intl) {
    if (digits.length > 12) return fail('impossible_length');
    if (digits.length === 11 && !digits.startsWith('0')) return fail('impossible_length');
    if (digits.length === 12 && !digits.startsWith('91')) return fail('impossible_length');
    if (digits.length === 10 && !/^[6-9]/.test(digits)) return fail('invalid_prefix');
  }
  const step = (k: number) => digits.split('').every((d, i, a) => i === 0 || (+d - +a[i - 1] + 10) % 10 === k);
  if (repeatedChar(digits)) return fail('repeated_digits');
  if (step(1) || step(9)) return fail('sequential_digits');
  for (const p of [1, 2]) {
    const unit = digits.slice(0, p);
    if (unit.repeat(Math.ceil(digits.length / p)).slice(0, digits.length) === digits) return fail('alternating_pattern');
  }
  return { score: 1, reason: 'ok' };
}

function scoreMessage(v: string): FieldScore {
  const s = v.trim();
  const fail = (reason: string, score = 0.2): FieldScore => ({ score, reason, message: MSG.message });
  const letters = s.replace(/[^A-Za-z]/g, '');
  const words = s.split(/\s+/).filter(Boolean);
  if (s.length < 15 || letters.length < 10 || words.length < 3) return fail('too_short');
  if (repeatedChar(s.replace(/\s/g, ''))) return fail('repeated_chars');
  if (/[^\p{L}\p{N}\s]{4,}/u.test(s)) return fail('punctuation_spam');
  // Repeated tokens: any word appearing in >40% of a 5+ word message.
  if (words.length >= 5) {
    const counts = new Map<string, number>();
    for (const w of words) counts.set(w.toLowerCase(), (counts.get(w.toLowerCase()) || 0) + 1);
    if (Math.max(...counts.values()) / words.length > 0.4) return fail('repeated_tokens');
  }
  // Keyboard-mash: majority of ASCII words are consonant-heavy non-words.
  // (No single-word run>=5 check — real words like "walkthrough" have one.)
  const tokens = words.map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const aw = tokens.filter((t) => /^[a-z]+$/.test(t));
  const mashy = aw.filter((w) => maxConsonantRun(w) >= 4).length;
  if (aw.length >= 3 && mashy / aw.length >= 0.5) return fail('gibberish');
  // Letters+digits fused mid-word (scivnvhe9hwv) is a strong mash signal.
  if (tokens.some((t) => /[a-z]\d+[a-z]/.test(t))) return fail('gibberish', 0.3);
  // Natural language contains function words; 5+ words with none => random text.
  if (words.length >= 5 && !aw.some((w) => FUNCTION_WORDS.has(w))) return fail('no_natural_language', 0.3);
  return { score: 1, reason: 'ok' };
}

export function scoreContact(f: ContactFields): ContactScores {
  const s: ContactScores = { name: scoreName(f.name), email: scoreEmail(f.email), phone: scorePhone(f.phone), message: scoreMessage(f.message) };
  // Composite distrust: 2+ failing fields marks the whole submission as spam;
  // fields that passed individually are no longer trusted (a plausible-looking
  // name beside a fake email, fake phone and gibberish is not a real name).
  const keys = Object.keys(s) as (keyof ContactFields)[];
  if (keys.filter((k) => s[k].score < PASS_THRESHOLD).length >= 2) {
    for (const k of keys) {
      if (s[k].score >= PASS_THRESHOLD) s[k] = { score: 0.4, reason: 'composite_distrust', message: MSG[k] };
    }
  }
  return s;
}

// Back-compat string API used by the client form.
export function validateName(v: string) { const r = scoreName(v); return r.score < PASS_THRESHOLD ? r.message : undefined; }
export function validateEmail(v: string) { const r = scoreEmail(v); return r.score < PASS_THRESHOLD ? r.message : undefined; }
export function validatePhone(v: string) { const r = scorePhone(v); return r.score < PASS_THRESHOLD ? r.message : undefined; }
export function validateMessage(v: string) { const r = scoreMessage(v); return r.score < PASS_THRESHOLD ? r.message : undefined; }

export function validateContact(f: ContactFields): ContactErrors {
  const e: ContactErrors = {};
  const scores = scoreContact(f);
  (Object.keys(scores) as (keyof ContactFields)[]).forEach((k) => {
    if (scores[k].score < PASS_THRESHOLD) e[k] = scores[k].message;
  });
  return e;
}
