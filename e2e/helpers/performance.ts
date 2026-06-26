import { expect, type Page } from "@playwright/test";

/** Soft budget for public marketing pages (ms). Tune via FI_E2E_PERF_BUDGET_MS. */
export function publicPageLoadBudgetMs(): number {
  const raw = process.env.FI_E2E_PERF_BUDGET_MS?.trim();
  const parsed = raw ? Number(raw) : 8_000;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8_000;
}

/**
 * Measures navigation time to domcontentloaded. Fails only when over budget —
 * intended as a regression guard, not a load-test substitute.
 */
export async function expectPageLoadsWithinBudget(
  page: Page,
  path: string,
  budgetMs = publicPageLoadBudgetMs(),
): Promise<number> {
  const started = Date.now();
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  const elapsed = Date.now() - started;

  expect(response?.status() ?? 0, `${path} should respond`).toBeLessThan(400);
  expect(
    elapsed,
    `${path} domcontentloaded should be under ${budgetMs}ms (got ${elapsed}ms)`,
  ).toBeLessThanOrEqual(budgetMs);

  return elapsed;
}
