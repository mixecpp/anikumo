import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { fail, readJson } from "@/lib/http";

const COLORS = ["#e11d48", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"];

export async function POST(req: Request) {
  const body = await readJson<{ email: string; username: string; password: string }>(req);
  const email = String(body.email ?? "").trim().toLowerCase();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email");
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return fail("Username must be 3–20 letters, numbers or _");
  if (password.length < 8) return fail("Password must be at least 8 characters");

  const clash = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
  if (clash) return fail(clash.email === email ? "Email already registered" : "Username taken", 409);

  const user = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash: await bcrypt.hash(password, 12),
      avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)],
    },
  });
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
