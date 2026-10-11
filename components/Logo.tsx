import { CLOUD_PATH, CLOUD_VIEWBOX } from "@/lib/logo-path";

/** The AniKumo cloud. Inherits the text colour, so it's white on dark and near-black on light. */
export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox={CLOUD_VIEWBOX} className={`text-fg ${className}`} aria-hidden>
      <path fill="currentColor" fillRule="evenodd" d={CLOUD_PATH} />
    </svg>
  );
}

export default function Logo() {
  return (
    <span className="group flex items-center gap-2">
      <LogoMark size={30} className="transition-transform duration-300 group-hover:-translate-y-0.5" />
      <span className="hidden text-[15px] font-semibold tracking-tight sm:inline">AniKumo</span>
    </span>
  );
}
