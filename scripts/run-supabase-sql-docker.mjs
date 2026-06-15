/**
 * Pipe a SQL file into local Supabase Postgres via docker exec (multi-statement safe).
 * Usage: node scripts/run-supabase-sql-docker.mjs <path-to.sql>
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/run-supabase-sql-docker.mjs <path-to.sql>");
  process.exit(1);
}

const sqlPath = resolve(process.cwd(), file);
const sql = readFileSync(sqlPath, "utf8");

let names;
try {
  names = execFileSync("docker", ["ps", "--format", "{{.Names}}"], {
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
} catch {
  console.error("docker ps failed; is Docker running?");
  process.exit(1);
}

const container = names.find((n) => /^supabase_db_/i.test(n));
if (!container) {
  console.error("No supabase_db_* container found. Run: npx supabase start");
  process.exit(1);
}

const r = spawnSync(
  "docker",
  ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
  { input: sql, encoding: "utf8" },
);

if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
process.exit(r.status ?? 1);
