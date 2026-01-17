import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const ONE_SIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "129c2cca-f76f-43e0-aa03-8c63a19557ac";
const ALLOW_LOCALHOST_AS_SECURE_ORIGIN = process.env.NODE_ENV !== "production";

export const metadata: Metadata = {
  title: "House of Kareevsky",
  description: "A private messenger-like home for stories, songs and letters",
  applicationName: "House of Kareevsky",
  manifest: "/manifest.webmanifest",
  themeColor: "#000000",
  appleWebApp: {
    statusBarStyle: "black-translucent",
    title: "House of Kareevsky",
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/icon-192x192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;500&family=Inter:wght@400;500;600&display=swap"
        />
        <Script src="https://cdn.onesignal.com/sdks/OneSignalSDK.js" strategy="afterInteractive" defer />
        <Script
          id="onesignal-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                window.OneSignalDeferred = window.OneSignalDeferred || [];
                window.OneSignalDeferred.push(function(OneSignal) {
                  OneSignal.init({
                    appId: "${ONE_SIGNAL_APP_ID}",
                    serviceWorkerPath: "/OneSignalSDKWorker.js",
                    serviceWorkerUpdaterPath: "/OneSignalSDKUpdaterWorker.js",
                    serviceWorkerParam: { scope: "/" },
                    notifyButton: { enable: false },
                    allowLocalhostAsSecureOrigin: ${ALLOW_LOCALHOST_AS_SECURE_ORIGIN}
                  });
                });
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

