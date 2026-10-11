import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";
import React from "react";
import { create, act } from "react-test-renderer";
import * as sourceModule from "../lib/playback/source.ts";
import * as settingsModule from "../lib/playback/settings.ts";

const require = createRequire(import.meta.url);
function loadHook(filename) {
  const code = ts.transpileModule(readFileSync(new URL("../components/" + filename, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const hookModule = { exports: {} };
  const localRequire = (id) => id === "@/lib/playback/source" ? sourceModule : id === "@/lib/playback/settings" ? settingsModule : require(id);
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`)(localRequire, hookModule, hookModule.exports);
  return hookModule.exports;
}
const { useEmbeddedPlayer } = loadHook("useEmbeddedPlayer.ts");
const { useWatchProgress } = loadHook("useWatchProgress.ts");
const { usePlaybackSettings } = loadHook("usePlaybackSettings.ts");
const { useLiveProgress } = loadHook("watch/useLiveProgress.ts");

function environment() {
  const saved = new Map();
  const previous = new Map(["window", "document", "localStorage", "navigator", "fetch", "CustomEvent", "IS_REACT_ACT_ENVIRONMENT"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const listeners = new Map();
  const events = {
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    dispatchEvent(event) { for (const fn of listeners.get(event.type) ?? []) fn(event); },
  };
  Object.assign(globalThis, { window: events, document: { ...events, visibilityState: "visible", fullscreenElement: null }, localStorage: { get length() { return saved.size; }, key(i) { return [...saved.keys()][i] ?? null; }, getItem(k) { return saved.get(k) ?? null; }, setItem(k,v) { saved.set(k,v); }, removeItem(k) { saved.delete(k); } }, CustomEvent: class { constructor(type, opts) { this.type = type; this.detail = opts?.detail; } }, IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { sendBeacon() { return false; } } });
  return { saved, message(data, origin, source) { events.dispatchEvent({ type: "message", data, origin, source }); }, restore() { for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } } };
}

test("bridge authenticates frame messages, resumes once and saves fresh pause positions", async () => {
  const env = environment();
  const commands = [], samples = [];
  const contentWindow = { postMessage(data, origin) { commands.push({ data, origin }); } };
  const frame = { current: { contentWindow } }, wrap = { current: null };
  const source = { url: "https://flixcloud.cc/e/abc", fallbackUrl: "https://api.aniweeb.net/embed/ani/21/1?track=sub", protocol: "flixcloud", controls: true };
  let pauses = 0, ended = 0, state, root;
  const settings = { ...settingsModule.defaultPlaybackSettings, autoSkipIntro: true };
  const callbacks = { sample: (c,d) => samples.push([c,d]), pause: () => pauses++, ended: () => ended++ };
  function Hook() { state = useEmbeddedPlayer(frame, wrap, source, source.url, settings, 300, [{ type: "op", start: 500, end: 590 }], callbacks); return null; }
  try {
    await act(async () => { root = create(React.createElement(Hook)); });
    await act(async () => { env.message({ currentTime: 400, duration: 1500 }, "https://attacker.test", contentWindow); env.message({ currentTime: 400, duration: 1500 }, "https://flixcloud.cc", {}); });
    assert.equal(samples.length, 0); assert.equal(state.connected, false);
    await act(async () => { env.message({ playerStatus: "Loading" }, "https://flixcloud.cc", contentWindow); });
    assert.equal(state.connected, false);
    await act(async () => { env.message({ currentTime: 0, duration: 1500 }, "https://flixcloud.cc", contentWindow); });
    assert.equal(samples.length, 0);
    assert.ok(commands.some(c=>c.data.command === "seek" && c.data.value === 300));
    await act(async () => { env.message({ currentTime: 300, duration: 1500 }, "https://flixcloud.cc", contentWindow); env.message({ playerStatus: "Paused" }, "https://flixcloud.cc", contentWindow); env.message({ currentTime: 310, duration: 1500 }, "https://flixcloud.cc", contentWindow); });
    assert.deepEqual(samples.at(-1), [310,1500]); assert.equal(pauses, 1);
    await act(async () => { env.message({ playerStatus: "Paused" }, "https://flixcloud.cc", contentWindow); env.message({ currentTime: 315, duration: 1500 }, "https://flixcloud.cc", contentWindow); });
    assert.equal(pauses, 1, "Polling a paused player must not create repeated pause saves");
    const seeksBefore = commands.filter(c=>c.data.command === "seek").length;
    await act(async () => { env.message({ currentTime: 10, duration: 1500 }, "https://flixcloud.cc", contentWindow); });
    assert.equal(commands.filter(c=>c.data.command === "seek").length, seeksBefore, "An intentional rewind must not be undone by resume");
    await act(async () => { env.message({ currentTime: 510, duration: 1500 }, "https://flixcloud.cc", contentWindow); env.message({ playerStatus: "Ended" }, "https://flixcloud.cc", contentWindow); env.message({ playerStatus: "Ended" }, "https://flixcloud.cc", contentWindow); });
    assert.ok(commands.some(c=>c.data.command === "seek" && c.data.value === 590)); assert.equal(ended, 1);
    assert.ok(commands.every(c=>c.origin === "https://flixcloud.cc"));
  } finally { if (root) await act(async () => root.unmount()); env.restore(); }
});

test("offline completion survives exit and replays under the original account and episode", async () => {
  const env = environment();
  let hook, root;
  const identity = { userId: "account-a", anilistId: 21, episode: 3, title: "One Piece", coverImage: "https://example.test/a.jpg", completed: false };
  globalThis.fetch = async () => { throw new Error("offline"); };
  function Hook() { hook = useWatchProgress(identity); return null; }
  try {
    await act(async () => { root = create(React.createElement(Hook)); });
    await act(async () => { hook.sample(400,1500); });
    await act(async () => { await hook.markWatched(); });
    await act(async () => root.unmount()); root = null;
    const key = "aw_pending_progress:account-a:21:3";
    const pending = JSON.parse(env.saved.get(key));
    assert.equal(pending.completed, true); assert.equal(pending.episode, 3); assert.equal(pending.expectedUserId, "account-a");
    const requests = [];
    globalThis.fetch = async (_url,opts) => { requests.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({ completed: true }) }; };
    const nextIdentity = { ...identity, episode: 4 };
    function NextHook() { useWatchProgress(nextIdentity); return null; }
    await act(async () => { root = create(React.createElement(NextHook)); });
    assert.equal(requests[0].episode, 3); assert.equal(requests[0].expectedUserId, "account-a");
    assert.equal(env.saved.has(key), false);
  } finally { if (root) await act(async () => root.unmount()); env.restore(); }
});

test("watched toggles both ways before the player connects and updates episode indicators", async () => {
  const env = environment();
  const requests = [];
  const initialProgress = { 1: { completed: true, pct: 98 } };
  let hook, progress, root, completed = true;
  globalThis.fetch = async (_url, opts) => {
    const payload = JSON.parse(opts.body);
    requests.push(payload);
    if (typeof payload.completed === "boolean") completed = payload.completed;
    return { ok: true, json: async () => ({ completed, progressSeconds: 1470, durationSeconds: 1500, sampledAt: payload.sampledAt }) };
  };
  function Hook() {
    hook = useWatchProgress({ userId: "account-a", anilistId: 21, episode: 1, title: "One Piece", coverImage: "", completed: true });
    progress = useLiveProgress(21, initialProgress);
    return null;
  }
  try {
    await act(async () => { root = create(React.createElement(Hook)); });
    await act(async () => { await hook.toggleWatched(); });
    assert.equal(hook.watched, false); assert.deepEqual(progress[1], { completed: false, pct: 98 });
    assert.equal(requests[0].completed, false);
    assert.equal(Object.hasOwn(requests[0], "progressSeconds"), false, "No player sample should overwrite the stored position");
    await act(async () => { await hook.toggleWatched(); });
    assert.equal(hook.watched, true); assert.equal(progress[1].completed, true);
    assert.equal(requests[1].completed, true);
    assert.ok(requests[1].sampledAt > requests[0].sampledAt, "Rapid toggles need distinct timestamps");
    await act(async () => { await hook.toggleWatched(); });
    await act(async () => { hook.sample(1490, 1500); await hook.save(); });
    assert.equal(hook.watched, false);
    assert.equal(Object.hasOwn(requests.at(-1), "completed"), false, "Automatic saves should not override a manual watch status");
  } finally { if (root) await act(async () => root.unmount()); env.restore(); }
});

test("an older save response cannot restore watched after a newer unmark", async () => {
  const env = environment();
  const requests = []; let hook, root, release;
  globalThis.fetch = async (_url, opts) => {
    const payload = JSON.parse(opts.body); requests.push(payload);
    if (requests.length === 1) await new Promise(resolve => { release = resolve; });
    return { ok: true, json: async () => ({ completed: payload.completed === false ? false : true }) };
  };
  function Hook() { hook = useWatchProgress({ userId: "account-a", anilistId: 21, episode: 1, title: "One Piece", coverImage: "", completed: true }); return null; }
  try {
    await act(async () => { root = create(React.createElement(Hook)); });
    await act(async () => { hook.sample(1470, 1500); });
    await act(async () => { await hook.toggleWatched(); });
    assert.equal(hook.watched, false);
    await act(async () => { release(); });
    assert.equal(hook.watched, false, "A late response must not change the completed ref or button state");
    await act(async () => { await hook.toggleWatched(); });
    assert.equal(requests.at(-1).completed, true);
    assert.equal(hook.watched, true);
  } finally { if (root) await act(async () => root.unmount()); env.restore(); }
});

test("offline unmark survives exit without a player sample and replays as unwatched", async () => {
  const env = environment();
  let hook, root;
  const identity = { userId: "account-a", anilistId: 21, episode: 1, title: "One Piece", coverImage: "", completed: true };
  globalThis.fetch = async () => { throw new Error("offline"); };
  function Hook() { hook = useWatchProgress(identity); return null; }
  try {
    await act(async () => { root = create(React.createElement(Hook)); });
    await act(async () => { await hook.toggleWatched(); });
    assert.equal(hook.saved, "error");
    await act(async () => root.unmount()); root = null;
    const key = "aw_pending_progress:account-a:21:1";
    const pending = JSON.parse(env.saved.get(key));
    assert.equal(pending.completed, false); assert.equal(pending.expectedUserId, "account-a");
    assert.equal(Object.hasOwn(pending, "progressSeconds"), false);
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ completed: false, progressSeconds: 321, durationSeconds: 1500 }) });
    await act(async () => { root = create(React.createElement(Hook)); });
    assert.equal(hook.watched, false); assert.equal(hook.saved, "saved");
    assert.equal(env.saved.has(key), false);
  } finally { if (root) await act(async () => root.unmount()); env.restore(); }
});

test("rapid preference edits are serialized and keep the newest values", async () => {
  const env = environment();
  const bodies = []; let release, hook, root;
  globalThis.fetch = async (_url,opts) => { bodies.push(JSON.parse(opts.body)); if (bodies.length === 1) await new Promise(resolve => { release = resolve; }); return { ok: true }; };
  function Hook() { hook = usePlaybackSettings(settingsModule.defaultPlaybackSettings, "account-a"); return null; }
  try {
    await act(async () => { root = create(React.createElement(Hook)); });
    await act(async () => { hook.update({ audioTrack: "dub" }); hook.update({ volume: .5 }); hook.update({ volume: .8 }); });
    assert.equal(bodies.length, 1);
    await act(async () => { release(); });
    assert.equal(bodies.length, 2); assert.deepEqual(bodies[1], { volume: .8 });
    assert.equal(hook.settings.audioTrack, "dub"); assert.equal(hook.settings.volume, .8); assert.equal(hook.status, "saved");
    assert.equal(env.saved.has("aw_player_settings_pending:account-a"), false);
  } finally { if (root) await act(async () => root.unmount()); env.restore(); }
});
