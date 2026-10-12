/**
 * Cloudflare Turnstile — the free, privacy-friendly captcha on log in, sign up and password reset.
 *
 *  - TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY (TURNSTILE_SECRET also works). Both empty = off,
 *    so a fresh checkout still works. Only one set = misconfigured, and everyone is refused
 *    (fail closed) rather than silently letting bots through.
 *  - TURNSTILE_HOSTNAMES: comma-separated sites the token must have been issued on
 *    (e.g. "anikumo.cc,www.anikumo.cc"). Defaults to APP_URL's host in production.
 *  - Each form has its own action ("login", "register", "forgot"); a token from one form can't
 *    be replayed on another. Tokens are single-use and Cloudflare rejects a second redeem.
 *  - In development .env.development uses Cloudflare's always-pass test keys, which don't
 *    report a real hostname or action, so those two checks are skipped for test keys only.
 */
export type CaptchaAction = "login" | "register" | "forgot";

const secretKey = () => (process.env.TURNSTILE_SECRET_KEY || process.env.TURNSTILE_SECRET || "").trim();

export function captchaSiteKey() {
  return process.env.TURNSTILE_SITE_KEY?.trim() || null;
}

/** Cloudflare's published dummy secrets (1x… always passes, 2x… always fails, 3x… token spent). */
const isTestSecret = (s: string) => /^[123]x0{20,}/.test(s);

function allowedHostnames(): string[] {
  const list = (process.env.TURNSTILE_HOSTNAMES ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (list.length) return list;
  try {
    const host = new URL(process.env.APP_URL ?? "").hostname.toLowerCase();
    return host ? [host, `www.${host.replace(/^www\./, "")}`] : [];
  } catch {
    return [];
  }
}

type Siteverify = { success?: boolean; action?: string; hostname?: string; "error-codes"?: string[] };

export async function verifyCaptcha(token: unknown, ip: string, action: CaptchaAction): Promise<boolean> {
  const secret = secretKey();
  const site = captchaSiteKey();
  if (!secret && !site) return true;
  if (!secret || !site) {
    console.error("[captcha] TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY must both be set — refusing sign-ins until they are");
    return false;
  }
  if (typeof token !== "string" || !token || token.length > 2048) return false;

  const form = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "local" && ip !== "unknown") form.set("remoteip", ip);
  let json: Siteverify;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return false;
    json = (await res.json()) as Siteverify;
  } catch {
    // Fail closed: if the check can't run, nobody gets through on a guess.
    return false;
  }
  if (json.success !== true) return false;
  if (isTestSecret(secret)) return true;

  if (json.action !== action) return false;
  const hosts = allowedHostnames();
  if (process.env.NODE_ENV === "production") {
    // Production never accepts tokens minted on a local machine.
    const host = (json.hostname ?? "").toLowerCase();
    if (!host || host === "localhost" || host === "127.0.0.1" || !hosts.includes(host)) return false;
  } else if (hosts.length && json.hostname && !hosts.includes(json.hostname.toLowerCase()) && json.hostname !== "localhost") {
    return false;
  }
  return true;
}
