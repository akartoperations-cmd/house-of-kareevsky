"use client";

import { useState, useEffect, useRef } from "react";
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
  // Use ref to track previous state for proper rollback on error
  const previousLanguagesRef = useRef<string[]>(["en"]);

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
        previousLanguagesRef.current = data.preferred_languages;
      }
      setIsLoading(false);
    }

    loadPreferences();
  }, [userId]);

  const toggleLanguage = async (code: string) => {
    // Calculate the new language list first
    let updated: string[] | null = null;

    setSelectedLanguages((prev) => {
      // Store previous state in ref before updating
      previousLanguagesRef.current = prev;

      if (prev.includes(code)) {
        // Can&apos;t unselect if it&apos;s the only one
        if (prev.length === 1) return prev;
        updated = prev.filter((lang) => lang !== code);
        return updated;
      } else {
        updated = [...prev, code];
        return updated;
      }
    });

    // Save preferences after state update, using the computed value
    if (updated !== null) {
      await savePreferences(updated);
    }
  };

  const savePreferences = async (newLanguages: string[]) => {
    if (!userId) return;

    setIsSaving(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("users")
      .update({ preferred_languages: newLanguages })
      .eq("id", userId);

    if (error) {
      console.error("Error updating language preferences:", error);
      // Revert to the previous state from ref (not stale closure)
      setSelectedLanguages(previousLanguagesRef.current);
    } else {
      // Update ref to current state on success
      previousLanguagesRef.current = newLanguages;
      if (typeof window !== "undefined") {
        localStorage.setItem("language-preferences-set", "true");
      }
    }

    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-charcoal-700 mb-3">
          Language Preferences
        </label>
        <div className="text-sm text-charcoal-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-charcoal-700 mb-2 flex items-center gap-2">
        <Globe className="w-4 h-4" />
        Language Preferences
      </label>
      <p className="text-xs text-charcoal-600 mb-3">
        Select languages for your feed. Universal content always appears.
      </p>
      <div className="space-y-1.5">
        {availableLanguages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => toggleLanguage(lang.code)}
            disabled={
              isSaving ||
              (selectedLanguages.length === 1 && selectedLanguages.includes(lang.code))
            }
            className={cn(
              "w-full px-3 py-2 rounded-lg border-2 text-left transition-all flex items-center gap-2",
              selectedLanguages.includes(lang.code)
                ? "border-bronze-400 bg-bronze-50"
                : "border-sand-200 bg-white hover:border-sand-300",
              isSaving ||
              (selectedLanguages.length === 1 && selectedLanguages.includes(lang.code))
                ? "opacity-75 cursor-not-allowed"
                : ""
            )}
          >
            <span className="text-xl">{lang.flag}</span>
            <div className="flex-1">
              <div className="font-medium text-charcoal-900 text-sm">{lang.name}</div>
            </div>
            {selectedLanguages.includes(lang.code) && (
              <div className="w-4 h-4 rounded-full bg-bronze-500 flex items-center justify-center">
                <span className="text-white text-[10px]">✓</span>
              </div>
            )}
          </button>
        ))}
      </div>
      {isSaving && (
        <p className="text-xs text-charcoal-500 mt-2">Saving...</p>
      )}
    </div>
  );
}
