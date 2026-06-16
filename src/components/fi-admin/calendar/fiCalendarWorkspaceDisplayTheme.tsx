"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/** Persisted only for FI OS scheduling workspace — does not affect global app theme. */
export const FI_OS_CALENDAR_DISPLAY_THEME_STORAGE_KEY = "fi-os-calendar-display-theme";

export type FiCalendarWorkspaceDisplayTheme = "dark" | "light";

type FiCalendarWorkspaceDisplayThemeContextValue = {
  theme: FiCalendarWorkspaceDisplayTheme;
  setTheme: (t: FiCalendarWorkspaceDisplayTheme) => void;
};

const FiCalendarWorkspaceDisplayThemeContext =
  createContext<FiCalendarWorkspaceDisplayThemeContextValue | null>(null);

export function FiCalendarWorkspaceDisplayThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<FiCalendarWorkspaceDisplayTheme>("dark");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FI_OS_CALENDAR_DISPLAY_THEME_STORAGE_KEY);
      if (raw === "light" || raw === "dark") setThemeState(raw);
    } catch {
      /* ignore */
    }
  }, []);

  const setTheme = useCallback((t: FiCalendarWorkspaceDisplayTheme) => {
    setThemeState(t);
    try {
      window.localStorage.setItem(FI_OS_CALENDAR_DISPLAY_THEME_STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <FiCalendarWorkspaceDisplayThemeContext.Provider value={value}>{children}</FiCalendarWorkspaceDisplayThemeContext.Provider>
  );
}

export function useFiCalendarWorkspaceDisplayTheme(): FiCalendarWorkspaceDisplayThemeContextValue | null {
  return useContext(FiCalendarWorkspaceDisplayThemeContext);
}
