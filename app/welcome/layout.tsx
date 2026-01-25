import Script from 'next/script';

export default function WelcomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Digistore24 scripts - using beforeInteractive to appear in view-source */}
      <Script
        src="https://www.digistore24-scripts.com/service/digistore.js"
        strategy="beforeInteractive"
      />
      <Script
        id="ds24-promocode-init"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
(function() {
  if (window.__ds24PromoInited) return;
  window.__ds24PromoInited = true;
  function initDS24Promo() {
    if (typeof window.digistorePromocode === 'function') {
      window.digistorePromocode({ product_id: 663680, adjust_domain: true });
    }
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initDS24Promo, 0);
  } else {
    document.addEventListener('DOMContentLoaded', initDS24Promo);
  }
})();
          `,
        }}
      />
      {children}
    </>
  );
}
