import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { Avatar } from "@/components/UserMenu";
import ShareButton from "@/components/ShareButton";

type Props = { params: Promise<{ username: string; id: string }> };

async function load({ username, id }: { username: string; id: string }) {
  const list = await prisma.customList.findFirst({
    where: { id, user: { username } },
    include: { items: { orderBy: { position: "asc" } }, user: { select: { id: true, username: true, avatarColor: true, avatar: true, profilePublic: true } } },
  });
  return list;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const list = await load(await params);
  return list?.isPublic && list.user.profilePublic ? { title: list.title, description: list.description || `A list by ${list.user.username}` } : { title: "List" };
}

export default async function PublicListPage({ params }: Props) {
  const list = await load(await params);
  const viewer = await getUserId();
  if (!list) notFound();
  const isOwner = viewer === list.user.id;
  if (!isOwner && (!list.isPublic || !list.user.profilePublic)) notFound();

  return (
    <div className="mx-auto max-w-[900px] px-4 pt-10 md:px-8">
      <Link href={`/u/${list.user.username}`} className="flex items-center gap-2 text-sm text-muted hover:text-fg">
        <Avatar name={list.user.username} color={list.user.avatarColor} avatar={list.user.avatar} size={22} /> {list.user.username}
      </Link>
      <div className="mt-3 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight">{list.title}</h1>
          {list.description && <p className="mt-2 max-w-2xl text-sm text-fg/75">{list.description}</p>}
          <p className="mt-1.5 font-mono text-[11px] text-muted">{list.items.length} shows</p>
        </div>
        <ShareButton title={list.title} />
        {isOwner && (
          <Link href={`/account/lists/${list.id}`} className="btn btn-ghost">
            Edit
          </Link>
        )}
      </div>
      <ol className="mt-8 space-y-2">
        {list.items.map((it, i) => (
          <li key={it.id}>
            <Link href={`/anime/${it.anilistId}`} className="panel group flex items-center gap-4 rounded-xl p-2.5 transition-colors hover:border-white/15">
              <span className="w-6 text-right font-mono text-sm text-muted">{i + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.coverImage} alt="" loading="lazy" className="h-16 w-11 rounded object-cover" />
              <div className="min-w-0">
                <div className="truncate text-sm group-hover:underline">{it.title}</div>
                {it.note && <p className="mt-0.5 text-xs text-muted">{it.note}</p>}
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
