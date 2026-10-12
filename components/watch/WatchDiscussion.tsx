"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import { ChevronRight, MessageCircle, X } from "lucide-react";
import Comments from "../Comments";
import { Avatar } from "../UserMenu";
import { useScrollLock } from "../useScrollLock";

type Peek = { count: number; top: { id: string; body: string; user: { username: string; avatarColor: string; avatar: string } } | null };
type Props = { anilistId: number; episode: number; loggedIn: boolean };

const PHONE = "(max-width: 767px)";
const isPhone = () => window.matchMedia(PHONE).matches;

function usePhone() {
  const [phone, setPhone] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

/**
 * YouTube-style comments preview right under the player (phones and tablets): the count and
 * the top comment. On a phone it opens a sheet below the pinned player so you can read and
 * write while the episode keeps playing; on a tablet it jumps down to the discussion.
 */
export function CommentsPeek({ anilistId, episode, loggedIn }: Props) {
  const [peek, setPeek] = useState<Peek | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/comments?anilistId=${anilistId}&episode=${episode}&peek=1`)
      .then((r) => r.json())
      .then((j: Peek) => setPeek(j))
      .catch(() => {});
  }, [anilistId, episode]);
  useEffect(load, [load]);

  const show = useCallback(() => {
    if (!isPhone()) {
      document.getElementById("discussion")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    // Scroll so the player pins to the top, then slide the comments up underneath it.
    const slot = document.querySelector<HTMLElement>("[data-player-slot]");
    if (slot) window.scrollTo({ top: slot.getBoundingClientRect().top + window.scrollY + 1, behavior: "instant" });
    setMounted(true);
    setOpen(true);
  }, []);

  // Links to a specific comment (e.g. from someone's profile) open the sheet on phones.
  useEffect(() => {
    if (location.hash.startsWith("#comment-") && isPhone()) {
      const t = setTimeout(show, 600);
      return () => clearTimeout(t);
    }
  }, [show]);

  const close = () => {
    setOpen(false);
    load();
  };

  return (
    <>
      <button onClick={show} className="panel mt-3 block w-full rounded-xl p-3.5 text-left transition-colors hover:border-white/15 xl:hidden">
        <div className="flex items-center gap-2 text-sm">
          <MessageCircle className="h-4 w-4 text-muted" />
          <span className="font-medium">Comments</span>
          <span className="font-mono text-xs text-muted">{peek ? peek.count : "…"}</span>
          <ChevronRight className="ml-auto h-4 w-4 text-muted" />
        </div>
        {peek?.top ? (
          <div className="mt-2.5 flex items-start gap-2.5">
            <Avatar name={peek.top.user.username} color={peek.top.user.avatarColor} avatar={peek.top.user.avatar} size={22} />
            <p className="line-clamp-2 min-w-0 text-[13px] leading-snug text-fg/80">
              <span className="mr-1.5 text-muted">{peek.top.user.username}</span>
              {peek.top.body.replace(/\|\|[\s\S]*?\|\|/g, "▒▒▒")}
            </p>
          </div>
        ) : (
          peek && <p className="mt-2 text-[13px] text-muted">No comments yet. Be the first to share your thoughts on this episode.</p>
        )}
      </button>
      {mounted && <CommentsSheet open={open} onClose={close} count={peek?.count ?? 0} {...{ anilistId, episode, loggedIn }} />}
    </>
  );
}

function CommentsSheet({ open, onClose, count, anilistId, episode, loggedIn }: Props & { open: boolean; onClose: () => void; count: number }) {
  const drag = useDragControls();
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          role="dialog"
          aria-label="Comments"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 420, damping: 42 }}
          drag="y"
          dragControls={drag}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.7 }}
          onDragEnd={(_, info) => (info.offset.y > 90 || info.velocity.y > 600) && onClose()}
          // Fills the screen below the pinned 16:9 player.
          style={{ top: "calc(100vw * 9 / 16 + env(safe-area-inset-top))" }}
          className="fixed inset-x-0 bottom-0 z-[44] flex flex-col border-t border-white/10 bg-bg"
        >
          <div onPointerDown={(e) => drag.start(e)} className="flex shrink-0 cursor-grab touch-none items-center gap-2 border-b border-white/[0.06] px-4 pb-3 pt-2">
            <div className="absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-full bg-white/15" aria-hidden />
            <span className="mt-1.5 text-sm font-semibold">Comments</span>
            <span className="mt-1.5 font-mono text-xs text-muted">{count}</span>
            <button onClick={onClose} onPointerDown={(e) => e.stopPropagation()} className="ml-auto mt-1 rounded-lg p-1.5 text-muted hover:bg-white/[0.06] hover:text-fg" aria-label="Close comments">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-4">
            <Comments anilistId={anilistId} episode={episode} loggedIn={loggedIn} hideHeading />
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

/** The full discussion further down the page — on phones it lives in the sheet instead. */
export function InlineComments({ anilistId, episode, loggedIn }: Props) {
  const phone = usePhone();
  return <div id="discussion" className="scroll-mt-24">{phone === false && <Comments anilistId={anilistId} episode={episode} loggedIn={loggedIn} />}</div>;
}
