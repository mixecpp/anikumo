import Link from "next/link";

const GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Romance", "Sci-Fi", "Slice of Life", "Mystery", "Horror", "Psychological", "Sports", "Mecha", "Music", "Supernatural", "Thriller"];

export default function GenreStrip() {
  return (
    <div className="scrollbar-none mask-fade-x relative z-10 -mt-2 flex gap-2 overflow-x-auto px-4 md:px-8">
      {GENRES.map((g) => (
        <Link
          key={g}
          href={`/browse?genre=${encodeURIComponent(g)}`}
          className="press shrink-0 rounded-full border border-white/[0.08] px-3.5 py-1.5 text-sm text-muted transition-colors hover:border-white/20 hover:text-fg"
        >
          {g}
        </Link>
      ))}
    </div>
  );
}
