"use client";

import dynamic from "next/dynamic";
import { ReaderSettingsProvider } from "@/components/reader-settings/reader-settings-provider";
import { ContentProtection } from "@/components/content-protection";
import { Navigation } from "@/components/navigation";
import { ReaderSettingsModal } from "@/components/reader-settings/reader-settings-modal";
import { Footer } from "@/components/footer";

// Dynamic import with SSR disabled for PWA component that uses window/navigator
const PWAInstallPrompt = dynamic(
  () => import("@/components/pwa-install-prompt").then((mod) => mod.PWAInstallPrompt),
  { ssr: false }
);

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
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
    </>
  );
}
