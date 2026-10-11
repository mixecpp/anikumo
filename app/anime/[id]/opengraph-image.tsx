import { ImageResponse } from "next/og";
import { getMedia, prettyEnum, titleOf } from "@/lib/anilist";
import { LogoGlyph, OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Anime on AniKumo";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const m = await getMedia(Number((await params).id)).catch(() => null);
  const title = m ? titleOf(m) : "AniKumo";
  const meta = m ? [prettyEnum(m.format), m.seasonYear, m.episodes ? `${m.episodes} eps` : null].filter(Boolean).join("  ·  ") : "";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0e0e0f", color: "#ececee", position: "relative" }}>
        {m?.bannerImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.bannerImage} alt="" width={1200} height={630} style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }} />
        )}
        <div style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, backgroundImage: "linear-gradient(90deg, rgba(14,14,15,0.97) 40%, rgba(14,14,15,0.75) 100%)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 56, padding: 72, position: "relative" }}>
          {m && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.coverImage.extraLarge} alt="" width={300} height={430} style={{ borderRadius: 20, objectFit: "cover" }} />
          )}
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 700 }}>
            <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>
            {meta && <div style={{ marginTop: 20, fontSize: 28, color: "#85858d" }}>{meta}</div>}
            {m?.averageScore ? <div style={{ display: "flex", marginTop: 16, fontSize: 30, color: "#fbbf24" }}>{`Score ${(m.averageScore / 10).toFixed(1)} / 10`}</div> : null}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 48, fontSize: 26, color: "#85858d" }}>
              <LogoGlyph size={40} /> AniKumo
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
