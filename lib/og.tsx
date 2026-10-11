import { CLOUD_PATH, CLOUD_VIEWBOX } from "./logo-path";

/** Shared building blocks for generated PNG icons and link-preview images (next/og). */
export function LogoGlyph({ size, color = "#fafafa" }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox={CLOUD_VIEWBOX}>
      <path fill={color} fillRule="evenodd" d={CLOUD_PATH} />
    </svg>
  );
}

export const OG_SIZE = { width: 1200, height: 630 };
