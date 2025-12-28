'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0f0d0c',
            color: '#f5f0e8',
            padding: '24px',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              background: '#171310',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
              textAlign: 'center',
            }}
          >
            <h1 style={{ fontSize: '20px', marginBottom: '8px' }}>Something went wrong</h1>
            <p style={{ fontSize: '14px', opacity: 0.85, marginBottom: '16px' }}>
              Please refresh the page.
            </p>
            <button
              onClick={() => {
                // eslint-disable-next-line no-console
                console.error(error?.digest || error?.message);
                if (reset) reset();
                else window.location.reload();
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: '#f5f0e8',
                color: '#0f0d0c',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

