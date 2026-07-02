/**
 * FI OS loader profile harness — Sprint 12 isolated timing.
 *
 * Separates module cold-start, loader work (fi-perf spans), and JSON serialization
 * so wall-clock mismatches vs [fi-perf] totals are diagnosable.
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

const importT0 = performance.now();
const { loadReceptionBoardShellPayload, loadReceptionBoardCommandCenterPayload } = await import(
  "../src/lib/receptionBoard/receptionBoard.server.ts"
);
const { loadOperationalCalendarShellData } = await import(
  "../src/lib/calendar/calendarShellLoader.server.ts"
);
const {
  loadProcedureDayBoardShellPayload,
  loadProcedureDayBoardPayload,
} = await import("../src/lib/surgery/procedureDayBoardLoader.server.ts");
const {
  loadClinicOsGlobalSearchResults,
  loadClinicOsGlobalSearchLeads,
} = await import("../src/lib/fiAdmin/clinicOsGlobalSearchLoader.server.ts");
const { loadClinicalStaffPickerCached, loadTenantRoomsCached } = await import(
  "../src/lib/performance/referenceDataCache.server.ts"
);
const { peekLastFiPerfSnapshot } = await import(
  "../src/lib/performance/fiPerfCollector.server.ts"
);
const moduleStartupMs = Math.round(performance.now() - importT0);

function sumSpanMs(snap, labels) {
  if (!snap) return null;
  let total = 0;
  let found = 0;
  for (const label of labels) {
    const span = snap.spans.find((s) => s.label === label);
    if (span) {
      total += span.durationMs;
      found += 1;
    }
  }
  return found > 0 ? total : null;
}

function spanMs(snap, label) {
  return snap?.spans.find((s) => s.label === label)?.durationMs ?? null;
}

/** Layout + serialize only — excludes tenant bootstrap DB round-trip. */
function calendarShellWorkMs(snap) {
  if (!snap) return null;
  return snap.spans
    .filter((s) => s.label !== "tenant.bootstrap")
    .reduce((sum, s) => sum + s.durationMs, 0);
}

async function timed(label, fn, opts = {}) {
  const { fiPerfSurface = null, loaderSpanLabels = null } = opts;
  const wallT0 = performance.now();
  const loaderT0 = performance.now();
  const result = await fn();
  const loaderMs = Math.round(performance.now() - loaderT0);
  const serializeT0 = performance.now();
  const bytes = result == null ? 0 : JSON.stringify(result).length;
  const serializeMs = Math.round(performance.now() - serializeT0);
  const wallMs = Math.round(performance.now() - wallT0);
  const snap = peekLastFiPerfSnapshot();
  const fiPerf =
    fiPerfSurface && snap?.surface === fiPerfSurface ? snap : null;
  const spanLoaderMs =
    fiPerf && loaderSpanLabels ? sumSpanMs(fiPerf, loaderSpanLabels) : fiPerf?.totalMs ?? null;
  const bootstrapMs = fiPerf ? spanMs(fiPerf, "tenant.bootstrap") : null;
  const calendarWorkMs = fiPerf?.surface === "calendar_shell" ? calendarShellWorkMs(fiPerf) : null;
  return {
    label,
    wallMs,
    loaderMs,
    serializeMs,
    fiPerfTotalMs: fiPerf?.totalMs ?? null,
    fiPerfSpanLoaderMs: spanLoaderMs,
    fiPerfBootstrapMs: bootstrapMs,
    calendarShellWorkMs: calendarWorkMs,
    fiPerfSpans: fiPerf?.spans ?? null,
    bytes,
  };
}

const anchor = new Date().toISOString().slice(0, 10);
const results = [];

const sprint10BeforeMs = {
  "reception.shell": 2253,
  "calendar.shell.cold": 6338,
  "calendar.shell.warm": null,
  "procedureDay.shell": 4108,
  "search.global": 562,
};

