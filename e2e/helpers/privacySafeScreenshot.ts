import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { Page } from "@playwright/test";

/**
 * Privacy-safe HubSpot smoke screenshots — crop to headers, status cards, and
 * tab chrome only. Never capture customer review tables / import rows.
 */

export const HUBSPOT_SMOKE_SCREENSHOT_DIR = join(
  process.cwd(),
  "test-results",
  "hubspot-production-smoke-screenshots",
);

export async function capturePrivacySafeHubspotShot(
  page: Page,
  name: string,
  options?: { cardTitles?: string[] },
): Promise<string> {
  mkdirSync(HUBSPOT_SMOKE_SCREENSHOT_DIR, { recursive: true });
  const filePath = join(HUBSPOT_SMOKE_SCREENSHOT_DIR, `${name}.png`);

  const header = page.locator("header").first();
  const tabs = page.getByRole("navigation", { name: /HubSpot workspace tabs/i });
  await tabs.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);

  // Import Review: header + tabs only — never the customer queue.
  if (name.includes("import")) {
    const headerBox = await header.boundingBox();
    const tabsBox = await tabs.boundingBox();
    if (headerBox && tabsBox) {
      const top = Math.max(0, headerBox.y);
      const bottom = tabsBox.y + tabsBox.height + 12;
      await page.screenshot({
        path: filePath,
        animations: "disabled",
        clip: {
          x: 0,
          y: top,
          width: Math.min(page.viewportSize()?.width ?? 1280, 1280),
          height: Math.max(80, bottom - top),
        },
      });
      return filePath;
    }
    await tabs.screenshot({ path: filePath, animations: "disabled" });
    return filePath;
  }

  const cardTitles = options?.cardTitles ?? [];
  if (cardTitles.length > 0) {
    const firstCard = page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: cardTitles[0] }) })
      .first();
    const tabsBox = await tabs.boundingBox();
    const cardBox = await firstCard.boundingBox().catch(() => null);
    if (tabsBox && cardBox) {
      const top = Math.max(0, Math.min(tabsBox.y - 100, cardBox.y - 24));
      const bottom = Math.min(
        (page.viewportSize()?.height ?? 900) + top,
        cardBox.y + Math.min(cardBox.height, 280) + 48,
      );
      await page.screenshot({
        path: filePath,
        animations: "disabled",
        clip: {
          x: 0,
          y: top,
          width: Math.min(page.viewportSize()?.width ?? 1280, 1280),
          height: Math.max(120, bottom - top),
        },
      });
      return filePath;
    }
  }

  // Fallback: tabs chrome only (never full-page customer tables).
  await tabs.screenshot({ path: filePath, animations: "disabled" });
  return filePath;
}
