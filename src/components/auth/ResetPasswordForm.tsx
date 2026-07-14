"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { PasswordInput } from "@/components/auth/PasswordInput"

const field = "w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-500 transition-colors"

export default function ResetPasswordForm({ email, token }: { email: string; token: string }) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const invalidLink = !email || !token

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    const res = await fetch("/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token, password }),
    })
    if (res.ok) {
      setDone(true)
      setTimeout(() => router.push("/login"), 1500)
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || "Something went wrong.")
    }
    setLoading(false)
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6 bg-white/5 backdrop-blur-lg p-8 rounded-2xl border border-white/10 shadow-xl">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">Set a new password</h1>
      </div>

      {invalidLink ? (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg text-sm text-center">
          This reset link is invalid. <Link href="/forgot-password" className="underline">Request a new one</Link>.
        </div>
      ) : done ? (
        <div className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 p-4 rounded-lg text-sm text-center">
          Password updated. Redirecting to sign in…
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm text-center">{error}</div>}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-200 block" htmlFor="password">New password</label>
            <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className={field} placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading} className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors">
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      )}

      <p className="text-center text-sm text-gray-400">
        <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">Back to sign in</Link>
      </p>
    </div>
  )
}
