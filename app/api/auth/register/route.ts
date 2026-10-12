import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkUsername, createSession } from "@/lib/auth";
import { fail, readJson } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { verifyCaptcha } from "@/lib/captcha";
import { issueRecoveryKey } from "@/lib/auth-flows";

const COLORS = ["#f6a57c", "#fb7185", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"];

/** Username + password only. Returns a one-time recovery key for resetting a forgotten password. */
export async function POST(req: Request) {
  const limit = rateLimit(`register:${clientIp(req.headers)}`, 5, 60 * 60_000);
  if (!limit.ok) return fail(`Too many sign-ups from this network. Try again in ${Math.ceil(limit.retryAfter / 60)} min.`, 429);

  const body = await readJson<{ username: string; password: string }>(req);
  if (!(await verifyCaptcha((body as { captcha?: unknown }).captcha, clientIp(req.headers), "register"))) return fail("The human check didn't pass — try again", 400);
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");

  if (password.length < 8) return fail("Password must be at least 8 characters");
  const problem = await checkUsername(username);
  if (problem) return fail(problem, problem.includes("taken") ? 409 : 400);

  const user = await prisma.user.create({
    data: { username, passwordHash: await bcrypt.hash(password, 12), avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)] },
  });
  const recoveryKey = await issueRecoveryKey(user.id);
  await createSession(user.id);
  return NextResponse.json({ ok: true, recoveryKey });
}
