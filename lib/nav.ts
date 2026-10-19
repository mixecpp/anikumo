import type { MessageKey } from "./i18n";

export type NavKey = "home" | "browse" | "season" | "schedule" | "charts" | "feed" | "chat" | "together" | "library" | "profile";

export function navLinks(libraryEnabled: boolean) {
  const links: { href: string; label: MessageKey; icon: NavKey }[] = [
    { href: "/", label: "nav.home", icon: "home" },
    { href: "/browse", label: "nav.browse", icon: "browse" },
    { href: "/season", label: "nav.season", icon: "season" },
    { href: "/schedule", label: "nav.schedule", icon: "schedule" },
    { href: "/charts", label: "nav.charts", icon: "charts" },
    { href: "#chat", label: "nav.chat", icon: "chat" },
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

/** `action: "chat"` items open the live chat instead of going to a page. */
export type MenuItem = { href: string; label: string; hint: string; icon: NavKey | "trailers" | "leaderboard" | "all"; action?: "chat" };
export type MenuEntry = { href: string; label: MessageKey; icon: NavKey; items?: MenuItem[] };

/**
 * The desktop top bar: a few entries, with related pages grouped into small menus so the bar
 * stays short. Phones use navLinks() in the bottom bar instead.
 */
export function navMenu(libraryEnabled: boolean): MenuEntry[] {
  const menu: MenuEntry[] = [
    { href: "/", label: "nav.home", icon: "home" },
    {
      href: "/browse",
      label: "nav.browse",
      icon: "browse",
      items: [
        { href: "/browse", label: "Browse all", hint: "Search and filter every anime", icon: "all" },
        { href: "/season", label: "Seasonal", hint: "What's airing this season", icon: "season" },
        { href: "/schedule", label: "Schedule", hint: "When new episodes air", icon: "schedule" },
        { href: "/charts", label: "Top charts", hint: "Highest rated and most popular", icon: "charts" },
        { href: "/trailers", label: "Trailers", hint: "Upcoming shows in motion", icon: "trailers" },
      ],
    },
    {
      href: "/watch-together",
      label: "nav.community",
      icon: "together",
      items: [
        { href: "#chat", label: "Live chat", hint: "Talk with everyone on the site", icon: "chat", action: "chat" },
        { href: "/watch-together", label: "Watch together", hint: "Watch in sync with friends", icon: "together" },
        { href: "/leaderboard", label: "Leaderboard", hint: "Who's watched the most", icon: "leaderboard" },
      ],
    },
  ];
  if (libraryEnabled) menu.push({ href: "/library", label: "nav.library", icon: "library" });
  return menu;
}
