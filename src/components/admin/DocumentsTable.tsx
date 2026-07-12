"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type Doc = {
  id: string; title: string; slug: string; fileName: string; fileSize: number | null
  status: string; published: boolean; createdAt: string
}

const statusStyle: Record<string, string> = {
  DRAFT: "border-white/15 bg-white/[0.05] text-slate-200",
  PUBLISHED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  ARCHIVED: "border-amber-400/30 bg-amber-400/10 text-amber-200",
}

export default function DocumentsTable({ documents }: { documents: Doc[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")

  const act = async (id: string, path: string, method: "PATCH" | "DELETE") => {
    setBusy(id); setError("")
    try {
      const res = await fetch(`/api/admin/documents/${id}${path}`, { method })
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Action failed.") }
      else router.refresh()
    } catch { setError("Network error.") }
    finally { setBusy(null) }
  }

  if (documents.length === 0) {
    return <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-400">No documents yet. Upload one to get started.</p>
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Uploaded</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Published</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {documents.map((d) => (
              <tr key={d.id} className="text-slate-200">
                <td className="px-4 py-3">
                  <a href={`/api/admin/documents/${d.id}/file`} target="_blank" rel="noreferrer" className="text-white hover:text-blue-300">{d.title}</a>
                </td>
                <td className="px-4 py-3 text-slate-400">{new Date(d.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${statusStyle[d.status] ?? statusStyle.DRAFT}`}>{d.status}</span>
                </td>
                <td className="px-4 py-3">{d.published ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-slate-400">{d.fileSize ? `${(d.fileSize / 1024 / 1024).toFixed(1)}MB` : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2 text-xs">
                    {d.published
                      ? <button disabled={busy === d.id} onClick={() => act(d.id, "/unpublish", "PATCH")} className="rounded-md border border-white/10 px-2 py-1 text-slate-200 hover:bg-white/5 disabled:opacity-50">Unpublish</button>
                      : <button disabled={busy === d.id || d.status === "ARCHIVED"} onClick={() => act(d.id, "/publish", "PATCH")} className="rounded-md border border-emerald-400/30 px-2 py-1 text-emerald-200 hover:bg-emerald-400/10 disabled:opacity-50">Publish</button>}
                    <button disabled={busy === d.id || d.status === "ARCHIVED"} onClick={() => { if (confirm(`Archive “${d.title}”? It will be hidden from the public.`)) act(d.id, "/archive", "PATCH") }} className="rounded-md border border-amber-400/30 px-2 py-1 text-amber-200 hover:bg-amber-400/10 disabled:opacity-50">Archive</button>
                    <button disabled={busy === d.id} onClick={() => { if (confirm(`Delete “${d.title}”? This permanently removes the file.`)) act(d.id, "", "DELETE") }} className="rounded-md border border-red-400/30 px-2 py-1 text-red-300 hover:bg-red-400/10 disabled:opacity-50">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
