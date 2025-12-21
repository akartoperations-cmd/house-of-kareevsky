'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';

type AuthBarProps = {
  onAuthState: (session: Session | null, isAdmin: boolean, hasAdminEmail: boolean) => void;
};

type AdminState = { isAdmin: boolean; hasAdminEmail: boolean };
type AdminCheckStatus = 'pending' | 'ok' | 'fail';
type BannerState = 'hidden' | 'visible' | 'fading';

export function AuthBar({ onAuthState }: AuthBarProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [adminState, setAdminState] = useState<AdminState>({ isAdmin: false, hasAdminEmail: true });
  const [adminCheckStatus, setAdminCheckStatus] = useState<AdminCheckStatus>('pending');
  const [debugAdmin, setDebugAdmin] = useState(false);
  const [debugAuth, setDebugAuth] = useState(false);
  const [bannerState, setBannerState] = useState<BannerState>('visible');
  const [lastAuthResult, setLastAuthResult] = useState<{ ok: boolean; code: string } | null>(null);
  const [lastAuthRedirectHost, setLastAuthRedirectHost] = useState<string>('none');
  const [cooldownUntilMs, setCooldownUntilMs] = useState<number>(0);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const authedEmail = (session?.user?.email || '').trim().toLowerCase();
  const cooldownMsLeft = Math.max(0, cooldownUntilMs - nowMs);
  const cooldownActive = cooldownMsLeft > 0;
  const cooldownSecondsLeft = Math.ceil(cooldownMsLeft / 1000);
  // For signed-in users: banner auto-hides after 4s
  // For guests: banner stays visible so they can sign in
  const showBanner = !session || bannerState !== 'hidden';
  const bannerFading = session && bannerState === 'fading';

  useEffect(() => {
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    if (session) {
      // Signed-in: show briefly then hide
      setBannerState('visible');
      fadeTimer = setTimeout(() => setBannerState('fading'), 3000);
      hideTimer = setTimeout(() => setBannerState('hidden'), 4000);
    } else {
      // Guest: keep visible for sign-in
      setBannerState('visible');
    }

    return () => {
      if (fadeTimer) clearTimeout(fadeTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [session]);

  // Keep "now" ticking only during cooldown (for disabling the button reliably)
  useEffect(() => {
    if (!cooldownActive) return;
    const t = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(t);
  }, [cooldownActive]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setDebugAdmin(params.get('debugAdmin') === '1');
    setDebugAuth(params.get('debugAuth') === '1');
  }, []);

  useEffect(() => {
    let mounted = true;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus('Auth unavailable');
      setIsSessionLoading(false);
      return () => {
        mounted = false;
      };
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setStatus('Auth unavailable');
      setSession(data.session ?? null);
      setIsSessionLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsSessionLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    onAuthState(session, adminState.isAdmin, adminState.hasAdminEmail);
  }, [session, adminState, onAuthState]);

  useEffect(() => {
    let cancelled = false;

    if (!authedEmail) {
      setAdminState((prev) => ({ ...prev, isAdmin: false }));
      setAdminCheckStatus('pending');
      return () => {
        cancelled = true;
      };
    }

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const attempt = async () => {
      try {
        const res = await fetch('/api/admin/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: authedEmail || null }),
        });
        if (!res.ok) throw new Error('Failed admin status check');
        const data = (await res.json()) as { hasAdminEmail?: boolean; isAdmin?: boolean };
        if (cancelled) return false;
        setAdminState({
          hasAdminEmail: Boolean(data?.hasAdminEmail),
          isAdmin: Boolean(data?.isAdmin),
        });
        setAdminCheckStatus('ok');
        return true;
      } catch {
        return false;
      }
    };

    const checkAdminStatus = async () => {
      const first = await attempt();
      if (cancelled || first) return;
      await sleep(500);
      const second = await attempt();
      if (cancelled) return;
      if (!second) {
        setAdminState({ hasAdminEmail: false, isAdmin: false });
        setAdminCheckStatus('fail');
      }
    };

    checkAdminStatus();
    return () => {
      cancelled = true;
    };
  }, [authedEmail]);

  const sendMagicLink = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus('Auth unavailable');
      setLastAuthResult({ ok: false, code: 'no_client' });
      setLastAuthRedirectHost(typeof window !== 'undefined' ? window.location.hostname : 'none');
      return;
    }

    const trimmed = email.trim();
    if (!trimmed) return;
    if (cooldownActive) return;

    setLoading(true);
    setStatus(null);
    setLastAuthResult(null);
    try {
      // Use current origin to avoid accidental redirects to an old/incorrect host.
      // Keep it at "/" to match the most common Supabase allowed redirect configuration.
      const emailRedirectTo = `${window.location.origin}/`;
      setLastAuthRedirectHost(window.location.hostname);
      setCooldownUntilMs(Date.now() + 30_000);
      setNowMs(Date.now());
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo },
      });
      if (error) {
        setLastAuthResult({ ok: false, code: error.code || error.name || 'unknown' });
        throw error;
      }
      setLastAuthResult({ ok: true, code: 'none' });
      setStatus('Check your email for the sign-in link.');
      setEmail('');
    } catch (e) {
      // Show user-friendly message, hide technical details
      const errAny = e as unknown as { code?: string; name?: string; status?: number };
      const errCode = errAny?.code || errAny?.name || 'unknown';
      if (errCode === 'over_email_send_rate_limit' || errAny?.status === 429) {
        setStatus('Please wait and try again.');
      } else {
        setStatus('Sign-in failed. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus('Auth unavailable');
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign-out failed.';
      setStatus(msg);
    } finally {
      setLoading(false);
    }
  };

  // When banner is hidden, remove pointer-events entirely to avoid blocking menu-btn and notification-banner
  const bannerPointerEvents = showBanner ? 'pointer-events-auto' : 'pointer-events-none';

  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-0 z-[60]"
      style={{ paddingTop: '4px' }}
    >
      <div
        className={`${bannerPointerEvents} mx-auto flex max-w-[520px] items-center justify-between gap-3 px-4 py-2 text-sm text-white/90 transition-opacity duration-500 ${
          showBanner ? 'opacity-100' : 'opacity-0'
        } ${bannerFading ? 'opacity-0' : ''} border-b border-white/10 bg-black/60 backdrop-blur rounded-b-lg`}
        style={{ paddingRight: '72px' }} // reserve space for the menu button on mobile
      >
        <div className="min-w-0">
          {isSessionLoading ? (
            <div className="truncate text-white/70">Loading…</div>
          ) : session ? (
            <div className="truncate">
              <span className="font-medium text-white">Signed in</span>
              {adminState.isAdmin && (
                <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs">admin</span>
              )}
            </div>
          ) : (
            <div className="truncate text-white/70">Guest mode</div>
          )}
          {!adminState.hasAdminEmail && (
            <div className="mt-0.5 text-xs text-amber-200/90">Admin tools disabled.</div>
          )}
          {debugAdmin && (
            <div className="mt-0.5 text-[11px] text-white/60">
              adminCheck: {adminCheckStatus}, hasAdminEmail: {String(adminState.hasAdminEmail)}
            </div>
          )}
          {debugAuth && lastAuthResult && (
            <div className="mt-0.5 text-[11px] text-white/60">
              authSend: {lastAuthResult.ok ? 'ok' : 'fail'}, errorCode: {lastAuthResult.code}, redirectHost:{' '}
              {lastAuthRedirectHost}
            </div>
          )}
        </div>

        {session ? (
          <button
            type="button"
            onClick={signOut}
            disabled={loading}
            className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/15 disabled:opacity-50"
          >
            Sign out
          </button>
        ) : (
          <div className="shrink-0">
            <form
              className="flex items-center gap-2"
              autoComplete="off"
              onSubmit={(e) => {
                e.preventDefault();
                sendMagicLink();
              }}
            >
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email for magic link"
                type="text"
                inputMode="email"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-form-type="other"
                data-lpignore="true"
                className="w-[190px] rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white placeholder:text-white/40 outline-none focus:border-white/25"
              />
              <button
                type="submit"
                disabled={loading || !email.trim() || cooldownActive}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-black hover:bg-white/90 disabled:opacity-50"
              >
                {cooldownActive ? `Wait ${cooldownSecondsLeft}s` : 'Sign in'}
              </button>
            </form>

            {/* Small, neat status line near the sign-in controls (no email, no secrets). */}
            {status && <div className="mt-1 text-[11px] text-white/70">{status}</div>}
          </div>
        )}
      </div>
    </div>
  );
}







