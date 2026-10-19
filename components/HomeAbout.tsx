import Link from "next/link";
import OpenChatButton from "./live/OpenChatButton";

/**
 * The home page's own heading and a short, plain description of the site. Search engines read
 * the page's h1 to learn what a site is about (the hero's anime titles are h2s), and the links
 * point them at the main sections.
 */
export default function HomeAbout() {
  const link = "text-fg underline-offset-2 hover:underline";
  return (
    <section aria-labelledby="about-anikumo" className="border-t border-line pt-10">
      <h1 id="about-anikumo" className="text-xl font-semibold tracking-tight md:text-2xl">
        AniKumo: watch anime online, free and with no ads
      </h1>
      <div className="mt-4 grid gap-6 text-sm leading-relaxed text-muted md:grid-cols-3">
        <p>
          AniKumo is a free anime site with no ads on our pages and no sign-up needed to start watching. Stream new episodes the day they air, in Japanese with English subtitles or
          English dub, and pick up where you left off on any device.
        </p>
        <p>
          Find what to watch with the{" "}
          <Link href="/season" className={link}>
            seasonal anime chart
          </Link>
          , the{" "}
          <Link href="/schedule" className={link}>
            airing schedule
          </Link>
          ,{" "}
          <Link href="/charts" className={link}>
            top-rated charts
          </Link>{" "}
          and{" "}
          <Link href="/browse" className={link}>
            browse by genre
          </Link>
          , then keep track of everything in your own anime list.
        </p>
        <p>
          Watching with friends? Start a{" "}
          <Link href="/watch-together" className={link}>
            watch party
          </Link>{" "}
          and everyone stays on the same episode with a chat on the side, or hang out in the{" "}
          <OpenChatButton className={link}>live chat</OpenChatButton> with everyone on the site.
        </p>
      </div>
    </section>
  );
}
