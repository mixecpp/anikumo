import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getUserId, requireStaff } from "@/lib/auth";
import { getPost } from "@/lib/posts";
import { pageMeta } from "@/lib/seo";
import { PostCard } from "@/components/posts/Posts";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  // Only public posts get a real preview; anything else stays generic and unindexed.
  const post = await getPost(id, null);
  if (!post) return pageMeta({ title: "Post", description: "A post on AniKumo.", path: `/post/${id}`, noindex: true });
  const v = post.view;
  const text = v.body || (v.anime ? `${v.anime.recommend ? "Recommends" : "Watching"} ${v.anime.title}` : "");
  return pageMeta({ title: `${v.author.username} on AniKumo`, description: text.replace(/\|\|[\s\S]*?\|\|/g, "▒▒▒").slice(0, 160), path: `/post/${id}` });
}

/** One post with its comments open — where notifications and "copy link" point. */
export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const me = await getUserId();
  const post = await getPost(id, me);
  if (!post) notFound();
  const staff = me ? !!(await requireStaff()) : false;

  return (
    <div className="mx-auto max-w-2xl px-4 pt-8 md:px-8">
      <Link href="/feed" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Feed
      </Link>
      <PostCard post={post.view} staff={staff} defaultOpen redirectOnDelete />
    </div>
  );
}
