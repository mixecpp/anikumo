import { NextResponse } from "next/server";
import { getUserId } from "./auth";

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireUserId() {
  const id = await getUserId();
  return id;
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<Partial<T>> {
  try {
    return (await req.json()) as Partial<T>;
  } catch {
    return {};
  }
}

export function toInt(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
