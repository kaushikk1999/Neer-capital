"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useLanguage } from "@/lib/i18n/LanguageContext"

const field = "w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-500 transition-colors"

type Status = "verifying" | "success" | "invalid" | "resend"

// Two modes in one screen:
//  - with a token in the link: verify it, show success or a generic failure;
//  - without a token: offer an enumeration-safe resend, reached from the login
//    page when a credentials account still needs verification.
export default function VerifyEmailClient({ email, token }: { email: string; token: string }) {
  const { t } = useLanguage()
  const [status, setStatus] = useState<Status>(token && email ? "verifying" : "resend")
  const [resendEmail, setResendEmail] = useState(email)
  const [resendDone, setResendDone] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token || !email) return
    let active = true
    ;(async () => {
      try {
        const res = await fetch("/api/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, token }),
        })
        if (active) setStatus(res.ok ? "success" : "invalid")
      } catch {
        if (active) setStatus("invalid")
      }
    })()
    return () => { active = false }
  }, [email, token])

  const resend = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await fetch("/api/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resendEmail }),
    }).catch(() => {})
    setResendDone(true)
    setLoading(false)
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6 bg-white/5 backdrop-blur-lg p-8 rounded-2xl border border-white/10 shadow-xl">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">{t("verify.title")}</h1>
      </div>

      {status === "verifying" && <p className="text-center text-gray-400">{t("verify.verifying")}</p>}

      {status === "success" && (
        <div className="space-y-4 text-center">
          <div className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 p-4 rounded-lg text-sm">{t("verify.success")}</div>
          <Link href="/login" className="inline-block text-blue-400 hover:text-blue-300 font-medium">{t("auth.backToSignIn")}</Link>
        </div>
      )}

      {status === "invalid" && (
        <div className="space-y-4">
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg text-sm text-center">{t("verify.invalid")}</div>
          <button type="button" onClick={() => setStatus("resend")} className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
            {t("verify.resendBtn")}
          </button>
        </div>
      )}

      {status === "resend" && (
        resendDone ? (
          <div className="space-y-4 text-center">
            <div className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 p-4 rounded-lg text-sm">{t("verify.resendDone")}</div>
            <Link href="/login" className="inline-block text-blue-400 hover:text-blue-300 font-medium">{t("auth.backToSignIn")}</Link>
          </div>
        ) : (
          <form onSubmit={resend} className="space-y-4">
            <p className="text-sm text-gray-400 text-center">{t("verify.resendBody")}</p>
            <input type="email" value={resendEmail} onChange={(e) => setResendEmail(e.target.value)} required className={field} placeholder={t("auth.emailPlaceholder")} aria-label={t("auth.emailLabel")} />
            <button type="submit" disabled={loading} className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
              {loading ? t("verify.resendSending") : t("verify.resendBtn")}
            </button>
            <p className="text-center text-sm text-gray-400"><Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">{t("auth.backToSignIn")}</Link></p>
          </form>
        )
      )}
    </div>
  )
}
