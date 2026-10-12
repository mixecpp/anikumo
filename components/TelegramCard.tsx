import { ArrowUpRight, Send } from "lucide-react";

export const TELEGRAM_URL = "https://t.me/animekumo";

/** Front-page invite to the AniKumo Telegram: updates and a way to reach us off the site. */
export default function TelegramCard() {
  return (
    <a
      href={TELEGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="panel group relative flex flex-col gap-4 overflow-hidden rounded-2xl p-5 transition-colors hover:border-white/15 sm:flex-row sm:items-center sm:gap-5 sm:p-6"
    >
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#229ED9]/10 blur-3xl" />
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#229ED9]/15 text-[#229ED9]">
        <Send className="h-5 w-5 -translate-x-px translate-y-px" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold tracking-tight">AniKumo on Telegram</h2>
        <p className="mt-0.5 text-sm text-muted">Site updates, new features and a place to talk to us — even when you&apos;re not on the site.</p>
      </div>
      <span className="btn btn-ghost shrink-0 self-start !py-2 sm:self-auto">
        Join @animekumo
        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </span>
    </a>
  );
}
