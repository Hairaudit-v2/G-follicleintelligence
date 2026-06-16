/**
 * Exercises `loadOperationalCalendarPageData` like calendar navigations (server-only).
 * Mirrors `[fi-calendar/server]` payload fields for clinic-scale smoke checks without a browser.
 *
 * Usage (from repo root):
 *
 *   node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs scripts/calendar-loader-perf-smoke.ts <tenantUuid>
 *
 * Requires `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (e.g. from `.env.local`).
 * Optional: `CALENDAR_PERF_ANCHOR=2026-06-15` (clinic-local YMD).
 */
import fs from "node:fs";
import path from "node:path";

import { loadOperationalCalendarPageData } from "@/src/lib/calendar/operationalCalendarLoader.server";

function loadDotEnvLocalSync(): void {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  const raw = fs.readFileSync(p, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

type Scenario = { label: string; searchParams: Record<string, string | string[] | undefined> };

async function run(): Promise<void> {
  loadDotEnvLocalSync();

  const tenantId = (process.argv[2] ?? process.env.CALENDAR_PERF_TENANT_ID ?? "").trim();
  if (!tenantId) {
    console.error(
      "Usage: node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs scripts/calendar-loader-perf-smoke.ts <tenantUuid>\n" +
        "Or set CALENDAR_PERF_TENANT_ID in the environment / .env.local"
    );
    process.exit(1);
  }

  const ymd = (process.env.CALENDAR_PERF_ANCHOR ?? "2026-06-15").trim();
  const monthNextDate = ymd.startsWith("2026-06") ? "2026-07-10" : ymd;
  const monthPrevDate = ymd.startsWith("2026-06") ? "2026-05-10" : ymd;
  const scenarios: Scenario[] = [
    { label: "week-default", searchParams: { date: ymd } },
    { label: "month", searchParams: { view: "month", date: ymd } },
    { label: "month-next", searchParams: { view: "month", date: monthNextDate } },
    { label: "month-prev", searchParams: { view: "month", date: monthPrevDate } },
    { label: "day", searchParams: { view: "day", date: ymd } },
  ];

  console.info("[calendar-loader-perf-smoke] tenant=%s anchor=%s\n", tenantId, ymd);

  for (const s of scenarios) {
    console.info("\n>>> scenario:", s.label);
    await loadOperationalCalendarPageData(tenantId, s.searchParams, { route: "fi-admin" });
  }

  console.info(
    "\nEach scenario prints one [fi-calendar/server] line from the loader (duration, returnedBookingCount, listTruncated, hitOverlapDbCap, monthSummaryMode).\n" +
      "Browser manual pass: NEXT_PUBLIC_FI_CALENDAR_PERF=1 — count [fi-calendar/client:calendar-hydrate] on navigation only; drawer/panel toggles should not add hydrates."
  );
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
