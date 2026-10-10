import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { destroySession } from "@/lib/auth";
import { fail, readJson, requireUserId } from "@/lib/http";

export async function PATCH(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Not logged in", 401);
  const body = await readJson<{ avatarColor: string; currentPassword: string; newPassword: string }>(req);

  if (body.avatarColor !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(String(body.avatarColor))) return fail("Invalid colour");
    await prisma.user.update({ where: { id: userId }, data: { avatarColor: String(body.avatarColor) } });
  }

  if (body.newPassword !== undefined) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(String(body.currentPassword ?? ""), user.passwordHash))) {
      return fail("Current password is wrong", 401);
    }
    if (String(body.newPassword).length < 8) return fail("New password must be at least 8 characters");
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(String(body.newPassword), 12) },
    });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const userId = await requireUserId();
  if (!userId) return fail("Not logged in", 401);
  await prisma.user.delete({ where: { id: userId } });
  await destroySession();
  return NextResponse.json({ ok: true });
}
