import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { revokeSessions } from "@/lib/auth";
import { fail, readJson } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { verifyCaptcha } from "@/lib/captcha";
import { checkRecoveryKey, issueRecoveryKey } from "@/lib/auth-flows";

/**
 * POST { username, recoveryKey, password } → resets the password with the account's recovery key.
 * The used key is replaced, and the new one is returned so the user can save it.
 */
export async function POST(req: Request) {
  if (!rateLimit(`forgot:${clientIp(req.headers)}`, 10, 15 * 60_000).ok) return fail("Too many attempts. Try again shortly.", 429);
  const b = await readJson<{ username: string; recoveryKey: string; password: string }>(req);
  if (!(await verifyCaptcha((b as { captcha?: unknown }).captcha, clientIp(req.headers), "forgot"))) return fail("The human check didn't pass — try again", 400);
  const username = String(b.username ?? "").trim();
  if (String(b.password ?? "").length < 8) return fail("Password must be at least 8 characters");
  if (!rateLimit(`forgot-acct:${username.toLowerCase()}`, 5, 60 * 60_000).ok) return fail("Too many attempts for this account. Try again later.", 429);

  const userId = await checkRecoveryKey(username, String(b.recoveryKey ?? ""));
  if (!userId) return fail("That username and recovery key don't match", 400);

  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(String(b.password), 12) } });
  await revokeSessions(userId);
  const recoveryKey = await issueRecoveryKey(userId);
  return NextResponse.json({ ok: true, recoveryKey });
}
