import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { fail, readJson } from "@/lib/http";

export async function POST(req: Request) {
  const body = await readJson<{ login: string; password: string }>(req);
  const login = String(body.login ?? "").trim();
  const password = String(body.password ?? "");
  if (!login || !password) return fail("Enter your email/username and password");

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: login.toLowerCase() }, { username: login }] },
  });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return fail("Wrong login or password", 401);
  }
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
