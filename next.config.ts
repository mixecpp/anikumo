import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Nobody on our pages — including the embedded players — gets the camera, mic, location,
  // payments, device access, motion sensors (used for fingerprinting) or the browser's ad and
  // interest-tracking APIs. Autoplay, fullscreen and picture-in-picture stay available to players.
  {
    key: "Permissions-Policy",
    value: [
      "camera=()", "microphone=()", "geolocation=()", "payment=()", "usb=()", "serial=()", "hid=()", "bluetooth=()",
      "display-capture=()", "idle-detection=()", "accelerometer=()", "gyroscope=()", "magnetometer=()",
      "browsing-topics=()", "interest-cohort=()", "attribution-reporting=()", "join-ad-interest-group=()", "run-ad-auction=()",
      "private-aggregation=()", "shared-storage=()", "shared-storage-select-url=()",
    ].join(", "),
  },
  // Pages other sites open (like a player's pop-up) can't reach back into AniKumo's window.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  // Only the parts that can't break players or images: no plugins, no <base> hijacking,
  // forms post only here, and the site can't be framed by other sites (clickjacking).
  { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // No floating Next.js badge, even in dev.
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
