/**
 * Client-safe CSRF constants.
 *
 * Kept separate from mutation-guard.ts so a browser component can reference the
 * header name without pulling Node's crypto module into the client bundle.
 */
export const CSRF_COOKIE = "neer.csrf"
export const CSRF_HEADER = "x-neer-csrf"
