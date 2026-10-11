// Snapshots the SQLite database (consistent even while the site is running) and keeps the newest 14.
// Usage: npm run db:backup     Env: DATABASE_URL, BACKUP_DIR (default ./backups)
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const env = fs.existsSync(path.join(root, ".env")) ? fs.readFileSync(path.join(root, ".env"), "utf8") : "";
const url = process.env.DATABASE_URL ?? env.match(/^DATABASE_URL=["']?([^"'\n]+)/m)?.[1] ?? "file:./dev.db";
if (!url.startsWith("file:")) {
  console.error("db:backup only handles SQLite. For Postgres use pg_dump, e.g.\n  pg_dump \"$DATABASE_URL\" > backups/anikumo.sql");
  process.exit(1);
}
const dbFile = path.resolve(root, "prisma", url.replace(/^file:/, ""));
if (!fs.existsSync(dbFile)) {
  console.log(`No database yet at ${dbFile}; nothing to back up.`);
  process.exit(0);
}
const dir = path.resolve(process.env.BACKUP_DIR || path.join(root, "backups"));
fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const target = path.join(dir, `anikumo-${stamp}.db`);

// VACUUM INTO writes a clean, consistent copy without stopping the site.
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbFile}` } } });
try {
  await prisma.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
} finally {
  await prisma.$disconnect();
}
const old = fs.readdirSync(dir).filter((f) => f.startsWith("anikumo-") && f.endsWith(".db")).sort().reverse().slice(14);
for (const f of old) fs.unlinkSync(path.join(dir, f));
console.log(`Backed up to ${target} (${(fs.statSync(target).size / 1024).toFixed(0)} KB). ${old.length} old backup(s) pruned.`);
