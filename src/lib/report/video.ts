// Presenter-video links for a report: an https MP4 (e.g. a HeyGen export on R2)
// or a YouTube link, which is rendered through the privacy-enhanced embed.

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

/** YouTube video id for watch / youtu.be / shorts / embed links, else null. */
export function youtubeId(url: string): string | null {
  let u: URL
  try { u = new URL(url) } catch { return null }
  const host = u.hostname.replace(/^www\.|^m\./, "")
  let id: string | null = null
  if (host === "youtu.be") id = u.pathname.slice(1)
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1] ?? null
  }
  return id && YOUTUBE_ID.test(id) ? id : null
}

/** Same-site path of a video stored in our bucket (e.g. a HeyGen render). */
export function storedVideoPath(slug: string, version: string): string {
  return `/api/documents/${slug}/video?v=${encodeURIComponent(version)}`
}

/** Storage key for a document's stored video. */
export function videoStorageKey(documentId: string): string {
  return `videos/${documentId}.mp4`
}

const STORED_PATH = /^\/api\/documents\/[A-Za-z0-9_-]+\/video(\?v=[A-Za-z0-9_%.-]+)?$/

/** Accepts https URLs up to 2000 chars, or our own stored-video path; returns the trimmed URL or null. */
export function normalizeVideoUrl(input: unknown): string | null {
  if (typeof input !== "string") return null
  const url = input.trim()
  if (!url || url.length > 2000) return null
  if (STORED_PATH.test(url)) return url
  try {
    return new URL(url).protocol === "https:" ? url : null
  } catch {
    return null
  }
}
