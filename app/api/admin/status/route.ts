import { NextResponse } from 'next/server';
import { isAdminEmailServer, normalizeEmail } from '@/app/lib/access';

export const runtime = 'nodejs';

type AdminStatusResponse = {
  ok: boolean;
  hasAdminEmail: boolean;
  isAdmin: boolean;
};

const hasAdminEmailConfigured = () => Boolean((process.env.ADMIN_EMAIL || '').trim());

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail((body as { email?: unknown })?.email);
    const hasAdminEmail = hasAdminEmailConfigured();
    const isAdmin = hasAdminEmail && isAdminEmailServer(email);

    const payload: AdminStatusResponse = { ok: true, hasAdminEmail, isAdmin };
    return NextResponse.json(payload);
  } catch {
    // Do not leak any information; default to safe false values.
    const payload: AdminStatusResponse = { ok: true, hasAdminEmail: false, isAdmin: false };
    return NextResponse.json(payload);
  }
}

