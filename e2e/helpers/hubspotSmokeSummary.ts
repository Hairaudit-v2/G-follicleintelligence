import { mkdirSync, writeFileSync } from "node:fs";
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

let summary: HubspotSmokeSummary | null = null;

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
  const failed = s.tests.some((t) => t.status === "FAIL");
  if (failed) {
    s.verdict = "RED";
    return "RED";
  }
  const skippedOptional =
    s.lowRole === "SKIPPED" ||
    s.tests.some((t) => t.status === "SKIPPED") ||
    !s.deployedCommit;
  s.verdict = skippedOptional ? "AMBER" : "GREEN";
  return s.verdict;
}

export function writeHubspotSmokeSummary(path = DEFAULT_SUMMARY_PATH): string {
  const s = getHubspotSmokeSummary();
  computeSmokeVerdict();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(s, null, 2)}\n`, "utf8");
  return path;
}

export function defaultSmokeSummaryPath(): string {
  return DEFAULT_SUMMARY_PATH;
}
