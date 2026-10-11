import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, verifyTwoFactorTicket } from "@/lib/auth";
import { fail, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { decrypt, safeEqual, sha256 } from "@/lib/crypto";
import { consumeTotp } from "@/lib/totp";

export async function POST(req: Request) {
  const body = await readJson<{ ticket: string; code: string }>(req);
  const userId = await verifyTwoFactorTicket(String(body.ticket ?? ""));
  if (!userId) return fail("Your sign-in expired. Enter your password again.", 401);

  const limit = rateLimit(`2fa:${userId}`, 6, 10 * 60_000);
  if (!limit.ok) return fail("Too many codes tried. Wait a few minutes.", 429);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { totpSecret: true, totpEnabled: true, recoveryCodes: true, bannedAt: true } });
  if (user?.bannedAt) return fail("This account has been suspended", 403);
  if (!user?.totpEnabled || !user.totpSecret) return fail("Two-factor is not enabled", 400);

  const code = String(body.code ?? "").trim().toLowerCase();
  let ok = consumeTotp(userId, decrypt(user.totpSecret), code);
  if (!ok && /^[a-f0-9]{5}-[a-f0-9]{5}$/.test(code)) {
    const hashes: string[] = JSON.parse(user.recoveryCodes || "[]");
    const hit = hashes.find((h) => safeEqual(h, sha256(code)));
    if (hit) {
      ok = true;
      await prisma.user.update({ where: { id: userId }, data: { recoveryCodes: JSON.stringify(hashes.filter((h) => h !== hit)) } });
    }
  }
  if (!ok) return fail("That code isn't valid", 401);

  await createSession(userId);
  return NextResponse.json({ ok: true });
}
