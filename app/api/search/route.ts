import { NextResponse } from "next/server";
import { searchEverything, titleOf } from "@/lib/anilist";
import { prisma } from "@/lib/db";
import { getPrefs } from "@/lib/prefs";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export type SearchItem = { kind: "anime" | "character" | "staff" | "studio" | "user"; href: string; title: string; subtitle: string; image: string | null; avatar?: { color: string; value: string } };
export type SearchGroup = { kind: SearchItem["kind"]; label: string; items: SearchItem[] };

const FORMAT: Record<string, string> = { TV: "TV", TV_SHORT: "TV short", MOVIE: "Movie", SPECIAL: "Special", OVA: "OVA", ONA: "ONA", MUSIC: "Music" };

/** GET ?q= → grouped results: anime, characters, people (staff), studios, public profiles. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
  if (q.length < 2) return NextResponse.json({ groups: [], results: [] });
  if (!rateLimit(`search:${clientIp(req.headers)}`, 60, 60_000).ok) return NextResponse.json({ groups: [], error: "Slow down a little" }, { status: 429 });

  const [hits, users, prefs] = await Promise.all([
    searchEverything(q).catch(() => null),
    /^[a-zA-Z0-9_]+$/.test(q)
      ? prisma.user.findMany({ where: { profilePublic: true, searchable: true, bannedAt: null, username: { startsWith: q } }, select: { username: true, avatarColor: true, avatar: true }, take: 3 })
      : [],
    getPrefs(),
  ]);
  const lang = prefs.titleLang;

  const groups: SearchGroup[] = [];
  if (hits?.anime.length)
    groups.push({
      kind: "anime",
      label: "Anime",
      items: hits.anime.map((m) => ({
        kind: "anime",
        href: `/anime/${m.id}`,
        title: titleOf(m, lang),
        subtitle: [m.format ? FORMAT[m.format] ?? m.format : null, m.seasonYear, m.episodes ? `${m.episodes} eps` : null].filter(Boolean).join(" · "),
        image: m.coverImage.large,
      })),
    });
  if (hits?.characters.length)
    groups.push({
      kind: "character",
      label: "Characters",
      items: hits.characters.map((c) => ({ kind: "character", href: `/character/${c.id}`, title: c.name.full, subtitle: c.media.nodes[0] ? titleOf(c.media.nodes[0], lang) : "Character", image: c.image.large })),
    });
  if (hits?.staff.length)
    groups.push({
      kind: "staff",
      label: "People",
      items: hits.staff.map((p) => ({ kind: "staff", href: `/staff/${p.id}`, title: p.name.full, subtitle: p.primaryOccupations.slice(0, 2).join(", ") || "Staff", image: p.image.large })),
    });
  if (hits?.studios.length)
    groups.push({ kind: "studio", label: "Studios", items: hits.studios.map((st) => ({ kind: "studio", href: `/studio/${st.id}`, title: st.name, subtitle: "Animation studio", image: null })) });
  if (users.length)
    groups.push({
      kind: "user",
      label: "Members",
      items: users.map((u) => ({ kind: "user", href: `/u/${u.username}`, title: u.username, subtitle: "Profile", image: null, avatar: { color: u.avatarColor, value: u.avatar } })),
    });

  // Flat anime list in the older shape, used by the command palette and compare picker.
  const results = (hits?.anime ?? []).map((m) => ({ id: m.id, title: titleOf(m, lang), cover: m.coverImage.large, year: m.seasonYear, format: m.format, episodes: m.episodes }));
  return NextResponse.json({ groups, results, error: hits ? undefined : "Search is having trouble — try again" }, { headers: { "Cache-Control": "private, max-age=60" } });
}
