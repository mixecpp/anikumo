// Run against the local dev server. Only the two disposable accounts created here are removed.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const base = process.env.TEST_BASE_URL || "http://localhost:8080";
const users = [];
async function api(path, cookie, method = "GET", body, extraHeaders = {}) {
  const res = await fetch(base + path, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), "Content-Type": "application/json", ...extraHeaders }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  return { status: res.status, data: await res.json(), cookie: res.headers.get("set-cookie")?.split(";")[0] };
}
// The player mounts in the browser now (it lives in the root layout so it can keep playing
// while you browse), so instead of the server-rendered iframe we read the props the watch page
// hands it: those decide the embed URL (resume point, audio, skips) and the watched state.
function playerProps(html) {
  const flight = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)].map((m) => JSON.parse(m[1])).join("");
  const start = flight.indexOf('{"href":"/watch/');
  if (start < 0) return null;
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < flight.length; i++) {
    const c = flight[i];
    if (inString) { if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === '"') inString = false; continue; }
    if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return JSON.parse(flight.slice(start, i + 1));
  }
  return null;
}
try {
  for (let i = 0; i < 2; i++) {
    const username = "playback_test_" + randomUUID().replaceAll("-", "");
    const password = randomUUID();
    const user = await prisma.user.create({ data: { username, passwordHash: await bcrypt.hash(password, 4) } });
    users.push(user);
    const login = await api("/api/auth/login", null, "POST", { username, password });
    assert.equal(login.status, 200); user.cookie = login.cookie;
  }
  const [a,b] = users;
  assert.equal((await api("/api/player/settings", null)).status, 401);
  assert.equal((await api("/api/progress", null, "POST", {})).status, 401);
  const prefs = { audioTrack: "dub", autoSkipIntro: true, autoSkipOutro: true, volume: .65, muted: false, autoplayNext: false, autoplay: false, resume: true };
  assert.equal((await api("/api/player/settings", a.cookie, "PATCH", prefs)).status, 200);
  assert.deepEqual((await api("/api/player/settings", a.cookie)).data.settings, prefs);
  assert.equal((await api("/api/player/settings", b.cookie)).data.settings.audioTrack, "sub");
  assert.equal((await api("/api/player/settings", a.cookie, "PATCH", { volume: 9 })).status, 400);
  assert.equal((await api("/api/player/settings", b.cookie, "PATCH", { muted: true }, { "X-Account-Id": a.id })).status, 409);
  console.log("PASS: settings persist, validate types and stay scoped to the account");
  const stamp = Date.now();
  const payload = { anilistId: 21, episode: 1, progressSeconds: 321, durationSeconds: 1500, sampledAt: stamp, title: "One Piece", coverImage: "https://example.invalid/cover.jpg", expectedUserId: a.id };
  assert.equal((await api("/api/progress", a.cookie, "POST", payload)).status, 200);
  const stale = await api("/api/progress", a.cookie, "POST", { ...payload, progressSeconds: 5, sampledAt: stamp - 1 });
  assert.equal(stale.data.saved, false);
  assert.equal((await api("/api/progress", a.cookie, "POST", { ...payload, episode: 1.5 })).status, 400);
  assert.equal((await api("/api/progress", b.cookie, "POST", payload)).status, 409);
  let progress = (await api("/api/progress?anilistId=21", a.cookie)).data.progress;
  assert.equal(progress[0].progressSeconds, 321);
  assert.deepEqual((await api("/api/progress?anilistId=21", b.cookie)).data.progress, []);
  const html = await (await fetch(base + "/watch/21/1", { headers: { Cookie: a.cookie }, signal: AbortSignal.timeout(30000) })).text();
  const player = playerProps(html);
  assert.ok(player, "Player props exist");
  assert.equal(player.resumeAt, 321);
  assert.equal(player.initialSettings.audioTrack, "dub");
  assert.equal(player.initialSettings.autoSkipIntro, true);
  console.log("PASS: account resume and audio/skip preferences are applied on the watch page");
  assert.equal((await api("/api/progress", a.cookie, "POST", { anilistId: 21, episode: 1, completed: true, sampledAt: stamp + 1 })).status, 200);
  progress = (await api("/api/progress?anilistId=21", a.cookie)).data.progress;
  assert.equal(progress[0].progressSeconds, 321); assert.equal(progress[0].durationSeconds, 1500); assert.equal(progress[0].completed, true);
  assert.equal((await api("/api/progress", a.cookie, "POST", { ...payload, progressSeconds: 12, sampledAt: stamp + 2 })).data.completed, true);
  console.log("PASS: manual completion preserves the true duration and rewatch does not erase completion");
  const unmarked = await api("/api/progress", a.cookie, "POST", { anilistId: 21, episode: 1, completed: false, sampledAt: stamp + 3, expectedUserId: a.id });
  assert.equal(unmarked.status, 200); assert.equal(unmarked.data.completed, false);
  assert.equal(unmarked.data.progressSeconds, 12); assert.equal(unmarked.data.durationSeconds, 1500);
  progress = (await api("/api/progress?anilistId=21", a.cookie)).data.progress;
  assert.equal(progress[0].completed, false); assert.equal(progress[0].progressSeconds, 12);
  const markedAgain = await api("/api/progress", a.cookie, "POST", { anilistId: 21, episode: 1, completed: true, sampledAt: stamp + 4, expectedUserId: a.id });
  assert.equal(markedAgain.data.completed, true);
  const watchedHtml = await (await fetch(base + "/watch/21/1", { headers: { Cookie: a.cookie }, signal: AbortSignal.timeout(30000) })).text();
  assert.equal(playerProps(watchedHtml).completed, true);
  const lateMark = await api("/api/progress", a.cookie, "POST", { ...payload, progressSeconds: 1470, sampledAt: stamp + 5 });
  assert.equal(lateMark.data.completed, true);
  assert.equal((await api("/api/progress", a.cookie, "POST", { anilistId: 21, episode: 1, completed: false, sampledAt: stamp + 6, expectedUserId: a.id })).data.completed, false);
  const latePoll = await api("/api/progress", a.cookie, "POST", { ...payload, progressSeconds: 1490, sampledAt: stamp + 7 });
  assert.equal(latePoll.data.completed, false);
  const staleMark = await api("/api/progress", a.cookie, "POST", { anilistId: 21, episode: 1, completed: true, sampledAt: stamp + 5, expectedUserId: a.id });
  assert.equal(staleMark.data.saved, false); assert.equal(staleMark.data.completed, false);
  const unwatchedHtml = await (await fetch(base + "/watch/21/1", { headers: { Cookie: a.cookie }, signal: AbortSignal.timeout(30000) })).text();
  assert.equal(playerProps(unwatchedHtml).completed, false);
  assert.deepEqual((await api("/api/progress?anilistId=21", b.cookie)).data.progress, []);
  console.log("PASS: watched toggles persist, preserve position, ignore stale marks, and survive near-end polling and reload");
} finally {
  for (const user of users) await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
}
