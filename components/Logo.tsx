/** Minimal mark: a play triangle with cat ears. */
export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#fafafa" />
      <path d="M8.5 13.2 L9.6 6.6 L14 10.2 Z" fill="#0a0a0b" />
      <path d="M23.5 13.2 L22.4 6.6 L18 10.2 Z" fill="#0a0a0b" />
      <path d="M12.6 11.8 L23.4 18 L12.6 24.2 Z" fill="#f6a57c" strokeLinejoin="round" stroke="#f6a57c" strokeWidth="1.6" />
    </svg>
  );
}

export default function Logo() {
  return (
    <span className="group flex items-center gap-2.5">
      <LogoMark className="transition-transform duration-300 group-hover:-rotate-6" />
      <span className="hidden text-[15px] font-semibold tracking-tight sm:inline">AniKumo</span>
    </span>
  );
}
