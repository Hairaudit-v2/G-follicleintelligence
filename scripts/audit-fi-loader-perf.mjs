/**
 * Server-side loader timing audit (no browser). Uses service role from .env.local.
 *
 *   node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs scripts/audit-fi-loader-perf.mjs [tenantUuid]
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

// react.cache is Next-only; stub for standalone scripts.
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "react") {
    const real = originalLoad.call(this, request, parent, isMain);
    return { ...real, cache: (fn) => fn };
  }
  return originalLoad.call(this, request, parent, isMain);
};

async function timed(label, fn) {
  const t0 = performance.now();
  try {
    const result = await fn();
    const ms = Math.round(performance.now() - t0);
    const size = result == null ? 0 : JSON.stringify(result).length;
    console.log(JSON.stringify({ label, ok: true, ms, payloadBytes: size }));
    return { label, ok: true, ms, payloadBytes: size };
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    const msg = e instanceof Error ? e.message : String(e);
    console.log(JSON.stringify({ label, ok: false, ms, error: msg }));
    return { label, ok: false, ms, error: msg };
  }
}

const tenantId =
  (process.argv[2] ?? process.env.EVOLVED_PERTH_TENANT_ID ?? process.env.CALENDAR_PERF_TENANT_ID ?? "").trim();

if (!tenantId) {
  console.error("Usage: audit-fi-loader-perf.mjs <tenantUuid>");
  process.exit(1);
}

const { loadTenantOperationalDashboard } = await import(
  "../src/lib/fiOs/tenantOperationalDashboardLoader.server.ts"
);
const { loadOperationalCalendarShellData, loadOperationalCalendarGridData } = await import(
  "../src/lib/calendar/operationalCalendarLoader.server.ts"
);
const { loadAnalyticsOsDashboard } = await import("../src/lib/fiAdmin/analyticsOsDashboardRead.server.ts");
const { loadAnalyticsExecutiveDashboard } = await import(
  "../src/lib/analytics-os/analyticsExecutive.server.ts"
);
const { loadCrmShellLeadsBoardIndex, loadCrmShellPipelineStages } = await import(
  "../src/lib/crm/crmShellLoaders.ts"
);
const { loadFinancialOsCommandCentrePayload } = await import(
  "../src/lib/financialOs/financialOsCommandCentreLoader.server.ts"
);
const { loadReceptionOsCommandCentrePayload } = await import(
  "../src/lib/receptionOs/receptionOsCommandCentreLoader.server.ts"
);
const { loadEnterpriseDemoGlobalCommandCentrePayload } = await import(
  "../src/lib/enterprise-demo/enterpriseDemoGlobalCommandCentreLoader.server.ts"
);
const { loadFinancialOsInvoices } = await import(
  "../src/lib/financialOs/financialListLoaders.server.ts"
);

const { supabaseAdmin } = await import("../lib/supabaseAdmin.ts");

console.info(`[audit-fi-loader-perf] tenant=${tenantId}\n`);

for (const table of ["fi_crm_leads", "fi_bookings", "fi_cases", "fi_patients"]) {
  const { count, error } = await supabaseAdmin()
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  console.info(`[row-count] ${table}: ${error ? error.message : count}`);
}
console.info("");

const results = [];

results.push(
  await timed("home.dashboard (includeReceptionBoard)", () =>
    loadTenantOperationalDashboard(tenantId, { includeReceptionBoard: true })
  )
);

results.push(
  await timed("calendar.shell week-default", () =>
    loadOperationalCalendarShellData(tenantId, { date: "2026-06-15" }, { route: "fi-admin" })
  )
);

results.push(
  await timed("calendar.shell month", () =>
    loadOperationalCalendarShellData(
      tenantId,
      { view: "month", date: "2026-06-15" },
      { route: "fi-admin" }
    )
  )
);

results.push(
  await timed("calendar.grid week-default", () =>
    loadOperationalCalendarGridData(tenantId, { date: "2026-06-15" }, { route: "fi-admin" })
  )
);

results.push(
  await timed("calendar.grid month", () =>
    loadOperationalCalendarGridData(
      tenantId,
      { view: "month", date: "2026-06-15" },
      { route: "fi-admin" }
    )
  )
);

results.push(
  await timed("crm.pipelineStages", () => loadCrmShellPipelineStages(tenantId))
);

results.push(
  await timed("crm.leadsBoardIndex", () => loadCrmShellLeadsBoardIndex(tenantId, {}))
);

results.push(
  await timed("analytics.osDashboard", () =>
    loadAnalyticsOsDashboard(tenantId, { showCrmNav: true, showBookingsBoard: true })
  )
);

results.push(
  await timed("analytics.executiveDashboard", () => loadAnalyticsExecutiveDashboard(tenantId))
);

results.push(
  await timed("financial.commandCentre", () =>
    loadFinancialOsCommandCentrePayload(tenantId, new Date(), {}, {})
  )
);

results.push(
  await timed("reception.commandCentre", () =>
    loadReceptionOsCommandCentrePayload(tenantId, new Date(), { dryRunCommunications: true })
  )
);

results.push(
  await timed("enterprise.globalCommandCentre", () =>
    loadEnterpriseDemoGlobalCommandCentrePayload(tenantId)
  )
);

results.push(
  await timed("financial.invoices (limit 400)", () => loadFinancialOsInvoices(tenantId, 400))
);

const ok = results.filter((r) => r.ok);
const failed = results.filter((r) => !r.ok);

console.info("\n--- summary (slowest first) ---");
for (const r of [...ok].sort((a, b) => b.ms - a.ms)) {
  console.info(`${String(r.ms).padStart(5)}ms  ${r.label}  (~${Math.round(r.payloadBytes / 1024)}KB JSON)`);
}
if (failed.length) {
  console.info("\n--- failures ---");
  for (const r of failed) console.info(`${r.label}: ${r.error}`);
}