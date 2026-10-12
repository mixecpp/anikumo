/**
 * Small automod: blocks slurs and "kys"-style harassment anywhere people can post.
 * Ordinary swearing is allowed — this is only for hate and harassment.
 *
 * Matching is done on a normalised copy of the text: lower-cased, accents removed,
 * leetspeak undone (n1gg3r → nigger), punctuation inside words dropped (n.i.g → nig),
 * spaced-out letters joined back up (f a g g o t → faggot), and every letter allowed to
 * repeat (niiiigger). Ambiguous words only match as a whole word, so "raccoon",
 * "Scunthorpe" and "spicy" are fine.
 */

// Matches anywhere inside a word.
const CONTAINS = ["nigg", "faggot", "fagget", "wetback", "towelhead", "raghead", "zipperhead", "jigaboo", "sandnig", "chinaman", "porchmonkey", "junglebunny"];
// Only as a whole word (plurals and -ed/-ing allowed).
const WORDS = ["nig", "niglet", "fag", "fags", "faggy", "kike", "chink", "chinky", "spic", "spick", "gook", "coon", "beaner", "paki", "dyke", "tranny", "trannie", "retard", "golliwog", "wog", "gyppo", "shemale"];
// Harassment shorthand, whole word only.
const HARASS = ["kys"];
// Multi-word phrases, matched on the normalised text with spaces.
const PHRASES = ["kill yourself", "kill urself", "kill your self", "porch monkey", "jungle bunny", "neck yourself", "hang yourself"];

const LEET: Record<string, string> = { "0": "o", "1": "i", "!": "i", "|": "i", "3": "e", "4": "a", "@": "a", "5": "s", $: "s", "7": "t", "9": "g", "6": "g", "8": "b", "+": "t" };

// Each letter may repeat ("niiigger"); "nigg" still needs at least two g's.
const stretch = (w: string) => w.split("").map((c) => `${c}+`).join("");
const containsRe = new RegExp(`(?<!s)(${CONTAINS.map(stretch).join("|")})`);
const wordRe = new RegExp(`^(${WORDS.map(stretch).join("|")})(s|es|z|ed|ing)?$`);
const harassRe = new RegExp(`^(${HARASS.map(stretch).join("|")})$`);
const phraseRe = new RegExp(`\\b(${PHRASES.map((p) => p.split(" ").map(stretch).join(" +")).join("|")})\\b`);

function normalise(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[0-9!|@$+]/g, (c) => LEET[c] ?? c)
    .replace(/[^\p{L}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(norm: string) {
  const words = norm.split(" ").filter(Boolean);
  const out = [...words];
  // Join runs of single letters: "f a g g o t" → "faggot".
  let run = "";
  for (const w of [...words, ""]) {
    if (w.length === 1) run += w;
    else {
      if (run.length >= 3) out.push(run);
      run = "";
    }
  }
  return out;
}

/** Returns why the text was blocked ("slur" or "harassment"), or null when it's fine. */
export function automodReason(text: string): "slur" | "harassment" | null {
  if (!text) return null;
  const norm = normalise(text);
  if (phraseRe.test(norm)) return "harassment";
  for (const t of tokens(norm)) {
    if (harassRe.test(t)) return "harassment";
    if (containsRe.test(t) || wordRe.test(t)) return "slur";
  }
  return null;
}

/** Error message to show the poster, or null. */
export function checkText(...texts: (string | null | undefined)[]): string | null {
  for (const t of texts) {
    const reason = t ? automodReason(t) : null;
    if (reason === "harassment") return "That message looks like harassment. Please keep it kind.";
    if (reason) return "That message contains language that isn't allowed here.";
  }
  return null;
}
