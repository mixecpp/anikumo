import type { Metadata } from "next";
import { stripHtml } from "./anilist";
import { appUrl } from "./url";

export const SITE_NAME = "AniKumo";
export const SITE_DESCRIPTION = "Discover, track and watch anime. Seasonal charts, airing schedules, watchlists, reviews and stats — free, no email needed.";

/** Plain-text summary for meta descriptions: no HTML, AniList spoiler/markdown marks, or mid-word cuts. */
export function excerpt(text: string | null | undefined, max = 160) {
  const plain = stripHtml(text)
    .replace(/~![\s\S]*?!~/g, "") // AniList spoiler blocks
    .replace(/[_*~]{2,}/g, "")
    .replace(/\(Source:[^)]*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6))}…`;
}

type PageMeta = {
  title: string;
  description: string;
  path: string;
  /** Omit on routes with an opengraph-image file — that one wins anyway. */
  image?: string;
  type?: "website" | "article" | "profile" | "video.tv_show" | "video.movie";
  noindex?: boolean;
  keywords?: string[];
};

/** Consistent title/description/canonical/Open Graph/Twitter metadata for a public page. */
export function pageMeta({ title, description, path, image, type = "website", noindex, keywords }: PageMeta): Metadata {
  const images = image ? [{ url: image }] : undefined;
  return {
    title,
    description,
    keywords,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: SITE_NAME, type, images },
    twitter: { card: image ? "summary" : "summary_large_image", title, description, images },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Metadata for pages that should never appear in search results. */
export const PRIVATE: Metadata = { robots: { index: false, follow: false } };

/** schema.org structured data. `<` is escaped so content can't close the script tag. */
export function JsonLd({ data }: { data: object | object[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: appUrl(it.path) })),
  };
}

export function isoDate(d: { year: number | null; month: number | null; day: number | null } | null | undefined) {
  if (!d?.year) return undefined;
  if (!d.month) return String(d.year);
  return `${d.year}-${String(d.month).padStart(2, "0")}${d.day ? `-${String(d.day).padStart(2, "0")}` : ""}`;
}
