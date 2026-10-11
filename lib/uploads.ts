import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { UPLOAD_FILE } from "./avatars";

const MAX_BYTES = 5 * 1024 * 1024;
const FORMATS = new Set(["jpeg", "png", "webp", "gif", "avif"]);

/** SQLite file path from DATABASE_URL (relative paths are relative to prisma/). */
export function dbFile() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:")) return null;
  const rel = url.slice(5);
  return path.isAbsolute(rel) ? rel : path.join(process.cwd(), "prisma", rel);
}

/**
 * Uploads live next to the database (outside the code, so deploys never touch them),
 * or wherever UPLOAD_DIR points.
 */
export function avatarDir() {
  const base = process.env.UPLOAD_DIR || path.join(path.dirname(dbFile() ?? path.join(process.cwd(), "prisma", "x")), "uploads");
  return path.join(base, "avatars");
}

export class UploadError extends Error {}

/**
 * Validates and re-encodes an uploaded picture: real image formats only, first frame of animations,
 * EXIF rotation applied then all metadata dropped, cropped square around the most interesting
 * region, 256px WebP. Returns the stored value ("upload:<id>.webp").
 */
export async function saveAvatar(input: Buffer) {
  if (input.length > MAX_BYTES) throw new UploadError("That image is over 5 MB");
  let meta;
  try {
    meta = await sharp(input, { limitInputPixels: 40_000_000 }).metadata();
  } catch {
    throw new UploadError("That file isn't an image we can read");
  }
  if (!meta.format || !FORMATS.has(meta.format)) throw new UploadError("Use a JPG, PNG, WebP, GIF or AVIF image");
  if ((meta.width ?? 0) < 32 || (meta.height ?? 0) < 32) throw new UploadError("That image is too small (min 32×32)");

  const out = await sharp(input, { limitInputPixels: 40_000_000, animated: false })
    .rotate()
    .resize(256, 256, { fit: "cover", position: sharp.strategy.attention })
    .webp({ quality: 82 })
    .toBuffer();

  const id = Array.from(crypto.randomBytes(24), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
  const file = `${id}.webp`;
  const dir = avatarDir();
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, file), out, { mode: 0o640 });
  return `upload:${file}`;
}

/** Removes the file behind an "upload:" value. Never throws. */
export async function deleteAvatarFile(value: string | null | undefined) {
  if (!value?.startsWith("upload:")) return;
  const file = value.slice(7);
  if (!UPLOAD_FILE.test(file)) return;
  await fs.promises.unlink(path.join(avatarDir(), file)).catch(() => {});
}

export async function readAvatarFile(file: string) {
  if (!UPLOAD_FILE.test(file)) return null;
  return fs.promises.readFile(path.join(avatarDir(), file)).catch(() => null);
}
