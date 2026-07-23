'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'

// The auth pages are server components, so the one translated line they carry
// needs its own client boundary rather than converting the whole page.
export function AuthLegalNote({ variant }: { variant: 'signIn' | 'signUp' }) {
  const { t } = useLanguage()
  return (
    <p className="mt-8 text-center text-sm text-gray-500">
      {t(variant === 'signIn' ? 'auth.legal.signIn' : 'auth.legal.signUp')}
    </p>
  )
}
