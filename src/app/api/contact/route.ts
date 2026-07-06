import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { validateContact, type ContactFields } from '@/lib/contact-validation';
import { getThread, saveThread } from '@/lib/thread-store';

export const runtime = 'nodejs';

const TO = process.env.CONTACT_TO || 'kaushikds1999@gmail.com';
const FROM = process.env.CONTACT_FROM || 'Neer Contact <onboarding@resend.dev>';

// In-memory guards (per server instance). Fine for a low-volume form;
// swap for a shared store if horizontally scaled.
const hits = new Map<string, number[]>();
const recent = new Map<string, number>();
const WINDOW = 10 * 60_000, MAX = 3, DUP = 60_000;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
// Strip control chars (keep newlines), trim, cap length.
const clean = (s: unknown, max = 2000) =>
  String(s ?? '').replace(/[^\P{Cc}\n]/gu, '').trim().slice(0, max);

function limited(ip: string) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW);
  if (arr.length >= MAX) return true;
  arr.push(now); hits.set(ip, arr);
  return false;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const ua = req.headers.get('user-agent') || 'unknown';

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  // Honeypot: silently succeed for bots, never send.
  if (clean(body.company, 100)) return NextResponse.json({ ok: true });

  if (limited(ip)) return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });

  const fields: ContactFields = {
    name: clean(body.name, 80),
    email: clean(body.email, 120),
    phone: clean(body.phone, 30),
    message: clean(body.message, 2000),
  };

  const errors = validateContact(fields);
  if (Object.keys(errors).length) return NextResponse.json({ errors }, { status: 422 });

  // Duplicate suppression.
  const key = `${fields.email}|${fields.message}`;
  const now = Date.now();
  if (now - (recent.get(key) || 0) < DUP) return NextResponse.json({ ok: true });
  recent.set(key, now);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Email service not configured.' }, { status: 500 });

  const html = `<h2>New Contact Form Submission</h2>
<p><b>Name:</b> ${esc(fields.name)}</p>
<p><b>Email:</b> ${esc(fields.email)}</p>
<p><b>Phone:</b> ${esc(fields.phone)}</p>
<p><b>Message:</b><br>${esc(fields.message).replace(/\n/g, '<br>')}</p>
<hr>
<p><b>Timestamp:</b> ${new Date().toISOString()}<br>
<b>User Agent:</b> ${esc(ua)}<br>
<b>IP:</b> ${esc(ip)}</p>`;

  // Per-sender conversation: new sender -> unique subject; returning sender ->
  // reuse original subject + threading headers referencing Resend's OWN message
  // ids (format <id@domain>), so Gmail nests the follow-up in the same thread.
  const domain = (FROM.match(/@([^>\s]+)/)?.[1] || 'resend.dev').trim();
  const prior = await getThread(fields.email);
  let subject: string;
  const headers: Record<string, string> = {};
  if (prior) {
    subject = prior.subject;
    headers['In-Reply-To'] = prior.messageId;
    headers['References'] = [...prior.references, prior.messageId].join(' ');
  } else {
    subject = `New Contact Enquiry • ${fields.name} • ${new Date().toISOString().slice(0, 10)}`;
  }

  let sentId: string;
  try {
    const { data, error } = await new Resend(apiKey).emails.send({
      from: FROM,
      to: TO,
      replyTo: fields.email,
      subject,
      html,
      headers: Object.keys(headers).length ? headers : undefined,
    });
    if (error || !data) throw error || new Error('no id');
    sentId = data.id;
  } catch {
    return NextResponse.json({ error: 'Unable to send your message. Please try again.' }, { status: 502 });
  }

  const messageId = `<${sentId}@${domain}>`;
  await saveThread(fields.email, {
    subject,
    messageId,
    references: prior ? [...prior.references, prior.messageId] : [],
  });

  return NextResponse.json({ ok: true });
}
