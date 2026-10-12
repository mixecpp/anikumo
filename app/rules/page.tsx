import Link from "next/link";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = pageMeta({ title: "Rules", description: "The rules for using AniKumo: be kind, tag spoilers, no hate or spam.", path: "/rules" });

export default function RulesPage() {
  return (
    <LegalPage
      title="Rules of use"
      updated="12 October 2026"
      intro="AniKumo is a place to find, track and talk about anime. These rules keep it friendly. By using the site or making an account, you agree to them."
    >
      <section>
        <h2>Be kind</h2>
        <ul>
          <li>Disagree about shows as much as you like, but don&apos;t attack people.</li>
          <li>No harassment, threats, bullying or telling anyone to hurt themselves.</li>
          <li>No slurs or hate against anyone for their race, ethnicity, religion, gender, sexuality or disability. Our filter blocks the worst of it automatically.</li>
        </ul>
      </section>

      <section>
        <h2>Tag your spoilers</h2>
        <ul>
          <li>Wrap spoilers in double bars, <code className="rounded bg-white/[0.06] px-1">||like this||</code>, so they stay hidden until someone taps them.</li>
          <li>Episode discussions are for that episode. Keep later events hidden there.</li>
        </ul>
      </section>

      <section>
        <h2>No spam or scams</h2>
        <ul>
          <li>No advertising, repeated messages, invite links to other servers, or links to scams and malware.</li>
          <li>New accounts have posting limits for their first few days. That&apos;s normal.</li>
          <li>One person, one account. Don&apos;t make accounts to dodge a mute or ban.</li>
        </ul>
      </section>

      <section>
        <h2>Keep it legal and safe</h2>
        <ul>
          <li>Nothing sexual involving minors. That includes drawn or animated content. It&apos;s removed and the account is banned straight away.</li>
          <li>No sharing other people&apos;s personal information.</li>
          <li>Don&apos;t pretend to be someone else, including AniKumo staff.</li>
          <li>Don&apos;t try to break, overload, scrape or get around the site&apos;s security.</li>
          <li>You need to be at least 13 to have an account.</li>
        </ul>
      </section>

      <section>
        <h2>Your account</h2>
        <ul>
          <li>Keep your password and recovery key safe. We never ask for your password, and we can&apos;t email you a reset.</li>
          <li>You can download your data or delete your account anytime in <Link href="/account/settings" className="text-fg underline-offset-2 hover:underline">Settings</Link>.</li>
        </ul>
      </section>

      <section>
        <h2>How moderation works</h2>
        <ul>
          <li>Use the flag button to report anything that breaks these rules. Reports are private.</li>
          <li>Moderators can remove posts and comments, and mute accounts for up to a week. Admins can suspend accounts.</li>
          <li>If we remove something of yours or restrict your account, you&apos;ll get a notification explaining why.</li>
          <li>Think we got it wrong? Message us on Telegram.</li>
        </ul>
      </section>

      <section>
        <h2>About the videos</h2>
        <p>
          AniKumo doesn&apos;t host any video files. Anime information comes from AniList, and episodes play from third-party players embedded on the page. If you own the rights to something
          and want it gone, contact us on Telegram and we&apos;ll remove it from the site.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          We may update these rules as the site grows. Big changes will be announced on the site and on Telegram. The site is provided as-is, and we may remove content or accounts that
          break these rules.
        </p>
      </section>
    </LegalPage>
  );
}
