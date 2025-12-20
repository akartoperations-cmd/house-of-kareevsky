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
  const [bannerState, setBannerState] = useState<BannerState>('hidden');

  const authedEmail = (session?.user?.email || '').trim().toLowerCase();
  const showBanner = bannerState !== 'hidden';
  const bannerFading = bannerState === 'fading';

  useEffect(() => {
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    if (session) {
      setBannerState('visible');
      fadeTimer = setTimeout(() => setBannerState('fading'), 3000);
      hideTimer = setTimeout(() => setBannerState('hidden'), 4000);
    } else {
      setBannerState('hidden');
    }

    return () => {
      if (fadeTimer) clearTimeout(fadeTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [session]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setDebugAdmin(params.get('debugAdmin') === '1');
  }, []);

  useEffect(() => {
    let mounted = true;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      setIsSessionLoading(false);
      return () => {
        mounted = false;
      };
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setStatus(error.message);
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
      setStatus('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }

    const trimmed = email.trim();
    if (!trimmed) return;

    setLoading(true);
    setStatus(null);
    try {
      const emailRedirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo },
      });
      if (error) throw error;
      setStatus('Check your email for the sign-in link.');
      setEmail('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign-in failed.';
      setStatus(msg);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
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

  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-0 z-[900]"
      style={{ paddingTop: '4px' }}
    >
      <div
        className={`pointer-events-auto mx-auto flex max-w-[520px] items-center justify-between gap-3 px-4 py-2 text-sm text-white/90 transition-opacity duration-500 ${
          showBanner ? 'opacity-100' : 'opacity-0'
        } ${bannerFading ? 'opacity-0' : ''} border-b border-white/10 bg-black/60 backdrop-blur rounded-b-lg`}
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
          <div className="flex shrink-0 items-center gap-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email for magic link"
              inputMode="email"
              autoComplete="email"
              className="w-[190px] rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white placeholder:text-white/40 outline-none focus:border-white/25"
            />
            <button
              type="button"
              onClick={sendMagicLink}
              disabled={loading || !email.trim()}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-black hover:bg-white/90 disabled:opacity-50"
            >
              Sign in
            </button>
          </div>
        )}
      </div>

      {status && (
        <div className="mx-auto max-w-[520px] px-4 pb-2 text-xs text-white/70">
          {status}
        </div>
      )}
    </div>
  );
}







