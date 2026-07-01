/**
 * WORKFORCE-GUARD-1 — static tenant-scoping guard.
 *
 * WorkforceOS reads/writes with the service-role client (`supabaseAdmin()`), which bypasses RLS.
 * Every service-role query on a WorkforceOS table must therefore be tenant-scoped. This test scans
 * the WorkforceOS server source and fails if it finds a `.from("<table>")` query that has no tenant
 * guarantee.
 *
 * A query is considered SAFE when any of these hold:
 *   • the statement carries `tenant_id` (e.g. `.eq("tenant_id", …)` or a `tenant_id:` insert column);
 *   • it is an insert/upsert whose payload object (built just above the `.from`) sets `tenant_id`;
 *   • it goes through the tenant-scoped helper (`workforceTenantClient(...)` — those use `.from(<var>)`
 *     internally and never appear as `.from("literal")`, so they are inherently excluded);
 *   • it is annotated with a `// tenant-guard-allow: <reason>` comment within a few lines
 *     (for genuine cross-tenant work or global reference tables without a `tenant_id` column).
 *
 * If you are adding a new WorkforceOS query and this test fails: add a `tenant_id` filter (ideally via
 * `workforceTenantClient`), or — only if tenant scoping genuinely does not apply — annotate it with a
 * `// tenant-guard-allow:` comment explaining why.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// repo root = .../src/lib/workforce-os/security/ -> up 4
const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");

const SCAN_DIRS = ["src/lib/workforce", "src/lib/workforce-os"];
const EXTRA_FILES = [
  "src/lib/actions/workforce-phase-1c-sprint-2-actions.ts",
  "src/lib/actions/workforce-phase-1c-sprint-3-actions.ts",
  "src/lib/actions/workforce-phase-1c-sprint-35-actions.ts",
  "src/lib/actions/workforce-phase-2-sprint-1-actions.ts",
  "src/lib/actions/workforce-phase-2-sprint-2-actions.ts",
  "src/lib/actions/workforce-phase-2-sprint-4-actions.ts",
  "src/lib/actions/workforce-phase-2-sprint-5-actions.ts",
  "src/lib/actions/workforce-roster-actions.ts",
  "src/lib/actions/staff-time-clock-actions.ts",
];

/**
 * Whole-file exemptions. Keep this list tiny and justified; prefer inline `// tenant-guard-allow:`.
 * The helper defines the safe primitives (and uses `.from(<var>)`, not string literals) so it never
 * trips the scanner — listed here for documentation only.
 */
const FILE_ALLOWLIST = new Set<string>([
  "src/lib/workforce-os/security/tenantScopedQuery.server.ts",
]);

const FROM_RE = /\.from\(\s*["'`]([a-zA-Z0-9_.]+)["'`]\s*\)/g;

function walk(dir: string, acc: string[]): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of names) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (p.endsWith(".ts") && !p.endsWith(".test.ts")) acc.push(p);
  }
  return acc;
}

function collectFiles(): string[] {
  const files: string[] = [];
  for (const d of SCAN_DIRS) walk(join(ROOT, d), files);
  for (const f of EXTRA_FILES) {
    const abs = join(ROOT, f);
    try {
      if (statSync(abs).isFile()) files.push(abs);
    } catch {
      /* optional file — ignore if renamed */
    }
  }
  return files;
}

type Violation = { file: string; line: number; table: string };

function scan(): { totalFrom: number; scannedFiles: number; violations: Violation[] } {
  const files = collectFiles();
  const violations: Violation[] = [];
  let totalFrom = 0;

  for (const abs of files) {
    const rel = abs.slice(ROOT.length + 1).split("\\").join("/");
    if (FILE_ALLOWLIST.has(rel)) continue;

    let src: string;
    try {
      src = readFileSync(abs, "utf8");
    } catch {
      continue;
    }

    FROM_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = FROM_RE.exec(src)) !== null) {
      totalFrom++;
      const table = m[1];
      const idx = m.index;

      // Statement window: from the match to the next ';' (capped).
      let end = src.indexOf(";", idx);
      if (end === -1 || end - idx > 1500) end = Math.min(src.length, idx + 1500);
      const stmt = src.slice(idx, end);

      const isWrite = /\.(insert|upsert)\s*\(/.test(stmt);
      // Insert/upsert payloads are usually built into a variable ABOVE the `.from` — look backward.
      const back = src.slice(Math.max(0, idx - 1800), idx);
      const allowWindow = src.slice(Math.max(0, idx - 400), end);

      const safe =
        stmt.includes("tenant_id") ||
        (isWrite && back.includes("tenant_id")) ||
        allowWindow.includes("tenant-guard-allow");

      if (!safe) {
        const line = src.slice(0, idx).split("\n").length;
        violations.push({ file: rel, line, table });
      }
    }
  }

  return { totalFrom, scannedFiles: files.length, violations };
}

test("WorkforceOS service-role queries are tenant-scoped (WORKFORCE-GUARD-1)", () => {
  const { totalFrom, scannedFiles, violations } = scan();

  // Sanity: the scanner must actually be looking at WorkforceOS source, or it could pass vacuously.
  assert.ok(scannedFiles > 20, `expected to scan WorkforceOS files, only saw ${scannedFiles}`);
  assert.ok(totalFrom > 50, `expected many .from() queries, only saw ${totalFrom}`);

  if (violations.length > 0) {
    const detail = violations
      .map((v) => `  • ${v.file}:${v.line} -> ${v.table}`)
      .join("\n");
    assert.fail(
      `Found ${violations.length} WorkforceOS service-role query/queries with no tenant guarantee.\n` +
        `Each must be tenant-scoped (use workforceTenantClient or an explicit tenant_id filter) or\n` +
        `annotated with a "// tenant-guard-allow: <reason>" comment:\n${detail}`
    );
  }
});
