'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { externalPlatforms, type ExternalPlatform } from '@/app/lib/externalPlatforms';
import { useAccessRedirect } from '@/app/lib/useAccessRedirect';

type Step = 1 | 2 | 3;
type Status =
  | { type: 'success' | 'error'; message: string }
  | null;

const STORY_BLOCKS = [
  'Hi, dear! I intentionally refuse Instagram, Spotify, YouTube, and all the others, and I am building my own storage and haven and my self-sufficient space for communication and connection with my audience. Never and nowhere will my art exist in digital form except my own app.',
  "I have been doing music for 18 years, 15 years of vocal, 7 years of literature, and all this time I was preparing for this moment. And now I created my own app myself using AI. Inside my app there is everything: my stories, notes, drafts, covers, original songs and music, film photos, oil works on canvas, and always in full volume both audio and video, and also a vlog! And there I am with my audience at arm's length and at a distance of warmth and spiritual closeness. And everywhere in social networks there will be only excerpts.",
  'The world of art is going through a unique evolution and I am one of the first who begins it. I do not follow corporations! I decided to create my own app and space for my art, and instead of getting 0.003 dollars per listen and somehow saving up, I decided to create my own place where I will be all me and all my art and I will be much closer than Patreon and YouTube or Spotify. Even 300 people who buy a subscription already give me the opportunity to create much more and without restrictions. And I will be able to devote all my time to art and dedicate my life to it.',
];

const checkoutUrl = process.env.NEXT_PUBLIC_DIGISTORE24_CHECKOUT_URL || '';
const checkoutConfigured = Boolean(checkoutUrl);

const platformIcons: Record<ExternalPlatform['icon'], JSX.Element> = {
  instagram: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="17.5" cy="6.5" r="1.25" />
    </svg>
  ),
  book: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 4.5h10a2 2 0 0 1 2 2v12.25c0 .69-.56 1.25-1.25 1.25H6a2 2 0 0 1-2-2v-11.5a2 2 0 0 1 2-2z" />
      <path d="M6 6.5h12" />
    </svg>
  ),
};

export default function WelcomePage() {
  const access = useAccessRedirect('welcome');
  const [step, setStep] = useState<Step>(1);
  const [showReturnerForm, setShowReturnerForm] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>(null);
  const [sending, setSending] = useState(false);

  const visibleBlocks = useMemo(() => STORY_BLOCKS.slice(0, step), [step]);

  const handleTellMeMore = () => {
    setStep((prev) => (prev < 3 ? ((prev + 1) as Step) : prev));
  };

  const handleEnter = () => {
    if (!checkoutConfigured) {
      setStatus({ type: 'error', message: 'Checkout is not configured yet.' });
      return;
    }
    window.location.href = checkoutUrl;
  };

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
      setStatus({ type: 'error', message: 'Unable to send link right now.' });
    } finally {
      setSending(false);
    }
  };

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
          <div className="welcome-tagline">Private Atelier • Complete Works • Vlog</div>
        </div>

        <div className="welcome-content">
          {visibleBlocks.map((block, idx) => (
            <div key={idx} className="welcome-block">
              <p>{block}</p>
            </div>
          ))}

          <div className="welcome-actions">
            <button className="welcome-button welcome-button--primary" onClick={handleEnter}>
              Enter
            </button>
            <button
              className="welcome-button welcome-button--ghost"
              onClick={() => {
                setShowReturnerForm(true);
                setStatus(null);
              }}
            >
              I already have access
            </button>
            {step < 3 && (
              <button className="welcome-button" onClick={handleTellMeMore}>
                Tell me more
              </button>
            )}
          </div>

          {externalPlatforms.length > 0 && (
            <div className="welcome-preview">
              <div className="welcome-preview__text">
                <span className="welcome-preview__title">Want a quick preview first?</span>
                <span className="welcome-preview__subtitle">Short excerpts are here:</span>
              </div>
              <div className="welcome-preview__icons">
                {externalPlatforms.map((platform) => (
                  <a
                    key={platform.id}
                    className="welcome-preview__button"
                    href={platform.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="welcome-preview__icon" aria-hidden="true">
                      {platformIcons[platform.icon]}
                    </span>
                    <span className="welcome-preview__label">{platform.label}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="welcome-returning">
            {showReturnerForm && (
              <form
                className="welcome-returning__form"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendLink();
                }}
              >
                <label className="welcome-input__label" htmlFor="welcome-email">
                  Email
                </label>
                <input
                  id="welcome-email"
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
            )}

            {status && (
              <div
                className={`welcome-status ${
                  status.type === 'success' ? 'welcome-status--success' : 'welcome-status--error'
                }`}
                role="status"
              >
                {status.message}
              </div>
            )}

            {status?.type === 'error' && (
              <div className="welcome-actions" style={{ marginTop: 16 }}>
                <button className="welcome-button welcome-button--primary" onClick={handleEnter}>
                  Enter
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="welcome-footer">
          <div className="welcome-footer__links">
            <Link href="/terms" className="welcome-link">
              Terms
            </Link>
            <span className="welcome-footer__divider" />
            <Link href="/privacy" className="welcome-link">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

