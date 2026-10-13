import { ArrowUpRight, Send } from "lucide-react";
import { TELEGRAM_URL, TIKTOK_URL, TikTokIcon } from "./Socials";

export { TELEGRAM_URL, TIKTOK_URL } from "./Socials";

/** Front-page invite to AniKumo's Telegram and TikTok: updates, clips and a way to reach us. */
export default function TelegramCard() {
  return (
    <section className="panel relative flex flex-col gap-4 overflow-hidden rounded-2xl p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#229ED9]/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 right-40 h-48 w-48 rounded-full bg-[#fe2c55]/[0.07] blur-3xl" />
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#229ED9]/15 text-[#229ED9]">
        <Send className="h-5 w-5 -translate-x-px translate-y-px" />
      </span>
      <div className="relative min-w-0 flex-1">
        <h2 className="text-base font-semibold tracking-tight">Follow AniKumo</h2>
        <p className="mt-0.5 text-sm text-muted">Site updates and a place to talk to us on Telegram, plus clips and edits on TikTok.</p>
      </div>
      <div className="relative flex shrink-0 flex-wrap gap-2">
        <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="btn btn-ghost group !py-2">
          <Send className="h-4 w-4 text-[#229ED9]" /> Telegram
          <ArrowUpRight className="h-3.5 w-3.5 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </a>
        <a href={TIKTOK_URL} target="_blank" rel="noopener noreferrer" className="btn btn-ghost group !py-2">
          <TikTokIcon className="h-4 w-4" /> TikTok
          <ArrowUpRight className="h-3.5 w-3.5 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </a>
      </div>
    </section>
  );
}
