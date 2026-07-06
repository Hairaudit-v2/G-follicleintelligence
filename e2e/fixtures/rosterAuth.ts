import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { test as base, expect } from "@playwright/test";

import {
  hasRosterManagerCredentials,
  hasRosterViewOnlyCredentials,
  rosterManagerEmail,
  rosterViewOnlyEmail,
} from "../helpers/credentials";
import { issueRosterE2eMagicLink } from "../helpers/rosterAuthBootstrap";
import { e2eTenantId, requireE2eBaseUrl } from "./baseUrl";

const PLAYWRIGHT_DIR = join(dirname(__dirname), ".playwright");

export const ROSTER_MANAGER_STORAGE_STATE = join(PLAYWRIGHT_DIR, "roster-manager-auth.json");
export const ROSTER_VIEW_ONLY_STORAGE_STATE = join(PLAYWRIGHT_DIR, "roster-view-only-auth.json");

type WorkerFixtures = {
  rosterManagerStorageState: string;
  rosterViewOnlyStorageState: string;
};

async function bootstrapMagicLinkSession(input: {
  browser: import("@playwright/test").Browser;
  email: string;
  storagePath: string;
  nextPath: string;
}): Promise<void> {
  mkdirSync(dirname(input.storagePath), { recursive: true });

  const tenantId = e2eTenantId();
  const actionLink = await issueRosterE2eMagicLink({
    email: input.email,
    tenantId,
    nextPath: input.nextPath,
  });

  const context = await input.browser.newContext({
    baseURL: requireE2eBaseUrl(),
  });
  const page = await context.newPage();
  await page.goto(actionLink, { waitUntil: "domcontentloaded" });

  // Supabase may redirect to the site root with tokens in the hash instead of auth/confirm.
  const landed = page.url();
  if (/#access_token=|access_token=/.test(landed)) {
    const hash = new URL(landed).hash;
    const confirmPath = `/follicle-intelligence/auth/confirm?next=${encodeURIComponent(input.nextPath)}${hash}`;
    await page.goto(confirmPath, { waitUntil: "domcontentloaded" });
  }

  await page.waitForURL(new RegExp(`/fi-admin/${tenantId}/`), { timeout: 90_000 });
  await context.storageState({ path: input.storagePath });
  await context.close();
}

/**
 * Roster manager session (manager@evolvedhair or paul@evolvedhair by default).
 * Uses Supabase magic-link bootstrap — no password env required.
 */
export const rosterManagerTest = base.extend<{}, WorkerFixtures>({
  storageState: async ({ rosterManagerStorageState }, use) => {
    await use(rosterManagerStorageState);
  },
  rosterManagerStorageState: [
    async ({ browser }, use) => {
      if (!hasRosterManagerCredentials()) {
        await use("");
        return;
      }

      await bootstrapMagicLinkSession({
        browser,
        email: rosterManagerEmail(),
        storagePath: ROSTER_MANAGER_STORAGE_STATE,
        nextPath: `/fi-admin/${e2eTenantId()}/team/roster`,
      });
      await use(ROSTER_MANAGER_STORAGE_STATE);
    },
    { scope: "worker", timeout: 120_000 },
  ],
});

/**
 * View-only roster staff session — expects roster.manage denied.
 */
export const rosterViewOnlyTest = base.extend<{}, WorkerFixtures>({
  storageState: async ({ rosterViewOnlyStorageState }, use) => {
    await use(rosterViewOnlyStorageState);
  },
  rosterViewOnlyStorageState: [
    async ({ browser }, use) => {
      if (!hasRosterViewOnlyCredentials()) {
        await use("");
        return;
      }

      await bootstrapMagicLinkSession({
        browser,
        email: rosterViewOnlyEmail(),
        storagePath: ROSTER_VIEW_ONLY_STORAGE_STATE,
        nextPath: `/fi-admin/${e2eTenantId()}/team/roster`,
      });
      await use(ROSTER_VIEW_ONLY_STORAGE_STATE);
    },
    { scope: "worker", timeout: 120_000 },
  ],
});

export { expect, hasRosterManagerCredentials, hasRosterViewOnlyCredentials };