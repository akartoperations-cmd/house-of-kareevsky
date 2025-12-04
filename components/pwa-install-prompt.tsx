"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download } from "lucide-react";

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Check if already installed
    const standalone = 
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    
    setIsStandalone(standalone);

    if (standalone) {
      return;
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Show prompt after a delay (give users time to explore)
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Check if iOS (which uses a different prompt)
    const iosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iosDevice);

    if (iosDevice && !standalone) {
      // Show iOS install instructions after delay
      setTimeout(() => {
        setShowPrompt(true);
      }, 5000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === "accepted") {
        setShowPrompt(false);
      }
      
      setDeferredPrompt(null);
    } else {
      // iOS instructions
      setShowPrompt(false);
    }
  };

  // Don't render anything during SSR or if already standalone
  if (!mounted || !showPrompt || isStandalone) {
    return null;
  }

  return (
    <AnimatePresence>
      {showPrompt && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setShowPrompt(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md mx-4"
          >
            <div className="bg-cream-50 rounded-2xl shadow-2xl p-6 border border-sand-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-bronze-100 rounded-lg">
                    <Download className="w-6 h-6 text-bronze-600" />
                  </div>
                  <div>
                    <h3 className="font-heading text-lg text-charcoal-900">
                      Install Digital Sanctuary
                    </h3>
                    <p className="text-sm text-charcoal-600">
                      Add to your home screen for a better experience
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPrompt(false)}
                  className="p-1 hover:bg-cream-200 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-charcoal-600" />
                </button>
              </div>

              {isIOS ? (
                <div className="space-y-3">
                  <p className="text-sm text-charcoal-700">
                    To install on iOS:
                  </p>
                  <ol className="list-decimal list-inside text-sm text-charcoal-600 space-y-1">
                    <li>Tap the Share button</li>
                    <li>Scroll down and tap &quot;Add to Home Screen&quot;</li>
                    <li>Tap &quot;Add&quot; to confirm</li>
                  </ol>
                </div>
              ) : (
                <button
                  onClick={handleInstall}
                  className="w-full px-4 py-3 bg-bronze-500 hover:bg-bronze-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Install Now
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
