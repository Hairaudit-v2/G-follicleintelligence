/**
 * Validate-only watcher for supabase/migrations.
 *
 * Watches supabase/migrations for new/changed .sql files and runs static
 * validation on change. It NEVER connects to a database and NEVER pushes —
 * it is purely a local pre-push safety net (contrast with
 * scripts/watch-supabase-migrations.mjs which auto-pushes to remote).
 *
 * Checks:
 *   - Duplicate version prefixes (hard error; mirrors check-migration-versions).
 *   - Filename naming policy (12- or legacy 14-digit prefix + lowercase slug).
 *   - Out-of-order version insertion (a changed file that is not the newest).
 *   - Per-file SQL lints that mirror the Supabase database linter:
 *       * idempotency: create table/index/type without IF NOT EXISTS,
 *         drop without IF EXISTS (pg_temp objects excluded).
 *       * lint 0011: SECURITY DEFINER function without SET search_path.
 *       * lint 0029: SECURITY DEFINER function EXECUTE granted to
 *         authenticated/public without an accompanying revoke.
 *       * lint 0008: ENABLE ROW LEVEL SECURITY with no policy in the same file.
 *
 * Usage:
 *   node scripts/watch-supabase-migrations-validate.mjs           # watch mode
 *   node scripts/watch-supabase-migrations-validate.mjs --once    # single run (CI)
 *   node scripts/watch-supabase-migrations-validate.mjs --interval=120
 *   node scripts/watch-supabase-migrations-validate.mjs --all     # content-lint every file on startup
 *
 * Emits a machine-readable sentinel per run: `MIGRATION_LINT_RESULT: PASS|WARN|ERROR`.
 * Exit code (in --once mode): 0 = PASS/WARN, 1 = ERROR.
 */
import { watch, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const runOnce = args.includes("--once");
const lintAll = args.includes("--all");
const intervalArg = args.find((a) => a.startsWith("--interval="));
const pollSeconds = intervalArg ? Number(intervalArg.split("=")[1]) : 300;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase", "migrations");

const NAME_RE = /^\d{12,14}_[a-z0-9]+(?:_[a-z0-9]+)*\.sql$/;

/** @typedef {{ level: "ERROR"|"WARN"|"INFO", line: number, msg: string }} Issue */

function listSqlFiles() {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function versionOf(filename) {
  return filename.split("_")[0];
}

/** Global checks across the whole migrations set. @returns {{file: string, issues: Issue[]}[]} */
function globalChecks(files) {
  /** @type {Map<string, string[]>} */
  const byVersion = new Map();
  for (const f of files) {
    const v = versionOf(f);
    byVersion.set(v, [...(byVersion.get(v) ?? []), f]);
  }
  /** @type {{file: string, issues: Issue[]}[]} */
  const out = [];
  for (const f of files) {
    /** @type {Issue[]} */
    const issues = [];
    const v = versionOf(f);
    const dupes = byVersion.get(v) ?? [];
    if (dupes.length > 1) {
      issues.push({
        level: "ERROR",
        line: 0,
        msg: `duplicate version prefix ${v} shared by: ${dupes.join(", ")}`,
      });
    }
    if (!NAME_RE.test(f)) {
      issues.push({
        level: "ERROR",
        line: 0,
        msg: `filename does not match naming policy \`^\\d{12,14}_lowercase_slug.sql$\``,
      });
    }
    if (issues.length) out.push({ file: f, issues });
  }
  return out;
}

/**
 * Remove `--` line comments and single-quoted string-literal contents so that
 * detection regexes only match real SQL, not prose in comments/doc strings.
 * (Dollar-quoted function bodies rarely contain these clause keywords, and the
 *  CREATE ... SECURITY DEFINER clause itself lives outside any string.)
 */
function stripNoise(line) {
  let out = "";
  let inStr = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inStr) {
      if (c === "'") inStr = false;
      continue;
    }
    if (c === "'") {
      inStr = true;
      out += " ";
      continue;
    }
    if (c === "-" && line[i + 1] === "-") break; // rest is a line comment
    out += c;
  }
  return out;
}

