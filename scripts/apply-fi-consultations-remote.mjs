/**
 * Apply fi_consultations migration to hosted Supabase when CLI link/login is unavailable.
 * Usage: SUPABASE_DB_PASSWORD='...' node scripts/apply-fi-consultations-remote.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const PROJECT_REF = "iqqvzgxoimxchhcnbzxl";
const MIGRATION_VERSION = "20260620120001";
const MIGRATION_NAME = "fi_consultations";

const password = process.env.SUPABASE_DB_PASSWORD?.trim();
if (!password) {
  console.error("Set SUPABASE_DB_PASSWORD to your hosted Postgres password (Dashboard → Settings → Database).");
  process.exit(1);
}

const regions = [
  "ap-southeast-2",
  "ap-southeast-1",
  "ap-northeast-1",
  "us-east-1",
  "us-west-1",
  "eu-west-1",
  "eu-central-1",
  "sa-east-1",
];

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sql = readFileSync(join(root, "supabase/migrations/20260620120001_fi_consultations.sql"), "utf8");

async function tryConnect(label, connectionString) {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    return client;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`  fail ${label}: ${msg.slice(0, 120)}`);
    return null;
  }
}

async function main() {
  const encoded = encodeURIComponent(password);
  const attempts = [
    [`direct`, `postgresql://postgres:${encoded}@db.${PROJECT_REF}.supabase.co:5432/postgres`],
    ...regions.flatMap((r) => [
      [`pooler-6543-${r}`, `postgresql://postgres.${PROJECT_REF}:${encoded}@aws-0-${r}.pooler.supabase.com:6543/postgres`],
      [`pooler-5432-${r}`, `postgresql://postgres.${PROJECT_REF}:${encoded}@aws-0-${r}.pooler.supabase.com:5432/postgres`],
    ]),
  ];

  let client = null;
  for (const [label, cs] of attempts) {
    console.log(`Trying ${label}…`);
    client = await tryConnect(label, cs);
    if (client) {
      console.log(`Connected via ${label}.`);
      break;
    }
  }

  if (!client) {
    console.error("Could not connect. Reset the database password in Supabase Dashboard and retry.");
    process.exit(1);
  }

  try {
    const exists = await client.query(
      `select 1 from information_schema.tables where table_schema = 'public' and table_name = 'fi_consultations'`
    );
    if (exists.rowCount > 0) {
      console.log("fi_consultations already exists — skipping DDL.");
    } else {
      console.log("Applying migration SQL…");
      await client.query(sql);
      console.log("fi_consultations created.");
    }

    await client.query(`create schema if not exists supabase_migrations`);
    await client.query(`
      create table if not exists supabase_migrations.schema_migrations (
        version text primary key,
        statements text[],
        name text
      )
    `);
    const hist = await client.query(
      `select 1 from supabase_migrations.schema_migrations where version = $1`,
      [MIGRATION_VERSION]
    );
    if (hist.rowCount === 0) {
      await client.query(
        `insert into supabase_migrations.schema_migrations (version, statements, name) values ($1, $2, $3)`,
        [MIGRATION_VERSION, [sql], MIGRATION_NAME]
      );
      console.log(`Recorded migration ${MIGRATION_VERSION} in schema_migrations.`);
    } else {
      console.log(`Migration ${MIGRATION_VERSION} already recorded.`);
    }
  } finally {
    await client.end();
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
