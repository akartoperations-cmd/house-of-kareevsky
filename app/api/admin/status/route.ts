import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type AdminStatusResponse = {
  ok: boolean;
  hasAdminEmail: boolean;
  isAdmin: boolean;
};

const parseAdminEmail = () =>
  (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').trim().toLowerCase();

const parseEmail = (value: unknown) => (typeof value === 'string' ? value : '').trim().toLowerCase();

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = parseEmail((body as { email?: unknown })?.email);
    const adminEmail = parseAdminEmail();
    const hasAdminEmail = adminEmail.length > 0;
    const isAdmin = hasAdminEmail && email === adminEmail;

    const payload: AdminStatusResponse = { ok: true, hasAdminEmail, isAdmin };
    return NextResponse.json(payload);
  } catch {
    // Do not leak any information; default to safe false values.
    const payload: AdminStatusResponse = { ok: true, hasAdminEmail: false, isAdmin: false };
    return NextResponse.json(payload);
  }
}

