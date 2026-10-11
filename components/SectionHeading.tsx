import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type HeadingIcon = string;

export default function SectionHeading({
  title,
  count,
  href,
  hrefLabel = "See all",
  className = "",
}: {
  icon?: HeadingIcon;
  title: React.ReactNode;
  count?: number;
  href?: string;
  hrefLabel?: string;
  className?: string;
}) {
  return (
    <div className={`mb-4 flex items-baseline justify-between gap-4 ${className}`}>
      <h2 className="text-lg font-semibold tracking-tight md:text-xl">
        {title}
        {count !== undefined && <span className="ml-2 text-sm font-normal text-muted tabular-nums">{count}</span>}
      </h2>
      {href && (
        <Link href={href} className="group flex shrink-0 items-center gap-0.5 text-sm text-muted transition-colors hover:text-fg">
          {hrefLabel}
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
