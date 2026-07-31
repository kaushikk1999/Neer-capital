import { CSRF_HEADER } from "@/lib/security/csrf-constants"

// Client-side CSRF helper for admin mutations. Fetches a session-bound token
// from the double-submit endpoint and returns headers to attach. Kept in one
// place so every admin write goes through the same path. No token is logged or
// placed in a URL.

export async function getCsrfToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/admin/csrf", { credentials: "same-origin" })
    if (!res.ok) return null
    const data = (await res.json()) as { token?: string }
    return data.token ?? null
  } catch {
    return null
  }
}

/**
 * Headers for a JSON admin mutation: application/json plus the CSRF token.
 * Do NOT use this for multipart/FormData uploads — let the browser set the
 * multipart Content-Type itself and attach only the CSRF header (see below).
 */
export async function adminJsonHeaders(): Promise<Record<string, string>> {
  const token = await getCsrfToken()
  return { "Content-Type": "application/json", ...(token ? { [CSRF_HEADER]: token } : {}) }
}
