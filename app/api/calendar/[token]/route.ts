import { prisma } from "@/lib/db";
import { getScheduleFor } from "@/lib/anilist";
import { pickTitle, normalizePrefs } from "@/lib/prefs-shared";
import { safeParse } from "@/lib/prefs";
import { appUrl } from "@/lib/url";
import { sha256 } from "@/lib/crypto";

function icsDate(unix: number) {
  return new Date(unix * 1000).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Lines longer than 75 octets must be folded (RFC 5545). */
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  out.push(rest);
  return out.join("\r\n");
}

/** Private iCalendar feed of upcoming episodes for shows you're watching or planning. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return new Response("Not found", { status: 404 });
  // Only the token's hash is stored; feeds created before that are matched once and upgraded.
  let user = await prisma.user.findUnique({ where: { calendarToken: sha256(token) }, select: { id: true, preferences: true } });
  if (!user) {
    user = await prisma.user.findUnique({ where: { calendarToken: token }, select: { id: true, preferences: true } });
    if (user) await prisma.user.update({ where: { id: user.id }, data: { calendarToken: sha256(token) } });
  }
  if (!user) return new Response("Not found", { status: 404 });

  const lang = normalizePrefs(safeParse(user.preferences)).titleLang;
  const entries = await prisma.listEntry.findMany({ where: { userId: user.id, status: { in: ["WATCHING", "PLANNING"] } }, select: { anilistId: true } });
  const now = Math.floor(Date.now() / 1000);
  const slots = await getScheduleFor(entries.map((e) => e.anilistId), now - 86400, now + 28 * 86400).catch(() => []);

  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AniKumo//Airing//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:AniKumo airing", "REFRESH-INTERVAL;VALUE=DURATION:PT6H"];
  for (const s of slots) {
    const title = pickTitle(s.media.title, lang);
    const minutes = s.media.duration ?? 24;
    lines.push(
      "BEGIN:VEVENT",
      `UID:airing-${s.id}@anikumo`,
      `DTSTAMP:${icsDate(now)}`,
      `DTSTART:${icsDate(s.airingAt)}`,
      `DTEND:${icsDate(s.airingAt + minutes * 60)}`,
      fold(`SUMMARY:${escape(`${title} · Episode ${s.episode}`)}`),
      fold(`URL:${appUrl(`/anime/${s.media.id}`)}`),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n"), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename=anikumo.ics', "Cache-Control": "private, max-age=1800" },
  });
}
