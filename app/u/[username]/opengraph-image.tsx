import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import { getAccountStats } from "@/lib/account";
import { formatDuration } from "@/lib/watchtime";
import { LogoGlyph, OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Profile on AniKumo";

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const user = await prisma.user.findUnique({ where: { username }, select: { id: true, username: true, avatarColor: true, profilePublic: true } });
  const visible = user?.profilePublic;
  const stats = visible ? await getAccountStats(user.id) : null;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#0e0e0f", color: "#ececee" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <div style={{ width: 120, height: 120, borderRadius: 60, background: visible ? user.avatarColor : "#333", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, fontWeight: 700, color: "#fff" }}>
            {(visible ? user.username : "?").charAt(0).toUpperCase()}
          </div>
          <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -2 }}>{visible ? user.username : "AniKumo"}</div>
        </div>
        {stats && (
          <div style={{ display: "flex", gap: 64, marginTop: 64 }}>
            {[
              ["Watched", formatDuration(stats.secondsWatched)],
              ["Episodes", String(stats.episodesWatched)],
              ["Completed", String(stats.showsCompleted)],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 56, fontWeight: 700 }}>{v}</div>
                <div style={{ fontSize: 26, color: "#85858d" }}>{k}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 72, fontSize: 26, color: "#85858d" }}>
          <LogoGlyph size={40} /> AniKumo
        </div>
      </div>
    ),
    size,
  );
}
