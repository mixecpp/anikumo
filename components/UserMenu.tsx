"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = {
  user: { username: string; avatarColor: string } | null;
  links: { href: string; label: string }[];
};

export function Avatar({ name, color, size = 32 }: { name: string; color: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-bold uppercase text-white"
      style={{ background: color, width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.charAt(0)}
    </span>
  );
}

export default function UserMenu({ user, links }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full p-1 transition hover:bg-white/5"
        aria-label="Menu"
      >
        {user ? (
          <Avatar name={user.username} color={user.avatarColor} />
        ) : (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-muted">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          </span>
        )}
      </button>
      {open && (
        <div className="fade-in absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-2xl shadow-black/60">
          {user && <div className="border-b border-line px-4 py-3 text-sm font-semibold">{user.username}</div>}
          <div className="border-b border-line py-1 lg:hidden">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block px-4 py-2 text-sm hover:bg-white/5">
                {l.label}
              </Link>
            ))}
          </div>
          {user ? (
            <>
              <Link href="/profile" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm hover:bg-white/5">
                Profile & history
              </Link>
              <button onClick={logout} className="block w-full px-4 py-2 text-left text-sm text-accent hover:bg-white/5">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm hover:bg-white/5">
                Log in
              </Link>
              <Link href="/register" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-accent hover:bg-white/5">
                Create account
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
