/**
 * Loader validation tier for operational day smoke.
 */
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";

function loadDotEnvLocalSync() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
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

loadDotEnvLocalSync();

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "react") {
    const real = originalLoad.call(this, request, parent, isMain);
    return { ...real, cache: (fn) => fn };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const tenantId = (
  process.argv[2] ??
  process.env.FI_SMOKE_TENANT_ID ??
  process.env.EVOLVED_PERTH_TENANT_ID ??
  ""
).trim();

if (!tenantId) {
  console.error("Usage: fi-operational-day-smoke-loaders.mjs <tenantUuid>");
  process.exit(1);
}

const anchor = process.env.CALENDAR_PERF_ANCHOR?.trim() || new Date().toISOString().slice(0, 10);

const { loadCalendarOperationalFeed } = await import(
  "../src/lib/calendar/calendarOperationalFeed.server.ts"
);
const { CALENDAR_OPERATIONAL_FEED_FORBIDDEN_KEYS } = await import(
  "../src/lib/calendarIntelligence/calendarIntelligenceTypes.ts"
);
const { loadReceptionBoardCommandCenterPayload } = await import(
  "../src/lib/receptionBoard/receptionBoard.server.ts"
);
const { readFiProcedureDayEnabled } = await import(
  "../src/lib/procedureDay/procedureDayEnv.server.ts"
);
const { appendProcedureDayQuickActionIfEnabled } = await import(
  "../src/lib/procedureDay/procedureDayReceptionCore.ts"
);

const RECEPTION_SHELL_COLD_BUDGET_MS = 2_000;
const RECEPTION_SHELL_WARM_BUDGET_MS = 500;
const RECEPTION_FULL_COLD_BUDGET_MS = 15_000;
const CALENDAR_FEED_BUDGET_MS = 3_000;

const t0 = performance.now();
const reception = await loadReceptionBoardCommandCenterPayload(tenantId, new Date(), {
  tier: "shell",
});
const receptionColdMs = Math.round(performance.now() - t0);

const tWarm = performance.now();
await loadReceptionBoardCommandCenterPayload(tenantId, new Date(), { tier: "shell" });
const receptionWarmMs = Math.round(performance.now() - tWarm);

const tFull = performance.now();
await loadReceptionBoardCommandCenterPayload(tenantId, new Date(), { tier: "full" });
const receptionFullMs = Math.round(performance.now() - tFull);

if (!reception.operationalDay) throw new Error("Reception payload missing operationalDay");
if (!Array.isArray(reception.appointments)) throw new Error("Reception payload missing appointments");

if (receptionColdMs > RECEPTION_SHELL_COLD_BUDGET_MS) {
  console.warn(
    `WARN: reception shell cold ${receptionColdMs}ms exceeds ${RECEPTION_SHELL_COLD_BUDGET_MS}ms budget`
  );
}
if (receptionWarmMs > RECEPTION_SHELL_WARM_BUDGET_MS) {
  console.warn(
    `WARN: reception shell warm ${receptionWarmMs}ms exceeds ${RECEPTION_SHELL_WARM_BUDGET_MS}ms budget`
  );
}
if (receptionFullMs > RECEPTION_FULL_COLD_BUDGET_MS) {
  console.warn(
    `WARN: reception full cold ${receptionFullMs}ms exceeds ${RECEPTION_FULL_COLD_BUDGET_MS}ms budget`
  );
}

const adminBase = `/fi-admin/${tenantId}`;
const quickActions = appendProcedureDayQuickActionIfEnabled(
  reception.quickActions ?? [],
  adminBase,
  readFiProcedureDayEnabled()
);
if (readFiProcedureDayEnabled() && !quickActions.some((q) => q.href?.includes("procedure-day"))) {
  console.warn("WARN: Procedure Day enabled but quick action not present");
}
if (!readFiProcedureDayEnabled() && quickActions.some((q) => q.href?.includes("procedure-day"))) {
  throw new Error("Procedure Day quick action visible while flag is off");
}

const t1 = performance.now();
const feed = await loadCalendarOperationalFeed(
  tenantId,
  { date: anchor, view: "week" },
  { staffNameById: {}, roomLabelById: {}, staffIdByUserId: new Map() },
  { enforceCrmReadGate: false }
);
const feedMs = Math.round(performance.now() - t1);

if (feedMs > CALENDAR_FEED_BUDGET_MS) {
  console.warn(`WARN: calendar feed ${feedMs}ms exceeds ${CALENDAR_FEED_BUDGET_MS}ms budget`);
}

const forbidden = new Set(CALENDAR_OPERATIONAL_FEED_FORBIDDEN_KEYS);
let feedBytes = 0;
for (const item of feed.items) {
  feedBytes += JSON.stringify(item).length;
  for (const key of Object.keys(item)) {
    if (forbidden.has(key)) throw new Error(`Forbidden calendar feed key: ${key}`);
  }
}

console.log(
  JSON.stringify({
    receptionColdMs,
    receptionWarmMs,
    receptionFullMs,
    receptionMs: receptionColdMs,
    feedMs,
    feedItems: feed.items.length,
    feedBytes,
    appointments: reception.appointments.length,
    procedureDayEnabled: readFiProcedureDayEnabled(),
    budgets: {
      receptionShellColdMs: RECEPTION_SHELL_COLD_BUDGET_MS,
      receptionShellWarmMs: RECEPTION_SHELL_WARM_BUDGET_MS,
      receptionFullColdMs: RECEPTION_FULL_COLD_BUDGET_MS,
      feedMs: CALENDAR_FEED_BUDGET_MS,
    },
  })
);