import Link from "next/link";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = pageMeta({ title: "Privacy policy", description: "What AniKumo collects, why, who else is involved, and how to delete it.", path: "/privacy" });

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="12 October 2026"
      intro="Short version: we collect as little as we can and don't sell it. There are no ads or advertising trackers, and we never ask for your email or real name."
    >
      <section>
        <h2>What we store when you have an account</h2>
        <ul>
          <li>
            <strong>Account:</strong> your username and your password, stored scrambled (hashed) so even we can&apos;t read it. Your recovery key is hashed the same way, and your
            two-factor secret (if you turn it on) is encrypted.
          </li>
          <li>
            <strong>Profile:</strong> anything you choose to add: your bio, picture, banner and privacy settings.
          </li>
          <li>
            <strong>Your activity:</strong> your lists, scores, favourites, watch progress and history, and your settings, so they follow you between devices.
          </li>
          <li>
            <strong>Things you post:</strong> comments, replies, reviews, posts, profile comments, likes, follows and reports.
          </li>
          <li>
            <strong>Sign-ins:</strong> for each device you&apos;re logged in on, its IP address, browser name and when it was last used. You can see these and sign devices out in Settings.
          </li>
        </ul>
      </section>

      <section>
        <h2>What we store if you just browse</h2>
        <ul>
          <li>Nothing tied to you. Your IP address is briefly held in memory to stop abuse (rate limiting) and then forgotten.</li>
          <li>If a page crashes, we log the error and the page address, plus your account if you&apos;re logged in, so we can fix it.</li>
        </ul>
      </section>

      <section>
        <h2>Cookies and storage on your device</h2>
        <ul>
          <li>One cookie, <code className="rounded bg-white/[0.06] px-1">aw_session</code>, keeps you logged in. There are no advertising or tracking cookies.</li>
          <li>Your browser also stores your preferences (volume, subtitles, theme, recent searches, unsaved progress) so the site remembers them. You can clear these anytime.</li>
        </ul>
      </section>

      <section>
        <h2>Who else is involved</h2>
        <ul>
          <li>
            <strong>Cloudflare</strong> delivers the site and runs the &quot;human check&quot; (Turnstile) on log in, sign up and password reset. It sees your IP address and basic browser
            details.
          </li>
          <li>
            <strong>AniList</strong> provides anime information. Cover images load straight from its servers.
          </li>
          <li>
            <strong>Video players</strong> on watch pages come from third parties. Like any embedded site, they can see your IP address and set their own cookies.
          </li>
          <li>
            <strong>AniSkip</strong> provides intro and outro skip times.
          </li>
        </ul>
        <p className="mt-2">We don&apos;t sell or share your data with anyone else, and we don&apos;t use it for advertising.</p>
      </section>

      <section>
        <h2>Who can see what</h2>
        <ul>
          <li>Your profile is private until you change it. You pick who can see it, which parts they see, and who can comment on it.</li>
          <li>Comments and reviews on anime pages are public. Posts follow your profile&apos;s privacy setting.</li>
          <li>Moderators see reported content and what&apos;s needed to moderate it. Admins can see basic account details (like when you joined and were last active) to keep the site safe.</li>
        </ul>
      </section>

      <section>
        <h2>Your choices</h2>
        <ul>
          <li>
            <strong>Download</strong> a copy of your data, or <strong>delete your account</strong> and everything tied to it, anytime in{" "}
            <Link href="/account/settings" className="text-fg underline-offset-2 hover:underline">
              Settings
            </Link>
            .
          </li>
          <li>Remove items from your watch history, or turn your profile private, whenever you like.</li>
          <li>When you delete your account it&apos;s erased straight away. Daily safety backups are kept for up to 14 days, then deleted.</li>
        </ul>
      </section>

      <section>
        <h2>Keeping it safe</h2>
        <p>
          Connections are encrypted (HTTPS), passwords and recovery keys are hashed, and sensitive settings are encrypted in our database. You can add two-factor authentication for
          extra protection. Nothing online is perfectly secure, but we take it seriously.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>AniKumo accounts are for people aged 13 and over. If you think a younger child has made an account, tell us and we&apos;ll remove it.</p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>If this policy changes in a way that matters, we&apos;ll say so on the site and on Telegram before it takes effect.</p>
      </section>
    </LegalPage>
  );
}
