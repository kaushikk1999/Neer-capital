"use client"

import { useState } from "react"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/i18n/LanguageContext"

const field = "w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-500 transition-colors"

export default function SignupForm() {
  const router = useRouter()
  const { t } = useLanguage()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || t("auth.unexpectedError"))
        setLoading(false)
        return
      }
      // Account created — sign in immediately.
      const signInRes = await signIn("credentials", { redirect: false, email, password })
      if (signInRes?.error) {
        router.push("/login")
      } else {
        router.push("/")
        router.refresh()
      }
    } catch {
      setError(t("auth.unexpectedError"))
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6 bg-white/5 backdrop-blur-lg p-8 rounded-2xl border border-white/10 shadow-xl">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">{t("auth.signupTitle")}</h1>
        <p className="text-gray-400">{t("auth.signupSubtitle")}</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg text-sm text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-200 block" htmlFor="name">{t("auth.nameLabel")}</label>
          <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required className={field} placeholder={t("auth.namePlaceholder")} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-200 block" htmlFor="email">{t("auth.emailLabel")}</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={field} placeholder={t("auth.emailPlaceholder")} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-200 block" htmlFor="password">{t("auth.passwordLabel")}</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className={field} placeholder="••••••••" />
        </div>
        <button type="submit" disabled={loading} className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors">
          {loading ? t("auth.creating") : t("auth.signUpBtn")}
        </button>
      </form>

      <p className="text-center text-sm text-gray-400">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">{t("auth.signInLink")}</Link>
      </p>
    </div>
  )
}
