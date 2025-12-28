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
  isSubscriber: boolean;
};

const subscriptionKeys = [
  'subscription_status',
  'subscriptionStatus',
  'subscription',
  'plan_status',
  'planStatus',
  'isSubscriber',
  'is_subscriber',
  'subscriber',
  'paid',
];

const hasActiveSubscription = (session: Session | null) => {
  if (!session) return false;
  const metaSources = [session.user.app_metadata, session.user.user_metadata];

  return metaSources.some((meta) =>
    subscriptionKeys.some((key) => {
      const value = (meta as Record<string, unknown> | undefined)?.[key];
      return value === true || value === 'active' || value === 'trialing';
    }),
  );
};

export function useAccessRedirect(target: AccessGuardTarget): AccessState {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<AccessState>({
    status: 'checking',
    session: null,
    isAdmin: false,
    isSubscriber: false,
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

    const evaluateAccess = async (nextSession: Session | null) => {
      const email = normalizeEmail(nextSession?.user?.email);
      const isAdmin = await checkAdmin(email);
      const isSubscriber = isAdmin || hasActiveSubscription(nextSession) || Boolean(nextSession);
      const onWelcome = pathname === '/welcome' || pathname?.startsWith('/welcome/');

      if (cancelled) return;

      if (target === 'feed' && !isAdmin && !isSubscriber) {
        setState({ status: 'redirecting', session: nextSession, isAdmin, isSubscriber });
        ensureRedirect('/welcome');
        return;
      }

      if (target === 'welcome' && (isAdmin || isSubscriber)) {
        setState({ status: 'redirecting', session: nextSession, isAdmin, isSubscriber });
        if (onWelcome) {
          ensureRedirect('/');
        }
        return;
      }

      redirectingRef.current = false;
      setState({ status: 'allowed', session: nextSession, isAdmin, isSubscriber });
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


