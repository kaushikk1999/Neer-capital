import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: { name?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const name = (body.name ?? '').trim().slice(0, 80);
  const email = (body.email ?? '').trim().toLowerCase().slice(0, 120);
  const password = body.password ?? '';

  if (!name || name.length < 2) return NextResponse.json({ error: 'Please enter your name.' }, { status: 422 });
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)) return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 422 });
  if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 422 });

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { name, email, passwordHash } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Unable to create your account. Please try again.' }, { status: 500 });
  }
}
