"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import type { Role } from "@/lib/roles";

/**
 * The live layer that sits on every page: the site-wide chat and announcements.
 *
 * It polls /api/live: every 30s normally (online count, announcement, newest message time for
 * the unread dot), every 3s while the chat is open, and slowly while the tab is hidden.
 */

export type Person = { id: string; username: string; avatarColor: string; avatar: string; role: Role };
export type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  author: Person;
  pinned: boolean;
  replyTo: { id: string; body: string; username: string } | null;
  anime: { id: number; episode: number | null; title: string; cover: string } | null;
};
export type Announcement = { id: string; body: string; href: string; tone: "info" | "important"; createdAt: string; expiresAt: string };
export type Me = { id: string; username: string; role: Role; staff: boolean; muted: boolean; mutedUntil: string | null; slowWait: number };
type Poll = {
  now: number;
  online: number;
  announcement: Announcement | null;
  chat: { on: boolean; slowMode: number; latestAt: number; messages?: ChatMessage[]; deleted?: string[]; pinned?: ChatMessage | null };
  me: Me | null;
};

type Live = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  online: number;
  announcement: Announcement | null;
  chatOn: boolean;
  slowMode: number;
  me: Me | null;
  messages: ChatMessage[];
  pinned: ChatMessage | null;
  loaded: boolean;
  hasOlder: boolean;
  unread: boolean;
  /** When you may send again under slow mode (ms timestamp). */
  slowUntil: number;
  send: (body: string, extra?: { replyToId?: string | null; anime?: { id: number; episode: number } | null }) => Promise<boolean>;
  remove: (id: string) => Promise<void>;
  staffAction: (body: Record<string, unknown>) => Promise<boolean>;
  loadOlder: () => Promise<void>;
  refresh: () => void;
};

const LiveContext = createContext<Live | null>(null);
export function useLive() {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error("useLive needs <LiveProvider>");
  return ctx;
}
export function useLiveOptional() {
  return useContext(LiveContext);
}

const SEEN = "ak_chat_seen";
const OPEN = "ak_chat_open";
const KEEP = 300;

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};

function merge(list: ChatMessage[], add: ChatMessage[], deleted: string[] = []) {
  if (!add.length && !deleted.length) return list;
  const byId = new Map(list.map((m) => [m.id, m]));
  for (const m of add) byId.set(m.id, m);
  for (const id of deleted) byId.delete(id);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-KEEP);
}

export async function liveAction(body: Record<string, unknown>) {
  try {
    const res = await fetch("/api/live/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(json.error ?? "Something went wrong", "error");
      return null;
    }
    return json as Record<string, unknown>;
  } catch {
    toast("You look offline. Try again in a moment.", "error");
    return null;
  }
}

