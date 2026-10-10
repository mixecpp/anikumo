import type { Metadata } from "next";
import { Geist, Outfit } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const outfit = Outfit({ variable: "--font-display", subsets: ["latin"], weight: ["500", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "AnimeWeb", template: "%s · AnimeWeb" },
  description: "Track, discover and watch anime.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${outfit.variable} min-h-screen`}>
        <Navbar />
        <main className="pb-20">{children}</main>
        <footer className="border-t border-line py-8 text-center text-sm text-muted">
          AnimeWeb · Metadata by{" "}
          <a className="hover:text-fg underline" href="https://anilist.co" target="_blank" rel="noreferrer">
            AniList
          </a>{" "}
          · Skip times by{" "}
          <a className="hover:text-fg underline" href="https://aniskip.com" target="_blank" rel="noreferrer">
            AniSkip
          </a>
        </footer>
      </body>
    </html>
  );
}
