"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { UploadCloud, FileText, CheckCircle2, AlertCircle, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { useLanguage } from "@/lib/i18n/LanguageContext"

const MAX = 25 * 1024 * 1024

type ItemState = "pending" | "uploading" | "queued" | "failed"

type Item = {
  // Files with the same name can legitimately be queued together, so identity
  // cannot come from the name. A counter keeps React keys stable while rows
  // are removed mid-batch.
  id: number
  file: File
  title: string
  state: ItemState
  progress: number
  error: string
}

let nextId = 0

export default function UploadForm() {
  const { t } = useLanguage()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Item[]>([])
  const [dragging, setDragging] = useState(false)
  const [running, setRunning] = useState(false)
  const [rejected, setRejected] = useState<string[]>([])

  const patch = (id: number, next: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...next } : it)))

  const add = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const accepted: Item[] = []
    const bad: string[] = []
    for (const file of Array.from(files)) {
      if (file.type !== "application/pdf") { bad.push(`${file.name} — ${t("upload.notPdf")}`); continue }
      if (file.size > MAX) { bad.push(`${file.name} — ${t("upload.tooLarge")}`); continue }
      accepted.push({
        id: nextId++,
        file,
        title: file.name.replace(/\.pdf$/i, ""),
        state: "pending",
        progress: 0,
        error: "",
      })
    }
    setRejected(bad)
    setItems((prev) => [...prev, ...accepted])
  }

  const uploadOne = (item: Item) =>
    new Promise<void>((resolve) => {
      patch(item.id, { state: "uploading", progress: 0, error: "" })
      const data = new FormData()
      data.append("file", item.file)
      data.append("title", item.title)
      const xhr = new XMLHttpRequest()
      xhr.open("POST", "/api/admin/documents/upload")
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) patch(item.id, { progress: Math.round((e.loaded / e.total) * 100) })
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          patch(item.id, { state: "queued", progress: 100 })
        } else {
          let message = t("upload.failed")
          try { message = JSON.parse(xhr.responseText).error || message } catch { /* keep the default */ }
          patch(item.id, { state: "failed", error: message })
        }
        resolve()
      }
      xhr.onerror = () => {
        patch(item.id, { state: "failed", error: t("upload.networkError") })
        resolve()
      }
      xhr.send(data)
    })

  // Sequential on purpose. Parallel uploads would race for R2 bandwidth and
  // leave the queue order non-deterministic, and the worker consumes jobs one
  // at a time regardless, so nothing is gained by finishing the uploads sooner.
  // A failed file is recorded on its own row and the batch carries on.
  const submit = async () => {
    setRunning(true)
    for (const item of items) {
      if (item.state === "queued") continue
      await uploadOne(item)
    }
    setRunning(false)
    router.refresh()
  }

  const remove = (id: number) => setItems((prev) => prev.filter((it) => it.id !== id))

  const outstanding = items.filter((it) => it.state !== "queued").length
  const queued = items.filter((it) => it.state === "queued").length

  return (
    <div className="max-w-2xl space-y-6">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); add(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-10 text-center transition ${dragging ? "border-blue-400/60 bg-blue-400/[0.06]" : "border-white/15 bg-white/[0.03] hover:bg-white/[0.05]"}`}
      >
        <UploadCloud className="h-8 w-8 text-blue-300" />
        <p className="mt-4 text-sm text-white">{t("upload.drop")}</p>
        <p className="mt-1 text-xs text-slate-400">{t("upload.hint")}</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => { add(e.target.files); e.target.value = "" }}
        />
      </div>

      {rejected.length > 0 && (
        <div className="space-y-1">
          {rejected.map((line) => (
            <p key={line} className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />{line}
            </p>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((it) => (
            <div key={it.id} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="flex items-center gap-3 text-sm text-white">
                {it.state === "uploading" && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-300" />}
                {it.state === "queued" && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
                {it.state === "failed" && <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />}
                {it.state === "pending" && <FileText className="h-4 w-4 shrink-0 text-blue-300" />}
                <span className="truncate">{it.file.name}</span>
                <span className="ml-auto shrink-0 text-xs text-slate-400">
                  {(it.file.size / 1024 / 1024).toFixed(1)}MB
                </span>
                {!running && it.state !== "queued" && (
                  <button
                    type="button"
                    onClick={() => remove(it.id)}
                    aria-label={`Remove ${it.file.name}`}
                    className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {it.state !== "queued" && (
                <input
                  value={it.title}
                  onChange={(e) => patch(it.id, { title: e.target.value })}
                  disabled={running}
                  placeholder={t("upload.titlePlaceholder")}
                  aria-label={`Title for ${it.file.name}`}
                  className="mt-3 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-400/40 focus:outline-none focus:ring-2 focus:ring-blue-400/20 disabled:opacity-60"
                />
              )}

              {it.state === "uploading" && (
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-blue-500 transition-all" style={{ width: `${it.progress}%` }} />
                </div>
              )}

              {it.state === "queued" && (
                <p className="mt-2 text-xs text-emerald-400">{t("upload.queued")}</p>
              )}

              {it.state === "failed" && <p className="mt-2 text-xs text-red-400">{it.error}</p>}
            </div>
          ))}
        </div>
      )}

      {queued > 0 && !running && (
        <p className="text-xs text-slate-400">
{queued} {queued === 1 ? t("upload.queueNoteOne") : t("upload.queueNoteMany")}
        </p>
      )}

      <Button onClick={submit} disabled={outstanding === 0 || running}>
        {running
          ? t("upload.uploading")
          : outstanding > 1
            ? `${t("upload.submitMany")} (${outstanding})`
            : t("upload.submitOne")}
      </Button>
    </div>
  )
}
