"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Video } from "lucide-react"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { adminJsonHeaders } from "@/lib/security/csrf-client"

export default function VideoUrlForm({ documentId, initialUrl }: { documentId: string; initialUrl: string | null }) {
  const { t } = useLanguage()
  const router = useRouter()
  const [url, setUrl] = useState(initialUrl ?? "")
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle")
  const [error, setError] = useState("")

  const save = async () => {
    setState("saving")
    setError("")
    try {
      const res = await fetch(`/api/admin/documents/${documentId}/video`, {
        method: "PATCH",
        headers: await adminJsonHeaders(),
        body: JSON.stringify({ videoUrl: url.trim() || null }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || t("review.videoFailed"))
      }
      setState("saved")
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setState("idle")
    }
  }

  return (
    <div className="mb-16 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
      <label htmlFor="video-url" className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
        <Video className="w-4 h-4 text-blue-400" /> {t("review.videoLabel")}
      </label>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          id="video-url"
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setState("idle") }}
          placeholder="https://"
          className="flex-1 rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50"
        />
        <button
          onClick={save}
          disabled={state === "saving"}
          className="rounded-lg bg-white text-black hover:bg-gray-200 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {state === "saving" ? t("review.videoSaving") : state === "saved" ? t("review.videoSaved") : t("review.videoSave")}
        </button>
      </div>
      <p className="mt-2 text-xs text-gray-500">{t("review.videoHint")}</p>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  )
}
