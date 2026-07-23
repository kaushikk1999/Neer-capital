"use client"

import { useState } from "react"
import Link from "next/link"
import { useLanguage } from "@/lib/i18n/LanguageContext"

const field = "w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-500 transition-colors"

export default function ForgotPasswordForm() {
  const { t } = useLanguage()
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => {})
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6 bg-white/5 backdrop-blur-lg p-8 rounded-2xl border border-white/10 shadow-xl">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">{t("auth.forgot.title")}</h1>
        <p className="text-gray-400">{t("auth.forgot.subtitle")}</p>
      </div>

      {sent ? (
        <div className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 p-4 rounded-lg text-sm text-center">
          {t("auth.forgot.sent")}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-200 block" htmlFor="email">{t("auth.emailLabel")}</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={field} placeholder={t("auth.emailPlaceholder")} />
          </div>
          <button type="submit" disabled={loading} className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors">
            {loading ? t("auth.forgot.sending") : t("auth.forgot.submit")}
          </button>
        </form>
      )}

      <p className="text-center text-sm text-gray-400">
        <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">{t("auth.backToSignIn")}</Link>
      </p>
    </div>
  )
}
