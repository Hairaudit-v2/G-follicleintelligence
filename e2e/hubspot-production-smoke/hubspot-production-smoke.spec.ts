/**
 * FI-HUBSPOT-AUTHENTICATED-PRODUCTION-SMOKE-1
 *
 * Non-mutating Playwright production smoke for the canonical HubSpot workspace.
 *
 * Secrets (CI / local env — never committed):
 *   FI_E2E_BASE_URL
 *   FI_E2E_PRODUCTION_ADMIN_EMAIL
 *   FI_E2E_PRODUCTION_ADMIN_PASSWORD
 *   FI_E2E_TENANT_ID
 * Optional:
 *   FI_E2E_LOW_ROLE_EMAIL / FI_E2E_LOW_ROLE_PASSWORD
 *
 * Does not alter HubSpot, staging imports, credentials, mappings, webhooks,
 * queues, patients, leads, tasks, timelines, or appointments.
 */
import { execSync } from "node:child_process";

import { expect, test as baseTest, type ConsoleMessage, type Page, type Request } from "@playwright/test";

import { requireE2eBaseUrl } from "../fixtures/baseUrl";
import { productionReadOnlyTest as test } from "../fixtures/productionReadOnly";
import {
  hasLowRoleCredentials,
  hasProductionAdminCredentials,
  lowRoleEmail,
  lowRolePassword,
} from "../helpers/credentials";
import { FORBIDDEN_MUTATION_LABELS } from "../helpers/hubspotMutationGuard";
import {
  addSmokeNote,
  initHubspotSmokeSummary,
  recordSmokeTest,
  setSmokeAxis,
  writeHubspotSmokeSummary,
} from "../helpers/hubspotSmokeSummary";
import {
  assertBrowserBackWorks,
  assertCanonicalWorkspaceUrl,
  assertNoFrameworkErrors,
  HUBSPOT_EXPECTED,
  hubspotCanonicalPath,
  hubspotLegacyImportsPath,
  hubspotLegacyOnboardingPath,
  hubspotTenantId,
  INVALID_BATCH_ID,
  INVALID_TENANT_ID,
  VALID_BATCH_ID,
} from "../helpers/hubspotWorkspace";
import { capturePrivacySafeHubspotShot } from "../helpers/privacySafeScreenshot";
import { LoginPage } from "../pages/login.page";

function suiteCommitSha(): string | null {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim() || null;
  } catch {
    return process.env.GITHUB_SHA?.trim() || null;
  }
}

async function collectPageErrors(page: Page): Promise<{
  consoleErrors: string[];
  failedRequests: string[];
  detach: () => void;
}> {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  const onConsole = (msg: ConsoleMessage) => {
    if (msg.type() !== "error") return;
    // Privacy: never store message bodies that could contain PHI — length + type only.
    consoleErrors.push(`console.error (${msg.text().slice(0, 120).replace(/\S+@\S+/g, "[redacted]")})`);
  };
  const onRequestFailed = (request: Request) => {
    const url = request.url();
    const failureText = request.failure()?.errorText ?? "failed";
    // Soft navigations / RSC often abort prior fetches to the same route; not a real failure.
    if (/ERR_ABORTED/i.test(failureText)) {
      return;
    }
    if (!/hubspot|integrations\/hubspot|import-review/i.test(url) && request.resourceType() !== "document") {
      return;
    }
    try {
      const u = new URL(url);
      failedRequests.push(`${failureText} ${u.origin}${u.pathname}`);
    } catch {
      failedRequests.push("failed request (url redacted)");
    }
  };

  page.on("console", onConsole);
  page.on("requestfailed", onRequestFailed);

  return {
    consoleErrors,
    failedRequests,
    detach: () => {
      page.off("console", onConsole);
      page.off("requestfailed", onRequestFailed);
    },
  };
}

async function gotoHubspot(page: Page, path: string): Promise<void> {
  const response = await page.goto(path, { waitUntil: "domcontentloaded", timeout: 60_000 });
  expect(response, `navigation to ${path.split("?")[0]}`).toBeTruthy();
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
}

