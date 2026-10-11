import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, readJson, requireUserId } from "@/lib/http";
import { decrypt, encrypt, sha256 } from "@/lib/crypto";
import { generateRecoveryCodes, generateSecret, otpauthUri, verifyTotp } from "@/lib/totp";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST { action: "setup" }             → new secret + QR (not active until confirmed)
 * POST { action: "enable", code }      → confirms the code, returns one-time recovery codes
 * POST { action: "disable", password, code }
 * POST { action: "recovery", password } → regenerates recovery codes
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Not logged in", 401);
  if (!rateLimit(`2fa-manage:${userId}`, 20, 10 * 60_000).ok) return fail("Too many attempts. Wait a few minutes.", 429);
  const body = await readJson<{ action: string; code: string; password: string }>(req);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (body.action === "setup") {
    if (user.totpEnabled) return fail("Two-factor is already on");
    const secret = generateSecret();
    await prisma.user.update({ where: { id: userId }, data: { totpSecret: encrypt(secret) } });
    const uri = otpauthUri(secret, user.username);
    const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220, color: { dark: "#0e0e0f", light: "#ffffff" } });
    return NextResponse.json({ secret, uri, qr });
  }

  if (body.action === "enable") {
    if (!user.totpSecret) return fail("Start setup first");
    if (!verifyTotp(decrypt(user.totpSecret), String(body.code ?? ""))) return fail("That code isn't valid. Check your device's clock and try again.");
    const codes = generateRecoveryCodes();
    await prisma.user.update({ where: { id: userId }, data: { totpEnabled: true, recoveryCodes: JSON.stringify(codes.map(sha256)) } });
    return NextResponse.json({ ok: true, recoveryCodes: codes });
  }

  if (body.action === "disable" || body.action === "recovery") {
    if (!(await bcrypt.compare(String(body.password ?? ""), user.passwordHash))) return fail("Password is incorrect", 401);
    if (body.action === "disable") {
      if (user.totpEnabled && user.totpSecret && !verifyTotp(decrypt(user.totpSecret), String(body.code ?? ""))) return fail("Enter a current code from your authenticator app");
      await prisma.user.update({ where: { id: userId }, data: { totpEnabled: false, totpSecret: null, recoveryCodes: "[]" } });
      return NextResponse.json({ ok: true });
    }
    if (!user.totpEnabled) return fail("Two-factor is off");
    const codes = generateRecoveryCodes();
    await prisma.user.update({ where: { id: userId }, data: { recoveryCodes: JSON.stringify(codes.map(sha256)) } });
    return NextResponse.json({ ok: true, recoveryCodes: codes });
  }

  return fail("Unknown action");
}
