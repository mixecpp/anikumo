"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { motion } from "motion/react";
import { ImageUp, LoaderCircle, Trash2 } from "lucide-react";
import { PRESET_AVATARS } from "@/lib/avatars";
import { toast } from "@/lib/toast";
import { Avatar } from "../UserMenu";

const MAX = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

/** Upload a picture or pick a character. Saves immediately. */
export default function AvatarPicker({ username, color, avatar, onChange }: { username: string; color: string; avatar: string; onChange: (v: string) => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function send(init: RequestInit, label: string) {
    setBusy(label);
    const res = await fetch("/api/account/avatar", init);
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast(json.error ?? "Couldn't update your picture", "error");
    onChange(json.avatar);
    router.refresh();
    toast(json.avatar ? "Picture updated" : "Picture removed");
  }

  function upload(file: File | undefined) {
    if (!file) return;
    if (!TYPES.includes(file.type)) return toast("Use a JPG, PNG, WebP, GIF or AVIF image", "error");
    if (file.size > MAX) return toast("That image is over 5 MB", "error");
    const body = new FormData();
    body.append("file", file);
    send({ method: "POST", body }, "upload");
  }

  const current = avatar.startsWith("preset:") ? avatar.slice(7) : null;

  return (
    <div>
      <span className="mb-2 block text-xs font-medium text-muted">Profile picture</span>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => (e.preventDefault(), setDragging(true))}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            upload(e.dataTransfer.files[0]);
          }}
          className={`relative rounded-full transition ${dragging ? "ring-2 ring-accent ring-offset-2 ring-offset-bg" : ""}`}
          aria-label="Upload a profile picture"
        >
          <Avatar name={username} color={color} avatar={avatar} size={72} />
          {busy === "upload" && (
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50">
              <LoaderCircle className="spin h-5 w-5 text-[#fff]" />
            </span>
          )}
        </button>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => input.current?.click()} disabled={!!busy} className="btn btn-ghost !py-1.5 !text-xs">
            <ImageUp className="h-3.5 w-3.5" /> Upload picture
          </button>
          {avatar && (
            <button type="button" onClick={() => send({ method: "DELETE" }, "remove")} disabled={!!busy} className="btn btn-ghost !py-1.5 !text-xs text-muted">
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          )}
          <p className="w-full text-[11px] text-muted">JPG, PNG, WebP or GIF up to 5 MB. Drop a file on the circle, or pick a character below.</p>
        </div>
        <input ref={input} type="file" accept={TYPES.join(",")} className="hidden" onChange={(e) => (upload(e.target.files?.[0]), (e.target.value = ""))} />
      </div>

      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-2" role="radiogroup" aria-label="Character pictures">
        {PRESET_AVATARS.map((p) => {
          const on = current === p.key;
          return (
            <motion.button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${p.name} (${p.show})`}
              title={`${p.name} · ${p.show}`}
              whileTap={{ scale: 0.92 }}
              disabled={!!busy}
              onClick={() => !on && send({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preset: p.key }) }, p.key)}
              className={`relative aspect-square overflow-hidden rounded-full bg-white/[0.06] transition ${on ? "ring-2 ring-accent ring-offset-2 ring-offset-bg" : "opacity-80 hover:opacity-100"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image} alt="" loading="lazy" className="h-full w-full object-cover object-[center_15%]" />
              {busy === p.key && (
                <span className="absolute inset-0 grid place-items-center bg-black/50">
                  <LoaderCircle className="spin h-4 w-4 text-[#fff]" />
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