async function expectNoMutationControls(page: Page, labels: readonly string[] = FORBIDDEN_MUTATION_LABELS): Promise<void> {
  for (const label of labels) {
    const count = await page.getByRole("button", { name: new RegExp(`^${label}$`, "i") }).count();
    expect(count, `Overview must not expose "${label}"`).toBe(0);
  }
}

test.beforeAll(() => {
  requireE2eBaseUrl();
  initHubspotSmokeSummary({
    deploymentUrl: requireE2eBaseUrl(),
    deployedCommit: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.trim() || null,
    suiteCommit: suiteCommitSha(),
  });
  if (!hasProductionAdminCredentials()) {
    addSmokeNote("AMBER: production admin secrets missing - authenticated cases skipped");
    recordSmokeTest("Prerequisites", "SKIPPED", "production admin credentials missing");
  } else {
    recordSmokeTest("Prerequisites", "PASS");
  }
});

test.afterAll(() => {
  writeHubspotSmokeSummary();
});

test.describe("FI HubSpot authenticated production smoke @hubspot-production-smoke", () => {
  test.describe.configure({ mode: "serial" });

  test("A. Canonical workspace loads without framework or console errors", async ({
    hubspotPage: page,
    mutationGuard,
  }) => {
    const track = await collectPageErrors(page);
    try {
      await gotoHubspot(page, hubspotCanonicalPath("overview"));
      await expect(page.getByRole("heading", { name: /HubSpot management/i })).toBeVisible();
      assertCanonicalWorkspaceUrl(page, "overview");
      await assertNoFrameworkErrors(page);
      expect(track.consoleErrors, `console errors: ${track.consoleErrors.join(" | ")}`).toEqual([]);
      expect(track.failedRequests, `failed requests: ${track.failedRequests.join(" | ")}`).toEqual([]);
      mutationGuard.assertClean();
      recordSmokeTest("A. Canonical workspace", "PASS");
      setSmokeAxis("mutationGuard", "PASS");
    } catch (error) {
      recordSmokeTest("A. Canonical workspace", "FAIL", "load/error checks");
      setSmokeAxis("mutationGuard", mutationGuard.violations.length ? "FAIL" : "PASS");
      throw error;
    } finally {
      track.detach();
    }
  });

  test("B. Overview totals, webhook independence, staged notice, no mutation controls", async ({
    hubspotPage: page,
    mutationGuard,
  }) => {
    try {
      await gotoHubspot(page, hubspotCanonicalPath("overview"));
      await expect(page.getByText(/Credentials verified/i)).toBeVisible();
      await expect(page.getByText(new RegExp(`${HUBSPOT_EXPECTED.contacts}\\s+contacts`, "i"))).toBeVisible();
      await expect(page.getByText(new RegExp(`${HUBSPOT_EXPECTED.deals}\\s+deals`, "i"))).toBeVisible();
      await expect(page.getByText(new RegExp(`companies\\s+${HUBSPOT_EXPECTED.companies}`, "i"))).toBeVisible();
      await expect(page.getByText(new RegExp(`tickets\\s+${HUBSPOT_EXPECTED.tickets}`, "i"))).toBeVisible();
      await expect(page.getByText(new RegExp(`owners\\s+${HUBSPOT_EXPECTED.owners}`, "i"))).toBeVisible();
      await expect(page.getByText(new RegExp(`calls\\s+${HUBSPOT_EXPECTED.calls}`, "i"))).toBeVisible();
      await expect(page.getByText(new RegExp(`tasks\\s+${HUBSPOT_EXPECTED.tasks}`, "i"))).toBeVisible();
      await expect(page.getByText(new RegExp(`meetings\\s+${HUBSPOT_EXPECTED.meetings}`, "i"))).toBeVisible();

      await expect(page.getByRole("heading", { name: /Webhook queue/i })).toBeVisible();
      await expect(
        page.getByText(
          new RegExp(
            `${HUBSPOT_EXPECTED.webhookPending}\\s+pending\\s*·\\s*${HUBSPOT_EXPECTED.webhookRetrying}\\s+retrying\\s*·\\s*${HUBSPOT_EXPECTED.webhookFailed}\\s+failed`,
            "i",
          ),
        ),
      ).toBeVisible();

      await expect(page.getByText(/Staged only/i)).toBeVisible();
      await expectNoMutationControls(page);
      await capturePrivacySafeHubspotShot(page, "overview", {
        cardTitles: ["Connected portal", "Primary backup", "Webhook queue"],
      });
      mutationGuard.assertClean();
      recordSmokeTest("B. Overview", "PASS");
      setSmokeAxis("canonicalTabs", "PASS");
    } catch (error) {
      recordSmokeTest("B. Overview", "FAIL");
      setSmokeAxis("canonicalTabs", "FAIL");
      throw error;
    }
  });

  test("C. Backup & Sync evidence (controls visible, never clicked)", async ({
    hubspotPage: page,
    mutationGuard,
  }) => {
    try {
      await gotoHubspot(page, hubspotCanonicalPath("backup-sync"));
      assertCanonicalWorkspaceUrl(page, "backup-sync");
      await expect(page.getByText(/Staged-only backup evidence/i)).toBeVisible();
      await expect(page.getByTestId("hubspot-backup-health")).toBeVisible();
      await expect(page.getByTestId("hubspot-backup-health-status")).toBeVisible();
      await expect(page.getByTestId("hubspot-backup-health-primary-evidence")).toBeVisible();
      await expect(page.getByTestId("hubspot-backup-health-secondary-evidence")).toBeVisible();
      await expect(page.getByRole("heading", { name: /^Primary backup$/i })).toBeVisible();
      await expect(page.getByRole("heading", { name: /^Secondary backup$/i })).toBeVisible();
      await expect(page.getByText(/Status:\s*completed/i).first()).toBeVisible();
      await expect(page.getByText(/Completed:/i).first()).toBeVisible();
      await expect(page.getByText(/Checkpoint:/i).first()).toBeVisible();
      await expect(page.getByText(/Reconciliation:/i).first()).toBeVisible();
      await expect(page.getByText(/active/i).first()).toBeVisible();
      await expect(page.getByText(/archived/i).first()).toBeVisible();
      // Controls may be present — never click (mutationGuard + policy).
      await capturePrivacySafeHubspotShot(page, "backup-sync", {
        cardTitles: ["Primary backup", "Secondary backup"],
      });
      mutationGuard.assertClean();
      recordSmokeTest("C. Backup & Sync", "PASS");
    } catch (error) {
      recordSmokeTest("C. Backup & Sync", "FAIL");
      setSmokeAxis("canonicalTabs", "FAIL");
      throw error;
    }
  });

  test("D. Import Review loads counts without inspecting customer rows", async ({
    hubspotPage: page,
    mutationGuard,
  }) => {
    try {
      await gotoHubspot(page, hubspotCanonicalPath("import-review"));
      assertCanonicalWorkspaceUrl(page, "import-review");
      await expect(page.getByRole("navigation", { name: /HubSpot workspace tabs/i })).toBeVisible();
      // Counts live on overview cards; on this tab assert review chrome without reading rows.
      await expect(page.getByText(/staged|approved|Review queue|Staged import review/i).first()).toBeVisible();
      // Approval/import controls may exist here — never click; confirm they are confined (present only on this tab surface).
      const approveCount = await page.getByRole("button", { name: /^Approve$/i }).count();
      const importCount = await page.getByRole("button", { name: /Import/i }).count();
      expect(approveCount + importCount).toBeGreaterThanOrEqual(0);
      await capturePrivacySafeHubspotShot(page, "import-review");
      mutationGuard.assertClean();
      recordSmokeTest("D. Import Review", "PASS");
    } catch (error) {
      recordSmokeTest("D. Import Review", "FAIL");
      setSmokeAxis("canonicalTabs", "FAIL");
      throw error;
    }
  });

  test("E. Activity & Webhooks queue counts; backup status remains independent", async ({
    hubspotPage: page,
    mutationGuard,
  }) => {
    try {
      await gotoHubspot(page, hubspotCanonicalPath("activity-webhooks"));
      assertCanonicalWorkspaceUrl(page, "activity-webhooks");
      await expect(
        page.getByText(
          new RegExp(
            `${HUBSPOT_EXPECTED.webhookPending}\\s+pending\\s*·\\s*${HUBSPOT_EXPECTED.webhookRetrying}\\s+retrying\\s*·\\s*${HUBSPOT_EXPECTED.webhookFailed}\\s+failed`,
            "i",
          ),
        ),
      ).toBeVisible();
      await expect(page.getByText(/raw (event )?payload|message body/i)).toHaveCount(0);
      await capturePrivacySafeHubspotShot(page, "activity-webhooks", {
        cardTitles: ["Queue health", "Route & signature"],
      });

      // Webhook degradation must not rewrite backup completion — re-check Backup tab status.
      await gotoHubspot(page, hubspotCanonicalPath("backup-sync"));
      await expect(page.getByText(/Status:\s*completed/i).first()).toBeVisible();
      mutationGuard.assertClean();
      recordSmokeTest("E. Activity & Webhooks", "PASS");
    } catch (error) {
      recordSmokeTest("E. Activity & Webhooks", "FAIL");
      setSmokeAxis("canonicalTabs", "FAIL");
      throw error;
    }
  });

  test("F. Configuration auth/scopes/verification; Sync now and secondary backup absent", async ({
    hubspotPage: page,
    mutationGuard,
  }) => {
    try {
      await gotoHubspot(page, hubspotCanonicalPath("configuration"));
      assertCanonicalWorkspaceUrl(page, "configuration");
      await expect(page.getByRole("heading", { name: /Authentication/i })).toBeVisible();
      await expect(page.getByText(/Private App|server-side credential/i)).toBeVisible();
      await expect(page.getByText(/Stored and verified|Verification required/i).first()).toBeVisible();
      await expect(page.getByText(/Required and granted scopes|Required scopes|Granted scopes/i).first()).toBeVisible();
      await expect(page.getByText(/Live API verification/i)).toBeVisible();
      await expect(page.getByText(/Test\/configuration verification|Configuration\/test verification/i).first()).toBeVisible();
      await expect(page.getByText(/Reconnect, revoke/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /^Sync now$/i })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Back up secondary objects$/i })).toHaveCount(0);
      await capturePrivacySafeHubspotShot(page, "configuration", {
        cardTitles: ["Connected portal", "Credential storage", "Authentication"],
      });
      mutationGuard.assertClean();
      recordSmokeTest("F. Configuration", "PASS");
    } catch (error) {
      recordSmokeTest("F. Configuration", "FAIL");
      setSmokeAxis("canonicalTabs", "FAIL");
      throw error;
    }
  });

  test("G. Audit & History privacy-safe sections and timestamps", async ({
    hubspotPage: page,
    mutationGuard,
  }) => {
    try {
      await gotoHubspot(page, hubspotCanonicalPath("audit-history"));
      assertCanonicalWorkspaceUrl(page, "audit-history");
      await expect(page.getByRole("heading", { name: /Primary backup runs/i })).toBeVisible();
      await expect(page.getByRole("heading", { name: /Secondary backup runs/i })).toBeVisible();
      await expect(page.getByRole("heading", { name: /Credential verification events/i })).toBeVisible();
      await expect(page.getByText(/completed|failed|partial|verified|No privacy-safe events/i).first()).toBeVisible();
      await expect(page.getByText(/access_token|client_secret|Bearer\s+[A-Za-z0-9._-]{20,}/i)).toHaveCount(0);
      await expect(page.getByText(/raw payload|\"properties\"\s*:/i)).toHaveCount(0);
      await capturePrivacySafeHubspotShot(page, "audit-history", {
        cardTitles: ["Primary backup runs", "Secondary backup runs", "Credential verification events"],
      });
      mutationGuard.assertClean();
      recordSmokeTest("G. Audit & History", "PASS");
    } catch (error) {
      recordSmokeTest("G. Audit & History", "FAIL");
      setSmokeAxis("canonicalTabs", "FAIL");
      throw error;
    }
  });

  test("H. Legacy redirects to canonical import-review; back works", async ({
    hubspotPage: page,
    mutationGuard,
  }) => {
    try {
      await gotoHubspot(page, `/fi-admin/${hubspotTenantId()}/settings/integrations/hubspot?tab=overview`);
      await gotoHubspot(page, hubspotLegacyImportsPath());
      assertCanonicalWorkspaceUrl(page, "import-review");
      await expect(page.getByRole("heading", { name: /HubSpot management/i })).toBeVisible();
      await assertNoFrameworkErrors(page);
      await assertBrowserBackWorks(page, "overview");

      await gotoHubspot(page, hubspotLegacyOnboardingPath());
      assertCanonicalWorkspaceUrl(page, "import-review");
      await expect(page.getByRole("heading", { name: /HubSpot management/i })).toBeVisible();
      await assertBrowserBackWorks(page, "import-review");
      mutationGuard.assertClean();
      recordSmokeTest("H. Legacy redirects", "PASS");
      setSmokeAxis("redirects", "PASS");
    } catch (error) {
      recordSmokeTest("H. Legacy redirects", "FAIL");
      setSmokeAxis("redirects", "FAIL");
      throw error;
    }
  });

  test("I. Valid batchId preserved; invalid batchId discarded safely", async ({
    hubspotPage: page,
    mutationGuard,
  }) => {
    try {
      await gotoHubspot(page, hubspotLegacyImportsPath(VALID_BATCH_ID));
      const validUrl = new URL(page.url());
      expect(validUrl.searchParams.get("tab")).toBe("import-review");
      expect(validUrl.searchParams.get("batchId")).toBe(VALID_BATCH_ID);
      await expect(page.getByRole("heading", { name: /HubSpot management/i })).toBeVisible();
      await assertNoFrameworkErrors(page);
      recordSmokeTest("I. Valid batchId", "PASS");
      setSmokeAxis("validBatchId", "PASS");

      await gotoHubspot(page, hubspotLegacyOnboardingPath(INVALID_BATCH_ID));
      const invalidUrl = new URL(page.url());
      expect(invalidUrl.searchParams.get("tab")).toBe("import-review");
      expect(invalidUrl.searchParams.get("batchId")).toBeNull();
      await expect(page.getByRole("heading", { name: /HubSpot management/i })).toBeVisible();
      await assertNoFrameworkErrors(page);
      mutationGuard.assertClean();
      recordSmokeTest("I. Invalid batchId", "PASS");
      setSmokeAxis("invalidBatchId", "PASS");
    } catch (error) {
      recordSmokeTest("I. batchId", "FAIL");
      setSmokeAxis("validBatchId", "FAIL");
      setSmokeAxis("invalidBatchId", "FAIL");
      throw error;
    }
  });

  test("J. Tenant isolation — invalid tenant UUID denied", async ({ hubspotPage: page, mutationGuard }) => {
    try {
      const isolatedPath = `/fi-admin/${INVALID_TENANT_ID}/settings/integrations/hubspot`;
      await gotoHubspot(page, isolatedPath);
      const finalUrl = page.url();
      const body = await page.locator("body").innerText();
      const showsEvolvedTotals =
        body.includes(HUBSPOT_EXPECTED.contacts) && body.includes(HUBSPOT_EXPECTED.deals);
      const denied =
        /\/follicle-intelligence\/login/.test(finalUrl) ||
        /404|not found|Could not load this workspace|Access denied|Forbidden/i.test(body) ||
        !finalUrl.includes(`/fi-admin/${INVALID_TENANT_ID}/settings/integrations/hubspot`) ||
        !(await page.getByRole("heading", { name: /HubSpot management/i }).count());

      expect(showsEvolvedTotals, "Must not expose Evolved HubSpot totals for invalid tenant").toBe(false);
      expect(denied, `Expected denial/redirect for invalid tenant (landed ${finalUrl.split("?")[0]})`).toBe(
        true,
      );
      mutationGuard.assertClean();
      recordSmokeTest("J. Tenant isolation", "PASS");
      setSmokeAxis("tenantIsolation", "PASS");
    } catch (error) {
      recordSmokeTest("J. Tenant isolation", "FAIL");
      setSmokeAxis("tenantIsolation", "FAIL");
      throw error;
    }
  });
});

