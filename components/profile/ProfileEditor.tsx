"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ImageIcon, LoaderCircle, Pencil, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { BannerPicker } from "../account/ProfilePrivacy";
import AvatarPicker from "../account/AvatarPicker";
import { useScrollLock } from "../useScrollLock";

type Props = { username: string; bio: string; banner: string; avatar: string; avatarColor: string };

/**
 * TikTok-style "edit profile": a pencil on your own banner opens a sheet where you change your
 * banner, picture and bio without leaving the profile. Privacy lives in Settings (linked).
 */
export default function ProfileEditor(p: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="glass-strong absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-lg transition-transform hover:scale-[1.03] active:scale-95 sm:left-4 sm:top-4"
        aria-label="Edit profile"
      >
        <Pencil className="h-3.5 w-3.5" /> <span>Edit</span>
      </button>
      <EditSheet open={open} onClose={() => setOpen(false)} {...p} />
    </>
  );
}

function EditSheet({ open, onClose, username, bio: initialBio, banner: initialBanner, avatar: initialAvatar, avatarColor }: Props & { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [bio, setBio] = useState(initialBio);
  const [banner, setBanner] = useState(initialBanner);
  const [avatar, setAvatar] = useState(initialAvatar);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  useScrollLock(open);
  useEffect(() => setMounted(true), []);
  // The picture saves on its own as soon as it's picked; show it once the sheet closes.
  useEffect(() => {
    if (!open && avatar !== initialAvatar) router.refresh();
  }, [open, avatar, initialAvatar, router]);

  useEffect(() => {
    if (!open) return;
    setBio(initialBio);
    setBanner(initialBanner);
    setPicking(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, initialBio, initialBanner, onClose]);

  const dirty = bio.trim() !== initialBio || banner !== initialBanner;

  async function save() {
    if (!dirty) return onClose();
    setBusy(true);
    const res = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bio: bio.trim(), profileBanner: banner }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast(json.error ?? "Couldn't save", "error");
    toast("Profile updated", "info");
    onClose();
    router.refresh();
  }

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label="Edit profile"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-bg shadow-2xl sm:rounded-2xl"
          >
            <header className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
              <h2 className="text-sm font-semibold">Edit profile</h2>
              <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-muted hover:bg-white/[0.06] hover:text-fg" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-4">
              <div>
                <span className="mb-1.5 block text-xs font-medium text-muted">Banner</span>
                <div className="relative aspect-[3/1] overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.03]">
                  {banner ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={banner} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-xs text-muted">
                      <span className="flex items-center gap-1.5">
                        <ImageIcon className="h-4 w-4" /> No banner yet
                      </span>
                    </div>
                  )}
                  <div className="absolute bottom-2 right-2 flex gap-1.5">
                    {banner && (
                      <button onClick={() => setBanner("")} className="glass-strong rounded-lg px-2.5 py-1 text-xs">
                        Remove
                      </button>
                    )}
                    <button onClick={() => setPicking((v) => !v)} className="glass-strong rounded-lg px-2.5 py-1 text-xs">
                      {picking ? "Close" : banner ? "Change" : "Choose a banner"}
                    </button>
                  </div>
                </div>
                {picking && (
                  <BannerPicker
                    current={banner}
                    onPick={(b) => {
                      setBanner(b.image);
                      setPicking(false);
                    }}
                  />
                )}
              </div>

              <label className="block">
                <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted">
                  Bio <span className="font-mono text-[11px]">{bio.length}/300</span>
                </span>
                <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 300))} rows={3} placeholder="A line about your taste in anime" className="input resize-none text-sm" />
              </label>

              <AvatarPicker username={username} color={avatarColor} avatar={avatar} onChange={setAvatar} />

              <p className="text-xs text-muted">
                Who can see your profile and comment on it is in{" "}
                <Link href="/account/settings#visibility" onClick={onClose} className="text-fg underline-offset-2 hover:underline">
                  privacy settings
                </Link>
                .
              </p>
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
              <button onClick={onClose} className="btn btn-ghost">
                Cancel
              </button>
              <button onClick={save} disabled={busy} className="btn btn-primary">
                {busy && <LoaderCircle className="spin h-4 w-4" />} Save
              </button>
            </footer>
          </motion.section>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
