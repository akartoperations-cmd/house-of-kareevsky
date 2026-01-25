'use client';

import Script from 'next/script';

declare global {
  interface Window {
    digistorePromocode?: (params: { product_id: number; adjust_domain: boolean }) => void;
    __ds24PromoInited?: boolean;
  }
}

const PRODUCT_ID = 663680 as const;

export default function DigistorePromocodeScript() {
  const handleLoad = () => {
    if (typeof window === 'undefined') return;
    if (window.__ds24PromoInited) return;

    const params = { product_id: PRODUCT_ID, adjust_domain: true };

    let attemptsLeft = 3;
    const tryInit = () => {
      if (window.__ds24PromoInited) return;
      const fn = window.digistorePromocode;
      if (typeof fn === 'function') {
        try {
          fn(params);
          window.__ds24PromoInited = true;
        } catch {
          // Swallow errors to avoid breaking the page.
        }
        return;
      }

      attemptsLeft -= 1;
      if (attemptsLeft <= 0) return;
      setTimeout(tryInit, 250);
    };

    tryInit();
  };

  return (
    <Script
      src="https://www.digistore24-scripts.com/service/digistore.js"
      strategy="afterInteractive"
      onLoad={handleLoad}
    />
  );
}

