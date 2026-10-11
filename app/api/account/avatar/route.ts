import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, readJson, requireUserId } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { avatarUrl, presetByKey } from "@/lib/avatars";
import { UploadError, deleteAvatarFile, saveAvatar } from "@/lib/uploads";

async function setAvatar(userId: string, value: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { avatar: true } });
  await prisma.user.update({ where: { id: userId }, data: { avatar: value } });
  if (user.avatar !== value) await deleteAvatarFile(user.avatar);
  return NextResponse.json({ ok: true, avatar: value, url: avatarUrl(value) });
}

/** POST multipart "file" → upload a picture. */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Log in to change your picture", 401);
  if (!rateLimit(`avatar:${userId}`, 10, 60 * 60_000).ok) return fail("Too many uploads. Try again in a bit.", 429);
  if (Number(req.headers.get("content-length") ?? 0) > 6 * 1024 * 1024) return fail("That image is over 5 MB", 413);

  let file: FormDataEntryValue | null = null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return fail("Upload a single image file");
  }
  if (!(file instanceof File) || file.size === 0) return fail("Choose an image to upload");
  try {
    const value = await saveAvatar(Buffer.from(await file.arrayBuffer()));
    return await setAvatar(userId, value);
  } catch (e) {
    if (e instanceof UploadError) return fail(e.message);
    throw e;
  }
}

/** PATCH { preset: key } → use a character picture. */
export async function PATCH(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Log in to change your picture", 401);
  const { preset } = await readJson<{ preset: string }>(req);
  if (!presetByKey(String(preset ?? ""))) return fail("Unknown picture");
  return setAvatar(userId, `preset:${preset}`);
}

/** DELETE → back to the coloured initial. */
export async function DELETE() {
  const userId = await requireUserId();
  if (!userId) return fail("Log in to change your picture", 401);
  return setAvatar(userId, "");
}
