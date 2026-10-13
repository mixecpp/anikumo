import { ArrowUpRight, Send } from "lucide-react";

export const TELEGRAM_URL = "https://t.me/animekumo";
export const TIKTOK_URL = "https://www.tiktok.com/@animekumo";

/** TikTok's note mark (lucide has no brand icons). */
export function TikTokIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48Z" />
    </svg>
  );
}

/** Small round icon links (footer, sidebars). */
export function SocialIcons({ className = "" }: { className?: string }) {
  const item = "grid h-7 w-7 place-items-center rounded-full border border-white/[0.08] text-muted transition-colors hover:border-white/20 hover:text-fg";
  return (
    <span className={`flex items-center gap-1.5 ${className}`}>
      <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className={`${item} hover:!text-[#229ED9]`} aria-label="AniKumo on Telegram" title="Telegram @animekumo">
        <Send className="h-3.5 w-3.5 -translate-x-px translate-y-px" />
      </a>
      <a href={TIKTOK_URL} target="_blank" rel="noopener noreferrer" className={item} aria-label="AniKumo on TikTok" title="TikTok @animekumo">
        <TikTokIcon className="h-3.5 w-3.5" />
      </a>
    </span>
  );
}

/** A compact "follow us" card for sidebars and page headers. */
export function SocialCard({ text = "Updates, clips and a place to talk to us", className = "" }: { text?: string; className?: string }) {
  return (
    <div className={`panel rounded-xl p-3 ${className}`}>
      <div className="px-1 text-sm font-medium">Follow @animekumo</div>
      <div className="px-1 text-xs text-muted">{text}</div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 rounded-lg border border-white/[0.07] px-2.5 py-2 text-xs transition-colors hover:border-[#229ED9]/40 hover:bg-[#229ED9]/10">
          <Send className="h-3.5 w-3.5 text-[#229ED9]" /> Telegram
          <ArrowUpRight className="ml-auto h-3 w-3 text-muted group-hover:text-fg" />
        </a>
        <a href={TIKTOK_URL} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 rounded-lg border border-white/[0.07] px-2.5 py-2 text-xs transition-colors hover:border-white/25 hover:bg-white/[0.05]">
          <TikTokIcon className="h-3.5 w-3.5" /> TikTok
          <ArrowUpRight className="ml-auto h-3 w-3 text-muted group-hover:text-fg" />
        </a>
      </div>
    </div>
  );
}
