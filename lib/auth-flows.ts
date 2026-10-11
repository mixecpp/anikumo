import crypto from "node:crypto";
import { prisma } from "./db";
import { safeEqual, sha256 } from "./crypto";

// No 0/O/1/I/L so the key survives being written down by hand.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LENGTH = 30; // 6 groups of 5, ~148 bits

function normalize(key: string) {
  return key.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Creates a new recovery key (replacing any old one) and returns it formatted as
 * XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX. Only its hash is stored, so it can be shown exactly once.
 */
export async function issueRecoveryKey(userId: string) {
  const chars = Array.from({ length: LENGTH }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join("");
  await prisma.user.update({ where: { id: userId }, data: { recoveryKeyHash: sha256(chars) } });
  return chars.match(/.{5}/g)!.join("-");
}

/** Returns the user id when the username + recovery key pair matches. */
export async function checkRecoveryKey(username: string, key: string) {
  const clean = normalize(key);
  if (clean.length !== LENGTH) return null;
  const user = await prisma.user.findUnique({ where: { username }, select: { id: true, recoveryKeyHash: true } });
  if (!user?.recoveryKeyHash || !safeEqual(user.recoveryKeyHash, sha256(clean))) return null;
  return user.id;
}
