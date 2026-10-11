export type TitleLang = "english" | "romaji" | "native";
export type Theme = "dark" | "light" | "system";
export type Locale = "en" | "es" | "fr" | "de" | "ja";

export type ShortcutAction = "goHome" | "goBrowse" | "goSchedule" | "goSeason" | "goAccount" | "goHistory" | "goFavorites" | "goList" | "palette" | "help";

export type Prefs = {
  titleLang: TitleLang;
  theme: Theme;
  accent: string;
  locale: Locale;
  hideEcchi: boolean;
  blurEcchi: boolean;
  shortcuts: Record<ShortcutAction, string>;
};

export const ACCENTS = ["#f6a57c", "#fb7185", "#f472b6", "#c084fc", "#818cf8", "#60a5fa", "#38bdf8", "#2dd4bf", "#4ade80", "#facc15"];

export const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = {
  goHome: "h",
  goBrowse: "b",
  goSchedule: "s",
  goSeason: "n",
  goAccount: "a",
  goHistory: "y",
  goFavorites: "f",
  goList: "l",
  palette: "k",
  help: "?",
};

export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  goHome: "Go to home",
  goBrowse: "Go to browse",
  goSchedule: "Go to schedule",
  goSeason: "Go to seasonal chart",
  goAccount: "Go to account",
  goHistory: "Go to history",
  goFavorites: "Go to favorites",
  goList: "Go to my list",
  palette: "Command palette (with Ctrl)",
  help: "Show shortcuts",
};

export const DEFAULT_PREFS: Prefs = {
  titleLang: "english",
  theme: "dark",
  accent: ACCENTS[0],
  locale: "en",
  hideEcchi: false,
  blurEcchi: false,
  shortcuts: DEFAULT_SHORTCUTS,
};

const LOCALES: Locale[] = ["en", "es", "fr", "de", "ja"];

/** Validates untrusted JSON into a complete Prefs object. */
export function normalizePrefs(raw: unknown): Prefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const shortcuts = { ...DEFAULT_SHORTCUTS };
  if (r.shortcuts && typeof r.shortcuts === "object") {
    for (const [k, v] of Object.entries(r.shortcuts as Record<string, unknown>)) {
      if (k in shortcuts && typeof v === "string" && /^[a-z0-9?/]$/i.test(v)) shortcuts[k as ShortcutAction] = v.toLowerCase();
    }
  }
  return {
    titleLang: r.titleLang === "romaji" || r.titleLang === "native" ? r.titleLang : "english",
    theme: r.theme === "light" || r.theme === "system" ? r.theme : "dark",
    accent: typeof r.accent === "string" && /^#[0-9a-f]{6}$/i.test(r.accent) ? r.accent : DEFAULT_PREFS.accent,
    locale: LOCALES.includes(r.locale as Locale) ? (r.locale as Locale) : "en",
    hideEcchi: r.hideEcchi === true,
    blurEcchi: r.blurEcchi === true,
    shortcuts,
  };
}

export function pickTitle(t: { english?: string | null; romaji?: string | null; native?: string | null; userPreferred?: string | null }, lang: TitleLang) {
  const order = lang === "native" ? [t.native, t.romaji, t.english] : lang === "romaji" ? [t.romaji, t.english, t.native] : [t.english, t.romaji, t.native];
  return order.find((x) => !!x) ?? t.userPreferred ?? "Untitled";
}
