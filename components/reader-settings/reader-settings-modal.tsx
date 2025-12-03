"use client";

import { useState } from "react";
import { Settings, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useReaderSettings } from "./reader-settings-provider";
import { cn } from "@/lib/utils";

export function ReaderSettingsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const { settings, updateSettings } = useReaderSettings();

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
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg mx-4"
            >
              <div className="bg-cream-50 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-heading text-charcoal-900">Reader Settings</h2>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-cream-200 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Font Size */}
                <div className="mb-8">
                  <label className="block text-sm font-medium text-charcoal-700 mb-3">
                    Font Size
                  </label>
                  <div className="flex gap-2">
                    {fontSizeOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => updateSettings({ fontSize: option.value })}
                        className={cn(
                          "flex-1 px-4 py-2 rounded-lg border-2 transition-all",
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
                <div className="mb-8">
                  <label className="block text-sm font-medium text-charcoal-700 mb-3">
                    Font Style
                  </label>
                  <div className="space-y-2">
                    {fontStyleOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => updateSettings({ fontStyle: option.value })}
                        className={cn(
                          "w-full px-4 py-3 rounded-lg border-2 text-left transition-all",
                          settings.fontStyle === option.value
                            ? "border-bronze-400 bg-bronze-50"
                            : "border-sand-200 bg-white hover:border-sand-300"
                        )}
                      >
                        <div className="font-medium text-charcoal-900">{option.label}</div>
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
                          "px-4 py-3 rounded-lg border-2 transition-all",
                          settings.theme === option.value
                            ? "border-bronze-400 bg-bronze-50"
                            : "border-sand-200 bg-white hover:border-sand-300"
                        )}
                      >
                        <div className="font-medium text-charcoal-900">{option.label}</div>
                        <div className="text-xs text-charcoal-600">{option.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

