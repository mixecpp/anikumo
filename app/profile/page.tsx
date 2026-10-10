import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getContinueWatching } from "@/lib/progress";
import { Avatar } from "@/components/UserMenu";
import ProfileSettings from "@/components/ProfileSettings";
import ContinueWatching from "@/components/ContinueWatching";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/profile");

  const [favorites, cont, stats, recent] = await Promise.all([
    prisma.favorite.findMany({ where: { userId: user.id }, orderBy: { addedAt: "desc" } }),
    getContinueWatching(user.id, 20),
    prisma.watchProgress.aggregate({
      where: { userId: user.id, completed: true },
      _count: true,
      _sum: { durationSeconds: true },
    }),
    prisma.watchProgress.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 30 }),
  ]);
  const shows = new Set(recent.map((r) => r.anilistId)).size;
  const hours = Math.round((stats._sum.durationSeconds ?? 0) / 3600);

  return (
    <div className="mx-auto max-w-[1500px] px-4 pt-10 md:px-8">
      <div className="flex flex-wrap items-center gap-5">
        <Avatar name={user.username} color={user.avatarColor} size={80} />
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">{user.username}</h1>
          <div className="text-sm text-muted">Member since {user.createdAt.toLocaleDateString()}</div>
        </div>
        <div className="ml-auto flex gap-3">
          {[
            [stats._count, "Episodes watched"],
            [hours, "Hours (local)"],
            [favorites.length, "Favorites"],
            [shows, "Recent shows"],
          ].map(([n, l]) => (
            <div key={String(l)} className="rounded-xl border border-line bg-surface px-4 py-3 text-center">
              <div className="font-[family-name:var(--font-display)] text-2xl font-bold">{n}</div>
              <div className="text-xs text-muted">{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="-mx-4 md:-mx-8">
        <ContinueWatching items={cont} />
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_340px]">
        <div className="space-y-10">
          <section>
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold">Favorites</h2>
            {favorites.length === 0 ? (
              <p className="text-sm text-muted">Nothing yet — hit ♥ on any anime page.</p>
            ) : (
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
                {favorites.map((f) => (
                  <Link key={f.id} href={`/anime/${f.anilistId}`} className="group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.coverImage} alt="" className="aspect-[2/3] w-full rounded-xl object-cover transition group-hover:brightness-75" />
                    <div className="mt-1.5 line-clamp-2 text-xs font-medium group-hover:text-accent-2">{f.title}</div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold">Recent activity</h2>
            {recent.length === 0 ? (
              <p className="text-sm text-muted">No watch history yet.</p>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {recent.map((r) => (
                  <li key={r.id}>
                    <Link href={`/watch/${r.anilistId}/${r.episode}`} className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-white/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.coverImage} alt="" className="h-12 w-8 rounded object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{r.title}</div>
                        <div className="text-xs text-muted">Episode {r.episode}</div>
                      </div>
                      <span className={`text-xs ${r.completed ? "text-accent" : "text-muted"}`}>
                        {r.completed ? "✓ Watched" : r.durationSeconds ? `${Math.round((r.progressSeconds / r.durationSeconds) * 100)}%` : "Opened"}
                      </span>
                      <span className="hidden w-24 text-right text-xs text-muted sm:block">{r.updatedAt.toLocaleDateString()}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <aside>
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold">Settings</h2>
          <ProfileSettings avatarColor={user.avatarColor} />
        </aside>
      </div>
    </div>
  );
}
