/**
 * FI OS loader profile harness — measures cold/warm loads across operational surfaces.
 *
 * Usage:
 *   node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs scripts/fi-os-profile-loaders.mjs <tenantUuid>
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
process.env.FI_PERF_DIAGNOSTICS_ENABLED = "1";

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "react") {
    const real = originalLoad.call(this, request, parent, isMain);
    return { ...real, cache: (fn) => fn };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const tenantId = (process.argv[2] ?? process.env.FI_SMOKE_TENANT_ID ?? "").trim();
if (!tenantId) {
  console.error("Usage: fi-os-profile-loaders.mjs <tenantUuid>");
  process.exit(1);
}

async function timed(label, fn) {
  const t0 = performance.now();
  const result = await fn();
  const ms = Math.round(performance.now() - t0);
  const bytes = result == null ? 0 : JSON.stringify(result).length;
  return { label, ms, bytes };
}

const { loadReceptionBoardShellPayload, loadReceptionBoardCommandCenterPayload } = await import(
  "../src/lib/receptionBoard/receptionBoard.server.ts"
);
const { loadOperationalCalendarShellData } = await import(
  "../src/lib/calendar/operationalCalendarLoader.server.ts"
);
const { loadPatientDetailPayload } = await import("../src/lib/patients/patientDetailLoader.ts");
const { loadCalendarOperationalFeed } = await import(
  "../src/lib/calendar/calendarOperationalFeed.server.ts"
);
const { loadProcedureDayBoardPayload } = await import(
  "../src/lib/surgery/procedureDayBoardLoader.server.ts"
);
const { loadClinicOsGlobalSearchResults } = await import(
  "../src/lib/fiAdmin/clinicOsGlobalSearchLoader.server.ts"
);
const { loadClinicalStaffPickerCached, loadTenantRoomsCached } = await import(
  "../src/lib/performance/referenceDataCache.server.ts"
);

const anchor = new Date().toISOString().slice(0, 10);
const results = [];

results.push(
  await timed("reception.shell", () => loadReceptionBoardShellPayload(tenantId, new Date()))
);
results.push(
  await timed("reception.shell.warm", () => loadReceptionBoardShellPayload(tenantId, new Date()))
);
results.push(
  await timed("reception.full", () =>
    loadReceptionBoardCommandCenterPayload(tenantId, new Date(), { tier: "full" })
  )
);
results.push(
  await timed("calendar.shell", () =>
    loadOperationalCalendarShellData(tenantId, { date: anchor }, { route: "fi-admin" })
  )
);
results.push(
  await timed("calendar.feed", () =>
    loadCalendarOperationalFeed(
      tenantId,
      { date: anchor, view: "week" },
      { staffNameById: {}, roomLabelById: {}, staffIdByUserId: new Map() },
      { enforceCrmReadGate: false }
    )
  )
);

const { supabaseAdmin } = await import("../lib/supabaseAdmin.ts");
const { data: patientRow } = await supabaseAdmin()
  .from("fi_patients")
  .select("id")
  .eq("tenant_id", tenantId)
  .limit(1)
  .maybeSingle();

if (patientRow?.id) {
  try {
    results.push(
      await timed("patient.profile", () =>
        loadPatientDetailPayload(tenantId, String(patientRow.id), { tab: "overview" })
      )
    );
  } catch (e) {
    results.push({
      label: "patient.profile",
      ms: 0,
      bytes: 0,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

results.push(
  await timed("procedureDay.board", () => loadProcedureDayBoardPayload(tenantId, new Date()))
);

results.push(
  await timed("surgeryBooking.wizardContext", async () => {
    const [staff, rooms] = await Promise.all([
      loadClinicalStaffPickerCached(tenantId),
      loadTenantRoomsCached(tenantId),
    ]);
    return { staffCount: staff.length, roomCount: rooms.length };
  })
);

results.push(
  await timed("search.global", () => loadClinicOsGlobalSearchResults(tenantId, "smith"))
);

const budgets = {
  "reception.shell": 2000,
  "calendar.shell": 2000,
  "patient.profile": 2000,
  "procedureDay.board": 2000,
  "surgeryBooking.wizardContext": 500,
  "search.global": 500,
};

const summary = results.map((r) => ({
  ...r,
  kb: Math.round(r.bytes / 1024),
  budgetMs: budgets[r.label] ?? null,
  withinBudget: budgets[r.label] == null ? null : r.ms <= budgets[r.label],
}));

console.log(JSON.stringify({ tenantId, results: summary }, null, 2));