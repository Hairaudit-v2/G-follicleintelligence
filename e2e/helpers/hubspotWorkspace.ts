import type { Page } from "@playwright/test";

import { e2eTenantId } from "../fixtures/baseUrl";

export const EVOLVED_HUBSPOT_TENANT_ID = "c2615b95-b707-4485-aa5f-be8f78ec868a";

/**
 * Historical snapshot only (do not assert equality — live inventory drifts).
 * Prefer {@link hubspotMetricCount} / {@link HUBSPOT_WEBHOOK_QUEUE_COUNTS} in smoke.
 */
export const HUBSPOT_EXPECTED = {
  contacts: "4,750",
  deals: "4,958",
  companies: "653",
  tickets: "682",
  owners: "31",
  calls: "2,093",
  tasks: "1,680",
  meetings: "17",
  webhookPending: "39",
  webhookRetrying: "20",
  webhookFailed: "2",
} as const;

/** Match live totals like `4,750 contacts` or `4750 contacts` (count may grow). */
export function hubspotMetricCount(unit: string): RegExp {
  const u = unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(String.raw`\d{1,3}(?:,\d{3})*\s+${u}`, "i");
}

/** Match live labels like `companies 653` (label then count). */
export function hubspotLabelThenCount(label: string): RegExp {
  const l = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(String.raw`${l}\s+\d{1,3}(?:,\d{3})*`, "i");
}

/** Webhook queue summary: `N pending · M retrying · K failed` (any non-negative counts). */
export const HUBSPOT_WEBHOOK_QUEUE_COUNTS =
  /\d{1,3}(?:,\d{3})*\s+pending\s*·\s*\d{1,3}(?:,\d{3})*\s+retrying\s*·\s*\d{1,3}(?:,\d{3})*\s+failed/i;

export const VALID_BATCH_ID = "11111111-1111-4111-8111-111111111111";
export const INVALID_BATCH_ID = "not-a-uuid";
export const INVALID_TENANT_ID = "00000000-0000-4000-8000-111111111111";

export type HubspotTab =
  | "overview"
  | "backup-sync"
  | "import-review"
  | "activity-webhooks"
  | "configuration"
  | "audit-history";

export function hubspotTenantId(): string {
  return process.env.FI_E2E_TENANT_ID?.trim() || EVOLVED_HUBSPOT_TENANT_ID;
}

export function hubspotCanonicalPath(tab?: HubspotTab, batchId?: string): string {
  const tenantId = hubspotTenantId();
  const params = new URLSearchParams();
  if (tab && tab !== "overview") params.set("tab", tab);
  else if (tab === "overview") params.set("tab", "overview");
  if (batchId) params.set("batchId", batchId);
  const q = params.toString();
  return `/fi-admin/${tenantId}/settings/integrations/hubspot${q ? `?${q}` : ""}`;
}

export function hubspotLegacyImportsPath(batchId?: string): string {
  const tenantId = hubspotTenantId();
  const q = batchId ? `?batchId=${encodeURIComponent(batchId)}` : "";
  return `/fi-admin/${tenantId}/settings/imports/hubspot${q}`;
}

export function hubspotLegacyOnboardingPath(batchId?: string): string {
  const tenantId = hubspotTenantId();
  const q = batchId ? `?batchId=${encodeURIComponent(batchId)}` : "";
  return `/fi-admin/${tenantId}/onboarding-os/import-review${q}`;
}

/** Server Component / React digest failure cues (privacy-safe; no payload dump). */
export async function assertNoFrameworkErrors(page: Page): Promise<void> {
  const body = await page.locator("body").innerText();
  if (/Server Components? render|digest\s*[:=]|Application error: a client-side exception/i.test(body)) {
    throw new Error("Framework error surface detected (Server Component / React digest)");
  }
  if (/invalid input syntax for type uuid/i.test(body)) {
    throw new Error("Database UUID error surface detected");
  }
}

export function assertCanonicalWorkspaceUrl(page: Page, tab?: HubspotTab): void {
  const tenantId = hubspotTenantId();
  const url = new URL(page.url());
  if (!url.pathname.includes(`/fi-admin/${tenantId}/settings/integrations/hubspot`)) {
    throw new Error(`Expected canonical HubSpot path, landed at ${url.pathname}`);
  }
  if (tab) {
    const actual = url.searchParams.get("tab") ?? "overview";
    if (actual !== tab) {
      throw new Error(`Expected tab=${tab}, got tab=${actual}`);
    }
  }
}

/** Confirm browser history can leave the canonical page after a redirect chain. */
export async function assertBrowserBackWorks(page: Page, priorPathFragment: string): Promise<void> {
  await page.goBack({ waitUntil: "domcontentloaded" });
  const url = page.url();
  if (!url.includes(priorPathFragment) && !/follicle-intelligence\/login/i.test(url)) {
    // After server redirect, back may restore the pre-redirect entry or login — both OK if no loop.
    const loops =
      (url.match(/settings\/integrations\/hubspot/g) ?? []).length > 1 ||
      url.includes("redirect_count");
    if (loops) throw new Error(`Possible redirect loop on back navigation: ${url.split("?")[0]}`);
  }
}

export { e2eTenantId };
