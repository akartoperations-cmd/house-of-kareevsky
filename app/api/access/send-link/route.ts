import { NextResponse } from 'next/server';
import { isAdminEmail, normalizeEmail } from '@/app/lib/access';
import { getSupabaseServerClient } from '@/app/lib/supabaseServerClient';
import { getSupabaseServiceClient } from '@/app/lib/supabaseServiceClient';

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

    // Access is granted by:
    // - ADMIN_EMAIL, or
    // - public.subscriptions where status = 'active' for this email.
    const isAdmin = isAdminEmail(email);
    if (!isAdmin) {
      const dataClient = getSupabaseServiceClient();
      if (!dataClient) {
        console.warn('[access/send-link] SUPABASE_SERVICE_ROLE_KEY not configured; cannot verify access.');
        return NextResponse.json({ error: 'Unable to verify access right now.' }, { status: 503 });
      }

      try {
        const { data, error } = await dataClient
          .from('subscriptions')
          .select('id,status')
          .ilike('email', email)
          .eq('status', 'active')
          .limit(1);
        if (error) throw error;
        const hasActive = Array.isArray(data) && data.length > 0;
        if (!hasActive) {
          return NextResponse.json({ error: 'Access not active. Please use Enter.' }, { status: 403 });
        }
      } catch (err) {
        console.error('[access/send-link] Subscription check failed.', err);
        return NextResponse.json({ error: 'Unable to verify access right now.' }, { status: 503 });
      }
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

