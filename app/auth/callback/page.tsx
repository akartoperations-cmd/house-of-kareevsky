'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';

type CallbackStatus = 'loading' | 'success' | 'error';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<CallbackStatus>('loading');
  const [errorCode, setErrorCode] = useState<string>('none');
  const [debugAuth, setDebugAuth] = useState(false);

  useEffect(() => {
    // Check for debug mode
    const params = new URLSearchParams(window.location.search);
    setDebugAuth(params.get('debugAuth') === '1');

    const handleCallback = async () => {
      const supabase = getSupabaseBrowserClient();

      // If Supabase client unavailable, show error
      if (!supabase) {
        setStatus('error');
        setErrorCode('auth_unavailable');
        return;
      }

      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const errorParam = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');

      // Check for explicit error from Supabase
      if (errorParam) {
        setStatus('error');
        setErrorCode(errorParam);
        return;
      }

      // Handle PKCE code flow (most common for magic links)
      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setStatus('error');
            setErrorCode(error.code || error.name || 'exchange_failed');
            return;
          }
          setStatus('success');
          // Give a brief moment for session to persist, then redirect
          setTimeout(() => router.replace('/'), 500);
          return;
        } catch (e) {
          setStatus('error');
          setErrorCode('exchange_exception');
          return;
        }
      }

      // Handle hash fragment tokens (older implicit flow)
      // Hash fragments like #access_token=... are processed by supabase-js automatically
      // when detectSessionInUrl is enabled, but we need to give it time
      if (window.location.hash && window.location.hash.includes('access_token')) {
        // Wait a tick for supabase-js to process the hash
        await new Promise((resolve) => setTimeout(resolve, 100));
        try {
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            setStatus('error');
            setErrorCode(error.code || error.name || 'session_error');
            return;
          }
          if (data.session) {
            setStatus('success');
            setTimeout(() => router.replace('/'), 500);
            return;
          }
        } catch {
          // Fall through to error
        }
      }

      // No code and no hash tokens - try to get existing session
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setStatus('success');
          setTimeout(() => router.replace('/'), 500);
          return;
        }
      } catch {
        // Ignore and show error
      }

      // If we reach here, no valid auth flow detected
      setStatus('error');
      setErrorCode('no_auth_params');
    };

    handleCallback();
  }, [router]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        color: 'white',
        fontFamily: 'system-ui, sans-serif',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      {status === 'loading' && (
        <>
          <div
            style={{
              width: 32,
              height: 32,
              border: '3px solid rgba(255,255,255,0.2)',
              borderTopColor: 'white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <p style={{ marginTop: 16, opacity: 0.8 }}>Signing you in…</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <p style={{ opacity: 0.9 }}>Success! Redirecting…</p>
        </>
      )}

      {status === 'error' && (
        <>
          <p style={{ fontSize: 18, marginBottom: 12 }}>Sign-in failed</p>
          <p style={{ opacity: 0.7, marginBottom: 24, maxWidth: 300 }}>
            The link may have expired or already been used. Please try again.
          </p>
          <a
            href="/"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: 'white',
              color: 'black',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Back to home
          </a>
        </>
      )}

      {/* Debug output when ?debugAuth=1 */}
      {debugAuth && (
        <div
          style={{
            position: 'fixed',
            bottom: 16,
            left: 16,
            right: 16,
            background: 'rgba(0,0,0,0.8)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 8,
            padding: 12,
            fontSize: 11,
            fontFamily: 'monospace',
            color: 'rgba(255,255,255,0.7)',
            textAlign: 'left',
          }}
        >
          <div>authCallback: {status === 'success' ? 'ok' : status === 'error' ? 'fail' : 'pending'}</div>
          <div>errorCode: {errorCode}</div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

