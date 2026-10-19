import Link from "next/link";
import type { Metadata } from "next";
import { Ban, Flag, Inbox, ShieldCheck, VolumeX } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireStaffPage, roleOf } from "@/lib/auth";
import { rankAbove, type Role } from "@/lib/roles";
import { findContent, isReportable, type ReportableType } from "@/lib/reports";
import { Avatar } from "@/components/UserMenu";
import { RoleBadge } from "@/components/admin/ModTools";
import { ModActions, RemoveButton, ReportButtons, RequestButtons } from "@/components/admin/ModActions";

export const metadata: Metadata = { title: "Moderation" };

type Props = { searchParams: Promise<{ tab?: string; show?: string }> };
const PERSON = { select: { id: true, username: true, avatarColor: true, avatar: true, isAdmin: true, isModerator: true, mutedUntil: true, bannedAt: true } } as const;
type Person = { id: string; username: string; avatarColor: string; avatar: string; isAdmin: boolean; isModerator: boolean; mutedUntil: Date | null; bannedAt: Date | null };

const TYPE_LABEL: Record<ReportableType, string> = { comment: "Comment", review: "Review", post: "Post", post_comment: "Post reply", profile_comment: "Profile comment", room_message: "Watch Together chat", chat_message: "Live chat" };
const KIND_LABEL: Record<string, string> = { ban: "Ban", clearProfile: "Clear bio & banner", removeAvatar: "Remove picture" };

