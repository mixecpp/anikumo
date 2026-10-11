import { getPrefs } from "./prefs";
import { translator } from "./i18n";
import { pickTitle } from "./prefs-shared";

/** Translator + title picker for the current request, for use in Server Components. */
export async function getUi() {
  const prefs = await getPrefs();
  return { prefs, t: translator(prefs.locale), title: (t: Parameters<typeof pickTitle>[0]) => pickTitle(t, prefs.titleLang) };
}
