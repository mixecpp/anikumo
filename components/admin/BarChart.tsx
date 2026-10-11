"use client";

import { useEffect, useRef, useState } from "react";

type Point = { label: string; value: number };

const H = 140;
const PAD = { top: 8, right: 4, bottom: 22, left: 34 };

function niceMax(v: number) {
  if (v <= 0) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow * 4 >= v)! * pow;
  return step * 4;
}

function shortDay(day: string) {
  const d = new Date(`${day}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Rounded top corners only, so each bar stays anchored to the baseline. */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  if (h <= 0) return "";
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** Single-series daily bar chart with a hover tooltip and a screen-reader table. */
export default function BarChart({ title, data, format = (v) => v.toLocaleString() }: { title: string; data: Point[]; format?: (v: number) => string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = H - PAD.top - PAD.bottom;
  const slot = data.length ? plotW / data.length : 0;
  const barW = Math.max(1, slot - 2);
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const total = data.reduce((s, d) => s + d.value, 0);
  const h = hover !== null ? data[hover] : null;

  return (
    <figure className="panel rounded-xl p-4">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        <span className="font-mono text-[11px] text-muted">{h ? `${shortDay(h.label)} · ${format(h.value)}` : `${format(total)} in ${data.length}d`}</span>
      </figcaption>
      <div ref={ref} className="relative mt-3" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        {width > 0 && (
          <svg width={width} height={H} role="img" aria-label={`${title}, last ${data.length} days`}>
            {ticks.map((t) => {
              const y = PAD.top + plotH - (t / max) * plotH;
              return (
                <g key={t}>
                  <line x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} stroke="var(--border)" />
                  <text x={PAD.left - 6} y={y} dy="0.32em" textAnchor="end" className="fill-muted font-mono text-[10px]">
                    {format(t)}
                  </text>
                </g>
              );
            })}
            {data.map((d, i) => {
              const bh = (d.value / max) * plotH;
              const x = PAD.left + i * slot + 1;
              return (
                <g key={d.label}>
                  <path d={barPath(x, PAD.top + plotH - bh, barW, bh)} className={hover === null || hover === i ? "fill-accent" : "fill-accent/35"} style={{ transition: "fill-opacity 150ms" }} />
                  {/* full-height hit target, larger than the bar */}
                  <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} />
                </g>
              );
            })}
            {[0, Math.floor((data.length - 1) / 2), data.length - 1].map((i) =>
              data[i] ? (
                <text key={i} x={PAD.left + i * slot + slot / 2} y={H - 6} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} className="fill-muted font-mono text-[10px]">
                  {shortDay(data[i].label)}
                </text>
              ) : null,
            )}
          </svg>
        )}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
