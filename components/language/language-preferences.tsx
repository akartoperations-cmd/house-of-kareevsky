"use client";

import { useState, useEffect } from "react";
import { Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface LanguagePreferencesProps {
  userId: string;
}

const availableLanguages = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
] as const;

export function LanguagePreferences({ userId }: LanguagePreferencesProps) {
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["en"]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadPreferences() {
      if (!userId) return;

      const supabase = createClient();
      const { data } = await supabase
        .from("users")
        .select("preferred_languages")
        .eq("id", userId)
        .single();

      if (data && data.preferred_languages) {
        setSelectedLanguages(data.preferred_languages);
      }
      setIsLoading(false);
    }

    loadPreferences();
  }, [userId]);

  const toggleLanguage = (code: string) => {
    setSelectedLanguages((prev) => {
      if (prev.includes(code)) {
        // Can't unselect if it's the only one
        if (prev.length === 1) return prev;
        const updated = prev.filter((lang) => lang !== code);
        savePreferences(updated);
        return updated;
      } else {
        const updated = [...prev, code];
        savePreferences(updated);
        return updated;
      }
    });
  };

  const savePreferences = async (languages: string[]) => {
    if (!userId) return;

    setIsSaving(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("users")
      .update({ preferred_languages: languages })
      .eq("id", userId);

    if (error) {
      console.error("Error updating language preferences:", error);
      // Revert on error
      setSelectedLanguages(selectedLanguages);
    } else {
      localStorage.setItem("language-preferences-set", "true");
    }

    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="mb-8">
        <label className="block text-sm font-medium text-charcoal-700 mb-3">
          Language Preferences
        </label>
        <div className="text-sm text-charcoal-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <label className="block text-sm font-medium text-charcoal-700 mb-3 flex items-center gap-2">
        <Globe className="w-4 h-4" />
        Language Preferences
      </label>
      <p className="text-xs text-charcoal-600 mb-3">
        Select languages you'd like to see in your feed. Universal content (music, photos) always appears.
      </p>
      <div className="space-y-2">
        {availableLanguages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => toggleLanguage(lang.code)}
            disabled={
              isSaving ||
              (selectedLanguages.length === 1 && selectedLanguages.includes(lang.code))
            }
            className={cn(
              "w-full px-4 py-3 rounded-lg border-2 text-left transition-all flex items-center gap-3",
              selectedLanguages.includes(lang.code)
                ? "border-bronze-400 bg-bronze-50"
                : "border-sand-200 bg-white hover:border-sand-300",
              isSaving ||
              (selectedLanguages.length === 1 && selectedLanguages.includes(lang.code))
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
      {isSaving && (
        <p className="text-xs text-charcoal-500 mt-2">Saving preferences...</p>
      )}
    </div>
  );
}
