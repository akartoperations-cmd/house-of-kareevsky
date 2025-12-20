import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const parseAdminEmail = () =>
  (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').trim().toLowerCase();

export async function GET() {
  const hasAdminEmail = parseAdminEmail().length > 0;
  return NextResponse.json({ ok: true, hasAdminEmail, runtime: 'nodejs' });
}

