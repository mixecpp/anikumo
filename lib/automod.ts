/**
 * Small automod: blocks slurs, hate slogans and "kys"-style harassment anywhere people can write
 * (usernames, bios, comments, reviews, posts, replies, profile comments, list names and notes).
 * Ordinary swearing is allowed — this is only for hate and harassment.
 *
 * Matching is done on a normalised copy of the text:
 *  - lower-cased, accents removed, fullwidth/𝐛𝐨𝐥𝐝/𝓈𝒸𝓇𝒾𝓅𝓉 letters folded to plain ones
 *  - look-alike letters from other alphabets swapped for Latin ones (Cyrillic "е", Greek "ο")
 *  - invisible characters dropped, leetspeak undone (n1gg3r → nigger)
 *  - punctuation inside words dropped (n.i.g → nig), spaced-out letters joined (f a g g o t)
 *  - every letter allowed to repeat (niiiigger), and words split in two joined back (ni gger)
 * Ambiguous words only match as a whole word, so "raccoon", "Scunthorpe", "spicy" and
 * "Spain iggy" are fine.
 */

// Matches anywhere inside a word.
const CONTAINS = ["nigg", "faggot", "fagget", "wetback", "towelhead", "raghead", "zipperhead", "jigaboo", "sandnig", "chinaman", "porchmonkey", "junglebunny"];
// Only as a whole word (plurals and -ed/-ing allowed).
const WORDS = ["nig", "niglet", "fag", "fags", "faggy", "kike", "chink", "chinky", "spic", "spick", "gook", "coon", "beaner", "paki", "dyke", "tranny", "trannie", "retard", "golliwog", "wog", "gyppo", "shemale"];
// Harassment shorthand, whole word only.
const HARASS = ["kys"];
// Multi-word harassment, matched on the normalised text with spaces.
const PHRASES = ["kill yourself", "kill urself", "kill your self", "neck yourself", "hang yourself"];
// Multi-word slurs and hate slogans.
const HATE = ["porch monkey", "jungle bunny", "gas the jews", "heil hitler", "sieg heil", "white power", "hitler was right"];
// Hate codes that are digits, checked before leetspeak is undone ("1488").
const CODES = /(^|[^0-9])(14 ?88|88 ?14)([^0-9]|$)/;

const LEET: Record<string, string> = { "0": "o", "1": "i", "!": "i", "|": "i", "3": "e", "4": "a", "@": "a", "5": "s", $: "s", "7": "t", "9": "g", "6": "g", "8": "b", "+": "t" };

// Letters from other alphabets that look like Latin ones (NFKD doesn't fold these).
const LOOKALIKE: Record<string, string> = {
  а: "a", в: "b", е: "e", ё: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", у: "y", х: "x", і: "i", ї: "i", ј: "j", ԁ: "d", ɡ: "g", ց: "g", ո: "n", ս: "u",
  α: "a", β: "b", ε: "e", η: "n", ι: "i", κ: "k", ν: "v", ο: "o", ρ: "p", τ: "t", υ: "u", χ: "x",
  ɢ: "g", ɪ: "i", ɴ: "n", ʀ: "r", ꜰ: "f", ᴀ: "a", ᴏ: "o", ᴇ: "e", ᴋ: "k", ʏ: "y",
};

// Each letter may repeat ("niiigger"); "nigg" still needs at least two g's.
const stretch = (w: string) => w.split("").map((c) => `${c}+`).join("");
const phrase = (p: string) => p.split(" ").map(stretch).join(" +");
const containsRe = new RegExp(`(?<!s)(${CONTAINS.map(stretch).join("|")})`);
const wordRe = new RegExp(`^(${WORDS.map(stretch).join("|")})(s|es|z|ed|ing)?$`);
const harassRe = new RegExp(`^(${HARASS.map(stretch).join("|")})$`);
const phraseRe = new RegExp(`\\b(${PHRASES.map(phrase).join("|")})\\b`);
const hateRe = new RegExp(`\\b(${HATE.map(phrase).join("|")})\\b`);
// A slur split across two words ("ni gger"): only where the slur starts the joined word.
const splitRe = new RegExp(`^(${CONTAINS.map(stretch).join("|")})`);

function normalise(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[​-‏⁠﻿­]/g, "")
    .replace(/./gu, (c) => LOOKALIKE[c] ?? c)
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
  if (CODES.test(text.normalize("NFKD"))) return "slur";
  const norm = normalise(text);
  if (hateRe.test(norm)) return "slur";
  if (phraseRe.test(norm)) return "harassment";
  for (const t of tokens(norm)) {
    if (harassRe.test(t)) return "harassment";
    if (containsRe.test(t) || wordRe.test(t)) return "slur";
  }
  const words = norm.split(" ");
  for (let i = 0; i + 1 < words.length; i++) {
    if (words[i].length >= 2 && words[i].length <= 4 && splitRe.test(words[i] + words[i + 1])) return "slur";
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
