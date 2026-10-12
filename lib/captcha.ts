/**
 * Cloudflare Turnstile — the free, privacy-friendly captcha on log in, sign up and password reset.
 * Off when TURNSTILE_SECRET_KEY is empty (so a fresh checkout still works). In development
 * .env.development uses Cloudflare's always-pass test keys.
 */
export function captchaSiteKey() {
  return process.env.TURNSTILE_SITE_KEY?.trim() || null;
}

export async function verifyCaptcha(token: unknown, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return true;
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  const form = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "local" && ip !== "unknown") form.set("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form, signal: AbortSignal.timeout(8000) });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    // Fail closed: if the check can't run, nobody gets through on a guess.
    return false;
  }
}
