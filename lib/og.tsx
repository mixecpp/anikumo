/** Shared building blocks for generated PNG icons and link-preview images (next/og). */
export function LogoGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <rect width="32" height="32" rx="9" fill="#fafafa" />
      <path d="M8.5 13.2 L9.6 6.6 L14 10.2 Z" fill="#0a0a0b" />
      <path d="M23.5 13.2 L22.4 6.6 L18 10.2 Z" fill="#0a0a0b" />
      <path d="M12.6 11.8 L23.4 18 L12.6 24.2 Z" fill="#f6a57c" />
    </svg>
  );
}

export const OG_SIZE = { width: 1200, height: 630 };
