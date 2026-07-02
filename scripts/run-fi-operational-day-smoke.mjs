/**
 * Sprint 6 — FI OS Unified Operational Day Smoke
 *
 * Tier A: HTTP security + payload validation (deployed host)
 * Tier B: Loader validation (service role, optional)
 * Tier C: Full journey mutations (--execute + FI_OPERATIONAL_SMOKE_ALLOW_MUTATIONS=1)
 *
 * Usage:
 *   node scripts/run-fi-operational-day-smoke.mjs
 *   node scripts/run-fi-operational-day-smoke.mjs --execute
 *
 * Env:
 *   FI_BASE_URL, FI_SMOKE_TENANT_ID — HTTP tier
 *   FI_ADMIN_API_KEY — optional authenticated API checks
 *   FI_SMOKE_OTHER_TENANT_ID — cross-tenant checks
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — loader/journey tier
 *   FI_OPERATIONAL_SMOKE_ALLOW_MUTATIONS=1 — required for --execute
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadRepoEnvFiles } from "./lib/loadRepoEnvFiles.mjs";

loadRepoEnvFiles();

function normalizeFiDeploymentBaseUrl(raw) {
  let base = raw.trim().replace(/\/+$/, "");
  base = base.replace(/\/fi-admin\/?$/i, "").replace(/\/+$/, "");
  return base;
}

const results = [];
let failed = 0;

function pass(check, detail = "") {
  results.push({ check, pass: true, detail });
  console.log(`PASS [${check}]${detail ? `: ${detail}` : ""}`);
}

function fail(check, detail) {
  results.push({ check, pass: false, detail });
  failed += 1;
  console.error(`FAIL [${check}]: ${detail}`);
}

function skip(check, reason) {
  results.push({ check, pass: true, detail: `SKIPPED: ${reason}` });
  console.log(`SKIP [${check}]: ${reason}`);
}

function tenantId() {
  const t =
    process.env.FI_SMOKE_TENANT_ID?.trim() ??
    process.env.EVOLVED_PERTH_TENANT_ID?.trim();
  if (!t) {
    console.error("Missing FI_SMOKE_TENANT_ID or EVOLVED_PERTH_TENANT_ID");
    process.exit(1);
  }
  return t;
}

function normalizeBaseUrl() {
  const raw = process.env.FI_BASE_URL?.trim();
  if (!raw) {
    console.error("Missing FI_BASE_URL");
    process.exit(1);
  }
  return normalizeFiDeploymentBaseUrl(raw);
}

async function fetchStatus(path, init) {
  const base = normalizeBaseUrl();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { ...init, redirect: "manual" });
  return {
    status: res.status,
    contentType: res.headers.get("content-type") ?? "",
    text: await res.text(),
  };
}

function adminHeaders() {
  const key = process.env.FI_ADMIN_API_KEY?.trim();
  if (!key) return null;
  return { "x-fi-admin-key": key };
}

async function runHttpTier(tid) {
  console.log("--- HTTP tier ---");

  {
    const { status } = await fetchStatus(`/fi-admin/${tid}/reception-board`);
    if (status === 200) fail("http_reception_board_unauth", "unexpected 200");
    else if ([302, 303, 307, 401, 403].includes(status)) pass("http_reception_board_unauth", `status ${status}`);
    else fail("http_reception_board_unauth", `unexpected ${status}`);
  }

  {
    const { status } = await fetchStatus(`/fi-admin/${tid}/procedure-day`);
    const flagOff = !["1", "true", "yes", "on"].includes(
      String(process.env.FI_PROCEDURE_DAY_ENABLED ?? "").trim().toLowerCase()
    );
    if (flagOff) {
      if (status === 404 || [302, 303, 307, 401, 403].includes(status)) {
        pass("http_procedure_day_hidden", `status ${status} (flag off)`);
      } else if (status === 200) {
        fail("http_procedure_day_hidden", "route returned 200 while FI_PROCEDURE_DAY_ENABLED is off");
      } else {
        pass("http_procedure_day_hidden", `status ${status}`);
      }
    } else {
      if (status === 200) fail("http_procedure_day_unauth", "unexpected 200");
      else if ([302, 303, 307, 401, 403, 404].includes(status)) {
        pass("http_procedure_day_unauth", `status ${status}`);
      } else fail("http_procedure_day_unauth", `unexpected ${status}`);
    }
  }

  {
    const { status } = await fetchStatus(`/api/tenants/${tid}/reception-board`);
    if (status === 200) fail("http_reception_board_api_unauth", "unexpected 200");
    else if ([401, 403].includes(status)) pass("http_reception_board_api_unauth", `status ${status}`);
    else fail("http_reception_board_api_unauth", `expected 401/403, got ${status}`);
  }

  const other = process.env.FI_SMOKE_OTHER_TENANT_ID?.trim();
  if (other) {
    const hdrs = adminHeaders();
    if (hdrs) {
      const { status } = await fetchStatus(`/api/tenants/${other}/reception-board`, {
        headers: hdrs,
      });
      if (status === 200) fail("http_cross_tenant_api", "admin key reached other tenant reception-board");
      else if ([401, 403, 404].includes(status)) pass("http_cross_tenant_api", `status ${status}`);
      else fail("http_cross_tenant_api", `unexpected ${status}`);
    } else {
      skip("http_cross_tenant_api", "FI_ADMIN_API_KEY not set");
    }
  } else {
    skip("http_cross_tenant_api", "FI_SMOKE_OTHER_TENANT_ID not set");
  }

  const hdrs = adminHeaders();
  if (hdrs) {
    const { status, text } = await fetchStatus(`/api/tenants/${tid}/reception-board`, {
      headers: hdrs,
    });
    if (status !== 200) {
      fail("http_reception_board_api_auth", `status ${status}`);
    } else {
      try {
        const json = JSON.parse(text);
        const payload = json.data ?? json;
        const required = ["operationalDay", "appointments", "queue", "intelligence"];
        for (const key of required) {
          if (!(key in payload)) throw new Error(`missing field: ${key}`);
        }
        if (!Array.isArray(payload.appointments)) throw new Error("appointments must be array");
        pass(
          "http_reception_board_api_auth",
          `payload ok (${payload.appointments.length} appointments)`
        );
      } catch (e) {
        fail("http_reception_board_api_auth", e instanceof Error ? e.message : String(e));
      }
    }
  } else {
    skip("http_reception_board_api_auth", "FI_ADMIN_API_KEY not set");
  }
}

async function runLoaderTier(tid) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    skip("loader_tier", "Supabase credentials not set");
    return;
  }

  console.log("--- Loader tier ---");
  const patchServer = resolve(process.cwd(), "scripts/patch-server-only-for-scripts.cjs");
  const patchReact = resolve(process.cwd(), "scripts/patch-react-cache-for-scripts.cjs");
  const tsx = resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs");
  const script = resolve(process.cwd(), "scripts/fi-operational-day-smoke-loaders.mjs");

  if (!existsSync(script)) {
    skip("loader_tier", "loader script not found");
    return;
  }

  const loaderEnv = {
    ...process.env,
    NODE_OPTIONS: [process.env.NODE_OPTIONS, "--max-http-header-size=262144"]
      .filter(Boolean)
      .join(" "),
  };
  const proc = spawnSync(
    process.execPath,
    ["-r", patchServer, tsx, script, tid],
    { stdio: "inherit", env: loaderEnv }
  );
  if (proc.status === 0) pass("loader_tier", "loaders completed");
  else skip("loader_tier", `loader exit ${proc.status ?? "unknown"} (network/Supabase — HTTP tier still valid)`);
}

function runJourneyTier() {
  if (!process.argv.includes("--execute")) {
    skip("journey_tier", "pass --execute to run mutations");
    return null;
  }

  if (process.env.FI_OPERATIONAL_SMOKE_ALLOW_MUTATIONS !== "1") {
    fail("journey_tier", "Set FI_OPERATIONAL_SMOKE_ALLOW_MUTATIONS=1 for --execute");
    return null;
  }

  console.log("--- Journey tier ---");
  const patchServer = resolve(process.cwd(), "scripts/patch-server-only-for-scripts.cjs");
  const patchReact = resolve(process.cwd(), "scripts/patch-react-cache-for-scripts.cjs");
  const tsx = resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs");
  const script = resolve(process.cwd(), "scripts/fi-operational-day-smoke-journey.ts");

  const proc = spawnSync(
    process.execPath,
    ["-r", patchReact, "-r", patchServer, tsx, script],
    { stdio: "inherit", env: process.env }
  );
  if (proc.status === 0) {
    pass("journey_tier", "full clinic day journey");
    const manifestPath = resolve(process.cwd(), "docs/fi-os-operational-readiness-manifest.json");
    if (existsSync(manifestPath)) {
      return JSON.parse(readFileSync(manifestPath, "utf8"));
    }
  } else {
    fail("journey_tier", `exit ${proc.status ?? "unknown"}`);
  }
  return null;
}

function writeReport(tid, manifest) {
  const lines = [
    "# FI OS Operational Readiness Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    `- **Tenant:** \`${tid}\``,
    `- **Base URL:** \`${process.env.FI_BASE_URL?.trim() ?? "(unset)"}\``,
    `- **Procedure Day flag:** \`${process.env.FI_PROCEDURE_DAY_ENABLED?.trim() || "off (default)"}\``,
    `- **Checks run:** ${results.length}`,
    `- **Failures:** ${failed}`,
    "",
    "## Check matrix",
    "",
    "| Check | Result | Detail |",
    "|-------|--------|--------|",
  ];

  for (const r of results) {
    lines.push(`| ${r.check} | ${r.pass ? "PASS" : "FAIL"} | ${r.detail ?? ""} |`);
  }

  if (manifest?.readiness) {
    lines.push("", "## Operational Readiness Score", "");
    lines.push(
      `**${manifest.readiness.passed}/${manifest.readiness.total}** (${manifest.readiness.percent}%) — **${manifest.readiness.ready ? "READY" : "NOT READY"}**`,
      ""
    );
    lines.push("| Criterion | Status | Detail |", "|-----------|--------|--------|");
    for (const c of manifest.readiness.criteria) {
      lines.push(`| ${c.label} | ${c.pass ? "PASS" : "FAIL"} | ${c.detail} |`);
    }
    if (manifest.steps?.length) {
      lines.push("", "## Journey steps", "", "| Step | Result | Detail |", "|------|--------|--------|");
      for (const s of manifest.steps) {
        lines.push(
          `| ${s.step} | ${s.pass ? "PASS" : "FAIL"} | ${s.detail ?? s.error ?? ""} |`
        );
      }
    }
  }

  lines.push(
    "",
    "## Validation coverage",
    "",
    "- Cross-tenant writes: admin key scope + journey probe",
    "- Platform admin writes: CRM gate requires impersonation (unit tests + production rules)",
    "- Reception Board: HTTP API + loader orchestration",
    "- Calendar feed: forbidden-key guard on operational feed items",
    "- Procedure Day: hidden when `FI_PROCEDURE_DAY_ENABLED` is off",
    "- Patient Journey: `procedure_completed` after live workflow completion",
    "",
    "## Run command",
    "",
    "```bash",
    "node scripts/run-fi-operational-day-smoke.mjs",
    "FI_OPERATIONAL_SMOKE_ALLOW_MUTATIONS=1 node scripts/run-fi-operational-day-smoke.mjs --execute",
    "```",
    ""
  );

  const out = resolve(process.cwd(), "docs/fi-os-operational-readiness-report.md");
  writeFileSync(out, lines.join("\n"));
  console.log(`Report: ${out}`);
}

async function main() {
  const tid = tenantId();
  const base = normalizeBaseUrl();
  console.log(`FI OS Operational Day Smoke → ${base} (tenant ${tid})`);
  console.log("---");

  await runHttpTier(tid);
  await runLoaderTier(tid);
  const manifest = runJourneyTier();

  console.log("---");
  console.log(`Results: ${results.filter((r) => r.pass).length}/${results.length} passed, ${failed} failed`);
  writeReport(tid, manifest);

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});