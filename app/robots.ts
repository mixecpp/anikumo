import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/url";
import { SITEMAP_IDS } from "./sitemap";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private or thin pages; also marked noindex on the pages themselves.
      disallow: ["/api/", "/account", "/admin", "/notifications", "/watch/", "/watch-together/", "/login", "/register", "/forgot-password", "/library", "/offline"],
    },
    sitemap: [appUrl("/sitemap-index.xml"), ...SITEMAP_IDS.map((id) => appUrl(`/sitemap/${id}.xml`))],
    host: appUrl("/"),
  };
}
