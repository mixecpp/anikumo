"use client";

import { useRouter } from "next/navigation";
import { GENRES } from "@/lib/anilist";

const FORMATS = ["TV", "TV_SHORT", "MOVIE", "OVA", "ONA", "SPECIAL"];
const STATUSES = [
  ["RELEASING", "Airing"],
  ["FINISHED", "Finished"],
  ["NOT_YET_RELEASED", "Upcoming"],
];
const SEASONS = ["WINTER", "SPRING", "SUMMER", "FALL"];
const SORTS = [
  ["popularity", "Popularity"],
  ["trending", "Trending"],
  ["score", "Score"],
  ["newest", "Newest"],
  ["title", "Title"],
];

export default function BrowseFilters({ current }: { current: Record<string, string | undefined> }) {
  const router = useRouter();
  const thisYear = new Date().getFullYear() + 1;
  const years = Array.from({ length: 60 }, (_, i) => thisYear - i);

  function set(key: string, value: string) {
    const next = new URLSearchParams(
      Object.entries(current).filter(([k, v]) => v && k !== "page") as [string, string][],
    );
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/browse?${next}`);
  }

  const select = (key: string, label: string, options: (string | string[])[]) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      <select
        value={current[key] ?? ""}
        onChange={(e) => set(key, e.target.value)}
        className="input !py-2 text-sm"
      >
        <option value="">Any</option>
        {options.map((o) => {
          const [v, l] = Array.isArray(o) ? o : [o, o.charAt(0) + o.slice(1).toLowerCase().replace("_", " ")];
          return (
            <option key={v} value={v}>
              {["TV", "OVA", "ONA"].includes(v) ? v : l}
            </option>
          );
        })}
      </select>
    </label>
  );

  const hasFilters = Object.entries(current).some(([k, v]) => v && k !== "page");

  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
      <label className="col-span-2 flex flex-col gap-1 sm:col-span-3 lg:col-span-1">
        <span className="text-xs font-medium text-muted">Search</span>
        <input
          defaultValue={current.q ?? ""}
          onKeyDown={(e) => {
            if (e.key === "Enter") set("q", (e.target as HTMLInputElement).value.trim());
          }}
          placeholder="Title…"
          className="input !py-2 text-sm"
        />
      </label>
      {select("genre", "Genre", GENRES)}
      {select("year", "Year", years.map(String))}
      {select("season", "Season", SEASONS)}
      {select("format", "Format", FORMATS)}
      {select("status", "Status", STATUSES)}
      <div className="flex items-end gap-2">
        <div className="flex-1">{select("sort", "Sort", SORTS)}</div>
        {hasFilters && (
          <button onClick={() => router.push("/browse")} className="btn btn-ghost !px-3 !py-2" title="Clear filters">
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
