"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { UploadCloud, FileText, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/Button"

const MAX = 25 * 1024 * 1024

export default function UploadForm() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  const pick = (f: File | null) => {
    setError(""); setDone(false)
    if (!f) return
    if (f.type !== "application/pdf") { setError("Only PDF files are allowed."); return }
    if (f.size > MAX) { setError("File exceeds the 25MB limit."); return }
    setFile(f)
    if (!title) setTitle(f.name.replace(/\.pdf$/i, ""))
  }

  const submit = () => {
    if (!file) return
    setProgress(0); setError(""); setDone(false)
    const data = new FormData()
    data.append("file", file)
    data.append("title", title)
    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/admin/documents/upload")
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => {
      setProgress(null)
      if (xhr.status >= 200 && xhr.status < 300) {
        setDone(true); setFile(null); setTitle("")
        router.refresh()
      } else {
        try { setError(JSON.parse(xhr.responseText).error || "Upload failed.") } catch { setError("Upload failed.") }
      }
    }
    xhr.onerror = () => { setProgress(null); setError("Network error during upload.") }
    xhr.send(data)
  }

  const uploading = progress !== null

  return (
    <div className="max-w-2xl space-y-6">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0] ?? null) }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-10 text-center transition ${dragging ? "border-blue-400/60 bg-blue-400/[0.06]" : "border-white/15 bg-white/[0.03] hover:bg-white/[0.05]"}`}
      >
        <UploadCloud className="h-8 w-8 text-blue-300" />
        <p className="mt-4 text-sm text-white">Drag &amp; drop a PDF, or click to browse</p>
        <p className="mt-1 text-xs text-slate-400">PDF only · up to 25MB</p>
        <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
      </div>

      {file && (
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white">
          <FileText className="h-4 w-4 text-blue-300" />
          <span className="truncate">{file.name}</span>
          <span className="ml-auto text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="title" className="text-sm font-medium text-slate-200">Title</label>
        <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-blue-400/40 focus:outline-none focus:ring-2 focus:ring-blue-400/20" />
      </div>

      {uploading && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      {error && <p className="flex items-center gap-2 text-sm text-red-400"><AlertCircle className="h-4 w-4" />{error}</p>}
      {done && <p className="flex items-center gap-2 text-sm text-emerald-400"><CheckCircle2 className="h-4 w-4" />Uploaded as a draft.</p>}

      <Button onClick={submit} disabled={!file || uploading}>{uploading ? `Uploading… ${progress}%` : "Upload document"}</Button>
    </div>
  )
}
