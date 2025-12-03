import type { Metadata } from "next";
import "./globals.css";
import { ContentProtection } from "@/components/content-protection";
import { ReaderSettingsProvider } from "@/components/reader-settings/reader-settings-provider";
import { ReaderSettingsModal } from "@/components/reader-settings/reader-settings-modal";
import { Navigation } from "@/components/navigation";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Digital Sanctuary",
  description: "A quiet space for exclusive artistic content",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Digital Sanctuary",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#3d3d3d" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Digital Sanctuary" />
      </head>
      <body>
        <ContentProtection />
        <ReaderSettingsProvider>
          <div className="flex flex-col min-h-screen">
            <Navigation />
            <div className="flex-1">
              {children}
            </div>
            <Footer />
          </div>
          <ReaderSettingsModal />
          <PWAInstallPrompt />
        </ReaderSettingsProvider>
      </body>
    </html>
  );
}
