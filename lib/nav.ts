import type { MessageKey } from "./i18n";

export type NavKey = "home" | "browse" | "season" | "schedule" | "charts" | "feed" | "together" | "library" | "profile";

export function navLinks(libraryEnabled: boolean) {
  const links: { href: string; label: MessageKey; icon: NavKey }[] = [
    { href: "/", label: "nav.home", icon: "home" },
    { href: "/browse", label: "nav.browse", icon: "browse" },
    { href: "/season", label: "nav.season", icon: "season" },
    { href: "/schedule", label: "nav.schedule", icon: "schedule" },
    { href: "/charts", label: "nav.charts", icon: "charts" },
    { href: "/feed", label: "nav.feed", icon: "feed" },
    { href: "/watch-together", label: "nav.together", icon: "together" },
  ];
  if (libraryEnabled) links.push({ href: "/library", label: "nav.library", icon: "library" });
  return links;
}

/** Matches whole path segments, so /account/lists doesn't light up /account/list. */
export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