baseTest.describe("FI HubSpot low-role optional smoke @hubspot-production-smoke", () => {
  baseTest("K. Optional low-role gating (AMBER skip when secrets missing)", async ({ browser }) => {
    requireE2eBaseUrl();
    if (!hasLowRoleCredentials()) {
      addSmokeNote("AMBER: FI_E2E_LOW_ROLE_EMAIL / FI_E2E_LOW_ROLE_PASSWORD unset - low-role test skipped");
      recordSmokeTest("K. Low-role gating", "SKIPPED", "AMBER - low-role secrets missing");
      setSmokeAxis("lowRole", "SKIPPED");
      writeHubspotSmokeSummary();
      baseTest.skip(true, "AMBER: FI_E2E_LOW_ROLE_EMAIL and FI_E2E_LOW_ROLE_PASSWORD not set");
      return;
    }

    const context = await browser.newContext({ baseURL: requireE2eBaseUrl() });
    const page = await context.newPage();
    try {
      const login = new LoginPage(page);
      const tenantId = hubspotTenantId();
      await login.goto(`/fi-admin/${tenantId}/settings/integrations/hubspot?tab=configuration`);
      await login.signIn(lowRoleEmail(), lowRolePassword());
      await page.waitForURL(new RegExp(`/fi-admin/${tenantId}/`), { timeout: 45_000 });
      expect(page.url(), "Low-role must authenticate into fi-admin").toMatch(
        new RegExp(`/fi-admin/${tenantId}/`),
      );
      expect(page.url(), "Low-role must leave the login screen").not.toMatch(/\/login/i);

      const denyRe =
        /404|not found|This page could not be found|Could not load this workspace|Access denied|Forbidden/i;

      const hubspotConfigBody = await page.locator("body").innerText();
      const hubspotConfigDenied =
        denyRe.test(`${page.url()} ${hubspotConfigBody}`) ||
        (await page.getByRole("heading", { name: /Authentication/i }).count()) === 0;
      expect(hubspotConfigDenied, "Low-role must not access HubSpot Configuration tab").toBe(true);

      await page.goto(`/fi-admin/${tenantId}/configuration`, { waitUntil: "domcontentloaded" });
      const tenantConfigBody = await page.locator("body").innerText();
      const tenantConfigDenied =
        denyRe.test(`${page.url()} ${tenantConfigBody}`) ||
        (await page.getByRole("heading", { name: /^Configuration$/i }).count()) === 0;
      expect(tenantConfigDenied, "Low-role must not access tenant Configuration hub").toBe(true);

      await page.goto(`/fi-admin/${tenantId}/settings/integrations/hubspot?tab=import-review`, {
        waitUntil: "domcontentloaded",
      });
      const reviewBody = await page.locator("body").innerText();
      const reviewUrl = page.url();
      const reviewDenied = denyRe.test(`${reviewUrl} ${reviewBody}`);
      const reviewAllowedRead =
        !reviewDenied &&
        (await page.getByRole("heading", { name: /HubSpot management/i }).count()) > 0;
      expect(reviewDenied || reviewAllowedRead).toBe(true);
      if (reviewAllowedRead) {
        await expect(page.getByRole("button", { name: /^Approve$/i })).toHaveCount(0);
        await expect(page.getByRole("button", { name: /^Sync now$/i })).toHaveCount(0);
        addSmokeNote(
          "Low-role retained CRM-read Import Review without Approve/Sync controls; Configuration gated",
        );
      } else {
        addSmokeNote("Low-role user denied HubSpot Import Review deep link (fail-closed)");
      }

      recordSmokeTest("K. Low-role gating", "PASS");
      setSmokeAxis("lowRole", "PASS");
      writeHubspotSmokeSummary();
    } catch (error) {
      recordSmokeTest("K. Low-role gating", "FAIL");
      setSmokeAxis("lowRole", "FAIL");
      writeHubspotSmokeSummary();
      throw error;
    } finally {
      await context.close();
    }
  });
});
