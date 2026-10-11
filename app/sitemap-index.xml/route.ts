import { SITEMAP_IDS } from "../sitemap";
import { appUrl } from "@/lib/url";

/** One URL to submit to Google/Bing: lists every sitemap. */
export function GET() {
  const now = new Date().toISOString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${SITEMAP_IDS.map((id) => `  <sitemap><loc>${appUrl(`/sitemap/${id}.xml`)}</loc><lastmod>${now}</lastmod></sitemap>`).join("\n")}
</sitemapindex>
`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
