"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type FontSize = "normal" | "large" | "extra-large";
type FontStyle = "classic" | "elegant" | "modern" | "fashion" | "retro";
type Theme = "light" | "sepia" | "dark";

interface ReaderSettings {
  fontSize: FontSize;
  fontStyle: FontStyle;
  theme: Theme;
}

interface ReaderSettingsContextType {
  settings: ReaderSettings;
  updateSettings: (settings: Partial<ReaderSettings>) => void;
  mounted: boolean;
}

const defaultSettings: ReaderSettings = {
  fontSize: "normal",
  fontStyle: "classic",
  theme: "light",
};

const ReaderSettingsContext = createContext<ReaderSettingsContextType>({
  settings: defaultSettings,
  updateSettings: () => {},
  mounted: false,
});

export function ReaderSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ReaderSettings>(defaultSettings);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load settings from localStorage
    const saved = localStorage.getItem("reader-settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...defaultSettings, ...parsed });
      } catch (e) {
        console.error("Failed to parse reader settings", e);
      }
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    // Apply settings to document
    const root = document.documentElement;
    root.className = root.className
      .replace(/font-size-\w+/g, "")
      .replace(/font-\w+/g, "")
      .replace(/theme-\w+/g, "");
    
    root.classList.add(`font-size-${settings.fontSize}`);
    root.classList.add(`font-${settings.fontStyle}`);
    root.classList.add(`theme-${settings.theme}`);

    // Save to localStorage
    localStorage.setItem("reader-settings", JSON.stringify(settings));
  }, [settings, mounted]);

  const updateSettings = (newSettings: Partial<ReaderSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  // Always render with provider - never return children without context
  return (
    <ReaderSettingsContext.Provider value={{ settings, updateSettings, mounted }}>
      {children}
    </ReaderSettingsContext.Provider>
  );
}

export function useReaderSettings() {
  const context = useContext(ReaderSettingsContext);
  return context;
}