export default function LiveProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpenState] = useState(false);
  const [data, setData] = useState<Poll | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pinned, setPinned] = useState<ChatMessage | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [hasOlder, setHasOlder] = useState(true);
  const [seen, setSeen] = useState(0);
  const [slowUntil, setSlowUntil] = useState(0);
  const [visible, setVisible] = useState(true);
  const since = useRef<string | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const inflight = useRef(false);

  // Restore: was the chat open (desktop only), when did you last read it, and ?chat=1 links.
  useEffect(() => {
    setSeen(Number(read(SEEN)) || 0);
    const wide = window.matchMedia("(min-width: 1024px)").matches;
    const url = new URL(window.location.href);
    if (url.searchParams.get("chat") === "1") {
      setOpenState(true);
      url.searchParams.delete("chat");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    } else if (wide && read(OPEN) === "1") setOpenState(true);
    const onVis = () => setVisible(document.visibilityState === "visible");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const poll = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const isOpen = openRef.current;
      const qs = new URLSearchParams();
      if (isOpen) {
        qs.set("open", "1");
        if (since.current) qs.set("since", since.current);
      }
      const query = qs.toString();
      const res = await fetch(query ? "/api/live?" + query : "/api/live", { cache: "no-store" });
      if (!res.ok) return;
      const json: Poll = await res.json();
      setData(json);
      if (json.me?.slowWait) setSlowUntil(Date.now() + json.me.slowWait * 1000);
      if (isOpen && json.chat.messages) {
        const fresh = json.chat.messages;
        const first = !since.current;
        if (first) setHasOlder(fresh.length >= 50);
        setMessages((list) => {
          const next = merge(first ? [] : list, fresh, json.chat.deleted);
          const last = next[next.length - 1];
          since.current = last ? last.createdAt : new Date(json.now).toISOString();
          return next;
        });
        setPinned(json.chat.pinned ?? null);
        setLoaded(true);
      }
    } catch {
      // offline for a moment: the next tick tries again
    } finally {
      inflight.current = false;
    }
  }, []);

  // The polling loop: quick while the chat is open, slow otherwise, slower in a hidden tab.
  useEffect(() => {
    void poll();
    const every = !visible ? 60_000 : open ? 3_000 : 30_000;
    const timer = setInterval(() => void poll(), every);
    return () => clearInterval(timer);
  }, [open, visible, poll]);

  // Reading the chat marks everything up to now as seen.
  const latestAt = data?.chat.latestAt ?? 0;
  useEffect(() => {
    if (!open || !latestAt) return;
    setSeen((s) => {
      const next = Math.max(s, latestAt);
      if (next !== s) write(SEEN, String(next));
      return next;
    });
  }, [open, latestAt, messages.length]);

  const setOpen = useCallback((value: boolean) => {
    setOpenState(value);
    if (window.matchMedia("(min-width: 1024px)").matches) write(OPEN, value ? "1" : "0");
  }, []);
  const toggle = useCallback(() => setOpen(!openRef.current), [setOpen]);

  const staffSlow = data?.me?.staff ? 0 : (data?.chat.slowMode ?? 0);
  const send = useCallback<Live["send"]>(
    async (body, extra = {}) => {
      const json = await liveAction({ action: "send", body, replyToId: extra.replyToId ?? null, anime: extra.anime ?? null });
      if (!json) return false;
      const m = json.message as ChatMessage | undefined;
      if (m) setMessages((list) => merge(list, [m]));
      if (staffSlow) setSlowUntil(Date.now() + staffSlow * 1000);
      return true;
    },
    [staffSlow],
  );

  const remove = useCallback(async (id: string) => {
    if (await liveAction({ action: "delete", id })) {
      setMessages((list) => list.filter((m) => m.id !== id));
      setPinned((p) => (p?.id === id ? null : p));
    }
  }, []);

  const staffAction = useCallback(
    async (body: Record<string, unknown>) => {
      const ok = !!(await liveAction(body));
      if (ok) {
        if (body.action === "clear") setMessages([]);
        void poll();
      }
      return ok;
    },
    [poll],
  );

  const loadOlder = useCallback(async () => {
    const first = messages[0];
    if (!first) return;
    try {
      const res = await fetch("/api/live/chat?before=" + encodeURIComponent(first.id), { cache: "no-store" });
      if (!res.ok) return;
      const json: { messages: ChatMessage[] } = await res.json();
      setHasOlder(json.messages.length >= 50);
      setMessages((list) => {
        const byId = new Map([...json.messages, ...list].map((m) => [m.id, m]));
        return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      });
    } catch {}
  }, [messages]);

  const value = useMemo<Live>(
    () => ({
      open,
      setOpen,
      toggle,
      online: data?.online ?? 0,
      announcement: data?.announcement ?? null,
      chatOn: data?.chat.on ?? true,
      slowMode: data?.chat.slowMode ?? 0,
      me: data?.me ?? null,
      messages,
      pinned,
      loaded,
      hasOlder,
      unread: !open && latestAt > 1 && seen > 0 && latestAt > seen,
      slowUntil,
      send,
      remove,
      staffAction,
      loadOlder,
      refresh: () => void poll(),
    }),
    [open, setOpen, toggle, data, messages, pinned, loaded, hasOlder, latestAt, seen, slowUntil, send, remove, staffAction, loadOlder, poll],
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}
