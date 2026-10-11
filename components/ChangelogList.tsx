import type { ReactNode } from "react";

export type ChangelogItem = { id: string; title: string; body: string; tag: string; version: string; createdAt: Date };

const TAG_STYLE: Record<string, string> = {
  new: "text-accent border-accent/30",
  improved: "text-sky-300 border-sky-300/25",
  fixed: "text-success border-success/30",
};

/** Plain text only: "- " lines become bullets, blank lines split paragraphs. Never renders HTML. */
function Body({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) blocks.push(<ul key={blocks.length} className="ml-4 list-disc space-y-1 marker:text-muted">{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>);
    bullets = [];
  };
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (/^[-*•]\s+/.test(t)) bullets.push(t.replace(/^[-*•]\s+/, ""));
    else {
      flush();
      if (t) blocks.push(<p key={blocks.length}>{t}</p>);
    }
  }
  flush();
  return <div className="mt-2 space-y-2 text-sm leading-relaxed text-fg/75">{blocks}</div>;
}

export default function ChangelogList({ entries, actions }: { entries: ChangelogItem[]; actions?: (id: string) => ReactNode }) {
  return (
    <ol className="relative space-y-10 border-l border-white/[0.06] pl-6 md:pl-8">
      {entries.map((e) => (
        <li key={e.id} id={e.id} className="relative scroll-mt-24">
          <span className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-bg bg-white/25 md:-left-[37px]" aria-hidden />
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <time dateTime={e.createdAt.toISOString()} className="font-mono text-muted">
              {e.createdAt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
            </time>
            <span className={`rounded-full border px-2 py-px text-[10px] font-medium uppercase tracking-wide ${TAG_STYLE[e.tag] ?? TAG_STYLE.new}`}>{e.tag}</span>
            {e.version && <span className="font-mono text-muted">v{e.version.replace(/^v/i, "")}</span>}
            {actions && <span className="ml-auto">{actions(e.id)}</span>}
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight">{e.title}</h2>
          {e.body && <Body text={e.body} />}
        </li>
      ))}
    </ol>
  );
}
