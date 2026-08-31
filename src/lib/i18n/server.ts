import { en } from "./en"
import { hi } from "./hi"
import { ta } from "./ta"
import type { Locale } from "./types"

// Server-side access to the shared i18n dictionaries. Server components and
// route handlers cannot use the client useLanguage() hook, so they read the
// same dictionaries directly, keyed by the neer_lang cookie value.
const DICT: Record<Locale, Record<string, string>> = { en, hi, ta }

export function normalizeLocale(v: string | undefined | null): Locale {
  return v === "hi" || v === "ta" ? v : "en"
}

export function serverT(locale: Locale): (key: string) => string {
  const dict = DICT[locale] ?? en
  return (key: string) => dict[key] ?? en[key] ?? key
}
