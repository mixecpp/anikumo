/**
 * Profile pictures. Stored on the user as one string:
 *   ""                    → coloured initial
 *   "preset:<key>"        → a character from PRESET_AVATARS (images served by AniList's CDN)
 *   "upload:<id>.webp"    → an uploaded picture, re-encoded by the server and served from /avatars/<id>.webp
 * Client-safe: no Node imports here.
 */
export type PresetAvatar = { key: string; name: string; show: string; characterId: number; image: string };

export const PRESET_AVATARS: PresetAvatar[] = [
  { key: "monkey-d-luffy", name: "Monkey D. Luffy", show: "ONE PIECE", characterId: 40, image: "https://s4.anilist.co/file/anilistcdn/character/large/b40-MNypXsxSRb1R.png" },
  { key: "roronoa-zoro", name: "Roronoa Zoro", show: "ONE PIECE", characterId: 62, image: "https://s4.anilist.co/file/anilistcdn/character/large/b62-S7oAeA9WInjV.png" },
  { key: "naruto-uzumaki", name: "Naruto Uzumaki", show: "Naruto", characterId: 17, image: "https://s4.anilist.co/file/anilistcdn/character/large/b17-phjcWCkRuIhu.png" },
  { key: "kakashi-hatake", name: "Kakashi Hatake", show: "Naruto", characterId: 85, image: "https://s4.anilist.co/file/anilistcdn/character/large/b85-mkVBh2yjxjmx.png" },
  { key: "son-goku", name: "Son Goku", show: "Dragon Ball Z", characterId: 246, image: "https://s4.anilist.co/file/anilistcdn/character/large/246-wsRRr6z1kii8.png" },
  { key: "vegeta", name: "Vegeta", show: "Dragon Ball Z", characterId: 913, image: "https://s4.anilist.co/file/anilistcdn/character/large/b913-NIFkKazWM8VO.png" },
  { key: "satoru-gojou", name: "Satoru Gojou", show: "JUJUTSU KAISEN", characterId: 127691, image: "https://s4.anilist.co/file/anilistcdn/character/large/b127691-9zqh1xpIubn7.png" },
  { key: "yuuji-itadori", name: "Yuuji Itadori", show: "JUJUTSU KAISEN", characterId: 127212, image: "https://s4.anilist.co/file/anilistcdn/character/large/b127212-FVm2tD0erQ5B.png" },
  { key: "tanjirou-kamado", name: "Tanjirou Kamado", show: "Demon Slayer: Kimetsu no Yaiba", characterId: 126071, image: "https://s4.anilist.co/file/anilistcdn/character/large/b126071-BTNEc1nRIv68.png" },
  { key: "nezuko-kamado", name: "Nezuko Kamado", show: "Demon Slayer: Kimetsu no Yaiba", characterId: 127518, image: "https://s4.anilist.co/file/anilistcdn/character/large/b127518-NRlq1CQ1v1ro.png" },
  { key: "eren-yeager", name: "Eren Yeager", show: "Attack on Titan", characterId: 40882, image: "https://s4.anilist.co/file/anilistcdn/character/large/b40882-dsj7IP943WFF.jpg" },
  { key: "levi", name: "Levi", show: "Attack on Titan", characterId: 45627, image: "https://s4.anilist.co/file/anilistcdn/character/large/b45627-CR68RyZmddGG.png" },
  { key: "mikasa-ackerman", name: "Mikasa Ackerman", show: "Attack on Titan", characterId: 40881, image: "https://s4.anilist.co/file/anilistcdn/character/large/b40881-F3gr1PkreDvj.png" },
  { key: "frieren", name: "Frieren", show: "Frieren: Beyond Journey’s End", characterId: 176754, image: "https://s4.anilist.co/file/anilistcdn/character/large/b176754-PCnpqIOkjhFk.png" },
  { key: "anya-forger", name: "Anya Forger", show: "SPY x FAMILY", characterId: 138100, image: "https://s4.anilist.co/file/anilistcdn/character/large/b138100-4Li0tWRCa5bQ.png" },
  { key: "light-yagami", name: "Light Yagami", show: "Death Note", characterId: 80, image: "https://s4.anilist.co/file/anilistcdn/character/large/b80-26EhwSsSqQ50.png" },
  { key: "l-lawliet", name: "L Lawliet", show: "Death Note", characterId: 71, image: "https://s4.anilist.co/file/anilistcdn/character/large/b71-1W4panC53vfs.png" },
  { key: "saitama", name: "Saitama", show: "One-Punch Man", characterId: 73935, image: "https://s4.anilist.co/file/anilistcdn/character/large/b73935-ON5d0mAcrItd.jpg" },
  { key: "killua-zoldyck", name: "Killua Zoldyck", show: "Hunter x Hunter (2011)", characterId: 27, image: "https://s4.anilist.co/file/anilistcdn/character/large/b27-Z5O02kQUydpT.jpg" },
  { key: "gon-freecss", name: "Gon Freecss", show: "Hunter x Hunter (2011)", characterId: 30, image: "https://s4.anilist.co/file/anilistcdn/character/large/b30-lyFExKyDhefc.jpg" },
  { key: "edward-elric", name: "Edward Elric", show: "Fullmetal Alchemist: Brotherhood", characterId: 11, image: "https://s4.anilist.co/file/anilistcdn/character/large/b11-TA5Nuk7EDUZG.jpg" },
  { key: "spike-spiegel", name: "Spike Spiegel", show: "Cowboy Bebop", characterId: 1, image: "https://s4.anilist.co/file/anilistcdn/character/large/b1-ChxaldmieFlQ.png" },
  { key: "denji", name: "Denji", show: "Chainsaw Man", characterId: 130102, image: "https://s4.anilist.co/file/anilistcdn/character/large/b130102-FO1VHNnEnLlB.png" },
  { key: "makima", name: "Makima", show: "Chainsaw Man", characterId: 137080, image: "https://s4.anilist.co/file/anilistcdn/character/large/b137080-UHcynYNjb5ZU.png" },
  { key: "power", name: "Power", show: "Chainsaw Man", characterId: 137079, image: "https://s4.anilist.co/file/anilistcdn/character/large/b137079-6yLEUYR3bmpr.png" },
  { key: "zero-two", name: "Zero Two", show: "DARLING in the FRANXX", characterId: 124381, image: "https://s4.anilist.co/file/anilistcdn/character/large/b124381-2gAVq76HPfL2.png" },
  { key: "rem", name: "Rem", show: "Re:ZERO -Starting Life in Another World-", characterId: 88575, image: "https://s4.anilist.co/file/anilistcdn/character/large/b88575-Ayu8UPDA8NS6.png" },
  { key: "marin-kitagawa", name: "Marin Kitagawa", show: "My Dress-Up Darling", characterId: 133676, image: "https://s4.anilist.co/file/anilistcdn/character/large/b133676-kV2czE3C8Qls.png" },
  { key: "shigeo-kageyama", name: "Shigeo Kageyama", show: "Mob Psycho 100", characterId: 89616, image: "https://s4.anilist.co/file/anilistcdn/character/large/b89616-dXmdOc7L6SDi.png" },
  { key: "shouyou-hinata", name: "Shouyou Hinata", show: "HAIKYU!!", characterId: 64769, image: "https://s4.anilist.co/file/anilistcdn/character/large/b64769-WoWlCMLLgJ14.png" },
];

const PRESETS = new Map(PRESET_AVATARS.map((p) => [p.key, p]));
export const UPLOAD_FILE = /^[a-z0-9]{24}.webp$/;

export function presetByKey(key: string) {
  return PRESETS.get(key);
}

/** The image URL for a stored avatar value, or null to show the coloured initial. */
export function avatarUrl(avatar: string | null | undefined): string | null {
  if (!avatar) return null;
  if (avatar.startsWith("preset:")) return PRESETS.get(avatar.slice(7))?.image ?? null;
  if (avatar.startsWith("upload:")) {
    const file = avatar.slice(7);
    return UPLOAD_FILE.test(file) ? `/avatars/${file}` : null;
  }
  return null;
}
