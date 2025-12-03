"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LanguagePreferenceModal } from "@/components/language/language-preference-modal";

interface ContentWithLanguageSetupProps {
  userId: string;
  children: React.ReactNode;
}

export function ContentWithLanguageSetup({ userId, children }: ContentWithLanguageSetupProps) {
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  useEffect(() => {
    // Check if user has already set language preferences
    async function checkPreferences() {
      const hasCustomPrefs = localStorage.getItem("language-preferences-set");
      if (hasCustomPrefs) {
        setShowLanguageModal(false);
        return;
      }

      // Check database for preferences
      const supabase = createClient();
      const { data } = await supabase
        .from("users")
        .select("preferred_languages")
        .eq("id", userId)
        .single();

      // If user only has default ['en'] or no preferences, show modal
      if (!data || !data.preferred_languages || data.preferred_languages.length === 0 || 
          (data.preferred_languages.length === 1 && data.preferred_languages[0] === 'en')) {
        setShowLanguageModal(true);
      }
    }

    if (userId) {
      checkPreferences();
    }
  }, [userId]);

  const handleLanguageSetupComplete = () => {
    setShowLanguageModal(false);
  };

  return (
    <>
      {children}
      {showLanguageModal && (
        <LanguagePreferenceModal userId={userId} onComplete={handleLanguageSetupComplete} />
      )}
    </>
  );
}

