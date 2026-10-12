"use client";

import { useEffect, useRef } from "react";

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
      reject(new Error("captcha script failed"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Cloudflare Turnstile widget. Usually invisible — it only shows a checkbox when Cloudflare
 * isn't sure. Tokens are single-use, so bump `nonce` after every submit to get a fresh one.
 */
export default function Turnstile({ siteKey, onToken, nonce = 0 }: { siteKey: string; onToken: (token: string | null) => void; nonce?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !el.current || !window.turnstile) return;
        id.current = window.turnstile.render(el.current, {
          sitekey: siteKey,
          theme: "dark",
          appearance: "interaction-only",
          callback: (t: string) => cb.current(t),
          "expired-callback": () => cb.current(null),
          "error-callback": () => cb.current(null),
        });
      })
      .catch(() => cb.current(null));
    return () => {
      cancelled = true;
      if (id.current) window.turnstile?.remove(id.current);
      id.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (!nonce || !id.current) return;
    cb.current(null);
    window.turnstile?.reset(id.current);
  }, [nonce]);

  return <div ref={el} className="empty:hidden [&_iframe]:!w-full" />;
}
