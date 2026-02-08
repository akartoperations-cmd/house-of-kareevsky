'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useAccessRedirect } from '@/app/lib/useAccessRedirect';

type Status = { type: 'success' | 'error'; message: string } | null;

const checkoutUrl = process.env.NEXT_PUBLIC_DIGISTORE24_CHECKOUT_URL || '';

export default function ThankYouPage() {
  const access = useAccessRedirect('welcome');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>(null);
  const [sending, setSending] = useState(false);

  const checkoutConfigured = Boolean(checkoutUrl);

  const enterCta = useMemo(() => {
    return {
      label: 'Enter',
      onClick: () => {
        if (!checkoutConfigured) {
          setStatus({ type: 'error', message: 'Checkout is not configured yet.' });
          return;
        }
        window.location.href = checkoutUrl;
      },
    };
  }, [checkoutConfigured]);

  const handleSendLink = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setStatus({ type: 'error', message: 'Please enter your email.' });
      return;
    }

    setSending(true);
    setStatus(null);

    try {
      const res = await fetch('/api/access/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });

      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };

      if (!res.ok) {
        setStatus({
          type: 'error',
          message: data?.error || 'Unable to verify access right now.',
        });
        return;
      }

      setStatus({
        type: 'success',
        message: data?.message || 'Check your email for your access link.',
      });
      setEmail('');
    } catch {
      setStatus({ type: 'error', message: 'Unable to verify access right now.' });
    } finally {
      setSending(false);
    }
  };

  // If user already has access, the guard will redirect to "/".
  if (access.status !== 'allowed') {
    return (
      <div className="welcome-page">
        <div className="welcome-card">
          <div className="welcome-loading">
            {access.status === 'redirecting' ? 'Taking you to your feed…' : 'Checking access…'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="welcome-page">
      <div className="welcome-card">
        <div className="welcome-hero">
          <div className="welcome-logo-wrap">
            <div className="welcome-logo-bg">
              <img src="/logo.svg" alt="House of Kareevsky" className="welcome-logo" />
            </div>
          </div>
          <div className="welcome-tagline">Thank you!</div>
        </div>

        <div className="welcome-content">
          <div className="welcome-block">
            <p>After payment, enter your email again to receive your access link.</p>
          </div>

          <form
            className="welcome-returning__form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendLink();
            }}
          >
            <label className="welcome-input__label" htmlFor="thankyou-email">
              Email
            </label>
            <input
              id="thankyou-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="welcome-input"
              placeholder="you@example.com"
              required
            />
            <button
              type="submit"
              className="welcome-button welcome-button--primary welcome-button--wide"
              disabled={sending}
            >
              {sending ? 'Sending…' : 'Send access link'}
            </button>
          </form>

          {status && (
            <div
              className={`welcome-status ${status.type === 'success' ? 'welcome-status--success' : 'welcome-status--error'}`}
              role="status"
            >
              {status.message}
            </div>
          )}

          {status?.type === 'error' && (
            <div className="welcome-actions" style={{ marginTop: 16 }}>
              <button className="welcome-button welcome-button--primary" onClick={enterCta.onClick}>
                {enterCta.label}
              </button>
            </div>
          )}
        </div>

        <div className="welcome-footer">
          <div className="welcome-footer__links">
            <small>Payments are processed by Digistore24.</small>
          </div>
          <div className="welcome-footer__links">
            <Link href="/terms" className="welcome-link">
              Terms
            </Link>
            <span className="welcome-footer__divider" />
            <Link href="/privacy" className="welcome-link">
              Privacy
            </Link>
            <span className="welcome-footer__divider" />
            <Link href="/legal-notice" className="welcome-link">
              Legal Notice
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

