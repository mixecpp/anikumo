import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { onlineCount, onlineUsers } from "@/lib/chat";
import { publicRooms } from "@/lib/rooms";

/** GET: who's online (signed-in people) and the public Watch Together rooms, for the chat's side tabs. */
export async function GET(req: Request) {
  if (!rateLimit(`live-online:${clientIp(req.headers)}`, 30, 60_000).ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const [users, rooms] = await Promise.all([onlineUsers(), publicRooms().catch(() => [])]);
  return NextResponse.json({ online: onlineCount(), users, rooms: rooms.slice(0, 12) }, { headers: { "Cache-Control": "private, no-store" } });
}
