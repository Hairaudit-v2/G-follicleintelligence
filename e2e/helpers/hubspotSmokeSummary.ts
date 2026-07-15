import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type SmokeStatus = "PASS" | "FAIL" | "SKIPPED";

export type SmokeTestResult = {
  name: string;
  status: SmokeStatus;
  detail?: string;
};

export type HubspotSmokeSummary = {
  suite: "FI-HUBSPOT-AUTHENTICATED-PRODUCTION-SMOKE-1";
  deploymentUrl: string;
  deployedCommit: string | null;
  suiteCommit: string | null;
  timestamp: string;
  verdict: "GREEN" | "AMBER" | "RED";
  mutationGuard: SmokeStatus;
  canonicalTabs: SmokeStatus;
  redirects: SmokeStatus;
  validBatchId: SmokeStatus;
  invalidBatchId: SmokeStatus;
  tenantIsolation: SmokeStatus;
  lowRole: SmokeStatus;
  tests: SmokeTestResult[];
  /** Privacy: never includes customer names, emails, phones, payloads, or credentials. */
  notes: string[];
};

const DEFAULT_SUMMARY_PATH = join(
  process.cwd(),
  "test-results",
  "hubspot-production-smoke-summary.json",
);

const AXIS_KEYS = [
  "mutationGuard",
  "canonicalTabs",
  "redirects",
  "validBatchId",
  "invalidBatchId",
  "tenantIsolation",
  "lowRole",
] as const;

let summary: HubspotSmokeSummary | null = null;

function preferStatus(a: SmokeStatus, b: SmokeStatus): SmokeStatus {
  if (a === "FAIL" || b === "FAIL") return "FAIL";
  if (a === "PASS" || b === "PASS") return "PASS";
  return "SKIPPED";
}

export function initHubspotSmokeSummary(input: {
  deploymentUrl: string;
  deployedCommit: string | null;
  suiteCommit: string | null;
}): HubspotSmokeSummary {
  summary = {
    suite: "FI-HUBSPOT-AUTHENTICATED-PRODUCTION-SMOKE-1",
    deploymentUrl: input.deploymentUrl,
    deployedCommit: input.deployedCommit,
    suiteCommit: input.suiteCommit,
    timestamp: new Date().toISOString(),
    verdict: "AMBER",
    mutationGuard: "SKIPPED",
    canonicalTabs: "SKIPPED",
    redirects: "SKIPPED",
    validBatchId: "SKIPPED",
    invalidBatchId: "SKIPPED",
    tenantIsolation: "SKIPPED",
    lowRole: "SKIPPED",
    tests: [],
    notes: [],
  };
  return summary;
}

export function getHubspotSmokeSummary(): HubspotSmokeSummary {
  if (!summary) {
    return initHubspotSmokeSummary({
      deploymentUrl: process.env.FI_E2E_BASE_URL?.trim() || "unset",
      deployedCommit: null,
      suiteCommit: process.env.GITHUB_SHA?.trim() || null,
    });
  }
  return summary;
}

export function recordSmokeTest(name: string, status: SmokeStatus, detail?: string): void {
  const s = getHubspotSmokeSummary();
  const existing = s.tests.findIndex((t) => t.name === name);
  const entry: SmokeTestResult = { name, status, ...(detail ? { detail } : {}) };
  if (existing >= 0) s.tests[existing] = entry;
  else s.tests.push(entry);
}

export function setSmokeAxis(
  axis:
    | "mutationGuard"
    | "canonicalTabs"
    | "redirects"
    | "validBatchId"
    | "invalidBatchId"
    | "tenantIsolation"
    | "lowRole",
  status: SmokeStatus,
): void {
  getHubspotSmokeSummary()[axis] = status;
}

export function addSmokeNote(note: string): void {
  getHubspotSmokeSummary().notes.push(note);
}

export function computeSmokeVerdict(): "GREEN" | "AMBER" | "RED" {
  const s = getHubspotSmokeSummary();
  const failed =
    s.tests.some((t) => t.status === "FAIL") || AXIS_KEYS.some((k) => s[k] === "FAIL");
  if (failed) {
    s.verdict = "RED";
    return "RED";
  }
  // Missing deployed commit is an evidence note, not a failed smoke axis.
  if (!s.deployedCommit) {
    const note = "Deployed commit SHA unset locally (CI may set NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA)";
    if (!s.notes.includes(note)) s.notes.push(note);
  }
  const skippedOptional =
    s.lowRole === "SKIPPED" || s.tests.some((t) => t.status === "SKIPPED");
  s.verdict = skippedOptional ? "AMBER" : "GREEN";
  return s.verdict;
}

function mergeSummaries(base: HubspotSmokeSummary, next: HubspotSmokeSummary): HubspotSmokeSummary {
  const testsByName = new Map<string, SmokeTestResult>();
  for (const t of base.tests) testsByName.set(t.name, t);
  for (const t of next.tests) {
    const prev = testsByName.get(t.name);
    if (!prev) {
      testsByName.set(t.name, t);
      continue;
    }
    testsByName.set(t.name, {
      name: t.name,
      status: preferStatus(prev.status, t.status),
      ...(t.detail || prev.detail ? { detail: t.detail ?? prev.detail } : {}),
    });
  }

  const notes = Array.from(new Set([...base.notes, ...next.notes]));

  const merged: HubspotSmokeSummary = {
    suite: "FI-HUBSPOT-AUTHENTICATED-PRODUCTION-SMOKE-1",
    deploymentUrl: next.deploymentUrl || base.deploymentUrl,
    deployedCommit: next.deployedCommit ?? base.deployedCommit,
    suiteCommit: next.suiteCommit ?? base.suiteCommit,
    timestamp: next.timestamp || base.timestamp,
    verdict: "AMBER",
    mutationGuard: preferStatus(base.mutationGuard, next.mutationGuard),
    canonicalTabs: preferStatus(base.canonicalTabs, next.canonicalTabs),
    redirects: preferStatus(base.redirects, next.redirects),
    validBatchId: preferStatus(base.validBatchId, next.validBatchId),
    invalidBatchId: preferStatus(base.invalidBatchId, next.invalidBatchId),
    tenantIsolation: preferStatus(base.tenantIsolation, next.tenantIsolation),
    lowRole: preferStatus(base.lowRole, next.lowRole),
    tests: Array.from(testsByName.values()),
    notes,
  };
  return merged;
}

export function writeHubspotSmokeSummary(path = DEFAULT_SUMMARY_PATH): string {
  let s = getHubspotSmokeSummary();
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) {
    try {
      const prev = JSON.parse(readFileSync(path, "utf8")) as HubspotSmokeSummary;
      if (prev?.suite === "FI-HUBSPOT-AUTHENTICATED-PRODUCTION-SMOKE-1") {
        s = mergeSummaries(prev, s);
        summary = s;
      }
    } catch {
      // ignore corrupt prior summary
    }
  }
  computeSmokeVerdict();
  writeFileSync(path, `${JSON.stringify(s, null, 2)}\n`, "utf8");
  return path;
}

export function defaultSmokeSummaryPath(): string {
  return DEFAULT_SUMMARY_PATH;
}
