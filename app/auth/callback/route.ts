import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const getServerClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
};

export async function GET(request: Request) {
  const redirectTo = NextResponse.redirect(new URL('/', request.url));
  const supabase = getServerClient();
  if (!supabase) return redirectTo;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  if (!code) return redirectTo;

  try {
    await supabase.auth.exchangeCodeForSession(code);
  } catch {
    // Swallow errors to avoid leaking details; rely on redirect.
  }

  return redirectTo;
}

