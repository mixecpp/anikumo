import { ImageResponse } from "next/og";
import { LogoGlyph } from "@/lib/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0e0e0f" }}>
        <LogoGlyph size={132} />
      </div>
    ),
    size,
  );
}
