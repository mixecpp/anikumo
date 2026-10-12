import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, signTwoFactorTicket } from "@/lib/auth";
import { fail, readJson } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { verifyCaptcha } from "@/lib/captcha";

// A real bcrypt hash (of a random string) so unknown usernames cost the same time as wrong passwords.
const DUMMY_HASH = "$2b$12$1P7GuOpT1wMx3NckwbYIFehsAM93n9Kh2VuBvaUkxA1blrx6G14wq";

export async function POST(req: Request) {
  const body = await readJson<{ username: string; login: string; password: string }>(req);
  const login = String(body.username ?? body.login ?? "").trim();
  const password = String(body.password ?? "");
  if (!login || !password) return fail("Enter your username and password");

  const ipLimit = rateLimit(`login-ip:${clientIp(req.headers)}`, 30, 15 * 60_000);
  const acctLimit = rateLimit(`login-acct:${login.toLowerCase()}`, 8, 15 * 60_000);
  if (!ipLimit.ok || !acctLimit.ok) {
    const wait = Math.max(ipLimit.retryAfter, acctLimit.retryAfter);
    return fail(`Too many attempts. Try again in ${Math.ceil(wait / 60)} min.`, 429);
  }
  if (!(await verifyCaptcha((body as { captcha?: unknown }).captcha, clientIp(req.headers), "login"))) return fail("The human check didn't pass — try again", 400);

  const user = await prisma.user.findUnique({ where: { username: login } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    return fail("Wrong username or password", 401);
  }
  if (user.bannedAt) return fail(user.banReason ? `This account has been suspended: ${user.banReason}` : "This account has been suspended", 403);
  if (user.totpEnabled) {
    return NextResponse.json({ twoFactor: true, ticket: await signTwoFactorTicket(user.id) });
  }
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
