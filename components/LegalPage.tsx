import Link from "next/link";
import { SocialCard } from "./Socials";

/** Shared layout for the rules and privacy pages: readable column, section headings, contact. */
export default function LegalPage({ title, intro, updated, children }: { title: string; intro: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl px-4 pb-10 pt-10 md:px-8">
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted">Last updated {updated}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-fg/80">{intro}</p>
      <nav className="mt-5 flex gap-4 text-sm" aria-label="Site policies">
        <Link href="/rules" className="text-muted hover:text-fg">
          Rules
        </Link>
        <Link href="/privacy" className="text-muted hover:text-fg">
          Privacy
        </Link>
      </nav>
      <div className="legal mt-8 space-y-8 text-sm leading-relaxed text-fg/80 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-fg [&_li]:mt-1.5 [&_strong]:font-medium [&_strong]:text-fg [&_ul]:list-disc [&_ul]:space-y-0.5 [&_ul]:pl-5">
        {children}
      </div>
      <SocialCard text="Questions or problems? Message us on Telegram — it's the fastest way to reach the team." className="mt-10" />
    </article>
  );
}