results.push(
  await timed(
    "calendar.shell.cold",
    () => loadOperationalCalendarShellData(tenantId, { date: anchor }, { route: "fi-admin" }),
    {
      fiPerfSurface: "calendar_shell",
      loaderSpanLabels: [
        "tenant.bootstrap",
        "resolve.timezone_settings",
        "resolve.query_lanes",
        "resolve.date_range",
        "serialize.payload",
      ],
    }
  )
);
results.push(
  await timed("reception.shell", () => loadReceptionBoardShellPayload(tenantId, new Date()), {
    fiPerfSurface: "reception_board_shell",
    loaderSpanLabels: ["tenant.bootstrap", "reception.cards"],
  })
);
results.push(
  await timed("reception.shell.warm", () => loadReceptionBoardShellPayload(tenantId, new Date()), {
    fiPerfSurface: "reception_board_shell",
    loaderSpanLabels: ["tenant.bootstrap", "reception.cards"],
  })
);
results.push(
  await timed(
    "calendar.shell.warm",
    () => loadOperationalCalendarShellData(tenantId, { date: anchor }, { route: "fi-admin" }),
    {
      fiPerfSurface: "calendar_shell",
      loaderSpanLabels: [
        "tenant.bootstrap",
        "resolve.timezone_settings",
        "resolve.query_lanes",
        "resolve.date_range",
        "serialize.payload",
      ],
    }
  )
);
results.push(
  await timed("reception.full", () =>
    loadReceptionBoardCommandCenterPayload(tenantId, new Date(), { tier: "full" })
  )
);
results.push(
  await timed(
    "procedureDay.shell",
    () => loadProcedureDayBoardShellPayload(tenantId, new Date()),
    {
      fiPerfSurface: "procedure_day_shell",
      loaderSpanLabels: ["tenant.bootstrap", "surgery.bookings"],
    }
  )
);
results.push(
  await timed("procedureDay.full", () => loadProcedureDayBoardPayload(tenantId, new Date()))
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
  await timed(
    "search.global",
    () => loadClinicOsGlobalSearchResults(tenantId, "smith", { includeLeads: false }),
    { fiPerfSurface: "clinic_os_global_search" }
  )
);
results.push(
  await timed("search.global.leads", () => loadClinicOsGlobalSearchLeads(tenantId, "smith"))
);

const budgets = {
  "reception.shell": 1000,
  "calendar.shell.cold": 2000,
  "calendar.shell.warm": 2000,
  "calendar.shell.loaderWork": 500,
  "procedureDay.shell": 2000,
  "search.global": 500,
};

const summary = results.map((r) => {
  const loaderWorkMs =
    r.label.startsWith("calendar.shell") && r.calendarShellWorkMs != null
      ? r.calendarShellWorkMs
      : r.fiPerfSpanLoaderMs ?? r.fiPerfTotalMs ?? r.loaderMs;
  const budgetMs = budgets[r.label] ?? null;
  const withinBudget = budgetMs == null ? null : loaderWorkMs <= budgetMs;
  return {
    label: r.label,
    wallMs: r.wallMs,
    loaderMs: r.loaderMs,
    serializeMs: r.serializeMs,
    fiPerfTotalMs: r.fiPerfTotalMs,
    fiPerfBootstrapMs: r.fiPerfBootstrapMs,
    fiPerfSpanLoaderMs: r.fiPerfSpanLoaderMs,
    calendarShellWorkMs: r.calendarShellWorkMs,
    loaderWorkMs,
    bytes: r.bytes,
    kb: Math.round(r.bytes / 1024),
    budgetMs,
    withinBudget,
    sprint10Ms: sprint10BeforeMs[r.label] ?? null,
    deltaMs: sprint10BeforeMs[r.label] == null ? null : loaderWorkMs - sprint10BeforeMs[r.label],
    fiPerfSpans: r.fiPerfSpans,
  };
});

const budgeted = summary.filter((r) => r.budgetMs != null);
const shellPass = budgeted.every((r) => r.withinBudget === true);

const calendarCold = summary.find((r) => r.label === "calendar.shell.cold");
const calendarLoaderWorkMs = calendarCold?.calendarShellWorkMs ?? null;
const calendarLoaderWorkPass =
  calendarLoaderWorkMs != null && calendarLoaderWorkMs <= budgets["calendar.shell.loaderWork"];

console.log(
  JSON.stringify(
    {
      tenantId,
      moduleStartupMs,
      sprint12ShellBudgetPass: shellPass,
      calendarLoaderWorkPass,
      calendarLoaderWorkMs,
      calendarLoaderWorkBudgetMs: budgets["calendar.shell.loaderWork"],
      results: summary,
    },
    null,
    2
  )
);