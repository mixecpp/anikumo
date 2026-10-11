import { ImageResponse } from "next/og";
import { LogoGlyph } from "@/lib/og";

/** 512px maskable icon for "Add to home screen". */
export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0e0e0f" }}>
        <LogoGlyph size={320} />
      </div>
    ),
    { width: 512, height: 512, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
