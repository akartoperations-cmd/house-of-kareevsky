import { NextResponse } from 'next/server';
import { isEmailEligible, normalizeEmail } from '@/app/lib/access';
import { getSupabaseServerClient } from '@/app/lib/supabaseServerClient';

export const runtime = 'nodejs';

const isValidEmailFormat = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const resolveRedirectOrigin = (request: Request) => {
  const headerOrigin = request.headers.get('origin');
  if (headerOrigin) return headerOrigin;

  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  return 'http://localhost:3000';
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail((body as { email?: unknown }).email);

    if (!email || !isValidEmailFormat(email)) {
      return NextResponse.json({ error: 'Invalid email.' }, { status: 400 });
    }

    // TODO: Replace allowlist check with Digistore24 webhook-backed eligibility storage.
    if (!isEmailEligible(email)) {
      return NextResponse.json(
        { error: 'No active access for this email. Please use Enter.' },
        { status: 403 },
      );
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Auth service is not configured.' }, { status: 500 });
    }

    const origin = resolveRedirectOrigin(request).replace(/\/$/, '');
    const emailRedirectTo = `${origin}/auth/callback`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    });

    if (error) {
      return NextResponse.json({ error: 'Unable to send link right now.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: 'Check your email for your access link.' });
  } catch {
    return NextResponse.json({ error: 'Unable to send link right now.' }, { status: 500 });
  }
}

