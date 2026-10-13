import { ImageResponse } from "next/og";
import { getHomeData } from "@/lib/anilist";
import { LogoGlyph, OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "AniKumo — watch anime online, free and with no ads";
// Rebuilt daily so the posters follow what's trending.
export const revalidate = 86400;

/** The default link preview for the site: what AniKumo is, plus three trending posters. */
export default async function Image() {
  const home = await getHomeData().catch(() => null);
  const covers = (home?.trending.media ?? [])
    .filter((m) => !m.genres.includes("Ecchi"))
    .slice(0, 3)
    .map((m) => m.coverImage.extraLarge);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0e0e0f", color: "#ececee", position: "relative", overflow: "hidden" }}>
        {/* soft accent glow, top left */}
        <div style={{ position: "absolute", top: -260, left: -200, width: 760, height: 760, borderRadius: 760, background: "radial-gradient(circle, rgba(225,29,72,0.22), rgba(14,14,15,0) 65%)" }} />

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px 0 64px 80px", width: 660, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, fontWeight: 700, letterSpacing: -0.5 }}>
            <LogoGlyph size={52} /> AniKumo
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.02, letterSpacing: -2.5 }}>Watch anime online.</div>
            <div style={{ marginTop: 22, fontSize: 30, color: "#a1a1aa", lineHeight: 1.35 }}>Free, no ads. Sub & dub, seasonal schedules, your watchlist and watch parties.</div>
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#71717a" }}>anikumo.cc</div>
        </div>

        {covers.length > 0 && (
          <div style={{ display: "flex", position: "absolute", right: 40, top: 70, width: 520, height: 500 }}>
            {covers.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt=""
                width={240}
                height={345}
                style={{
                  position: "absolute",
                  left: i * 125,
                  top: i === 1 ? 0 : 60,
                  borderRadius: 22,
                  objectFit: "cover",
                  border: "2px solid rgba(255,255,255,0.08)",
                  boxShadow: "0 30px 60px rgba(0,0,0,0.55)",
                  transform: `rotate(${(i - 1) * 6}deg)`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    ),
    size,
  );
}
