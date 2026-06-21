/**
 * Watch supabase/migrations for new/changed files and push pending migrations to hosted Supabase.
 *
 * Usage:
 *   npm run supabase:watch:migrations
 *   npm run supabase:watch:migrations -- --interval 300
 *
 * Env:
 *   SUPABASE_DB_PASSWORD — required to apply (see push-pending-supabase-migrations.mjs)
 */
import { watch } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { loadRepoEnvFiles } from "./lib/loadRepoEnvFiles.mjs";
import { pushPendingSupabaseMigrations } from "./push-pending-supabase-migrations.mjs";

loadRepoEnvFiles();

const args = process.argv.slice(2);
const intervalArg = args.find((a) => a.startsWith("--interval="));
const pollSeconds = intervalArg ? Number(intervalArg.split("=")[1]) : 300;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase/migrations");

let running = false;
let debounceTimer = null;

async function tick(reason) {
  if (running) {
    console.log(`[watch] skip (${reason}) — previous push still running`);
    return;
  }
  running = true;
  const stamp = new Date().toISOString();
  console.log(`\n[watch] ${stamp} — check (${reason})`);
  try {
    const result = await pushPendingSupabaseMigrations({ assumeYes: true });
    if (result.pending?.length === 0) {
      console.log("[watch] up to date");
    } else if (result.applied?.length) {
      console.log(`[watch] applied ${result.applied.length} migration(s)`);
    } else if (result.aborted) {
      console.log("[watch] push aborted");
    }
  } catch (err) {
    console.error(`[watch] error: ${err instanceof Error ? err.message : err}`);
  } finally {
    running = false;
  }
}

function schedule(reason) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void tick(reason);
  }, 1500);
}

console.log(`Watching ${migrationsDir}`);
console.log(`Poll every ${pollSeconds}s · debounced file events · auto-push with --yes`);
console.log("Press Ctrl+C to stop.\n");

void tick("startup");

watch(migrationsDir, { persistent: true }, (_event, filename) => {
  if (!filename || !filename.endsWith(".sql")) return;
  console.log(`[watch] filesystem: ${filename}`);
  schedule(`file:${filename}`);
});

setInterval(() => {
  void tick("poll");
}, Math.max(30, pollSeconds) * 1000);
