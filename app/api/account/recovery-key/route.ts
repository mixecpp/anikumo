import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fail, readJson } from "@/lib/http";
import { issueRecoveryKey } from "@/lib/auth-flows";

/** POST { password } → replaces the recovery key and returns the new one (shown once). */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return fail("Not logged in", 401);
  const { password } = await readJson<{ password: string }>(req);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId }, select: { username: true, passwordHash: true } });
  if (!(await bcrypt.compare(String(password ?? ""), user.passwordHash))) return fail("Password is incorrect", 401);
  return NextResponse.json({ ok: true, username: user.username, recoveryKey: await issueRecoveryKey(session.userId) });
}
