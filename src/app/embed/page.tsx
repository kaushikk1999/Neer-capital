'use client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
export default function EmbedPage() {
  const { t } = useLanguage();
  return <div className="p-6 text-white">{t('embed.placeholder')}</div>;
}
