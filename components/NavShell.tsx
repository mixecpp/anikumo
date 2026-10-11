"use client";

import { useEffect, useRef } from "react";

/**
 * Transparent at the top, frosted once the page scrolls. The scrolled state is a data attribute
 * toggled outside React so the server and client always render identical markup.
 */
export default function NavShell({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      el.dataset.scrolled = window.scrollY > 12 ? "true" : "false";
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      ref={ref}
      data-scrolled="false"
      className="sticky top-0 z-40 border-b pt-[env(safe-area-inset-top)] border-transparent transition-[background-color,border-color] duration-200 data-[scrolled=true]:border-white/[0.06] data-[scrolled=true]:bg-bg/80 data-[scrolled=true]:backdrop-blur-xl"
    >
      {children}
    </header>
  );
}
