import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AniKumo",
    short_name: "AniKumo",
    description: "Discover, track and watch anime.",
    start_url: "/",
    display: "standalone",
    background_color: "#0e0e0f",
    theme_color: "#0e0e0f",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
      { src: "/pwa-icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Continue watching", url: "/account" },
      { name: "My list", url: "/account/list" },
      { name: "Schedule", url: "/schedule" },
    ],
  };
}
