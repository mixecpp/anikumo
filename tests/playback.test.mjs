import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAniweebPlayer, playbackUrl, decodePlayerMessage } from "../lib/playback/source.ts";
import { defaultPlaybackSettings, settingsPatch, normalizeSettings } from "../lib/playback/settings.ts";
import { parseProgress, mergeProgress } from "../lib/playback/progress.ts";
import { cached } from "../lib/cache.ts";

const fallback = "https://api.aniweeb.net/embed/ani/21/1?track=sub";
const wrapper = (config) => `<script>window.__ANIWEEB_PLAYER=${JSON.stringify(config)};</script>`;
const direct = parseAniweebPlayer(wrapper({ iframe: "https://flixcloud.cc/e/abc123?v=2" }), fallback);

test("resolver extracts only the supported player and safely keeps unknown wrappers", () => {
  assert.equal(direct.controls, true);
  assert.equal(direct.protocol, "flixcloud");
  for (const url of ["javascript:alert(1)", "http://flixcloud.cc/e/abc", "https://flixcloud.cc.attacker.test/e/abc", "https://user:password@flixcloud.cc/e/abc", "https://flixcloud.cc:444/e/abc", "https://flixcloud.cc/admin", "https://other.test/e/abc"]) {
    const parsed = parseAniweebPlayer(wrapper({ iframe: url }), fallback);
    assert.equal(parsed.url, fallback); assert.equal(parsed.controls, false);
  }
  assert.equal(parseAniweebPlayer("<script>window.__ANIWEEB_PLAYER=doSomething();</script>", fallback).controls, false);
});

test("resume, audio and skip preferences stay on the same resolved player", () => {
  const sub = new URL(playbackUrl(direct, defaultPlaybackSettings, 300));
  const dub = new URL(playbackUrl(direct, { ...defaultPlaybackSettings, audioTrack: "dub", autoSkipIntro: true, autoSkipOutro: true }, 300));
  assert.equal(sub.pathname, dub.pathname);
  assert.equal(sub.searchParams.get("a"), "0"); assert.equal(dub.searchParams.get("a"), "1");
  assert.equal(dub.searchParams.get("start_at"), "300"); assert.equal(dub.searchParams.get("skI"), "true");
  assert.equal(new URL(playbackUrl(direct, { ...defaultPlaybackSettings, resume: false }, 300)).searchParams.has("start_at"), false);
  assert.equal(new URL(playbackUrl(direct, defaultPlaybackSettings, Infinity)).searchParams.has("start_at"), false);
});

test("message decoder refuses malformed progress and recognizes real status events", () => {
  assert.deepEqual(decodePlayerMessage(direct, { currentTime: 125, duration: 1500 }), { type: "time", current: 125, duration: 1500 });
  assert.deepEqual(decodePlayerMessage(direct, { playerStatus: "Ended" }), { type: "status", status: "Ended" });
  for (const data of [{ currentTime: NaN, duration: 10 }, { currentTime: "12", duration: 15 }, { currentTime: 20, duration: 5 }, { currentTime: -1, duration: 5 }, { event: "complete" }, { playerStatus: "invented" }]) assert.equal(decodePlayerMessage(direct, data), null);
  const native = { ...direct, protocol: "aniweeb", controls: false };
  assert.deepEqual(decodePlayerMessage(native, { event: "time", time: 30, duration: 60 }), { type: "time", current: 30, duration: 60 });
});

test("settings reject wrong types, unknown keys and inherited object names", () => {
  assert.deepEqual(settingsPatch({ audioTrack: "dub", autoSkipIntro: true }), { audioTrack: "dub", autoSkipIntro: true });
  for (const value of [{ volume: Infinity }, { volume: -1 }, { muted: "false" }, { audioTrack: "raw" }, { toString: true }, { unexpected: true }, null]) assert.throws(() => settingsPatch(value));
  assert.deepEqual(normalizeSettings({ audioTrack: "dub", volume: -2 }), { ...defaultPlaybackSettings, audioTrack: "dub" });
});

test("manual marking preserves real position; rewatch samples cannot undo completion", () => {
  const previous = { progressSeconds: 123, durationSeconds: 1500, completed: false };
  assert.deepEqual(mergeProgress(parseProgress({ anilistId: 21, episode: 1, completed: true }), previous), { ...previous, completed: true });
  const sample = parseProgress({ anilistId: 21, episode: 1, progressSeconds: 30, durationSeconds: 1500 });
  assert.equal(mergeProgress(sample, { ...previous, completed: true }).completed, true);
  assert.equal(mergeProgress(sample, previous).completed, false);
  for (const patch of [{ episode: 1.5 }, { anilistId: -1 }, { progressSeconds: Infinity }, { durationSeconds: 0 }, { progressSeconds: "30" }, { sampledAt: Date.now() + 900000 }]) assert.throws(() => parseProgress({ ...sample, ...patch }));
});

test("explicit unmark preserves position and is not undone by near-end background polls", () => {
  const previous = { progressSeconds: 1470, durationSeconds: 1500, completed: true };
  const unmarked = mergeProgress(parseProgress({ anilistId: 21, episode: 1, completed: false }), previous);
  assert.deepEqual(unmarked, { ...previous, completed: false });
  const poll = parseProgress({ anilistId: 21, episode: 1, progressSeconds: 1490, durationSeconds: 1500 });
  assert.equal(mergeProgress(poll, unmarked).completed, false);
  const restarted = mergeProgress({ ...poll, progressSeconds: 30 }, unmarked);
  assert.equal(mergeProgress(poll, restarted).completed, true, "Rewatching through the end should complete the episode again");
  assert.equal(mergeProgress(parseProgress({ anilistId: 21, episode: 1, completed: true }), unmarked).completed, true);
  assert.throws(() => parseProgress({ anilistId: 21, episode: 1, completed: "false" }));
});

test("cache collapses concurrent Aniweeb lookups and retries failed calls", async () => {
  let calls = 0;
  const key = `playback-test-${Date.now()}`;
  const fn = async () => { calls++; await new Promise(r => setTimeout(r, 5)); return 7; };
  assert.deepEqual(await Promise.all([cached(key, 10, fn), cached(key, 10, fn), cached(key, 10, fn)]), [7,7,7]);
  assert.equal(calls, 1);
  await assert.rejects(cached(key + "error", 10, async () => { throw new Error("upstream down"); }));
  assert.equal(await cached(key + "error", 10, async () => 9), 9);
});
