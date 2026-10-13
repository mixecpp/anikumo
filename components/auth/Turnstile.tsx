"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<void> | null = null;
function loadScript() {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      s.remove();
      reject(new Error("captcha script failed"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Cloudflare Turnstile widget. Usually invisible — it only shows a checkbox when Cloudflare
 * isn't sure. `action` names the form so the server can check the token came from it.
 * Tokens are single-use, so bump `nonce` after every submit to get a fresh one.
 */
export default function Turnstile({ siteKey, action, onToken, nonce = 0 }: { siteKey: string; action: "login" | "register" | "forgot" | "room"; onToken: (token: string | null) => void; nonce?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  const cb = useRef(onToken);
  cb.current = onToken;
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    loadScript()
      .then(() => {
        if (cancelled || !el.current || !window.turnstile) return;
        id.current = window.turnstile.render(el.current, {
          sitekey: siteKey,
          action,
          theme: "dark",
          appearance: "interaction-only",
          "refresh-expired": "auto",
          callback: (t: string) => {
            setFailed(false);
            cb.current(t);
          },
          "expired-callback": () => cb.current(null),
          "error-callback": () => {
            cb.current(null);
            setFailed(true);
            // Returning true tells Turnstile we've handled it (no console error spam).
            return true;
          },
        });
      })
      .catch(() => {
        cb.current(null);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (id.current) window.turnstile?.remove(id.current);
      id.current = null;
    };
  }, [siteKey, action, attempt]);

  useEffect(() => {
    if (!nonce || !id.current) return;
    cb.current(null);
    window.turnstile?.reset(id.current);
  }, [nonce]);

  return (
    <>
      <div ref={el} className="empty:hidden [&_iframe]:!w-full" />
      {failed && (
        <p className="flex items-center justify-between gap-3 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          The human check couldn&apos;t load. Ad blockers or VPNs can cause this.
          <button type="button" onClick={() => setAttempt((a) => a + 1)} className="flex shrink-0 items-center gap-1 font-medium hover:underline">
            <RotateCw className="h-3 w-3" /> Retry
          </button>
        </p>
      )}
    </>
  );
}
