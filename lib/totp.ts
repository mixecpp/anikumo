import crypto from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string) {
  const clean = s.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("Invalid base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateSecret() {
  return base32Encode(crypto.randomBytes(20));
}

/** RFC 6238 TOTP (SHA-1, 30s step, 6 digits) — what authenticator apps use. */
export function totp(secret: string, at = Date.now(), step = 30, digits = 6) {
  const counter = Math.floor(at / 1000 / step);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits).toString();
  return code.padStart(digits, "0");
}

/** Accepts the current code plus one step either side to absorb clock drift. */
export function verifyTotp(secret: string, code: string, at = Date.now()) {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return false;
  return [-1, 0, 1].some((w) => {
    const expected = totp(secret, at + w * 30_000);
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(c));
  });
}

const g = globalThis as unknown as { __akTotpUsed?: Map<string, number> };
const used = g.__akTotpUsed ?? new Map<string, number>();
g.__akTotpUsed = used;

/** Like verifyTotp, but each code works only once per user (it stays valid for ~90s otherwise). */
export function consumeTotp(userId: string, secret: string, code: string) {
  const now = Date.now();
  for (const [k, exp] of used) if (exp < now) used.delete(k);
  const key = `${userId}:${code.replace(/s/g, "")}`;
  if (used.has(key) || !verifyTotp(secret, code, now)) return false;
  used.set(key, now + 120_000);
  return true;
}

export function otpauthUri(secret: string, account: string, issuer = "AniKumo") {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export function generateRecoveryCodes(n = 10) {
  return Array.from({ length: n }, () => {
    const raw = crypto.randomBytes(5).toString("hex");
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}
