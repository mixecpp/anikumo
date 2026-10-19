"use client";

import Link from "next/link";
import { useState } from "react";

const SPOILER = /(\|\|[\s\S]+?\|\|)/g;
const MENTION = /(@[A-Za-z0-9_.-]{2,24})/g;

/** A chat message: ||spoilers|| blurred until tapped, @mentions linked (and highlighted when they are you). */
export default function MessageText({ text, me, className = "" }: { text: string; me?: string | null; className?: string }) {
  return (
    <p className={`whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${className}`}>
      {text.split(SPOILER).map((part, i) =>
        part.startsWith("||") && part.endsWith("||") && part.length > 4 ? <Spoiler key={i} text={part.slice(2, -2)} /> : <Mentions key={i} text={part} me={me} />,
      )}
    </p>
  );
}

function Mentions({ text, me }: { text: string; me?: string | null }) {
  return (
    <>
      {text.split(MENTION).map((part, i) => {
        if (i % 2 === 0) return part;
        const name = part.slice(1).replace(/[.-]+$/, "");
        const tail = part.slice(1 + name.length);
        const mine = !!me && name.toLowerCase() === me.toLowerCase();
        return (
          <span key={i}>
            <Link href={"/u/" + encodeURIComponent(name)} className={`rounded px-0.5 font-medium ${mine ? "bg-accent/20 text-accent" : "text-accent/90 hover:underline"}`}>
              @{name}
            </Link>
            {tail}
          </span>
        );
      })}
    </>
  );
}

function Spoiler({ text }: { text: string }) {
  const [shown, setShown] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setShown((s) => !s)}
      className={`rounded px-0.5 text-left transition-all ${shown ? "bg-white/[0.06]" : "bg-white/[0.12] text-transparent blur-[4px] hover:blur-[3px]"}`}
      aria-label={shown ? "Hide spoiler" : "Show spoiler"}
      title={shown ? "Hide spoiler" : "Spoiler, tap to reveal"}
    >
      {text}
    </button>
  );
}

/** For one-line previews (pinned message, reply quotes): spoilers stay hidden. */
export const preview = (text: string) => text.replace(SPOILER, "▒▒▒");

/** True when the text mentions @name. */
export function mentions(text: string, name: string | null | undefined) {
  if (!name) return false;
  const safe = name.replace(/[^A-Za-z0-9_.-]/g, "");
  const re = new RegExp("(^|[^A-Za-z0-9_.-])@" + safe.replace(/[.-]/g, (c) => "[" + c + "]") + "(?![A-Za-z0-9_])", "i");
  return re.test(text);
}
