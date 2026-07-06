'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { validateContact, validateName, validateEmail, validatePhone, validateMessage, type ContactFields, type ContactErrors } from '@/lib/contact-validation';

const field = 'mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-blue-400/40 focus:outline-none focus:ring-2 focus:ring-blue-400/20';
const label = 'text-sm font-medium text-slate-200';
const errCls = 'mt-2 whitespace-pre-line text-sm text-red-400';

const perField: Record<keyof ContactFields, (v: string) => string | undefined> = {
  name: validateName, email: validateEmail, phone: validatePhone, message: validateMessage,
};
const empty: ContactFields = { name: '', email: '', phone: '', message: '' };

export default function ContactPage() {
  const [values, setValues] = useState<ContactFields>(empty);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof ContactFields, boolean>>>({});
  const [company, setCompany] = useState(''); // honeypot
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');

  const setField = (k: keyof ContactFields, v: string) => {
    setValues((p) => ({ ...p, [k]: v }));
    if (touched[k]) setErrors((p) => ({ ...p, [k]: perField[k](v) }));
  };
  const blur = (k: keyof ContactFields) => {
    setTouched((p) => ({ ...p, [k]: true }));
    setErrors((p) => ({ ...p, [k]: perField[k](values[k]) }));
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const found = validateContact(values);
    setTouched({ name: true, email: true, phone: true, message: true });
    setErrors(found);
    if (Object.keys(found).length) return;
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, company }),
      });
      if (res.status === 422) { setErrors((await res.json()).errors || {}); setStatus('idle'); return; }
      if (!res.ok) { setStatus('error'); return; }
      setStatus('ok'); setValues(empty); setTouched({});
    } catch { setStatus('error'); }
  }

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-24 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">Contact</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Contact Us</h1>
      <p className="mt-6 text-lg leading-8 text-slate-300">Get a tailored walkthrough for your organization.</p>
      <form onSubmit={onSubmit} noValidate className="mt-12 space-y-6 rounded-2xl border border-white/10 bg-white/[0.04] p-8">
        <div>
          <label htmlFor="name" className={label}>Name</label>
          <input id="name" name="name" type="text" placeholder="Your name" className={field} value={values.name} onChange={(e) => setField('name', e.target.value)} onBlur={() => blur('name')} aria-invalid={!!errors.name} />
          {errors.name && <p className={errCls}>{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="email" className={label}>Email</label>
          <input id="email" name="email" type="email" placeholder="Your email" className={field} value={values.email} onChange={(e) => setField('email', e.target.value)} onBlur={() => blur('email')} aria-invalid={!!errors.email} />
          {errors.email && <p className={errCls}>{errors.email}</p>}
        </div>
        <div>
          <label htmlFor="phone" className={label}>Phone</label>
          <input id="phone" name="phone" type="tel" placeholder="Your phone number" className={field} value={values.phone} onChange={(e) => setField('phone', e.target.value)} onBlur={() => blur('phone')} aria-invalid={!!errors.phone} />
          {errors.phone && <p className={errCls}>{errors.phone}</p>}
        </div>
        <div>
          <label htmlFor="message" className={label}>Message</label>
          <textarea id="message" name="message" rows={5} placeholder="Your message" className={field} value={values.message} onChange={(e) => setField('message', e.target.value)} onBlur={() => blur('message')} aria-invalid={!!errors.message} />
          {errors.message && <p className={errCls}>{errors.message}</p>}
        </div>
        {/* Honeypot: hidden from users, catches bots. */}
        <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={company} onChange={(e) => setCompany(e.target.value)} />
        <Button fullWidth disabled={status === 'sending'}>{status === 'sending' ? 'Sending…' : 'Send message'}</Button>
        {status === 'ok' && <p className="text-sm text-emerald-400" role="status">Message sent successfully.</p>}
        {status === 'error' && <p className="text-sm text-red-400" role="alert">Unable to send your message. Please try again.</p>}
      </form>
    </section>
  );
}
