"use client";

import { ReaderSettingsProvider } from "@/components/reader-settings/reader-settings-provider";
import { ContentProtection } from "@/components/content-protection";
import { Navigation } from "@/components/navigation";
import { ReaderSettingsModal } from "@/components/reader-settings/reader-settings-modal";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { Footer } from "@/components/footer";

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

