"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_PREFS, pickTitle, type Prefs } from "@/lib/prefs-shared";
import { translator, type MessageKey } from "@/lib/i18n";

type Ctx = { prefs: Prefs; loggedIn: boolean };

const PrefsContext = createContext<Ctx>({ prefs: DEFAULT_PREFS, loggedIn: false });

export function PrefsProvider({ prefs, loggedIn, children }: { prefs: Prefs; loggedIn: boolean; children: React.ReactNode }) {
  const value = useMemo(() => ({ prefs, loggedIn }), [prefs, loggedIn]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  return useContext(PrefsContext);
}

export function useT() {
  const { prefs } = usePrefs();
  return useMemo(() => translator(prefs.locale), [prefs.locale]);
}

export function useTitle() {
  const { prefs } = usePrefs();
  return (t: Parameters<typeof pickTitle>[0]) => pickTitle(t, prefs.titleLang);
}

export type { MessageKey };
