/**
 * Architectural enforcement: no new uncontrolled fi_staff ↔ fi_staff_members
 * identity joins outside src/lib/team/identity (FI-TEAM-COHESION-B1D).
 *
 * Allowed:
 * - Single-table domain use of either table
 * - Canonical resolution under src/lib/team/identity/**
 * - Frozen B0 debt in staffIdentityDualTableAllowlist.ts
 *
 * Restricted:
 * - New files (or paths not on the allowlist) that reference BOTH tables
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { STAFF_IDENTITY_DUAL_TABLE_ALLOWLIST_SET } from "@/src/lib/team/identity/staffIdentityDualTableAllowlist";

const SRC_LIB = "src/lib";
const IDENTITY_ROOT = "src/lib/team/identity";
/** Canonical Team domains that own dual-table joins after B2 consolidation. */
const TEAM_DOMAIN_EXEMPT_PREFIXES = [
  "src/lib/team/identity/",
  "src/lib/team/access/",
] as const;
const HAS_FI_STAFF = /\bfi_staff\b/;
const HAS_FI_STAFF_MEMBERS = /\bfi_staff_members\b/;

function isTeamDomainExempt(rel: string): boolean {
  return TEAM_DOMAIN_EXEMPT_PREFIXES.some((prefix) => rel.startsWith(prefix));
}

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".next") continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      walkTsFiles(full, acc);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(ent.name)) continue;
    if (/\.test\.(ts|tsx)$/.test(ent.name)) continue;
    if (!statSync(full).isFile()) continue;
    acc.push(full.replace(/\\/g, "/"));
  }
  return acc;
}

function mentionsBothStaffTables(source: string): boolean {
  return HAS_FI_STAFF.test(source) && HAS_FI_STAFF_MEMBERS.test(source);
}

test("B1 identity: dual-table allowlist is frozen and sorted", () => {
  const list = [...STAFF_IDENTITY_DUAL_TABLE_ALLOWLIST_SET].sort((a, b) =>
    a.localeCompare(b)
  );
  assert.equal(list.length, STAFF_IDENTITY_DUAL_TABLE_ALLOWLIST_SET.size);
  for (const rel of list) {
    assert.match(rel, /^src\/lib\//, `allowlist path must be under src/lib: ${rel}`);
    assert.ok(
      !isTeamDomainExempt(rel),
      `canonical team domain files must not be on the debt allowlist: ${rel}`
    );
  }
});

test("B1 identity: no new dual fi_staff + fi_staff_members references outside allowlist", () => {
  const files = walkTsFiles(SRC_LIB);
  const violations: string[] = [];

  for (const rel of files) {
    if (isTeamDomainExempt(rel)) continue;
    if (rel.endsWith("staffIdentityDualTableAllowlist.ts")) continue;

    const src = readFileSync(rel, "utf8");
    if (!mentionsBothStaffTables(src)) continue;

    if (!STAFF_IDENTITY_DUAL_TABLE_ALLOWLIST_SET.has(rel)) {
      violations.push(rel);
    }
  }

  assert.deepEqual(
    violations,
    [],
    [
      "New dual-table staff identity references detected.",
      "Route joins through @/src/lib/team/identity/server, or update the B1 allowlist + cohesion register deliberately.",
      ...violations.map((v) => ` - ${v}`),
    ].join("\n")
  );
});

test("B1 identity: allowlisted dual-table files still exist", () => {
  const missing: string[] = [];
  for (const rel of STAFF_IDENTITY_DUAL_TABLE_ALLOWLIST_SET) {
    try {
      readFileSync(rel, "utf8");
    } catch {
      missing.push(rel);
    }
  }
  assert.deepEqual(
    missing,
    [],
    `Allowlist entries missing on disk (remove from allowlist if deleted):\n${missing.join("\n")}`
  );
});

test("B1 identity: public consumers must not import identity/internal", () => {
  const files = walkTsFiles(SRC_LIB);
  const banned = /@\/src\/lib\/team\/identity\/internal\//;
  const violations: string[] = [];

  for (const rel of files) {
    if (rel.startsWith(`${IDENTITY_ROOT}/`)) continue;
    // Access may load identity via the public/server barrels only.
    const src = readFileSync(rel, "utf8");
    if (banned.test(src)) violations.push(rel);
  }

  assert.deepEqual(
    violations,
    [],
    `External imports of team/identity/internal are forbidden:\n${violations.join("\n")}`
  );
});
