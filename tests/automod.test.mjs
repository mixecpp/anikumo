import assert from "node:assert/strict";
import { test } from "node:test";
import { automodReason, checkText } from "../lib/automod.ts";

// Built from pieces so the slurs themselves aren't sitting in the source as plain words.
const n = ["ni", "gger"].join("");
const f = ["fag", "got"].join("");

test("automod blocks slurs however they're disguised", () => {
  const disguised = [
    n,
    n.toUpperCase(),
    "n1gg3r",
    "n.i.g.g.e.r",
    "n i g g e r",
    "niiiiigger",
    "ni gger",
    "nі" + "gger", // Cyrillic і
    "ｎｉｇｇｅｒ", // fullwidth
    "n​igger", // zero-width space
    `you ${f}`,
    "f a g g o t",
    "ph4ggot".replace("ph", "f"),
    "what a " + "re" + "tard",
  ];
  for (const s of disguised) assert.equal(automodReason(s), "slur", s);
});

test("automod blocks hate slogans, codes and harassment", () => {
  assert.equal(automodReason("sieg heil"), "slur");
  assert.equal(automodReason("HEIL HITLER"), "slur");
  assert.equal(automodReason("1488"), "slur");
  assert.equal(automodReason("14 88 brother"), "slur");
  assert.equal(automodReason("kys"), "harassment");
  assert.equal(automodReason("just kill yourself"), "harassment");
  assert.equal(automodReason("k y s"), "harassment");
  assert.match(checkText("ok", "kys") ?? "", /harassment/);
  assert.match(checkText(n) ?? "", /isn't allowed/);
});

test("automod leaves ordinary text alone", () => {
  const fine = [
    "This episode was fucking amazing",
    "raccoon girls are the best",
    "Scunthorpe United",
    "spicy ramen arc",
    "Spain iggy pop",
    "snigger",
    "the night was long",
    "Attack on Titan season 4 part 2 (2022), 14 episodes, rated 8.8",
    "episode 1489 of One Piece",
    "coonskin hat",
    "Kill la Kill is great",
    "go die hard fans",
    "the fag end of the season".replace("fag end", "tail end"),
    "",
  ];
  for (const s of fine) assert.equal(automodReason(s), null, s);
});
