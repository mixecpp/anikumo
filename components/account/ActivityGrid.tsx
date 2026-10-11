const LEVELS = ["bg-white/[0.05]", "bg-accent/25", "bg-accent/45", "bg-accent/70", "bg-accent"];

function level(seconds: number) {
  const m = seconds / 60;
  if (m < 1) return 0;
  if (m < 20) return 1;
  if (m < 60) return 2;
  if (m < 150) return 3;
  return 4;
}

function fmt(seconds: number) {
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** GitHub-style grid of daily active watch time (oldest week on the left). */
export default function ActivityGrid({ activity }: { activity: { date: string; seconds: number }[] }) {
  const weeks: { date: string; seconds: number }[][] = [];
  for (let i = 0; i < activity.length; i += 7) weeks.push(activity.slice(i, i + 7));
  const total = activity.reduce((n, d) => n + d.seconds, 0);
  const activeDays = activity.filter((d) => d.seconds >= 60).length;

  return (
    <div>
      <div className="scrollbar-none overflow-x-auto">
        <div className="flex w-max gap-[3px]" role="img" aria-label={`${fmt(total)} watched across ${activeDays} days in the last ${activity.length} days`}>
          {weeks.map((week, w) => (
            <div key={w} className="flex flex-col gap-[3px]">
              {week.map((d) => (
                <div
                  key={d.date}
                  title={`${d.seconds >= 60 ? fmt(d.seconds) : "No viewing"} · ${new Date(d.date + "T00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`}
                  className={`h-[11px] w-[11px] rounded-[3px] transition-transform hover:scale-125 ${LEVELS[level(d.seconds)]}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>
          {fmt(total)} across {activeDays} day{activeDays === 1 ? "" : "s"}
        </span>
        <span className="flex items-center gap-1">
          Less
          {LEVELS.map((l) => (
            <span key={l} className={`h-[10px] w-[10px] rounded-[3px] ${l}`} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
