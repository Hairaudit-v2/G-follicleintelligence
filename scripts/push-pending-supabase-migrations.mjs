/**
 * Detect pending supabase/migrations/*.sql files and apply them to hosted Supabase.
 *
 * Usage:
 *   npm run supabase:push:remote:dry-run
 *   npm run supabase:push:remote
 *
 * Requires SUPABASE_DB_PASSWORD in .env.local or the shell.
 *
 * Flags:
 *   --dry-run     Report pending migrations without applying DDL
 *   --yes         Skip confirmation prompt when pending migrations exist
 */
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { loadRepoEnvFiles } from "./lib/loadRepoEnvFiles.mjs";
import { listLocalMigrationFiles } from "./lib/supabaseMigrationFiles.mjs";
import { connectHostedSupabasePostgres } from "./lib/supabaseRemotePostgres.mjs";

loadRepoEnvFiles();

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase/migrations");

async function fetchRemoteVersions(client) {
  const { rows } = await client.query(
    `select version, name from supabase_migrations.schema_migrations order by version`
  );
  return new Map(rows.map((r) => [r.version, r.name]));
}

async function ensureHistoryTable(client) {
  await client.query(`create schema if not exists supabase_migrations`);
  await client.query(`
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    )
  `);
}

async function recordMigration(client, migration) {
  await client.query(
    `insert into supabase_migrations.schema_migrations (version, statements, name)
     values ($1, $2, $3)
     on conflict (version) do nothing`,
    [migration.version, [migration.sql], migration.name]
  );
}

async function confirmPush(pending, { assumeYes = false, dryRun = false } = {}) {
  if (assumeYes || dryRun) return true;
  if (!process.stdin.isTTY) {
    console.error("Pending migrations require --yes when stdin is not a TTY.");
    return false;
  }
  const rl = readline.createInterface({ input, output });
  try {
    console.log("Pending migrations:");
    for (const m of pending) console.log(`  - ${m.version} ${m.name}`);
    const answer = await rl.question("Apply to hosted Supabase? [y/N] ");
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

function fingerprint(files) {
  return createHash("sha256")
    .update(files.map((f) => `${f.version}:${f.filename}`).join("\n"))
    .digest("hex")
    .slice(0, 12);
}

export async function pushPendingSupabaseMigrations(options = {}) {
  const dryRun = options.dryRun ?? false;
  const assumeYes = options.assumeYes ?? false;

  const local = listLocalMigrationFiles(migrationsDir);
  const fp = fingerprint(local);

  let client;
  let label;
  try {
    ({ client, label } = await connectHostedSupabasePostgres(options));
    console.log(`Connected to hosted Postgres via ${label}.`);

    await ensureHistoryTable(client);
    const remote = await fetchRemoteVersions(client);

    const pending = local.filter((m) => !remote.has(m.version));
    const remoteOnly = [...remote.keys()].filter((v) => !local.some((m) => m.version === v));

    console.log(
      `Local migrations: ${local.length} · Remote recorded: ${remote.size} · Pending push: ${pending.length}`
    );
    if (local.length > 0) {
      console.log(`Latest local: ${local[local.length - 1].version} (${local[local.length - 1].name})`);
    }
    const latestRemote = [...remote.keys()].sort().at(-1);
    if (latestRemote) {
      console.log(`Latest remote: ${latestRemote} (${remote.get(latestRemote)})`);
    }

    if (remoteOnly.length > 0) {
      console.warn(`Remote-only history rows (${remoteOnly.length}) — not removed automatically.`);
      for (const version of remoteOnly.slice(0, 5)) {
        console.warn(`  · ${version} ${remote.get(version)}`);
      }
      if (remoteOnly.length > 5) console.warn(`  · … and ${remoteOnly.length - 5} more`);
    }

    if (pending.length === 0) {
      return { ok: true, pending: [], fingerprint: fp, applied: [] };
    }

    for (const m of pending) {
      console.log(`  pending → ${m.version} ${m.name} (${m.filename})`);
    }

    if (dryRun) {
      console.log("Dry run — no DDL applied.");
      return { ok: true, pending, fingerprint: fp, applied: [], dryRun: true };
    }

    if (!(await confirmPush(pending, { assumeYes, dryRun }))) {
      console.log("Aborted.");
      return { ok: false, pending, fingerprint: fp, applied: [], aborted: true };
    }

    const applied = [];
    for (const migration of pending) {
      console.log(`Applying ${migration.version} ${migration.name}…`);
      await client.query("begin");
      try {
        await client.query(migration.sql);
        await recordMigration(client, migration);
        await client.query("commit");
        applied.push(migration);
        console.log(`  ✓ applied ${migration.version}`);
      } catch (err) {
        await client.query("rollback");
        throw err;
      }
    }

    return { ok: true, pending, fingerprint: fp, applied };
  } finally {
    if (client) await client.end();
  }
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const args = new Set(process.argv.slice(2));
  const cliDryRun = args.has("--dry-run");
  const cliYes = args.has("--yes");

  pushPendingSupabaseMigrations({ dryRun: cliDryRun, assumeYes: cliYes })
    .then((result) => {
      if (result.applied?.length) {
        console.log(`Done — applied ${result.applied.length} migration(s).`);
      } else if (!result.aborted && result.pending?.length === 0) {
        console.log("Hosted Supabase is up to date.");
      }
      process.exit(result.ok ? 0 : 1);
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
