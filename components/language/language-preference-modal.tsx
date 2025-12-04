"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface LanguagePreferenceModalProps {
  userId: string;
  onComplete: () => void;
}

const availableLanguages = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
] as const;

export function LanguagePreferenceModal({ userId, onComplete }: LanguagePreferenceModalProps) {
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["en"]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleLanguage = (code: string) => {
    setSelectedLanguages((prev) => {
      if (prev.includes(code)) {
        // Can&apos;t unselect if it&apos;s the only one
        if (prev.length === 1) return prev;
        return prev.filter((lang) => lang !== code);
      } else {
        return [...prev, code];
      }
    });
  };

  const handleSubmit = async () => {
    if (selectedLanguages.length === 0) return;

    setIsSubmitting(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("users")
      .update({ preferred_languages: selectedLanguages })
      .eq("id", userId);

    if (error) {
      console.error("Error updating language preferences:", error);
      setIsSubmitting(false);
      return;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("language-preferences-set", "true");
    }
    setIsSubmitting(false);
    onComplete();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 sm:w-full sm:max-w-md flex flex-col"
      >
        <div className="bg-cream-50 rounded-2xl shadow-2xl border border-sand-200 flex flex-col max-h-full sm:max-h-[85vh] overflow-hidden">
          {/* Fixed Header */}
          <div className="p-6 pb-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-bronze-100 rounded-lg">
                <Globe className="w-6 h-6 text-bronze-600" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-heading text-charcoal-900">
                  Welcome to Digital Sanctuary
                </h2>
                <p className="text-sm text-charcoal-600 mt-1">
                  Choose your preferred languages
                </p>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6">
            <p className="text-sm text-charcoal-700 mb-4">
              Select the languages you&apos;d like to see in your feed. You can change this anytime in settings.
            </p>
            <div className="space-y-2">
              {availableLanguages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => toggleLanguage(lang.code)}
                  disabled={selectedLanguages.length === 1 && selectedLanguages.includes(lang.code)}
                  className={cn(
                    "w-full px-4 py-3 rounded-lg border-2 text-left transition-all flex items-center gap-3",
                    selectedLanguages.includes(lang.code)
                      ? "border-bronze-400 bg-bronze-50"
                      : "border-sand-200 bg-white hover:border-sand-300",
                    selectedLanguages.length === 1 && selectedLanguages.includes(lang.code)
                      ? "opacity-75 cursor-not-allowed"
                      : ""
                  )}
                >
                  <span className="text-2xl">{lang.flag}</span>
                  <div className="flex-1">
                    <div className="font-medium text-charcoal-900">{lang.name}</div>
                    <div className="text-xs text-charcoal-600">{lang.code.toUpperCase()}</div>
                  </div>
                  {selectedLanguages.includes(lang.code) && (
                    <div className="w-5 h-5 rounded-full bg-bronze-500 flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-charcoal-500 mt-3">
              Note: Universal content (music, photos) will always appear regardless of language selection.
            </p>
          </div>

          {/* Fixed Footer */}
          <div className="p-6 pt-4 flex-shrink-0 border-t border-sand-100">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || selectedLanguages.length === 0}
              className="w-full px-6 py-3 bg-bronze-500 hover:bg-bronze-600 disabled:bg-sand-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {isSubmitting ? "Saving..." : "Continue"}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
