import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/app/lib/supabaseServiceClient';

export const runtime = 'nodejs';

type AccessStatusResponse = {
  ok: boolean;
  isAdmin: boolean;
  active: boolean;
  reason?: string;
};

const parseEmail = (value: unknown) => (typeof value === 'string' ? value : '').trim().toLowerCase();
const parseUserId = (value: unknown) => (typeof value === 'string' ? value : '').trim();

const adminEmail = () => (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = parseEmail((body as { email?: unknown }).email);
  const userId = parseUserId((body as { userId?: unknown }).userId);

  const isAdmin = Boolean(adminEmail()) && email === adminEmail();
  if (isAdmin) {
    const payload: AccessStatusResponse = { ok: true, isAdmin: true, active: true };
    return NextResponse.json(payload);
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    const payload: AccessStatusResponse = {
      ok: false,
      isAdmin: false,
      active: false,
      reason: 'service_role_not_configured',
    };
    console.warn('[access/status] SUPABASE_SERVICE_ROLE_KEY not configured; default deny.');
    return NextResponse.json(payload);
  }

  if (!email && !userId) {
    const payload: AccessStatusResponse = { ok: true, isAdmin: false, active: false, reason: 'missing_identity' };
    return NextResponse.json(payload);
  }

  try {
    // Prefer user_id match, then fallback to email (case-insensitive).
    if (userId) {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('id,user_id,email,status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1);
      if (error) throw error;
      if (Array.isArray(data) && data.length > 0) {
        const payload: AccessStatusResponse = { ok: true, isAdmin: false, active: true };
        return NextResponse.json(payload);
      }
    }

    if (email) {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('id,user_id,email,status')
        .ilike('email', email)
        .eq('status', 'active')
        .limit(1);
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : null) as { id?: string; user_id?: string | null } | null;
      if (!row?.id) {
        const payload: AccessStatusResponse = { ok: true, isAdmin: false, active: false };
        return NextResponse.json(payload);
      }

      // Best-effort: bind user_id once it exists.
      if (userId && !row.user_id) {
        try {
          await supabase.from('subscriptions').update({ user_id: userId }).eq('id', row.id);
        } catch (err) {
          console.warn('[access/status] Failed to bind user_id (continuing).', err);
        }
      }

      const payload: AccessStatusResponse = { ok: true, isAdmin: false, active: true };
      return NextResponse.json(payload);
    }

    const payload: AccessStatusResponse = { ok: true, isAdmin: false, active: false };
    return NextResponse.json(payload);
  } catch (err) {
    console.error('[access/status] Subscription check failed; default deny.', err);
    const payload: AccessStatusResponse = { ok: false, isAdmin: false, active: false, reason: 'check_failed' };
    return NextResponse.json(payload);
  }
}

