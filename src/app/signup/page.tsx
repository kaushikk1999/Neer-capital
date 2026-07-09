import SignupForm from "@/components/auth/SignupForm"
import { Logo } from "@/components/ui/Logo"

export const metadata = {
  title: "Create Account | Neer Capital",
  description: "Create your Neer Capital account",
}

export default function SignupPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-gray-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-gray-950 to-gray-950"></div>
      <div className="relative z-10 w-full max-w-md px-4 sm:px-0 flex flex-col items-center">
        <div className="mb-8">
          <Logo />
        </div>
        <SignupForm />
        <p className="mt-8 text-center text-sm text-gray-500">
          By creating an account, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
