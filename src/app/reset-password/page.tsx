import ResetPasswordForm from "@/components/auth/ResetPasswordForm"
import { Logo } from "@/components/ui/Logo"
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher"

export const metadata = { title: "Reset Password | Neer Capital" }

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string; email?: string }
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-gray-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-gray-950 to-gray-950"></div>
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>

      <div className="relative z-10 w-full max-w-md px-4 sm:px-0 flex flex-col items-center">
        <div className="mb-8"><Logo /></div>
        <ResetPasswordForm email={searchParams.email ?? ""} token={searchParams.token ?? ""} />
      </div>
    </div>
  )
}
