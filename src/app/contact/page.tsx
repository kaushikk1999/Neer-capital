'use client';
import { Button } from '@/components/ui/Button';

const field = 'mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-blue-400/40 focus:outline-none focus:ring-2 focus:ring-blue-400/20';
const label = 'text-sm font-medium text-slate-200';

export default function ContactPage() {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get('name'));
    const body = `Name: ${name}\nEmail: ${data.get('email')}\nPhone: ${data.get('phone')}\n\n${data.get('message')}`;
    window.location.href = `mailto:comms.neercapital@gmail.com?subject=${encodeURIComponent(`Contact request from ${name}`)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-24 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">Contact</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Contact Us</h1>
      <p className="mt-6 text-lg leading-8 text-slate-300">Get a tailored walkthrough for your organization.</p>
      <form onSubmit={handleSubmit} className="mt-12 space-y-6 rounded-2xl border border-white/10 bg-white/[0.04] p-8">
        <div>
          <label htmlFor="name" className={label}>Name</label>
          <input id="name" name="name" type="text" required placeholder="Your name" className={field} />
        </div>
        <div>
          <label htmlFor="email" className={label}>Email</label>
          <input id="email" name="email" type="email" required placeholder="Your email" className={field} />
        </div>
        <div>
          <label htmlFor="phone" className={label}>Phone</label>
          <input id="phone" name="phone" type="tel" placeholder="Your phone number" className={field} />
        </div>
        <div>
          <label htmlFor="message" className={label}>Message</label>
          <textarea id="message" name="message" required rows={5} placeholder="Your message" className={field} />
        </div>
        <Button fullWidth>Send message</Button>
      </form>
    </section>
  );
}
