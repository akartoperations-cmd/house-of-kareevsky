'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from './supabaseClient';
import { normalizeEmail } from './access';

type AccessGuardTarget = 'feed' | 'welcome';
type AccessStatus = 'checking' | 'allowed' | 'redirecting';

type AccessState = {
  status: AccessStatus;
  session: Session | null;
  isAdmin: boolean;
  hasActiveSubscription: boolean;
};

type SubscriptionRow = {
  id: string;
  user_id: string | null;
  email: string;
  status: string;
};

export function useAccessRedirect(target: AccessGuardTarget): AccessState {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<AccessState>({
    status: 'checking',
    session: null,
    isAdmin: false,
    hasActiveSubscription: false,
  });

  const redirectingRef = useRef(false);
  const adminCacheRef = useRef<Record<string, boolean>>({});

  const checkAdmin = useCallback(async (email: string) => {
    const normalized = normalizeEmail(email);
    if (!normalized) return false;

    // Check localStorage cache first (survives reload, works offline)
    const storageKey = `admin_status_${normalized}`;
    if (adminCacheRef.current[normalized] !== undefined) {
      return adminCacheRef.current[normalized];
    }
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached !== null) {
        const val = cached === 'true';
        adminCacheRef.current[normalized] = val;
        return val;
      }
    } catch {
      // localStorage unavailable
    }

    // Fetch with timeout to avoid hanging on slow/offline connections
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch('/api/admin/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error('admin check failed');
      const data = (await res.json()) as { isAdmin?: boolean };
      const isAdmin = Boolean(data?.isAdmin);
      adminCacheRef.current[normalized] = isAdmin;
      try {
        localStorage.setItem(storageKey, String(isAdmin));
      } catch {
        // ignore
      }
      return isAdmin;
    } catch {
      clearTimeout(timeout);
      // On network failure, default to false but don't cache permanently
      return false;
    }
  }, []);

  const ensureRedirect = useCallback(
    (targetPath: string) => {
      if (redirectingRef.current) return;
      const onTarget = pathname === targetPath || pathname?.startsWith(`${targetPath}/`);
      if (onTarget) return;
      redirectingRef.current = true;
      router.replace(targetPath);
    },
    [pathname, router],
  );

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      if (target === 'feed') {
        setState((prev) => ({ ...prev, status: 'redirecting' }));
        ensureRedirect('/welcome');
      } else {
        setState((prev) => ({ ...prev, status: 'allowed' }));
      }
      return;
    }

    let cancelled = false;

    const checkSubscriptionActive = async (nextSession: Session | null): Promise<boolean> => {
      if (!nextSession) return false;

      const email = normalizeEmail(nextSession.user?.email);
      const userId = nextSession.user?.id || null;

      try {
        // Prefer user_id match when available (stronger link), then fallback to email.
        if (userId) {
          const { data, error } = await supabase
            .from('subscriptions')
            .select('id,user_id,email,status')
            .eq('user_id', userId)
            .eq('status', 'active')
            .limit(1);
          if (error) throw error;
          if ((data as SubscriptionRow[] | null)?.length) return true;
        }

        if (email) {
          const { data, error } = await supabase
            .from('subscriptions')
            .select('id,user_id,email,status')
            .eq('email', email)
            .eq('status', 'active')
            .limit(1);
          if (error) throw error;
          const row = (data as SubscriptionRow[] | null | undefined)?.[0];
          if (!row) return false;

          // Best-effort: bind user_id on first successful login.
          if (userId && !row.user_id) {
            try {
              await supabase.from('subscriptions').update({ user_id: userId }).eq('id', row.id);
            } catch (err) {
              if (process.env.NODE_ENV !== 'production') {
                console.warn('[access] Failed to bind subscription user_id', err);
              }
            }
          }
          return true;
        }

        return false;
      } catch (err) {
        // Do not crash on missing tables or network errors; default to safe denial.
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[access] Subscription check failed (default deny)', err);
        }
        return false;
      }
    };

    const evaluateAccess = async (nextSession: Session | null) => {
      const email = normalizeEmail(nextSession?.user?.email);
      const isAdmin = await checkAdmin(email);
      const hasSubscription = isAdmin ? true : await checkSubscriptionActive(nextSession);
      const onWelcome = pathname === '/welcome' || pathname?.startsWith('/welcome/');

      if (cancelled) return;

      // If the user has a session but no active subscription (and is not admin), force sign-out and redirect.
      if (nextSession && !isAdmin && !hasSubscription) {
        try {
          await supabase.auth.signOut();
        } catch (err) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[access] signOut failed', err);
          }
        }
        setState({ status: 'redirecting', session: null, isAdmin, hasActiveSubscription: false });
        ensureRedirect('/welcome');
        return;
      }

      if (target === 'feed' && !isAdmin && !hasSubscription) {
        setState({ status: 'redirecting', session: nextSession, isAdmin, hasActiveSubscription: hasSubscription });
        ensureRedirect('/welcome');
        return;
      }

      if (target === 'welcome' && (isAdmin || hasSubscription)) {
        setState({ status: 'redirecting', session: nextSession, isAdmin, hasActiveSubscription: hasSubscription });
        if (onWelcome) {
          ensureRedirect('/');
        }
        return;
      }

      redirectingRef.current = false;
      setState({ status: 'allowed', session: nextSession, isAdmin, hasActiveSubscription: hasSubscription });
    };

    supabase.auth
      .getSession()
      .then(({ data }) => evaluateAccess(data.session ?? null))
      .catch(() => evaluateAccess(null));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      redirectingRef.current = false;
      evaluateAccess(nextSession);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [checkAdmin, ensureRedirect, pathname, target]);

  return useMemo(() => state, [state]);
}


