// Pure, dependency-free validators shared by the Contact form (client) and the
// /api/contact route (server). No Node/DOM APIs so it is safe on both sides.

export type ContactFields = { name: string; email: string; phone: string; message: string };
export type ContactErrors = Partial<Record<keyof ContactFields, string>>;

const ERR = {
  name: 'Please enter your full name.\nThe current name appears incomplete or invalid.',
  email: "Please enter a valid email address.\nThis email doesn't look deliverable.",
  phone: "Please enter a valid phone number.\nThis number doesn't look real.",
  message: "Please describe your enquiry in more detail.\nThe current message doesn't appear meaningful.",
};

const KEYBOARD = ['qwerty', 'qwertyuiop', 'asdf', 'asdfgh', 'asdfghjkl', 'zxcv', 'zxcvbn', 'poiuy', 'lkjh', 'mnbv', 'qazwsx', 'wasd'];
const FAKE_LOCAL = new Set(['test', 'fake', 'fakeemail', 'asdf', 'qwerty', 'abc', 'abc123', 'admin', 'example', 'demo', 'sample', 'noreply', 'nomail']);
const VOWEL = new Set(['a', 'e', 'i', 'o', 'u', 'y']);

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
// e.g. abcabc, xyxyxy — a short unit repeated to fill the string.
function patternRepeat(s: string) {
  const l = s.toLowerCase();
  for (let p = 1; p <= 3 && p < l.length; p++) {
    if (l.length % p === 0 && l.slice(0, p).repeat(l.length / p) === l) return true;
  }
  return false;
}
// Longest run of consecutive consonants (y treated as vowel here).
function maxConsonantRun(t: string) {
  let m = 0, c = 0;
  for (const ch of t.toLowerCase()) { if (VOWEL.has(ch)) c = 0; else { c++; if (c > m) m = c; } }
  return m;
}
// Only judges ASCII-Latin tokens; leaves Unicode/accented names alone.
function gibberish(t: string) {
  if (!asciiWord(t)) return false;
  return maxConsonantRun(t) >= 5 || (t.length >= 6 && !hasVowelAZ(t));
}

export function validateName(v: string): string | undefined {
  const s = v.trim();
  if (!/^[\p{L}][\p{L}\s'.-]{1,49}$/u.test(s)) return ERR.name;
  const letters = s.replace(/[^\p{L}]/gu, '');
  if (letters.length < 2) return ERR.name;
  const compact = s.replace(/[\s'.-]/g, '');
  const tokens = s.split(/[\s'.-]+/).filter(Boolean);
  if (repeatedChar(letters) || sequential(compact) || patternRepeat(compact) || KEYBOARD.includes(compact.toLowerCase()))
    return ERR.name;
  if (asciiWord(letters) && !hasVowelAZ(letters)) return ERR.name;
  if (tokens.some(gibberish)) return ERR.name;
  return undefined;
}

export function validateEmail(v: string): string | undefined {
  const s = v.trim();
  const m = /^([^\s@]+)@([^\s@]+)$/.exec(s);
  if (!m) return ERR.email;
  const [, localRaw, domain] = m;
  if (!/^[^.\s]+(\.[^.\s]+)+$/.test(domain) || !/\.[A-Za-z]{2,}$/.test(domain)) return ERR.email;
  const local = localRaw.toLowerCase();
  if (FAKE_LOCAL.has(local)) return ERR.email;
  if (gibberish(local)) return ERR.email;
  // Very short all-consonant local parts (e.g. sxt) are treated as invalid.
  if (asciiWord(local) && local.length >= 3 && !hasVowelAZ(local)) return ERR.email;
  return undefined;
}

export function validatePhone(v: string): string | undefined {
  const s = v.trim();
  const intl = s.startsWith('+');
  const digits = s.replace(/[\s()\-.]/g, '').replace(/^\+/, '');
  if (!/^\d{8,15}$/.test(digits)) return ERR.phone;
  // Bare 10-digit numbers are read as Indian mobiles (must start 6-9).
  if (!intl && digits.length === 10 && !/^[6-9]/.test(digits)) return ERR.phone;
  const step = (k: number) => digits.split('').every((d, i, a) => i === 0 || (+d - +a[i - 1] + 10) % 10 === k);
  if (repeatedChar(digits) || step(1) || step(9)) return ERR.phone;
  for (const p of [1, 2]) {
    const unit = digits.slice(0, p);
    if (unit.repeat(Math.ceil(digits.length / p)).slice(0, digits.length) === digits) return ERR.phone;
  }
  return undefined;
}

export function validateMessage(v: string): string | undefined {
  const s = v.trim();
  const letters = s.replace(/[^A-Za-z]/g, '');
  const words = s.split(/\s+/).filter(Boolean);
  if (s.length < 15 || letters.length < 10 || words.length < 3 || repeatedChar(s.replace(/\s/g, ''))) return ERR.message;
  // Reject keyboard-mash: majority of words are consonant-heavy non-words.
  // (No single-word run>=5 check here — real words like "walkthrough" have one.)
  const aw = words.filter(asciiWord);
  const mashy = aw.filter((w) => maxConsonantRun(w) >= 4).length;
  if (aw.length >= 3 && mashy / aw.length >= 0.5) return ERR.message;
  return undefined;
}

export function validateContact(f: ContactFields): ContactErrors {
  const e: ContactErrors = {};
  const n = validateName(f.name); if (n) e.name = n;
  const em = validateEmail(f.email); if (em) e.email = em;
  const p = validatePhone(f.phone); if (p) e.phone = p;
  const m = validateMessage(f.message); if (m) e.message = m;
  return e;
}
