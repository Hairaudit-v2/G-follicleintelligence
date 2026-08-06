#!/usr/bin/env node
/**
 * FI-TEAM-COHESION-B0 inventory generator.
 * Discovery only — does not move files or change runtime behaviour.
 *
 * Usage: node scripts/team-cohesion/generate-b0-inventory.mjs
 * Outputs under docs/architecture/team-cohesion/generated/
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.join(ROOT, "docs/architecture/team-cohesion/generated");

const LEGACY_TREES = [
  "src/lib/workforce-os",
  "src/lib/workforce",
  "src/lib/staff",
  // Canonical Team tree (B1+) — inventoried alongside legacy trees for ownership tracking.
  "src/lib/team",
];

const ACTION_DIR = "src/lib/actions";

/** Heuristic ownership from path/name. Reviewed in inventory.md. */
function proposeDomain(relPath) {
  const p = relPath.replace(/\\/g, "/").toLowerCase();
  const base = path.basename(p);

  // Canonical Team tree (B1+)
  if (p.startsWith("src/lib/team/")) {
    const seg = p.split("/")[3] || "shared";
    if (seg === "identity") {
      return { domain: "identity", reason: "canonical team/identity module (B1)" };
    }
    if (
      [
        "directory",
        "roster",
        "onboarding",
        "access",
        "compliance",
        "payroll",
        "planning",
        "commandcentre",
        "shared",
        "notifications",
      ].includes(seg)
    ) {
      return {
        domain: seg === "commandcentre" ? "commandCentre" : seg,
        reason: `canonical team/${seg} module`,
      };
    }
    return { domain: "shared", reason: "team umbrella / unclassified domain folder" };
  }

  if (base === "readme.md" || p.includes("/security/readme")) {
    return { domain: "shared", reason: "docs/security guard scaffolding" };
  }

  // Command centre collisions
  if (
    p.includes("workforcecommandcentre") ||
    p.includes("rostercommandcentre") ||
    (p.includes("commandcentre") && !p.includes("rostercandidates"))
  ) {
    if (p.includes("rostercommandcentre") || p.includes("workforcerostercommandcentre")) {
      return { domain: "roster", reason: "roster command centre (ops surface)" };
    }
    if (p.startsWith("src/lib/staff/workforcecommandcentre")) {
      return { domain: "needsDecision", reason: "legacy staff CC vs workforce V2" };
    }
    return { domain: "commandCentre", reason: "KPI/attention composition" };
  }

  // Onboarding
  if (p.includes("/onboarding/") || /onboarding/.test(base)) {
    return { domain: "onboarding", reason: "onboarding path/name" };
  }

  // Access
  if (
    /staffaccess|staffpin|hrmanagegate|stafffiuserlink|logininvite|pinlayer/.test(
      base.replace(/[.-]/g, "")
    ) ||
    p.includes("staffaccess") ||
    (p.includes("access") && !p.includes("readiness"))
  ) {
    if (/staffaccess|pinlayer|logininvite|hrmanagegate|fiuserlink/.test(base.replace(/[.-]/g, ""))) {
      return { domain: "access", reason: "login/PIN/entitlement" };
    }
  }

  // Payroll
  if (
    /wage|payroll|timesheet|payperiod|shiftcost|timeclock|punchsync/.test(base) ||
    p.includes("payroll")
  ) {
    return { domain: "payroll", reason: "pay/time costing" };
  }

  // Compliance
  if (
    /credential|certif|compliance|expiry/.test(base) ||
    p.includes("compliance")
  ) {
    return { domain: "compliance", reason: "credentials/certs/audits" };
  }

  // Planning
  if (
    /planning|recruitment|procedurestaffing|surgicalworkforceintelligence|workforceintelligence/.test(
      base
    )
  ) {
    return { domain: "planning", reason: "demand/recruitment/procedure staffing" };
  }

  // Roster
  if (
    /roster|rostering|standardhours|eligiblestaff|rostertx|grideligibility|lifecycledrift|shiftcreatedby|shiftaudit|clinicalstaffing|eventassignment|rostercandidates|rosterquery/.test(
      base
    ) ||
    p.includes("roster")
  ) {
    return { domain: "roster", reason: "roster/ops scheduling" };
  }

  // Directory
  if (
    /directory|clinicalstaffpicker|calendarvisiblestaff|staffassigneedisplay|staffdirectory/.test(
      base
    )
  ) {
    return { domain: "directory", reason: "directory/list projections" };
  }

  // Identity
  if (
    /identity|readiness|canonicallifecycle|stafflifecycle|staffmemberresolve|nexusfistaff|hrreconciliation|iiohrstaffhrlink|projectionhealth|identityreconciliation|staffcanonicaldecision|duplicatedetection|duplicatemerge|duplicatereview|staffmerge|tenantlinkrepair|staffreconciliation|hreconciliation|staffdeparture|staffoffboarding|hrstaffreadiness|staffsourceids|staffprofilehub|staffoperationalhistory|stafftwin|staffsensitive|profilesextras|staffapischemas|staff\.server|workforceidentity|workforcereadiness|hrsyncaudit|workforcehrstaffsync|hrtaskmap/.test(
      base.replace(/[.-]/g, "")
    ) ||
    /identity|readiness|reconciliation|lifecycle|profilehub/.test(p)
  ) {
    // Offboarding / leave UX may straddle identity + access
    if (/staffleave|leavworkflow/.test(base)) {
      return { domain: "needsDecision", reason: "leave workflow vs identity lifecycle" };
    }
    if (/stafflifecycle(ux|copy)/.test(base.replace(/[.-]/g, ""))) {
      return { domain: "shared", reason: "lifecycle UX/copy used across domains" };
    }
    if (/hrtaskmap|hrnotification|myhrportal|staffhrimport|staffrole|staffweekly|staffslot|staffpayrollsource|assertstaffclinically|clinicalstaffassignment/.test(base.replace(/[.-]/g, ""))) {
      // classified below with more specific rules
    } else {
      return { domain: "identity", reason: "identity/lifecycle/readiness/reconciliation" };
    }
  }

  // Shared / presentation leftovers in staff/
  if (p.startsWith("src/lib/staff/")) {
    if (/myhrportal|hrnotification|staffhrimport/.test(base)) {
      return { domain: "notifications", reason: "HR portal/notification orchestration (B2.3b)" };
    }
    if (/staffrole|staffweekly|staffslot|staffpayrollsource|staffprofileextras|staffapischemas|staffsensitive|staffassignee|clinicalstaff|calendarvisible|assertstaff/.test(base.replace(/[.-]/g, ""))) {
      return { domain: "directory", reason: "staff presentation/picker helpers" };
    }
    if (base === "staff.server.ts") {
      return { domain: "identity", reason: "canonical fi_staff CRUD" };
    }
  }

  // Clinical eligibility bridges
  if (/clinicaleligibility|procedureclinical|clinicaleventmapping|surgery staffing|workforcesurgery/.test(base)) {
    return { domain: "roster", reason: "clinical staffing eligibility bridge" };
  }

  // Telemetry / phase tests / maps
  if (/legacyroutetelemetry|workforcephase|workforceclinicaltypes|workforceclinicalintegration|workforcemutationerrors|workforcesubnav|workforceossubnav|legacyj|hrreadpathsync|workforcesurgery|clinicalintegrationmap/.test(base.replace(/[.-]/g, ""))) {
    if (/workforcephase/.test(base)) {
      return { domain: "shared", reason: "sprint-era integration tests / audit helpers" };
    }
    if (/legacyroutetelemetry/.test(base)) {
      return { domain: "shared", reason: "legacy route telemetry (nav A1)" };
    }
    if (/mutationerrors/.test(base)) {
      return { domain: "shared", reason: "cross-domain mutation error mapping" };
    }
    if (/clinicalintegration|clinicaltypes|clinicalintegrationmap|workforce_clinical/.test(base)) {
      return { domain: "shared", reason: "cross-domain clinical integration map/types" };
    }
    if (/subnav|hrreadpathsync|workforceossubnav/.test(base)) {
      return { domain: "shared", reason: "nav/sync integration test" };
    }
  }

  if (/offboardingpage|staffleave|staffprofileactionmenu/.test(base.replace(/[.-]/g, ""))) {
    if (/offboarding/.test(base)) {
      return { domain: "identity", reason: "offboarding page loader (employment termination UI)" };
    }
    if (/staffleave/.test(base)) {
      return { domain: "roster", reason: "leave affects roster eligibility/availability" };
    }
    if (/profileactionmenu/.test(base)) {
      return { domain: "shared", reason: "cross-surface profile action menu test" };
    }
  }

  if (/tenantscop|resolvecurrenttenant|resolveworkforceactor/.test(base)) {
    return { domain: "shared", reason: "tenant/actor resolution shared by roster+mutations" };
  }

  if (/staffhrtaskmap/.test(base)) {
    return { domain: "access", reason: "access task map (identity linkage UX)" };
  }

  if (/operationalmetrics/.test(base)) {
    return { domain: "commandCentre", reason: "operational metrics for CC composition" };
  }

  if (/WORKFORCE_CLINICAL_INTEGRATION_MAP/i.test(base)) {
    return { domain: "shared", reason: "clinical integration registry" };
  }

  return { domain: "needsDecision", reason: "no confident name heuristic" };
}