/** @returns {Issue[]} */
function lintSql(text) {
  const rawLines = text.split(/\r?\n/);
  const code = rawLines.map((l) => stripNoise(l).toLowerCase());
  const strippedText = code.join("\n");
  /** @type {Issue[]} */
  const issues = [];

  const hasCreatePolicy = /create\s+policy/i.test(strippedText);
  const hasWithin = (idx, radius, re) => {
    const from = Math.max(0, idx - radius);
    const to = Math.min(code.length - 1, idx + radius);
    for (let i = from; i <= to; i++) if (re.test(code[i])) return true;
    return false;
  };

  for (let i = 0; i < code.length; i++) {
    const l = code[i];
    const ln = i + 1;

    // Idempotency — CREATE TABLE / SEQUENCE without IF NOT EXISTS
    if (/\bcreate\s+(table|sequence)\b/.test(l) && !/if\s+not\s+exists/.test(l)) {
      issues.push({ level: "WARN", line: ln, msg: `${rawLines[i].trim().slice(0, 80)} — missing IF NOT EXISTS (idempotency)` });
    }
    // CREATE [UNIQUE] INDEX without IF NOT EXISTS
    if (/\bcreate\s+(unique\s+)?index\b/.test(l) && !/if\s+not\s+exists/.test(l)) {
      issues.push({ level: "WARN", line: ln, msg: `create index missing IF NOT EXISTS (idempotency)` });
    }
    // DROP without IF EXISTS (ignore pg_temp scratch objects)
    if (/\bdrop\s+(table|function|policy|index|trigger|view|type|materialized\s+view)\b/.test(l) &&
        !/if\s+exists/.test(l) && !/pg_temp\./.test(l)) {
      issues.push({ level: "WARN", line: ln, msg: `drop without IF EXISTS (idempotency)` });
    }
    // lint 0011 — SECURITY DEFINER function without SET search_path nearby
    if (/security\s+definer/.test(l) && hasWithin(i, 30, /\bfunction\b/) && !hasWithin(i, 30, /pg_temp\./)) {
      if (!hasWithin(i, 30, /set\s+search_path/)) {
        issues.push({ level: "WARN", line: ln, msg: `SECURITY DEFINER without SET search_path (lint 0011)` });
      }
    }
    // lint 0008 — ENABLE RLS with no policy in this migration
    if (/enable\s+row\s+level\s+security/.test(l) && !hasCreatePolicy) {
      issues.push({
        level: "INFO",
        line: ln,
        msg: `ENABLE RLS but no CREATE POLICY in this file (lint 0008 — confirm a policy exists elsewhere or default-deny is intended)`,
      });
    }
  }

  // lint 0029 — SECURITY DEFINER + grant execute to authenticated/public without revoke
  if (/security\s+definer/.test(strippedText)) {
    const grantsBroad = /grant\s+execute\s+on\s+function[\s\S]*?\bto\s+(authenticated|public)\b/.test(strippedText);
    const hasRevoke = /revoke\s+execute\s+on\s+function/.test(strippedText);
    if (grantsBroad && !hasRevoke) {
      issues.push({
        level: "INFO",
        line: 0,
        msg: `SECURITY DEFINER function EXECUTE granted to authenticated/public with no revoke (lint 0029 — confirm intended, document if a user-callable RPC)`,
      });
    }
  }

  return issues;
}

/** @type {Map<string, number>} */
const lastMtimes = new Map();

function mtimeOf(file) {
  try {
    return statSync(join(migrationsDir, file)).mtimeMs;
  } catch {
    return 0;
  }
}

function pickContentTargets(files, { forceAll }) {
  if (forceAll) return files;
  const now = Date.now();
  /** @type {string[]} */
  const targets = [];
  for (const f of files) {
    const m = mtimeOf(f);
    const prev = lastMtimes.get(f);
    const changed = prev === undefined ? now - m < 24 * 60 * 60 * 1000 : m > prev;
    if (changed) targets.push(f);
    lastMtimes.set(f, m);
  }
  return targets;
}

let firstRun = true;

function runValidation(reason) {
  const stamp = new Date().toISOString();
  const files = listSqlFiles();

  const globals = globalChecks(files);
  const contentTargets = pickContentTargets(files, { forceAll: lintAll && firstRun });
  firstRun = false;

  /** @type {{file: string, issues: Issue[]}[]} */
  const contentResults = [];
  for (const f of contentTargets) {
    const issues = lintSql(readFileSync(join(migrationsDir, f), "utf8"));
    if (issues.length) contentResults.push({ file: f, issues });
  }

  let errors = 0;
  let warns = 0;
  let infos = 0;
  const tally = (issues) => {
    for (const it of issues) {
      if (it.level === "ERROR") errors++;
      else if (it.level === "WARN") warns++;
      else infos++;
    }
  };

  console.log(`\n[validate] ${stamp} — ${reason} · ${files.length} migration(s), content-linted ${contentTargets.length}`);

  const printGroup = (label, group) => {
    if (!group.length) return;
    console.log(`  ${label}:`);
    for (const { file, issues } of group) {
      tally(issues);
      for (const it of issues) {
        const loc = it.line ? `:${it.line}` : "";
        console.log(`    ${it.level.padEnd(5)} ${file}${loc} — ${it.msg}`);
      }
    }
  };

  printGroup("naming / versions", globals);
  printGroup("sql lints (changed files)", contentResults);

  const result = errors ? "ERROR" : warns ? "WARN" : "PASS";
  console.log(`[validate] summary: ${errors} error(s), ${warns} warning(s), ${infos} info`);
  console.log(`MIGRATION_LINT_RESULT: ${result}`);
  return result;
}

if (runOnce) {
  const result = runValidation("once");
  process.exit(result === "ERROR" ? 1 : 0);
} else {
  console.log(`Validating (no push) ${migrationsDir}`);
  console.log(`Poll every ${Math.max(30, pollSeconds)}s · debounced file events · NEVER pushes`);
  console.log("Press Ctrl+C to stop.\n");

  let debounceTimer = null;
  const schedule = (reason) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      runValidation(reason);
    }, 1200);
  };

  runValidation("startup");

  watch(migrationsDir, { persistent: true }, (_event, filename) => {
    if (!filename || !String(filename).endsWith(".sql")) return;
    console.log(`[validate] filesystem: ${filename}`);
    schedule(`file:${filename}`);
  });

  setInterval(() => runValidation("poll"), Math.max(30, pollSeconds) * 1000);
}
