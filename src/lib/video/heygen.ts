// HeyGen avatar-video API (v3). Needs HEYGEN_API_KEY; the account must have API
// credit (billed separately from the HeyGen web app plan).
// HEYGEN_AVATAR_ID / HEYGEN_VOICE_ID pin the presenter; without them the first
// public studio avatar that supports the engine, and its default voice, are used.
// Cost is per second of output and depends on the engine: the API defaults to
// Avatar IV (~$4/min for studio avatars), so we default to Avatar III (~$1/min)
// at 720p. Override with HEYGEN_ENGINE (avatar_iii | avatar_iv | avatar_v) and
// HEYGEN_RESOLUTION (720p | 1080p | 4k).

const API = "https://api.heygen.com"
const ENGINE = process.env.HEYGEN_ENGINE || "avatar_iii"
const RESOLUTION = process.env.HEYGEN_RESOLUTION || "720p"
// Dark navy studio backdrop; HEYGEN_BACKGROUND_URL swaps in a newsroom image.
const BACKGROUND = process.env.HEYGEN_BACKGROUND_URL
  ? { type: "image", url: process.env.HEYGEN_BACKGROUND_URL }
  : { type: "color", value: "#0b1530" }

export function heygenConfigured(): boolean {
  return !!process.env.HEYGEN_API_KEY
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "x-api-key": process.env.HEYGEN_API_KEY || "", "content-type": "application/json", ...init?.headers },
    cache: "no-store",
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = body?.error?.message || body?.message || body?.error || `HTTP ${res.status}`
    throw new Error(`HeyGen: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`)
  }
  return body as T
}

interface Look { id: string; default_voice_id?: string | null; supported_api_engines?: string[] | null }

async function resolvePresenter(): Promise<{ avatarId: string; voiceId: string | null }> {
  const avatarId = process.env.HEYGEN_AVATAR_ID
  const voiceId = process.env.HEYGEN_VOICE_ID || null
  if (avatarId) return { avatarId, voiceId }
  // First public studio avatar that the configured engine can render.
  let token: string | undefined
  for (let page = 0; page < 5; page++) {
    const q = new URLSearchParams({ ownership: "public", avatar_type: "studio_avatar", limit: "50" })
    if (token) q.set("token", token)
    const res = await call<{ data?: Look[]; has_more?: boolean; next_token?: string }>(`/v3/avatars/looks?${q}`)
    const look = res.data?.find((l) => !l.supported_api_engines || l.supported_api_engines.includes(ENGINE))
    if (look) return { avatarId: look.id, voiceId: voiceId ?? look.default_voice_id ?? null }
    if (!res.has_more || !res.next_token) break
    token = res.next_token
  }
  throw new Error(`HeyGen: no public studio avatar supports ${ENGINE} — set HEYGEN_AVATAR_ID`)
}

/** Start a 16:9 avatar render of `script`; returns the HeyGen video id. */
export async function createAvatarVideo(opts: { script: string; title: string; callbackId: string }): Promise<string> {
  const { avatarId, voiceId } = await resolvePresenter()
  if (!voiceId) throw new Error("HeyGen: no voice available — set HEYGEN_VOICE_ID")
  const res = await call<{ data?: { video_id?: string } }>("/v3/videos", {
    method: "POST",
    body: JSON.stringify({
      type: "avatar",
      avatar_id: avatarId,
      voice_id: voiceId,
      script: opts.script,
      title: opts.title,
      callback_id: opts.callbackId,
      aspect_ratio: "16:9",
      resolution: RESOLUTION,
      background: BACKGROUND,
      engine: { type: ENGINE },
    }),
  })
  const id = res.data?.video_id
  if (!id) throw new Error("HeyGen: no video id returned")
  return id
}

export interface HeygenVideo {
  status: "pending" | "processing" | "completed" | "failed" | string
  videoUrl: string | null
  failureMessage: string | null
}

export async function getAvatarVideo(videoId: string): Promise<HeygenVideo> {
  const res = await call<{ data?: Record<string, any> } & Record<string, any>>(`/v3/videos/${encodeURIComponent(videoId)}`)
  const d = res.data ?? res
  return {
    status: d.status ?? "pending",
    videoUrl: d.video_url ?? null,
    failureMessage: d.failure_message ?? null,
  }
}

/** Remaining API wallet balance in USD, or null if the account is not wallet-billed. */
export async function getApiBalance(): Promise<number | null> {
  const res = await call<{ data?: Record<string, any> } & Record<string, any>>("/v3/users/me")
  const d = res.data ?? res
  const wallet = d.wallet ?? d.billing ?? d
  const bal = wallet?.remaining_balance
  return typeof bal === "number" ? bal : null
}
