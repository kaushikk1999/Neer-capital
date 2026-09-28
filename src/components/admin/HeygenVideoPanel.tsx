"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles } from "lucide-react"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { adminJsonHeaders } from "@/lib/security/csrf-client"

const POLL_MS = 10_000

// Sends an admin-written script to HeyGen, then polls until the render is
// stored and attached to the report.
export default function HeygenVideoPanel({ documentId, initiallyPending }: { documentId: string; initiallyPending: boolean }) {
  const { t } = useLanguage()
  const router = useRouter()
  const [script, setScript] = useState("")
  const [pending, setPending] = useState(initiallyPending)
  const [starting, setStarting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  const poll = useCallback(async () => {
    const res = await fetch(`/api/admin/documents/${documentId}/video/heygen`, { cache: "no-store" })
    const data = await res.json().catch(() => ({}))
    if (data.status === "completed") {
      setPending(false)
      setDone(true)
      router.refresh()
    } else if (data.status === "failed" || data.status === "idle") {
      setPending(false)
      if (data.error) setError(data.error)
    } else if (data.status === "error" && data.error) {
      setError(data.error)
    }
  }, [documentId, router])

  useEffect(() => {
    if (!pending) return
    const id = setInterval(poll, POLL_MS)
    return () => clearInterval(id)
  }, [pending, poll])

  const start = async () => {
    setStarting(true)
    setError("")
    setDone(false)
    try {
      const res = await fetch(`/api/admin/documents/${documentId}/video/heygen`, {
        method: "POST",
        headers: await adminJsonHeaders(),
        body: JSON.stringify({ script }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || t("review.heygenFailed"))
      setPending(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="mt-6 pt-6 border-t border-white/[0.06]">
      <label htmlFor="heygen-script" className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
        <Sparkles className="w-4 h-4 text-blue-400" /> {t("review.heygenLabel")}
      </label>
      <textarea
        id="heygen-script"
        value={script}
        onChange={(e) => setScript(e.target.value)}
        maxLength={1500}
        rows={5}
        disabled={pending}
        className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          onClick={start}
          disabled={pending || starting || !script.trim()}
          className="rounded-lg bg-white text-black hover:bg-gray-200 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? t("review.heygenRendering") : starting ? t("review.heygenStarting") : t("review.heygenGenerate")}
        </button>
        <span className="text-xs text-gray-500">{script.length}/1500 · {t("review.heygenHint")}</span>
      </div>
      {done && <p className="mt-2 text-sm text-emerald-400">{t("review.heygenDone")}</p>}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  )
}
