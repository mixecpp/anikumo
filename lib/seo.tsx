import type { Metadata } from "next";
import { stripHtml } from "./anilist";
import { appUrl } from "./url";

export const SITE_NAME = "AniKumo";
export const SITE_DESCRIPTION = "Watch anime online free with no ads on AniKumo. Stream sub and dub episodes, follow the seasonal schedule, track your list and watch together with friends.";
/** The phrases the site as a whole should be found for. Pages add their own on top. */
export const SITE_KEYWORDS = [
  "anime", "watch anime", "watch anime online", "anime online free", "free anime", "anime streaming", "stream anime",
  "anime site", "anime website", "ad free anime", "anime no ads", "anime sub", "anime dub", "english dubbed anime",
  "subbed anime", "new anime episodes", "seasonal anime", "anime schedule", "anime tracker", "anime list", "watch anime together",
];

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
  /** A specific preview image. Without one, pages use the site-wide image (app/opengraph-image.tsx). */
  image?: string;
  /** The route has its own opengraph-image file (anime, profiles): leave the image to it. */
  ownImage?: boolean;
  type?: "website" | "article" | "profile" | "video.tv_show" | "video.movie";
  noindex?: boolean;
  keywords?: string[];
};

/** Consistent title/description/canonical/Open Graph/Twitter metadata for a public page. */
/** The site-wide link preview (app/opengraph-image.tsx). */
export const SITE_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: "AniKumo — watch anime online, free and with no ads" };

export function pageMeta({ title, description, path, image, ownImage, type = "website", noindex, keywords }: PageMeta): Metadata {
  // Only set images when there is one: even an empty "images" key would hide the page's
  // opengraph-image file (or the site-wide one inherited from app/opengraph-image.tsx).
  const images = image ? { images: [{ url: image }] } : ownImage ? {} : { images: [SITE_IMAGE] };
  return {
    title,
    description,
    keywords,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: SITE_NAME, type, locale: "en_US", ...images },
    twitter: { card: image ? "summary" : "summary_large_image", title, description, ...images },
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
