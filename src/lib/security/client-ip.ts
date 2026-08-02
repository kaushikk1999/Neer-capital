// Server-only client-IP resolution.
//
// Trust model (documented, not invented): production runs on Railway behind its
// single L7 edge proxy. The custom domain uses Cloudflare in DNS-only mode, so
// Cloudflare does not proxy requests — clients reach Railway's edge directly.
// Railway sets `x-forwarded-for` with the real client as the LEFTMOST entry.
// We therefore trust only the leftmost XFF entry (or `x-real-ip`), never an
// arbitrary client-supplied chain, and validate it as a real IP.
//
// A missing/invalid IP returns null; callers must still enforce account-based
// limits so protection is never fully disabled by a spoofed/absent header.

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/
// Permissive IPv6 (hex groups / ::) — good enough to reject garbage, not to
// canonicalise. We only need a stable, valid-looking token for hashing.
const IPV6 = /^(([0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{0,4}|::(ffff:)?(\d{1,3}\.){3}\d{1,3}|([0-9a-fA-F]{1,4}:){1,7}:)$/

function normalize(raw: string): string | null {
  let ip = raw.trim()
  if (!ip) return null
  // Strip an optional :port on IPv4 or bracketed IPv6.
  if (ip.startsWith("[")) ip = ip.slice(1, ip.indexOf("]") === -1 ? undefined : ip.indexOf("]"))
  // IPv4-mapped IPv6 (::ffff:1.2.3.4) → IPv4.
  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i)
  if (mapped) ip = mapped[1]
  if (IPV4.test(ip)) return ip
  if (IPV6.test(ip)) return ip.toLowerCase()
  return null
}

/** Resolve the trusted client IP, or null when none can be trusted. */
export function getClientIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for")
  if (xff) {
    // Leftmost entry is the client under the Railway single-proxy model.
    const first = xff.split(",")[0]
    const ip = normalize(first)
    if (ip) return ip
  }
  const real = headers.get("x-real-ip")
  if (real) {
    const ip = normalize(real)
    if (ip) return ip
  }
  return null
}
