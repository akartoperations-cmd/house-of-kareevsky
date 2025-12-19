'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';

type AuthBarProps = {
  onAuthState: (session: Session | null, isAdmin: boolean) => void;
};

const getAdminEmail = () => (process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').trim().toLowerCase();

export function AuthBar({ onAuthState }: AuthBarProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const adminEmail = useMemo(() => getAdminEmail(), []);
  const authedEmail = (session?.user?.email || '').trim().toLowerCase();
  const isAdmin = Boolean(adminEmail) && authedEmail === adminEmail;

  useEffect(() => {
    let mounted = true;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      return () => {
        mounted = false;
      };
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setStatus(error.message);
      setSession(data.session ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    onAuthState(session, isAdmin);
  }, [session, isAdmin, onAuthState]);

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
      const emailRedirectTo = `${window.location.origin}/`;
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
    <div className="fixed left-0 right-0 top-0 z-[1000] border-b border-white/10 bg-black/40 backdrop-blur">
      <div className="mx-auto flex max-w-[520px] items-center justify-between gap-3 px-4 py-2 text-sm text-white/90">
        <div className="min-w-0">
          {session ? (
            <div className="truncate">
              Signed in as <span className="font-medium text-white">{session.user.email}</span>
              {isAdmin && <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs">admin</span>}
            </div>
          ) : (
            <div className="truncate text-white/70">Guest mode</div>
          )}
          {adminEmail ? null : (
            <div className="mt-0.5 text-xs text-amber-200/90">
              Missing <span className="font-mono">NEXT_PUBLIC_ADMIN_EMAIL</span> (admin UI disabled).
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






