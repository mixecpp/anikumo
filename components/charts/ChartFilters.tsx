"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { GENRE_LIST } from "@/lib/browse-params";
import Select from "../Select";

export default function ChartFilters({ type, genre, year }: { type: "top" | "gems"; genre?: string; year?: number }) {
  const router = useRouter();
  const thisYear = new Date().getFullYear();
  const go = (next: { type?: string; genre?: string; year?: string }) => {
    const qs = new URLSearchParams();
    const t = next.type ?? type;
    const g = next.genre !== undefined ? next.genre : genre ?? "";
    const y = next.year !== undefined ? next.year : year ? String(year) : "";
    if (t !== "top") qs.set("type", t);
    if (g) qs.set("genre", g);
    if (y) qs.set("year", y);
    router.push(`/charts${qs.size ? `?${qs}` : ""}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-xl bg-white/[0.04] p-1">
        {(
          [
            ["top", "Top 100"],
            ["gems", "Hidden gems"],
          ] as const
        ).map(([k, l]) => (
          <Link key={k} href={k === "top" ? "/charts" : "/charts?type=gems"} className={`relative rounded-lg px-3 py-1.5 text-sm transition-colors ${type === k ? "text-fg" : "text-muted hover:text-fg"}`}>
            {type === k && <motion.span layoutId="chart-type" className="absolute inset-0 rounded-lg bg-white/[0.09]" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            <span className="relative">{l}</span>
          </Link>
        ))}
      </div>
      <Select label="Genre" value={genre ?? ""} onChange={(v) => go({ genre: v })} options={[{ value: "", label: "All genres" }, ...GENRE_LIST.map((g) => ({ value: g, label: g }))]} className="w-44" />
      <Select
        label="Year"
        value={year ? String(year) : ""}
        onChange={(v) => go({ year: v })}
        options={[{ value: "", label: "All time" }, ...Array.from({ length: thisYear - 1969 }, (_, i) => String(thisYear - i)).map((y) => ({ value: y, label: y }))]}
        className="w-36"
      />
    </div>
  );
}
