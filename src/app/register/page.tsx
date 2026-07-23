import SignupForm from "@/components/auth/SignupForm"
import { AuthLegalNote } from "@/components/auth/AuthLegalNote"
import { Logo } from "@/components/ui/Logo"

export const metadata = {
  title: "Create Account | Neer Capital",
  description: "Create your Neer Capital account",
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-gray-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-gray-950 to-gray-950"></div>
      <div className="relative z-10 w-full max-w-md px-4 sm:px-0 flex flex-col items-center">
        <div className="mb-8"><Logo /></div>
        <SignupForm />
        <AuthLegalNote variant="signUp" />
      </div>
    </div>
  )
}
