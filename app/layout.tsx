import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { SocialIcons } from "@/components/Socials";
import PageViews from "@/components/PageViews";
import TrackerShield from "@/components/TrackerShield";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import MobileNav from "@/components/MobileNav";
import AmbientBackground from "@/components/AmbientBackground";
import Toaster from "@/components/Toaster";
import Providers from "@/components/Providers";
import PlayerProvider from "@/components/player/PlayerProvider";
import ScrollTop from "@/components/ScrollTop";
import Shortcuts, { ShortcutsButton } from "@/components/Shortcuts";
import CommandPalette from "@/components/CommandPalette";
import ServiceWorker from "@/components/ServiceWorker";
import { PrefsProvider } from "@/components/PrefsProvider";
import { libraryRoot } from "@/lib/library";
import { getPrefs } from "@/lib/prefs";
import { getUser, roleOf } from "@/lib/auth";
import DevtoolsGuard from "@/components/DevtoolsGuard";
import { prisma } from "@/lib/db";
import { translator } from "@/lib/i18n";
import { appUrl } from "@/lib/url";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(appUrl("/")),
  title: { default: "AniKumo", template: "%s · AniKumo" },
  description: "Discover, track and watch anime. Seasonal charts, schedules, lists, stats and more.",
  applicationName: "AniKumo",
  openGraph: { type: "website", siteName: "AniKumo" },
  twitter: { card: "summary_large_image" },
  appleWebApp: { capable: true, title: "AniKumo", statusBarStyle: "black-translucent" },
  keywords: ["anime", "watch anime", "anime tracker", "anime list", "seasonal anime", "anime schedule", "anime reviews"],
  category: "entertainment",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  // Set in the server env to verify ownership in Google Search Console / Bing Webmaster Tools.
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION || undefined, other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the layout use the full screen on notched phones; safe-area insets keep content clear.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0e0e0f" },
    { media: "(prefers-color-scheme: light)", color: "#f7f7f8" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const libraryEnabled = !!libraryRoot();
  const [prefs, user, latest] = await Promise.all([
    getPrefs(),
    getUser(),
    prisma.changelogEntry.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }).catch(() => null),
  ]);
  const userId = user?.id ?? null;
  const t = translator(prefs.locale);

  return (
    <html lang={prefs.locale} data-theme={prefs.theme} style={{ "--accent": prefs.accent } as React.CSSProperties}>
      <body className={`${geist.variable} ${geistMono.variable} relative min-h-svh`}>
        <PrefsProvider prefs={prefs} loggedIn={!!userId}>
          <Providers>
            <PlayerProvider>
              <a href="#main" className="sr-only z-[100] rounded-lg bg-fg px-3 py-2 text-sm text-bg focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
                Skip to content
              </a>
              <AmbientBackground />
              <Navbar libraryEnabled={libraryEnabled} />
              <main id="main" className="pb-28 lg:pb-16">
                {children}
              </main>
              {/* Pages already in the top bar (Browse, Seasonal, Charts…) aren't repeated here. */}
              <footer className="mx-auto mb-24 max-w-[1400px] border-t border-line px-4 py-4 text-xs text-muted md:px-8 lg:mb-6">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="font-medium text-fg/80">AniKumo</span>
                  <nav className="flex flex-wrap items-center gap-x-3.5 gap-y-1" aria-label="Footer">
                    <Link href="/compare" className="hover:text-fg">Compare</Link>
                    <Link href="/changelog" className="hover:text-fg">What&apos;s new</Link>
                    <Link href="/rules" className="hover:text-fg">Rules</Link>
                    <Link href="/privacy" className="hover:text-fg">Privacy</Link>
                    <span className="hidden lg:contents"><ShortcutsButton /></span>
                  </nav>
                  <SocialIcons />
                  <span className="text-[11px] sm:ml-auto">
                    {t("footer.data")}{" "}
                    <a className="text-fg/70 hover:text-fg" href="https://anilist.co" target="_blank" rel="noreferrer">AniList</a>
                    {" · "}{t("footer.skip")}{" "}
                    <a className="text-fg/70 hover:text-fg" href="https://aniskip.com" target="_blank" rel="noreferrer">AniSkip</a>
                  </span>
                </div>
              </footer>
              <MobileNav
                libraryEnabled={libraryEnabled}
                user={user ? { username: user.username, avatarColor: user.avatarColor, avatar: user.avatar } : null}
                latestChangelog={latest?.createdAt.toISOString() ?? null}
              />
              <ScrollTop />
              <PageViews />
              <TrackerShield />
              <DevtoolsGuard enabled={roleOf(user) !== "owner"} />
              <Toaster />
              <Shortcuts />
              <CommandPalette />
              <ServiceWorker />
            </PlayerProvider>
          </Providers>
        </PrefsProvider>
      </body>
    </html>
  );
}
