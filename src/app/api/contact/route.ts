import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { prisma } from '@/lib/db';
import { log } from '@/lib/monitoring';
import { scoreContact, PASS_THRESHOLD, type ContactFields, type ContactErrors } from '@/lib/contact-validation';

export const runtime = 'nodejs';

const TO = process.env.CONTACT_TO || 'comms.neercapital@gmail.com';
const FROM = process.env.CONTACT_FROM || 'Neer Contact <onboarding@resend.dev>';
const RATE_MAX = 5;               // submissions per IP
const RATE_WINDOW_MS = 10 * 60_000;
const DUP_WINDOW_MS = 60_000;     // identical message from same customer

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
// Strip control chars (keep newlines), trim, cap length.
const clean = (s: unknown, max = 2000) =>
  String(s ?? '').replace(/[^\P{Cc}\n]/gu, '').trim().slice(0, max);

const audit = (event: string, details: object, customerId?: string, messageId?: string) =>
  prisma.auditLog.create({ data: { event, details, customerId, messageId } }).catch((e) => log('warn', 'audit_write_failed', { event, error: String(e) }));

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const ua = clean(req.headers.get('user-agent'), 512) || 'unknown';

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  // Honeypot: silently succeed for bots, never send or persist a message.
  if (clean(body.company, 100)) { await audit('honeypot_triggered', { ip, ua }); return NextResponse.json({ ok: true }); }

  const fields: ContactFields = {
    name: clean(body.name, 80),
    email: clean(body.email, 120).toLowerCase(),
    phone: clean(body.phone, 30),
    message: clean(body.message, 2000),
  };

  try {
    // DB-backed rate limit per IP.
    const since = new Date(Date.now() - RATE_WINDOW_MS);
    const recent = await prisma.contactMessage.count({ where: { ip, createdAt: { gt: since } } });
    if (recent >= RATE_MAX) {
      await audit('rate_limited', { ip, count: recent });
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    // Authoritative server-side validation with score logging.
    const scores = scoreContact(fields);
    const errors: ContactErrors = {};
    const failed = (Object.keys(scores) as (keyof ContactFields)[]).filter((k) => scores[k].score < PASS_THRESHOLD);
    if (failed.length) {
      failed.forEach((k) => { errors[k] = scores[k].message; });
      await prisma.validationLog.createMany({
        data: failed.map((k) => ({ field: k, value: fields[k].slice(0, 512), reason: scores[k].reason, score: scores[k].score })),
      });
      await audit('validation_rejected', { ip, fields: failed.map((k) => `${k}:${scores[k].reason}`) });
      return NextResponse.json({ errors }, { status: 422 });
    }
    const validationScore = (Object.values(scores).reduce((a, r) => a + r.score, 0)) / 4;

    // Duplicate detection: identical message from same customer inside window.
    const customer = await prisma.customer.findUnique({ where: { email: fields.email }, include: { threads: { orderBy: { createdAt: 'asc' }, take: 1 } } });
    if (customer) {
      const dup = await prisma.contactMessage.findFirst({
        where: { customerId: customer.id, message: fields.message, createdAt: { gt: new Date(Date.now() - DUP_WINDOW_MS) } },
      });
      if (dup) { await audit('duplicate_suppressed', { ip }, customer.id); return NextResponse.json({ ok: true }); }
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) { log('error', 'contact_email_unconfigured', {}); return NextResponse.json({ error: 'Email service not configured.' }, { status: 500 }); }

    // Threading: returning customer replies into their stored thread.
    const thread = customer?.threads[0];
    const subject = thread?.threadSubject ?? `New Contact Enquiry • ${fields.name} • ${new Date().toISOString().slice(0, 10)}`;
    const headers: Record<string, string> = {};
    if (thread) {
      headers['In-Reply-To'] = thread.lastMessageId;
      headers['References'] = [thread.referencesHeader, thread.lastMessageId].filter(Boolean).join(' ');
    }

    const html = `<h2>New Contact Form Submission</h2>
<p><b>Name:</b> ${esc(fields.name)}</p>
<p><b>Email:</b> ${esc(fields.email)}</p>
<p><b>Phone:</b> ${esc(fields.phone)}</p>
<p><b>Message:</b><br>${esc(fields.message).replace(/\n/g, '<br>')}</p>
<hr>
<p><b>Timestamp:</b> ${new Date().toISOString()}<br>
<b>User Agent:</b> ${esc(ua)}<br>
<b>IP:</b> ${esc(ip)}</p>`;

    const { data, error } = await new Resend(apiKey).emails.send({
      from: FROM, to: TO, replyTo: fields.email, subject, html,
      headers: Object.keys(headers).length ? headers : undefined,
    });
    if (error || !data) {
      log('error', 'contact_send_failed', { error: String(error) });
      await audit('send_failed', { ip, error: String(error) }, customer?.id);
      return NextResponse.json({ error: 'Unable to send your message. Please try again.' }, { status: 502 });
    }
    const domain = (FROM.match(/@([^>\s]+)/)?.[1] || 'resend.dev').trim();
    const providerMessageId = `<${data.id}@${domain}>`;

    // Persist customer, thread, and message.
    const cust = customer
      ? await prisma.customer.update({
          where: { id: customer.id },
          data: { name: fields.name, phone: fields.phone, lastContact: new Date(), totalMessages: { increment: 1 } },
        })
      : await prisma.customer.create({ data: { email: fields.email, name: fields.name, phone: fields.phone, totalMessages: 1 } });

    const thr = thread
      ? await prisma.emailThread.update({
          where: { id: thread.id },
          data: {
            lastMessageId: providerMessageId,
            referencesHeader: [thread.referencesHeader, thread.lastMessageId].filter(Boolean).join(' '),
            replyCount: { increment: 1 },
          },
        })
      : await prisma.emailThread.create({
          data: { customerId: cust.id, threadSubject: subject, rootMessageId: providerMessageId, lastMessageId: providerMessageId, referencesHeader: '' },
        });

    const msg = await prisma.contactMessage.create({
      data: { customerId: cust.id, threadId: thr.id, subject, message: fields.message, validationScore, spamScore: 0, ip, userAgent: ua },
    });

    await audit(customer ? 'follow_up_sent' : 'new_customer_created', { ip, resendId: data.id, subject }, cust.id, msg.id);
    log('info', 'contact_message_processed', { customer: cust.id, thread: thr.id, returning: !!customer });
    return NextResponse.json({ ok: true });
  } catch (e) {
    // Secure error handling: log details server-side, return a generic message.
    log('error', 'contact_route_error', { error: String(e) });
    return NextResponse.json({ error: 'Unable to send your message. Please try again.' }, { status: 500 });
  }
}
