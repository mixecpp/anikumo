"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";

/**
 * Discourages casual poking around with browser developer tools:
 *  - blocks the usual shortcuts (F12, Ctrl+Shift+I/J/C/K, Ctrl+U and the Mac equivalents)
 *  - if developer tools are open anyway, the tab is closed (browsers only let a page close a tab
 *    it opened itself, so otherwise the page is wiped and replaced with a blank one)
 * Right-click stays as normal (so "open link in new tab" works).
 *
 * Detection uses a `debugger` statement: it does nothing when developer tools are closed, and
 * pauses when they're open, so a long gap means they're open. Unlike window-size checks it isn't
 * fooled by page zoom or browser side panels. Only the site owner is exempt.
 *
 * This is a deterrent, not security: anything secret must stay on the server.
 */
const pause = new Function("debugger") as () => void;

/** Close the tab if the browser allows it; otherwise blank it (replacing this history entry). */
function shutDown() {
  try {
    window.stop();
    document.documentElement.innerHTML = "";
  } catch {}
  try {
    window.open("", "_self");
    window.close();
  } catch {}
  // Still here (tabs the visitor opened themselves can't be closed by a page): leave nothing behind.
  setTimeout(() => location.replace("about:blank"), 50);
}

export default function DevtoolsGuard({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const blocked =
        e.key === "F12" ||
        (ctrl && e.shiftKey && ["i", "j", "c", "k"].includes(k)) ||
        (e.metaKey && e.altKey && ["i", "j", "c", "u"].includes(k)) ||
        (ctrl && !e.shiftKey && k === "u");
      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled]);

  useEffect(() => {
    // Touch devices don't have docked developer tools; skip the check there.
    if (!enabled || matchMedia("(pointer: coarse)").matches) return;
    let hits = 0;
    const check = () => {
      const start = performance.now();
      // Built at run time: production builds strip a literal debugger statement.
      pause();
      const paused = performance.now() - start > 800;
      hits = paused ? hits + 1 : 0;
      if (paused) {
        setOpen(true);
        shutDown();
      }
    };
    const t = setInterval(check, 1500);
    return () => clearInterval(t);
  }, [enabled]);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-devtools", open);
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-bg p-6 text-center" role="alertdialog" aria-label="Developer tools are open">
      <div className="max-w-sm">
        <ShieldAlert className="mx-auto h-8 w-8 text-muted" />
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Close developer tools to continue</h1>
        <p className="mt-2 text-sm text-muted">AniKumo is paused while the browser&apos;s developer tools are open. Close them and the site comes right back.</p>
      </div>
    </div>
  );
}
