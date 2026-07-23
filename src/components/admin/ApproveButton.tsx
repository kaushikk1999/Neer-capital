"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle } from "lucide-react"
import { useLanguage } from "@/lib/i18n/LanguageContext"

export default function ApproveButton({ documentId, analysisId, isAlreadyPublished }: { documentId: string, analysisId: string, isAlreadyPublished: boolean }) {
  const { t } = useLanguage()
  const router = useRouter()
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState("")

  const handleApproveAndPublish = async () => {
    setIsPublishing(true)
    setError("")
    try {
      const res = await fetch(`/api/admin/documents/${documentId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t("review.publishFailed"))
      }
      
      router.push("/admin/documents")
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setIsPublishing(false)
    }
  }

  if (isAlreadyPublished) {
    return (
      <span className="flex items-center gap-2 text-emerald-400 font-medium px-4 py-2 border border-emerald-500/20 bg-emerald-500/10 rounded-xl text-sm">
        <CheckCircle className="w-4 h-4" /> {t("review.livePublished")}
      </span>
    )
  }

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-red-400 text-sm">{error}</span>}
      <button 
        onClick={handleApproveAndPublish}
        disabled={isPublishing}
        className="flex items-center gap-2 bg-white text-black hover:bg-gray-200 transition-colors font-medium px-5 py-2 rounded-xl text-sm disabled:opacity-50"
      >
        <CheckCircle className="w-4 h-4" />
        {isPublishing ? t("review.publishing") : t("review.approvePublish")}
      </button>
    </div>
  )
}
