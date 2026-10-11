// Switches the Prisma datasource between SQLite (local) and PostgreSQL (hosting).
// Usage:  node scripts/use-postgres.mjs postgres   |   node scripts/use-postgres.mjs sqlite
// Then set DATABASE_URL accordingly and run: npx prisma migrate dev --name init_postgres
// (Postgres needs a fresh migration history: move prisma/migrations aside first.)
import fs from "node:fs";
import path from "node:path";

const target = process.argv[2];
if (target !== "postgres" && target !== "sqlite") {
  console.error("Usage: node scripts/use-postgres.mjs <postgres|sqlite>");
  process.exit(1);
}
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const schemaPath = path.join(root, "prisma", "schema.prisma");
const schema = fs.readFileSync(schemaPath, "utf8");
const next = schema.replace(/provider = "(sqlite|postgresql)"(\s+url\s+= env\("DATABASE_URL"\))/, `provider = "${target === "postgres" ? "postgresql" : "sqlite"}"$2`);
if (next === schema) console.log(`Datasource already set to ${target}.`);
else {
  fs.writeFileSync(schemaPath, next);
  console.log(`Datasource set to ${target}. Next:\n  1. Set DATABASE_URL in .env\n  2. Move prisma/migrations to prisma/migrations-sqlite (keep for reference)\n  3. npx prisma migrate dev --name init`);
}
