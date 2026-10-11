"use client";

import { useEffect, useState } from "react";

const KEY = "ak_changelog_seen";
const EVENT = "anikumo:changelog-seen";

function read() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** True when there's a changelog entry newer than the last one this browser opened. */
export function useChangelogUnseen(latest: string | null) {
  const [unseen, setUnseen] = useState(false);
  useEffect(() => {
    const check = () => {
      const seen = read();
      setUnseen(!!latest && (!seen || seen < latest));
    };
    check();
    window.addEventListener(EVENT, check);
    return () => window.removeEventListener(EVENT, check);
  }, [latest]);
  return unseen;
}

/** Rendered on /changelog: records the newest entry as seen. */
export function MarkChangelogSeen({ latest }: { latest: string | null }) {
  useEffect(() => {
    if (!latest) return;
    try {
      localStorage.setItem(KEY, latest);
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  }, [latest]);
  return null;
}

export function NewDot({ className = "" }: { className?: string }) {
  return <span className={`inline-block h-1.5 w-1.5 rounded-full bg-accent ${className}`} aria-label="New" />;
}
