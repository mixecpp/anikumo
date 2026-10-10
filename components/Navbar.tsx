import Link from "next/link";
import { getUser } from "@/lib/auth";
import SearchBox from "./SearchBox";
import UserMenu from "./UserMenu";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Browse" },
  { href: "/schedule", label: "Schedule" },
  { href: "/library", label: "Library" },
];

export default async function Navbar() {
  const user = await getUser();
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-[1500px] items-center gap-4 px-4 md:gap-8 md:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-[family-name:var(--font-display)] text-xl font-extrabold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-sm text-white">A</span>
          <span className="hidden sm:inline">
            Anime<span className="text-accent">Web</span>
          </span>
        </Link>
        <div className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-white/5 hover:text-fg">
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-1 justify-end">
          <SearchBox />
        </div>
        <UserMenu user={user ? { username: user.username, avatarColor: user.avatarColor } : null} links={LINKS} />
      </nav>
    </header>
  );
}