function ago(d: Date) {
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function ModerationPage({ searchParams }: Props) {
  const me = await requireStaffPage();
  const myRole = me.role as Role;
  const isAdmin = myRole === "admin" || myRole === "owner";
  const sp = await searchParams;
  const tab = ["requests", "activity", "restricted"].includes(sp.tab ?? "") ? sp.tab! : "reports";
  const now = new Date();

  const [openReports, openRequests, restrictedCount] = await Promise.all([
    prisma.report.groupBy({ by: ["targetType", "targetId"], where: { status: "open" } }).then((g) => g.length),
    prisma.modRequest.count({ where: { status: "open" } }),
    prisma.user.count({ where: { OR: [{ mutedUntil: { gt: now } }, { bannedAt: { not: null } }] } }),
  ]);

  const tabs: [string, string, number][] = [
    ["reports", "Reports", openReports],
    ["requests", "Requests", openRequests],
    ["activity", "Activity", 0],
    ["restricted", "Muted & banned", restrictedCount],
  ];

  // Actions on a person show only if you rank above them.
  const actionsFor = (p: Person) =>
    rankAbove(myRole, roleOf(p)) ? <ModActions userId={p.id} username={p.username} muted={!!p.mutedUntil && p.mutedUntil > now} banned={!!p.bannedAt} isAdmin={isAdmin} hasAvatar={!!p.avatar} /> : null;

  return (
    <div>
      <p className="-mt-2 mb-6 max-w-2xl text-sm text-muted">
        {isAdmin
          ? "Review reports, handle moderator requests and keep an eye on new posts."
          : "Remove anything that breaks the rules and mute people for up to a week. For bans or profile clean-ups, send a request to the admins."}
      </p>

      <nav aria-label="Moderation" className="scrollbar-none mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-white/[0.06]">
        {tabs.map(([key, label, count]) => {
          const active = tab === key;
          return (
            <Link
              key={key}
              href={key === "reports" ? "/admin/moderation" : `/admin/moderation?tab=${key}`}
              aria-current={active ? "page" : undefined}
              className={`relative flex shrink-0 items-center gap-1.5 px-3 pb-3 pt-1 text-sm transition-colors ${active ? "text-fg" : "text-muted hover:text-fg"}`}
            >
              {label}
              {count > 0 && <span className={`rounded-full px-1.5 font-mono text-[10px] ${key === "reports" || (key === "requests" && isAdmin) ? "bg-accent text-bg" : "bg-white/[0.08] text-muted"}`}>{count}</span>}
              {active && <span className="absolute inset-x-0 -bottom-px h-px bg-fg" />}
            </Link>
          );
        })}
      </nav>

      {tab === "reports" && <Reports actionsFor={actionsFor} />}
      {tab === "requests" && <Requests isAdmin={isAdmin} myId={me.id} />}
      {tab === "activity" && <Activity show={sp.show} actionsFor={actionsFor} />}
      {tab === "restricted" && <Restricted actionsFor={actionsFor} />}
    </div>
  );
}

function Empty({ icon: Icon, title, text }: { icon: typeof Flag; title: string; text: string }) {
  return (
    <div className="panel rounded-2xl px-6 py-14 text-center">
      <Icon className="mx-auto h-6 w-6 text-muted" />
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted">{text}</p>
    </div>
  );
}

function Byline({ person, when, extra }: { person: Person; when: Date; extra?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Link href={`/u/${person.username}`} className="shrink-0">
        <Avatar name={person.username} color={person.avatarColor} avatar={person.avatar} size={28} />
      </Link>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <Link href={`/u/${person.username}`} className="truncate font-medium hover:underline">
            {person.username}
          </Link>
          <RoleBadge role={roleOf(person)} />
          {person.bannedAt && <span className="text-[11px] text-red-300">banned</span>}
          {!person.bannedAt && person.mutedUntil && person.mutedUntil > new Date() && <span className="text-[11px] text-amber-200">muted</span>}
        </div>
        <div className="font-mono text-[11px] text-muted">
          {ago(when)}
          {extra}
        </div>
      </div>
    </div>
  );
}

async function Reports({ actionsFor }: { actionsFor: (p: Person) => React.ReactNode }) {
  const reports = await prisma.report.findMany({ where: { status: "open" }, orderBy: { createdAt: "desc" }, take: 200, select: { id: true, targetType: true, targetId: true, reason: true, createdAt: true } });
  // One card per reported thing, however many people reported it.
  const groups = new Map<string, { type: ReportableType; id: string; reportId: string; reasons: Map<string, number>; latest: Date; count: number }>();
  for (const r of reports) {
    if (!isReportable(r.targetType)) continue;
    const key = `${r.targetType}:${r.targetId}`;
    const g = groups.get(key) ?? { type: r.targetType, id: r.targetId, reportId: r.id, reasons: new Map(), latest: r.createdAt, count: 0 };
    g.reasons.set(r.reason, (g.reasons.get(r.reason) ?? 0) + 1);
    g.count++;
    groups.set(key, g);
  }
  const items = await Promise.all([...groups.values()].slice(0, 40).map(async (g) => ({ ...g, content: await findContent(g.type, g.id) })));
  const authors = new Map((await prisma.user.findMany({ where: { id: { in: items.flatMap((i) => (i.content ? [i.content.userId] : [])) } }, ...PERSON })).map((u) => [u.id, u]));

  if (!items.length) return <Empty icon={Flag} title="All clear" text="No open reports right now." />;

  return (
    <ul className="space-y-3">
      {items.map((g) => {
        const author = g.content ? authors.get(g.content.userId) : undefined;
        return (
          <li key={`${g.type}:${g.id}`} className="panel rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="chip !py-0">{TYPE_LABEL[g.type]}</span>
              {[...g.reasons].map(([reason, n]) => (
                <span key={reason} className="rounded-full bg-red-500/10 px-2 py-0.5 text-red-200">
                  {reason}
                  {n > 1 && ` ×${n}`}
                </span>
              ))}
              <span className="ml-auto font-mono text-[11px] text-muted">
                {g.count} report{g.count === 1 ? "" : "s"} · {ago(g.latest)}
              </span>
            </div>
            {g.content && author ? (
              <>
                <blockquote className="mt-3 line-clamp-6 whitespace-pre-wrap break-words border-l-2 border-white/10 pl-3 text-sm text-fg/85">{g.content.body}</blockquote>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <Byline person={author} when={g.latest} extra={<> · <Link href={g.content.href} className="hover:text-fg">view in context</Link></>} />
                  <div className="flex items-center gap-1">
                    {actionsFor(author)}
                    <ReportButtons reportId={g.reportId} />
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-sm text-muted">Already deleted.</p>
                <ReportButtons reportId={g.reportId} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

async function Requests({ isAdmin, myId }: { isAdmin: boolean; myId: string }) {
  const where = isAdmin ? {} : { requesterId: myId };
  const [open, done] = await Promise.all([
    prisma.modRequest.findMany({ where: { ...where, status: "open" }, orderBy: { createdAt: "desc" }, take: 50, include: { target: PERSON, requester: PERSON } }),
    prisma.modRequest.findMany({ where: { ...where, status: { not: "open" } }, orderBy: { handledAt: "desc" }, take: 15, include: { target: PERSON, requester: PERSON } }),
  ]);
  if (!open.length && !done.length)
    return <Empty icon={Inbox} title="No requests" text={isAdmin ? "When a moderator asks for a ban or a profile clean-up, it shows up here." : "Ask for a ban or a profile clean-up from the ⋯ menu next to someone's name."} />;

  return (
    <div className="space-y-8">
      {open.length > 0 && (
        <ul className="space-y-3">
          {open.map((r) => (
            <li key={r.id} className="panel rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Byline person={r.target} when={r.createdAt} extra={<> · asked by {r.requester.username}</>} />
                <span className={`rounded-full px-2.5 py-0.5 text-xs ${r.kind === "ban" ? "bg-red-500/15 text-red-200" : "bg-white/[0.06] text-fg/80"}`}>{KIND_LABEL[r.kind] ?? r.kind}</span>
              </div>
              {r.reason && <p className="mt-3 border-l-2 border-white/10 pl-3 text-sm text-fg/85">{r.reason}</p>}
              <div className="mt-3 flex items-center justify-between gap-3">
                <Link href={`/u/${r.target.username}`} className="text-xs text-muted hover:text-fg">
                  View profile
                </Link>
                {isAdmin ? <RequestButtons requestId={r.id} /> : <span className="text-xs text-muted">Waiting for an admin</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Recently handled</h2>
          <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.06]">
            {done.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                <span className="font-medium">{r.target.username}</span>
                <span className="text-muted">{KIND_LABEL[r.kind] ?? r.kind}</span>
                <span className="text-xs text-muted">asked by {r.requester.username}</span>
                <span className={`ml-auto text-xs ${r.status === "approved" ? "text-success" : "text-muted"}`}>{r.status === "approved" ? "Approved" : "Declined"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type ActivityItem = { key: string; kind: "post" | "comment" | "review" | "post_comment" | "profile_comment"; id: string; at: Date; person: Person; body: string; href: string; where: string };

async function Activity({ show, actionsFor }: { show?: string; actionsFor: (p: Person) => React.ReactNode }) {
  const filter = ["posts", "comments", "reviews"].includes(show ?? "") ? show : "all";
  const take = filter === "all" ? 15 : 40;
  const [posts, replies, comments, reviews, wall] = await Promise.all([
    filter === "all" || filter === "posts" ? prisma.post.findMany({ orderBy: { createdAt: "desc" }, take, include: { user: PERSON } }) : [],
    filter === "all" || filter === "posts" ? prisma.postComment.findMany({ orderBy: { createdAt: "desc" }, take, include: { user: PERSON, post: { select: { user: { select: { username: true } } } } } }) : [],
    filter === "all" || filter === "comments" ? prisma.comment.findMany({ orderBy: { createdAt: "desc" }, take, include: { user: PERSON } }) : [],
    filter === "all" || filter === "reviews" ? prisma.review.findMany({ orderBy: { createdAt: "desc" }, take, include: { user: PERSON } }) : [],
    filter === "all" || filter === "comments" ? prisma.profileComment.findMany({ orderBy: { createdAt: "desc" }, take, include: { user: PERSON, profile: { select: { username: true } } } }) : [],
  ]);
  const items: ActivityItem[] = [
    ...posts.map((p) => ({ key: `p${p.id}`, kind: "post" as const, id: p.id, at: p.createdAt, person: p.user, body: p.body || (p.animeTitle ? `📺 ${p.animeTitle}` : ""), href: `/post/${p.id}`, where: "post" })),
    ...replies.map((c) => ({ key: `r${c.id}`, kind: "post_comment" as const, id: c.id, at: c.createdAt, person: c.user, body: c.body, href: `/post/${c.postId}`, where: `reply on ${c.post.user.username}'s post` })),
    ...wall.map((c) => ({ key: `w${c.id}`, kind: "profile_comment" as const, id: c.id, at: c.createdAt, person: c.user, body: c.body, href: `/u/${c.profile.username}#wall-${c.id}`, where: `on ${c.profile.username}'s profile` })),
    ...comments.map((c) => ({ key: `c${c.id}`, kind: "comment" as const, id: c.id, at: c.createdAt, person: c.user, body: c.body, href: `${c.episode ? `/watch/${c.anilistId}/${c.episode}` : `/anime/${c.anilistId}`}#comment-${c.id}`, where: c.episode ? `episode ${c.episode} discussion` : "show discussion" })),
    ...reviews.map((r) => ({ key: `v${r.id}`, kind: "review" as const, id: r.id, at: r.createdAt, person: r.user, body: [r.title, r.body].filter(Boolean).join(" — "), href: `/anime/${r.anilistId}#reviews`, where: `review · ${r.score}/10` })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const filters: [string, string][] = [
    ["all", "Everything"],
    ["posts", "Posts"],
    ["comments", "Comments"],
    ["reviews", "Reviews"],
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {filters.map(([key, label]) => (
          <Link
            key={key}
            href={key === "all" ? "/admin/moderation?tab=activity" : `/admin/moderation?tab=activity&show=${key}`}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${filter === key ? "bg-white/[0.1] text-fg" : "text-muted hover:bg-white/[0.05] hover:text-fg"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      {items.length === 0 ? (
        <Empty icon={ShieldCheck} title="Nothing yet" text="New posts, comments and reviews show up here." />
      ) : (
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.06]">
          {items.slice(0, 60).map((it) => (
            <li key={it.key} className="group px-4 py-3 transition-colors hover:bg-white/[0.015]">
              <div className="flex items-start justify-between gap-3">
                <Byline person={it.person} when={it.at} extra={<> · <Link href={it.href} className="hover:text-fg">{it.where}</Link></>} />
                <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
                  {actionsFor(it.person)}
                  <RemoveButton kind={it.kind} id={it.id} />
                </div>
              </div>
              {it.body && <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words pl-[38px] text-sm text-fg/80">{it.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function Restricted({ actionsFor }: { actionsFor: (p: Person) => React.ReactNode }) {
  const now = new Date();
  const people = await prisma.user.findMany({
    where: { OR: [{ mutedUntil: { gt: now } }, { bannedAt: { not: null } }] },
    orderBy: { username: "asc" },
    take: 100,
    select: { ...PERSON.select, muteReason: true, banReason: true, createdAt: true },
  });
  if (!people.length) return <Empty icon={VolumeX} title="Nobody is muted or banned" text="Mutes and bans show up here until they're lifted." />;
  return (
    <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.06]">
      {people.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <Byline person={p} when={p.createdAt} extra={<> joined</>} />
          <div className="min-w-0 flex-1 text-xs">
            {p.bannedAt ? (
              <span className="flex items-center gap-1.5 text-red-300">
                <Ban className="h-3.5 w-3.5 shrink-0" /> Banned {p.bannedAt.toLocaleDateString()}
                {p.banReason && <span className="truncate text-muted">· {p.banReason}</span>}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-200">
                <VolumeX className="h-3.5 w-3.5 shrink-0" /> Muted until {p.mutedUntil!.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                {p.muteReason && <span className="truncate text-muted">· {p.muteReason}</span>}
              </span>
            )}
          </div>
          {actionsFor(p)}
        </li>
      ))}
    </ul>
  );
}
