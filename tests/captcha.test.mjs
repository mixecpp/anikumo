import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyCaptcha } from "../lib/captcha.ts";

// Fake Cloudflare: whatever `reply` is gets returned from siteverify.
let reply = {};
let calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), body: String(init?.body ?? "") });
  if (reply === "down") throw new Error("network down");
  if (reply === "500") return new Response("oops", { status: 500 });
  return new Response(JSON.stringify(reply), { status: 200, headers: { "Content-Type": "application/json" } });
};

function env(vars) {
  for (const k of ["TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY", "TURNSTILE_SECRET", "TURNSTILE_HOSTNAMES", "APP_URL", "NODE_ENV"]) delete process.env[k];
  Object.assign(process.env, vars);
  calls = [];
}
const REAL = { TURNSTILE_SITE_KEY: "0x4AAAAtestsite", TURNSTILE_SECRET_KEY: "0x4AAAAtestsecret", APP_URL: "https://anikumo.cc", NODE_ENV: "production" };
const ok = { success: true, action: "login", hostname: "anikumo.cc" };

test("captcha is off only when both keys are missing, and fails closed when half set", async () => {
  env({});
  assert.equal(await verifyCaptcha(undefined, "1.2.3.4", "login"), true);
  env({ TURNSTILE_SITE_KEY: "0x4AAAAtestsite" });
  const err = console.error;
  console.error = () => {};
  assert.equal(await verifyCaptcha("tok", "1.2.3.4", "login"), false);
  console.error = err;
  assert.equal(calls.length, 0);
});

test("a real token passes only with the right action and hostname", async () => {
  env(REAL);
  reply = ok;
  assert.equal(await verifyCaptcha("tok", "1.2.3.4", "login"), true);
  assert.match(calls[0].url, /siteverify$/);
  assert.match(calls[0].body, /remoteip=1\.2\.3\.4/);
  assert.equal(await verifyCaptcha("tok", "1.2.3.4", "register"), false, "token from the login form can't sign up");
  reply = { ...ok, hostname: "www.anikumo.cc" };
  assert.equal(await verifyCaptcha("tok", "1.2.3.4", "login"), true, "www is allowed by default");
  for (const hostname of ["evil.example", "localhost", "127.0.0.1", ""]) {
    reply = { ...ok, hostname };
    assert.equal(await verifyCaptcha("tok", "1.2.3.4", "login"), false, hostname || "(no hostname)");
  }
  env({ ...REAL, TURNSTILE_HOSTNAMES: "kumo.example" });
  reply = ok;
  assert.equal(await verifyCaptcha("tok", "1.2.3.4", "login"), false, "explicit list replaces the default");
});

test("bad tokens and Cloudflare trouble are refused", async () => {
  env(REAL);
  reply = ok;
  for (const t of [undefined, null, "", 42, "x".repeat(2049)]) assert.equal(await verifyCaptcha(t, "1.2.3.4", "login"), false);
  assert.equal(calls.length, 0, "never sent to Cloudflare");
  reply = { success: false, "error-codes": ["timeout-or-duplicate"] };
  assert.equal(await verifyCaptcha("used", "1.2.3.4", "login"), false, "replayed token");
  reply = "down";
  assert.equal(await verifyCaptcha("tok", "1.2.3.4", "login"), false);
  reply = "500";
  assert.equal(await verifyCaptcha("tok", "1.2.3.4", "login"), false);
});

test("Cloudflare's test keys skip the hostname and action checks", async () => {
  env({ TURNSTILE_SITE_KEY: "1x00000000000000000000AA", TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA", NODE_ENV: "development" });
  reply = { success: true, hostname: "example.com", action: "" };
  assert.equal(await verifyCaptcha("XXXX.DUMMY.TOKEN.XXXX", "local", "register"), true);
  assert.doesNotMatch(calls[0].body, /remoteip/);
});
