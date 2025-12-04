"use client";

import { useState, useEffect } from "react";
import { Settings, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useReaderSettings } from "./reader-settings-provider";
import { LanguagePreferences } from "@/components/language/language-preferences";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function ReaderSettingsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { settings, updateSettings } = useReaderSettings();

  useEffect(() => {
    async function getUserId() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    }
    getUserId();
  }, []);

  const fontSizeOptions = [
    { value: "normal", label: "Normal" },
    { value: "large", label: "Large" },
    { value: "extra-large", label: "Extra Large" },
  ] as const;

  const fontStyleOptions = [
    { value: "classic", label: "Classic", desc: "Merriweather" },
    { value: "elegant", label: "Elegant", desc: "Cormorant Garamond" },
    { value: "modern", label: "Modern", desc: "Inter" },
    { value: "fashion", label: "Fashion", desc: "Montserrat" },
    { value: "retro", label: "Retro", desc: "Courier Prime" },
  ] as const;

  const themeOptions = [
    { value: "light", label: "Light", desc: "Cream" },
    { value: "sepia", label: "Sepia", desc: "Warm" },
    { value: "dark", label: "Dark", desc: "Charcoal" },
  ] as const;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 p-3 bg-cream-200 hover:bg-cream-300 rounded-full shadow-lg transition-colors"
        aria-label="Reader Settings"
      >
        <Settings className="w-6 h-6 text-charcoal-700" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 sm:w-full sm:max-w-lg flex flex-col"
            >
              <div className="bg-cream-50 rounded-2xl shadow-2xl flex flex-col max-h-full sm:max-h-[85vh] overflow-hidden">
                {/* Fixed Header */}
                <div className="flex items-center justify-between p-6 pb-4 border-b border-sand-200 flex-shrink-0">
                  <h2 className="text-2xl font-heading text-charcoal-900">Reader Settings</h2>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-cream-200 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 pt-4">
                  {/* Font Size */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-charcoal-700 mb-3">
                      Font Size
                    </label>
                    <div className="flex gap-2">
                      {fontSizeOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => updateSettings({ fontSize: option.value })}
                          className={cn(
                            "flex-1 px-3 py-2 rounded-lg border-2 transition-all text-sm",
                            settings.fontSize === option.value
                              ? "border-bronze-400 bg-bronze-50 text-bronze-900"
                              : "border-sand-200 bg-white text-charcoal-700 hover:border-sand-300"
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Font Style */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-charcoal-700 mb-3">
                      Font Style
                    </label>
                    <div className="space-y-2">
                      {fontStyleOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => updateSettings({ fontStyle: option.value })}
                          className={cn(
                            "w-full px-4 py-2.5 rounded-lg border-2 text-left transition-all",
                            settings.fontStyle === option.value
                              ? "border-bronze-400 bg-bronze-50"
                              : "border-sand-200 bg-white hover:border-sand-300"
                          )}
                        >
                          <div className="font-medium text-charcoal-900 text-sm">{option.label}</div>
                          <div className="text-xs text-charcoal-600">{option.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Theme */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-charcoal-700 mb-3">
                      Theme
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {themeOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => updateSettings({ theme: option.value })}
                          className={cn(
                            "px-3 py-2.5 rounded-lg border-2 transition-all",
                            settings.theme === option.value
                              ? "border-bronze-400 bg-bronze-50"
                              : "border-sand-200 bg-white hover:border-sand-300"
                          )}
                        >
                          <div className="font-medium text-charcoal-900 text-sm">{option.label}</div>
                          <div className="text-xs text-charcoal-600">{option.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Language Preferences */}
                  {userId && (
                    <div className="border-t border-sand-200 pt-6">
                      <LanguagePreferences userId={userId} />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
