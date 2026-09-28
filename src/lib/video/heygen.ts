// HeyGen avatar-video API (v3). Needs HEYGEN_API_KEY; the account must have API
// credit (billed separately from the HeyGen web app plan).
// HEYGEN_AVATAR_ID / HEYGEN_VOICE_ID pin the presenter; without them the first
// public studio avatar and its default voice are used.

const API = "https://api.heygen.com"

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

async function resolvePresenter(): Promise<{ avatarId: string; voiceId: string | null }> {
  const avatarId = process.env.HEYGEN_AVATAR_ID
  const voiceId = process.env.HEYGEN_VOICE_ID || null
  if (avatarId) return { avatarId, voiceId }
  const looks = await call<{ data?: { id: string; default_voice_id?: string | null }[] }>(
    "/v3/avatars/looks?ownership=public&avatar_type=studio_avatar&limit=1",
  )
  const look = looks.data?.[0]
  if (!look) throw new Error("HeyGen: no public avatar available — set HEYGEN_AVATAR_ID")
  return { avatarId: look.id, voiceId: voiceId ?? look.default_voice_id ?? null }
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
      resolution: "1080p",
      background: { type: "color", value: "#050505" },
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