function proposePath(relPath, domain) {
  if (domain === "delete" || domain === "needsDecision") return null;
  const norm = relPath.replace(/\\/g, "/");
  const file = path.basename(norm);
  // Preserve onboarding subdirectory for onboarding files already nested
  if (domain === "onboarding" && norm.includes("/onboarding/")) {
    return `src/lib/team/onboarding/${file}`;
  }
  if (domain === "commandCentre") {
    return `src/lib/team/commandCentre/${file}`;
  }
  return `src/lib/team/${domain}/${file}`;
}

function walkFiles(dirRel) {
  const abs = path.join(ROOT, dirRel);
  const out = [];
  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) walk(full);
      else out.push(path.relative(ROOT, full).replace(/\\/g, "/"));
    }
  }
  if (fs.existsSync(abs)) walk(abs);
  return out.sort();
}

function readText(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const IMPORT_RE =
  /(?:import|export)\s+(?:type\s+)?(?:[^'"\n]+?\s+from\s+)?["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)/g;

function extractImports(source) {
  const imports = [];
  let m;
  const re = new RegExp(IMPORT_RE.source, "g");
  while ((m = re.exec(source))) {
    imports.push(m[1] || m[2]);
  }
  return imports;
}

function resolveImport(fromRel, spec) {
  if (
    !spec.startsWith("@/") &&
    !spec.startsWith(".") &&
    !spec.startsWith("src/")
  ) {
    return null; // package
  }
  let target;
  if (spec.startsWith("@/")) {
    // tsconfig: "@/*" -> "./*" so "@/src/lib/foo" => "src/lib/foo"
    target = spec.slice(2);
  } else if (spec.startsWith("src/")) {
    target = spec;
  } else {
    const fromDir = path.dirname(fromRel);
    target = path.normalize(path.join(fromDir, spec)).replace(/\\/g, "/");
  }
  target = target.replace(/\\/g, "/");
  const candidates = [
    target,
    target + ".ts",
    target + ".tsx",
    target + ".js",
    path.join(target, "index.ts").replace(/\\/g, "/"),
    path.join(target, "index.tsx").replace(/\\/g, "/"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(ROOT, c))) return c.replace(/\\/g, "/");
  }
  // soft fail: return .ts guess for graph edges
  if (!path.extname(target)) return (target + ".ts").replace(/\\/g, "/");
  return target.replace(/\\/g, "/");
}

/** Match resolved path to a known legacy file (extension-tolerant). */
function matchLegacyFile(resolved, legacyFileList) {
  const r = resolved.replace(/\\/g, "/");
  if (legacyFileList.includes(r)) return r;
  const noExt = r.replace(/\.tsx?$/, "");
  return (
    legacyFileList.find(
      (lf) => lf === r || lf.replace(/\.tsx?$/, "") === noExt
    ) || null
  );
}

function isLegacyPath(p) {
  return LEGACY_TREES.some((t) => p.replace(/\\/g, "/").startsWith(t + "/") || p === t);
}

function detectTables(source) {
  const tables = new Set();
  const patterns = [
    /\bfi_staff_members\b/g,
    /\bfi_staff\b/g,
    /\["fi_staff_members"\]/g,
    /\["fi_staff"\]/g,
    /'fi_staff_members'/g,
    /'fi_staff'/g,
    /`fi_staff_members`/g,
    /`fi_staff`/g,
  ];
  // Count carefully: fi_staff should not double-count fi_staff_members
  const members = (source.match(/\bfi_staff_members\b/g) || []).length;
  const staffOnly = (source.match(/\bfi_staff\b/g) || []).length - members;
  if (members > 0) tables.add("fi_staff_members");
  if (staffOnly > 0) tables.add("fi_staff");
  // Other common roster tables for context
  for (const t of [
    "fi_roster_shifts",
    "fi_staff_credentials",
    "fi_staff_certifications",
    "fi_staff_wage_profiles",
    "fi_staff_access_invites",
    "fi_staff_onboarding_invites",
  ]) {
    if (new RegExp(`\\b${t}\\b`).test(source)) tables.add(t);
  }
  return [...tables];
}

function isMutationBearing(source, rel) {
  if (/\.test\.(ts|tsx)$/.test(rel)) return false;
  const markers = [
    /\.insert\(/,
    /\.update\(/,
    /\.upsert\(/,
    /\.delete\(/,
    /rosterTx/,
    /createClient.*service/i,
    /generateInviteToken|hashToken|createHash/,
    /"use server"/,
  ];
  // Page loaders often read-only even if .server
  const writey = markers.some((r) => r.test(source));
  if (!writey) return false;
  // Prefer true for action-adjacent server modules that mutate
  return (
    /insert|update|upsert|delete|rosterTx|invite|revoke|suspend|offboard|merge|link/i.test(
      source
    ) && writey
  );
}

function migrationRisk(row, source) {
  const highMarkers = [
    /rosterTx/,
    /generateInvite|inviteToken|setupToken/,
    /assert.*Entitlement|canManage|HrManageGate/,
    /fi_staff_members[\s\S]{0,200}(insert|update|upsert|delete)/i,
    /payroll|wage|timesheet/i,
    /complianceAuditCron|TimeClockAutoCloseCron/,
    /cross.?tenant|tenantScoped/i,
  ];
  if (row.mutationBearing) return "high";
  if (highMarkers.some((r) => r.test(source))) return "high";
  if (row.runtimeConsumers.length >= 8) return "high";
  if (row.runtimeConsumers.length >= 3 || row.serverOnly) return "medium";
  if (/\.test\.(ts|tsx)$/.test(row.currentPath)) return "low";
  return "low";
}

function classifyIdentityHit(file, kind /* staff | members */) {
  const p = file.replace(/\\/g, "/").toLowerCase();
  const base = path.basename(p);
  if (/\.test\.(ts|tsx)$/.test(p) || /fixtures|seed/.test(p)) {
    if (/seed|demo|fixture/.test(p)) return "test or fixture";
    return "test or fixture";
  }
  if (/migration|scripts\//.test(p)) return "migration script";
  if (/identity|resolve|canonical|profilehub|staffmembersolve|fistaffbridge|staff\.server|links\.server|tenantlink/.test(base + p)) {
    return "canonical identity resolution";
  }
  if (/roster|calendar|booking|appoint|schedule|eligib|standardhours|slot/.test(p)) {
    return "scheduling read";
  }
  if (/lifecycle|onboard|offboard|employment|departure|leave/.test(p)) {
    return "lifecycle read";
  }
  if (/actions\/|insert|update|upsert|mutate|merge|invite|repair/.test(p)) {
    return "mutation";
  }
  if (/report|metric|commandcentre|operational|analytics|intelligence/.test(p)) {
    return "reporting";
  }
  if (/crm|financial|clinicsetup|prescrib|patholog|surgery|imaging|academy|hubspot|googlecalendar|fiOs|fi-os|reception|pilot/.test(p)) {
    return "cross-domain join";
  }
  if (/import|sync|reconciliation|duplicate/.test(p)) {
    return "suspected duplicate identity logic";
  }
  return kind === "members" ? "lifecycle read" : "scheduling read";
}

// ---- main ----
const legacyFiles = LEGACY_TREES.flatMap(walkFiles);
const actionFiles = walkFiles(ACTION_DIR).filter((f) =>
  /workforce/i.test(path.basename(f))
);

// Index all src for consumer scan (costly but bounded)
const allSrcFiles = walkFiles("src").filter((f) => /\.(ts|tsx)$/.test(f));
const importIndex = new Map(); // file -> resolved imports[]
for (const f of allSrcFiles) {
  let src;
  try {
    src = readText(f);
  } catch {
    continue;
  }
  const specs = extractImports(src);
  const resolved = [];
  for (const s of specs) {
    const r = resolveImport(f, s);
    if (r) resolved.push({ spec: s, resolved: r });
  }
  importIndex.set(f, resolved);
}

// Reverse: who imports each legacy file
const consumersOf = new Map();
for (const f of legacyFiles) consumersOf.set(f, []);
for (const [from, edges] of importIndex) {
  for (const { resolved } of edges) {
    const hit = matchLegacyFile(resolved, legacyFiles);
    if (hit && from !== hit) {
      consumersOf.get(hit).push(from);
    }
  }
}

const inventory = [];
const interTreeEdges = [];
const externalIntoTree = { "workforce-os": [], workforce: [], staff: [] };
const unofficialBarrels = [];
const deepImportViolations = []; // outside -> deep path
const clientImportingServer = [];

for (const f of legacyFiles) {
  const source = /\.(ts|tsx|md)$/.test(f) ? (f.endsWith(".md") ? "" : readText(f)) : "";
  const { domain, reason } = proposeDomain(f);
  const runtimeConsumers = [];
  const testConsumers = [];
  for (const c of consumersOf.get(f) || []) {
    if (/\.test\.(ts|tsx)$/.test(c) || /\/__tests__\//.test(c) || /e2e\//.test(c)) {
      testConsumers.push(c);
    } else {
      runtimeConsumers.push(c);
    }
  }
  runtimeConsumers.sort();
  testConsumers.sort();

  const tablesReferenced = f.endsWith(".md") ? [] : detectTables(source);
  const serverOnly =
    /\.server\.(ts|tsx)$/.test(f) ||
    /"server-only"/.test(source) ||
    /from\s+["']server-only["']/.test(source);
  const mutationBearing = f.endsWith(".md") ? false : isMutationBearing(source, f);

  // Inter-tree imports from this file
  const edges = importIndex.get(f) || [];
  for (const { spec, resolved } of edges) {
    const toHit = matchLegacyFile(resolved, legacyFiles);
    if (!toHit) continue;
    const fromTree = LEGACY_TREES.find((t) => f.startsWith(t + "/"));
    const toTree = LEGACY_TREES.find((t) => toHit.startsWith(t + "/"));
    if (fromTree && toTree && fromTree !== toTree) {
      interTreeEdges.push({ from: f, to: toHit, fromTree, toTree, spec });
    }
  }

  // Consumers outside trees
  for (const c of [...runtimeConsumers, ...testConsumers]) {
    if (!isLegacyPath(c)) {
      const tree = LEGACY_TREES.find((t) => f.startsWith(t + "/"))?.replace("src/lib/", "");
      if (tree && externalIntoTree[tree]) {
        externalIntoTree[tree].push({ consumer: c, target: f });
      }
    }
  }

  // Unofficial barrels: many re-exports or many unique exporters
  const exportStar = (source.match(/export\s+\*\s+from/g) || []).length;
  const namedExports = (source.match(/^export\s+(?:async\s+)?(?:function|const|class|type|interface|enum)/gm) || []).length;
  if (exportStar >= 2 || (namedExports >= 12 && !/\.test\./.test(f))) {
    unofficialBarrels.push({ file: f, exportStar, namedExports });
  }

  const row = {
    currentPath: f,
    proposedDomain: domain,
    proposeReason: reason,
    proposedPath: proposePath(f, domain),
    runtimeConsumers,
    testConsumers,
    tablesReferenced,
    serverOnly,
    mutationBearing,
    duplicateOf: null,
    deletionReason: null,
    migrationRisk: "low",
  };
  row.migrationRisk = migrationRisk(row, source);
  inventory.push(row);
}

// Duplicate detection by basename collisions across trees
const byBase = new Map();
for (const row of inventory) {
  const base = path.basename(row.currentPath).replace(/\.test\.ts$/, ".ts");
  if (!byBase.has(base)) byBase.set(base, []);
  byBase.get(base).push(row.currentPath);
}
const basenameCollisions = [...byBase.entries()].filter(([, files]) => {
  const trees = new Set(
    files.map((f) => LEGACY_TREES.find((t) => f.startsWith(t + "/")))
  );
  return trees.size > 1;
});

for (const [base, files] of basenameCollisions) {
  if (/workforcecommandcentre/i.test(base)) {
    const wfCore = files.find(
      (f) => f.includes("/workforce/workforceCommandCentre") && !f.includes("Page")
    );
    for (const f of files) {
      const row = inventory.find((r) => r.currentPath === f);
      if (!row) continue;
      if (f.includes("/staff/")) {
        row.duplicateOf = "src/lib/workforce/workforceCommandCentreCore.ts";
        row.proposedDomain = "delete";
        row.deletionReason =
          "Legacy staff workforceCommandCentre; live V2 is workforce/workforceCommandCentre*. Confirm staffProfileHub + directory loader migrate off it first.";
        row.proposedPath = null;
      }
    }
  }
}

// Also mark staff CC server module for delete even if basename differs from workforce core
for (const f of [
  "src/lib/staff/workforceCommandCentre.server.ts",
  "src/lib/staff/workforceCommandCentre.ts",
  "src/lib/staff/workforceCommandCentre.test.ts",
]) {
  const row = inventory.find((r) => r.currentPath === f);
  if (!row) continue;
  row.proposedDomain = "delete";
  row.duplicateOf = "src/lib/workforce/workforceCommandCentreCore.ts";
  row.deletionReason =
    "Legacy staff command-centre implementation. KEEP_CANONICAL is workforce V2; DELETE after profile/directory consumers move.";
  row.proposedPath = null;
}

// Dedupe consumer lists
for (const row of inventory) {
  row.runtimeConsumers = [...new Set(row.runtimeConsumers)].sort();
  row.testConsumers = [...new Set(row.testConsumers)].sort();
  row.migrationRisk = migrationRisk(row, row.currentPath.endsWith(".md") ? "" : readText(row.currentPath));
}

// Circular dependencies among legacy files (SCC via DFS)
const legacySet = new Set(legacyFiles);
const adj = new Map(legacyFiles.map((f) => [f, []]));
for (const f of legacyFiles) {
  for (const { resolved } of importIndex.get(f) || []) {
    const hit = matchLegacyFile(resolved, legacyFiles);
    if (hit && hit !== f) adj.get(f).push(hit);
  }
}
const cycles = [];
const visiting = new Set();
const visited = new Set();
const stack = [];
function dfs(n) {
  if (visiting.has(n)) {
    const i = stack.indexOf(n);
    if (i >= 0) cycles.push(stack.slice(i).concat(n));
    return;
  }
  if (visited.has(n)) return;
  visiting.add(n);
  stack.push(n);
  for (const m of adj.get(n) || []) dfs(m);
  stack.pop();
  visiting.delete(n);
  visited.add(n);
}
for (const f of legacyFiles) dfs(f);
// Deduplicate cycles
const cycleKeys = new Set();
const uniqueCycles = [];
for (const c of cycles) {
  const key = [...c].slice(0, -1).sort().join("|");
  if (!cycleKeys.has(key)) {
    cycleKeys.add(key);
    uniqueCycles.push(c);
  }
}

// Client components importing server-only
for (const [from, edges] of importIndex) {
  if (!/\.(tsx)$/.test(from)) continue;
  let fromSrc = "";
  try {
    fromSrc = readText(from);
  } catch {
    continue;
  }
  const isClient = /["']use client["']/.test(fromSrc);
  if (!isClient) continue;
  for (const { spec, resolved } of edges) {
    const hit = matchLegacyFile(resolved, legacyFiles);
    if (!hit) continue;
    let head = "";
    try {
      head = readText(hit).slice(0, 800);
    } catch {
      continue;
    }
    if (/\.server\.(ts|tsx)$/.test(hit) || /server-only/.test(head)) {
      clientImportingServer.push({ client: from, serverModule: hit, spec });
    }
  }
}

// Deep imports into legacy that bypass would-be domain indexes
for (const [from, edges] of importIndex) {
  if (isLegacyPath(from)) continue;
  for (const { spec, resolved } of edges) {
    const hit = matchLegacyFile(resolved, legacyFiles);
    if (!hit) continue;
    if (!/\.test\./.test(from)) {
      deepImportViolations.push({ consumer: from, target: hit, spec });
    }
  }
}

// Identity table baseline across ALL src (and optionally scripts)
const identityHits = [];
const identityScanRoots = ["src", "scripts", "supabase"].filter((d) =>
  fs.existsSync(path.join(ROOT, d))
);
function walkAll(relDir, acc) {
  const abs = path.join(ROOT, relDir);
  if (!fs.existsSync(abs)) return;
  const norm = relDir.replace(/\\/g, "/");
  if (norm === "scripts/team-cohesion" || norm.startsWith("scripts/team-cohesion/")) return;
  for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".next" || ent.name === ".worktrees") continue;
    const full = path.join(abs, ent.name);
    const rel = path.relative(ROOT, full).replace(/\\/g, "/");
    if (ent.isDirectory()) walkAll(rel, acc);
    else if (/\.(ts|tsx|js|jsx|sql|mjs|cjs)$/.test(ent.name)) acc.push(rel);
  }
}
const identityFiles = [];
for (const r of identityScanRoots) walkAll(r, identityFiles);

let fiStaffCount = 0;
let fiStaffMembersCount = 0;
const byClassification = {};
const byArea = {};

for (const f of identityFiles) {
  let src;
  try {
    src = readText(f);
  } catch {
    continue;
  }
  const membersMatches = src.match(/\bfi_staff_members\b/g) || [];
  const allStaff = src.match(/\bfi_staff\b/g) || [];
  const staffOnlyCount = Math.max(0, allStaff.length - membersMatches.length);
  if (membersMatches.length === 0 && staffOnlyCount === 0) continue;

  fiStaffMembersCount += membersMatches.length;
  fiStaffCount += staffOnlyCount;

  const area = f.startsWith("src/lib/")
    ? f.split("/").slice(0, 3).join("/")
    : f.split("/").slice(0, 2).join("/");

  if (staffOnlyCount > 0) {
    const cls = classifyIdentityHit(f, "staff");
    identityHits.push({
      file: f,
      table: "fi_staff",
      count: staffOnlyCount,
      classification: cls,
    });
    byClassification[cls] = (byClassification[cls] || 0) + staffOnlyCount;
    byArea[area] = byArea[area] || { fi_staff: 0, fi_staff_members: 0 };
    byArea[area].fi_staff += staffOnlyCount;
  }
  if (membersMatches.length > 0) {
    const cls = classifyIdentityHit(f, "members");
    identityHits.push({
      file: f,
      table: "fi_staff_members",
      count: membersMatches.length,
      classification: cls,
    });
    byClassification[cls] = (byClassification[cls] || 0) + membersMatches.length;
    byArea[area] = byArea[area] || { fi_staff: 0, fi_staff_members: 0 };
    byArea[area].fi_staff_members += membersMatches.length;
  }
}

// Action file export map
const actionExportMap = [];
for (const f of actionFiles) {
  if (!/\.ts$/.test(f) || /\.test\.ts$/.test(f)) continue;
  const src = readText(f);
  const exports = [];
  const re = /^export\s+(?:async\s+)?function\s+(\w+)|^export\s+(?:type|interface)\s+(\w+)|^export\s+const\s+(\w+)/gm;
  let m;
  while ((m = re.exec(src))) {
    exports.push(m[1] || m[2] || m[3]);
  }
  actionExportMap.push({ file: f, exports, sourcePreviewDomains: proposeActionDomains(f, exports) });
}

function proposeActionDomains(file, exports) {
  const base = path.basename(file);
  const joined = exports.join(" ").toLowerCase();
  if (/onboarding/.test(base) || /onboarding/.test(joined)) return ["onboarding"];
  if (/staff-access/.test(base) || /logininvite|pinsetup|revoke|suspend/.test(joined))
    return ["access"];
  if (/roster-cadence/.test(base)) return ["roster"];
  if (/roster-actions/.test(base)) return ["roster"];
  if (/sprint-2-actions/.test(base)) {
    if (/credential|certif|compliance/.test(joined)) return ["compliance"];
    // phase-1c-sprint-2 is identity/merge/offboard
    return ["identity", "onboarding"]; // offboard split check
  }
  if (/sprint-3-actions/.test(base) && !/sprint-35/.test(base)) return ["compliance"];
  if (/sprint-35/.test(base)) return ["identity"];
  if (/sprint-1-actions/.test(base)) return ["planning"];
  if (/sprint-2-actions/.test(base) && /phase-2/.test(base)) return ["payroll"];
  if (/phase-2-sprint-2/.test(base)) return ["payroll"];
  if (/phase-2-sprint-4/.test(base)) return ["planning"];
  if (/phase-2-sprint-5/.test(base)) return ["planning"];
  if (/phase-1c-sprint-2/.test(base)) {
    const domains = [];
    if (/link|duplicate|merge/.test(joined)) domains.push("identity");
    if (/offboard/.test(joined)) domains.push("identity"); // employment termination stays identity-adjacent; access must not own it
    return domains.length ? domains : ["identity"];
  }
  return ["needsDecision"];
}

// Fix action domain mapping more carefully
for (const a of actionExportMap) {
  const b = path.basename(a.file);
  const joined = a.exports.join(" ");
  if (b === "workforce-phase-1c-sprint-2-actions.ts") {
    a.sourcePreviewDomains = ["identity"];
    a.splitPlan = [
      {
        to: "src/lib/team/identity/identityLinkActions.ts",
        exports: a.exports.filter((e) => /Link|Duplicate|Merge|merge/i.test(e)),
      },
      {
        to: "src/lib/team/identity/offboardingActions.ts",
        exports: a.exports.filter((e) => /offboard/i.test(e)),
      },
    ];
    a.proposedPath = null; // split
  } else if (b === "workforce-phase-1c-sprint-3-actions.ts") {
    a.proposedPath = "src/lib/team/compliance/credentialActions.ts";
    a.sourcePreviewDomains = ["compliance"];
  } else if (b === "workforce-phase-1c-sprint-35-actions.ts") {
    a.proposedPath = "src/lib/team/identity/reconciliationActions.ts";
    a.sourcePreviewDomains = ["identity"];
  } else if (b === "workforce-phase-2-sprint-1-actions.ts") {
    a.proposedPath = "src/lib/team/planning/recruitmentActions.ts";
    a.sourcePreviewDomains = ["planning"];
  } else if (b === "workforce-phase-2-sprint-2-actions.ts") {
    a.proposedPath = "src/lib/team/payroll/payrollActions.ts";
    a.sourcePreviewDomains = ["payroll"];
  } else if (b === "workforce-phase-2-sprint-4-actions.ts") {
    a.proposedPath = "src/lib/team/planning/procedureStaffingActions.ts";
    a.sourcePreviewDomains = ["planning"];
  } else if (b === "workforce-phase-2-sprint-5-actions.ts") {
    a.proposedPath = "src/lib/team/planning/planningActions.ts";
    a.sourcePreviewDomains = ["planning"];
  } else if (b === "workforce-onboarding-actions.ts") {
    a.proposedPath = "src/lib/team/onboarding/actions.ts";
    a.sourcePreviewDomains = ["onboarding"];
  } else if (b === "workforce-staff-access-actions.ts") {
    a.proposedPath = "src/lib/team/access/actions.ts";
    a.sourcePreviewDomains = ["access"];
  } else if (b === "workforce-roster-actions.ts") {
    a.proposedPath = "src/lib/team/roster/actions.ts";
    a.sourcePreviewDomains = ["roster"];
  } else if (b === "workforce-roster-cadence-actions.ts") {
    a.proposedPath = "src/lib/team/roster/cadenceActions.ts";
    a.sourcePreviewDomains = ["roster"];
  }
}

// Domain summary
const domainCounts = {};
for (const row of inventory) {
  domainCounts[row.proposedDomain] = (domainCounts[row.proposedDomain] || 0) + 1;
}

const riskCounts = {};
for (const row of inventory) {
  riskCounts[row.migrationRisk] = (riskCounts[row.migrationRisk] || 0) + 1;
}

// External consumer uniqued
function uniqExternal(arr) {
  const seen = new Set();
  const out = [];
  for (const e of arr) {
    const k = e.consumer + "->" + e.target;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}
for (const k of Object.keys(externalIntoTree)) {
  externalIntoTree[k] = uniqExternal(externalIntoTree[k]);
}

const report = {
  generatedAt: new Date().toISOString(),
  auditBaselineFiles: 267,
  currentFiles: inventory.length,
  growthSinceAudit: inventory.length - 267,
  trees: {
    "workforce-os": inventory.filter((r) => r.currentPath.startsWith("src/lib/workforce-os/")).length,
    workforce: inventory.filter((r) => r.currentPath.startsWith("src/lib/workforce/")).length,
    staff: inventory.filter((r) => r.currentPath.startsWith("src/lib/staff/")).length,
  },
  domainCounts,
  riskCounts,
  inventory,
  importGraph: {
    interTreeEdgeCount: interTreeEdges.length,
    interTreeEdges: interTreeEdges.slice(0, 500),
    cycles: uniqueCycles.slice(0, 50),
    cycleCount: uniqueCycles.length,
    unofficialBarrels,
    clientImportingServer,
    deepImportViolationCount: deepImportViolations.length,
    deepImportViolationsSample: deepImportViolations.slice(0, 200),
    externalIntoTreeCounts: {
      "workforce-os": externalIntoTree["workforce-os"].length,
      workforce: externalIntoTree.workforce.length,
      staff: externalIntoTree.staff.length,
    },
    externalIntoTree,
  },
  basenameCollisions: basenameCollisions.map(([base, files]) => ({ base, files })),
  identityBaseline: {
    method:
      "Word-boundary counts of fi_staff vs fi_staff_members (fi_staff_members subtracted from fi_staff matches). Regenerable via scripts/team-cohesion/generate-b0-inventory.mjs",
    scanRoots: identityScanRoots,
    auditParityNote:
      "Aug 2026 audit cited 448 refs / 176 files in src/lib. Re-run produces srcLibOnly below for apples-to-apples.",
    fi_staff_reference_count: fiStaffCount,
    fi_staff_members_reference_count: fiStaffMembersCount,
    total_raw_references: fiStaffCount + fiStaffMembersCount,
    files_with_any_reference: new Set(identityHits.map((h) => h.file)).size,
    srcLibOnly: (() => {
      const libHits = identityHits.filter((h) => h.file.startsWith("src/lib/"));
      return {
        fi_staff: libHits.filter((h) => h.table === "fi_staff").reduce((a, h) => a + h.count, 0),
        fi_staff_members: libHits
          .filter((h) => h.table === "fi_staff_members")
          .reduce((a, h) => a + h.count, 0),
        total: libHits.reduce((a, h) => a + h.count, 0),
        files: new Set(libHits.map((h) => h.file)).size,
      };
    })(),
    byClassification,
    byArea: Object.fromEntries(
      Object.entries(byArea).sort(
        (a, b) =>
          b[1].fi_staff +
          b[1].fi_staff_members -
          (a[1].fi_staff + a[1].fi_staff_members)
      )
    ),
    hits: identityHits,
  },
  actionRenameMap: actionExportMap,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "b0-inventory.json"), JSON.stringify(report, null, 2));

// CSV for spreadsheet review
const csvEsc = (v) => {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};
const csvHeader = [
  "currentPath",
  "proposedDomain",
  "proposedPath",
  "runtimeConsumerCount",
  "testConsumerCount",
  "tablesReferenced",
  "serverOnly",
  "mutationBearing",
  "duplicateOf",
  "deletionReason",
  "migrationRisk",
  "proposeReason",
];
const csvLines = [csvHeader.join(",")];
for (const r of inventory) {
  csvLines.push(
    [
      r.currentPath,
      r.proposedDomain,
      r.proposedPath,
      r.runtimeConsumers.length,
      r.testConsumers.length,
      r.tablesReferenced.join("|"),
      r.serverOnly,
      r.mutationBearing,
      r.duplicateOf,
      r.deletionReason,
      r.migrationRisk,
      r.proposeReason,
    ]
      .map(csvEsc)
      .join(",")
  );
}
fs.writeFileSync(path.join(OUT_DIR, "b0-inventory.csv"), csvLines.join("\n"));

// Compact summary json for docs
fs.writeFileSync(
  path.join(OUT_DIR, "b0-summary.json"),
  JSON.stringify(
    {
      generatedAt: report.generatedAt,
      currentFiles: report.currentFiles,
      trees: report.trees,
      domainCounts,
      riskCounts,
      identity: {
        fi_staff: fiStaffCount,
        fi_staff_members: fiStaffMembersCount,
        total: fiStaffCount + fiStaffMembersCount,
        files: report.identityBaseline.files_with_any_reference,
        byClassification,
      },
      importGraph: {
        interTreeEdgeCount: interTreeEdges.length,
        cycleCount: uniqueCycles.length,
        deepImportViolationCount: deepImportViolations.length,
        clientImportingServerCount: clientImportingServer.length,
        externalIntoTreeCounts: report.importGraph.externalIntoTreeCounts,
      },
      basenameCollisionCount: basenameCollisions.length,
      actionFiles: actionExportMap.length,
    },
    null,
    2
  )
);

console.log(
  JSON.stringify(
    {
      ok: true,
      files: report.currentFiles,
      domainCounts,
      identityTotal: fiStaffCount + fiStaffMembersCount,
      cycles: uniqueCycles.length,
      out: path.relative(ROOT, OUT_DIR),
    },
    null,
    2
  )
);
