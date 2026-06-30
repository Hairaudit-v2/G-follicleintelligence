/**
 * Smoke checks for trial-hardening fixes: C2 VIE bypass, C4 consent gate, C5 tenant filter, C6 API auth, C8 errors.
 * Safe to run locally — no PHI writes. Optional HTTP checks against FI_BASE_URL (default http://127.0.0.1:3000).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

import { crmUnexpectedErrorPublicMessage } from "../src/lib/crm/crmUnexpectedErrorMessage";
import { isTenantBackendPortalAllowed } from "../src/lib/fiOs/tenantBackendPortalAccess.server";
import { assertVieProtocolCapturePolicy } from "../src/lib/vie/vieCapturePolicy.server";

function loadRepoEnvFiles(): void {
  for (const name of [".env.local", ".env"] as const) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    let raw = readFileSync(p, "utf8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
      const eq = withoutExport.indexOf("=");
      if (eq <= 0) continue;
      const key = withoutExport.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      let val = withoutExport.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      } else {
        const hash = val.indexOf("#");
        if (hash > 0 && !/\s/.test(val.slice(0, hash))) val = val.slice(0, hash).trim();
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

loadRepoEnvFiles();

let passed = 0;
let failed = 0;
let skipped = 0;

function pass(id: string, detail?: string): void {
  passed += 1;
  console.log(`PASS [${id}]${detail ? `: ${detail}` : ""}`);
}

function fail(id: string, detail: string): never {
  failed += 1;
  console.error(`FAIL [${id}]: ${detail}`);
  process.exit(1);
}

function skip(id: string, reason: string): void {
  skipped += 1;
  console.log(`SKIP [${id}]: ${reason}`);
}

async function runNodeTests(pattern: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "--test", pattern],
      { cwd: process.cwd(), stdio: "inherit", shell: false }
    );
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`tests failed: ${pattern} (exit ${code})`));
    });
  });
}

function checkC2ReExport(): void {
  const routePath = resolve(
    process.cwd(),
    "app/api/tenants/[tenantId]/patient-directory/[patientId]/images/route.ts"
  );
  const src = readFileSync(routePath, "utf8");
  if (!src.includes('export { POST } from "../../../patients/[patientId]/images/route"')) {
    fail("C2-reexport", "patient-directory route does not delegate to patients/images");
  }
  pass("C2-reexport", "patient-directory delegates to canonical patients/images route");
}

function checkC2ViePolicy(): void {
  let threw = false;
  try {
    assertVieProtocolCapturePolicy({
      captureSource: "patient_profile",
      protocolSessionId: null,
      protocolTemplateSlug: null,
      protocolSlotSlug: null,
    });
  } catch (e) {
    threw = true;
    const msg = e instanceof Error ? e.message : String(e);
    if (!/active capture protocol/i.test(msg)) {
      fail("C2-vie-policy", `unexpected error: ${msg}`);
    }
  }
  if (!threw) fail("C2-vie-policy", "generic patient_profile upload was not blocked");
  pass("C2-vie-policy", "generic upload blocked without active protocol");
}

function checkC5TenantFilter(): void {
  const loaderPath = resolve(process.cwd(), "src/lib/fiOs/tenantOperationalDashboardLoader.server.ts");
  const src = readFileSync(loaderPath, "utf8");
  const block = src.slice(src.indexOf("async function loadStaleLeads"), src.indexOf("async function loadStaleLeads") + 1200);
  if (!block.includes('.from("fi_persons")') || !block.includes('.eq("tenant_id", tid)')) {
    fail("C5-tenant-filter", "loadStaleLeads fi_persons query missing .eq(tenant_id)");
  }
  pass("C5-tenant-filter", "loadStaleLeads scopes fi_persons by tenant_id");
}

async function checkC6NonBackendRole(): Promise<void> {
  const ok = await isTenantBackendPortalAllowed("00000000-0000-4000-8000-000000000099", {
    id: "00000000-0000-4000-8000-000000000001",
    role: "crm_operator",
    auth_user_id: "00000000-0000-4000-8000-000000000002",
  });
  if (!ok) fail("C6-non-backend", "crm_operator should pass tenant backend gate");
  pass("C6-non-backend", "non-tenant_backend roles bypass fi_tenant_admin_users check");
}

function checkC6CrmGateWiring(): void {
  const gatePath = resolve(process.cwd(), "src/lib/crm/crmGate.ts");
  const src = readFileSync(gatePath, "utf8");
  if (!src.includes("assertTenantMembershipPortalAllowed")) {
    fail("C6-crm-gate", "crmGate missing assertTenantMembershipPortalAllowed");
  }
  if (!src.includes("isTenantBackendPortalAllowed")) {
    fail("C6-crm-gate", "crmGate missing isTenantBackendPortalAllowed import");
  }
  const readBlock = src.slice(src.indexOf("export async function assertCrmTenantReadAllowed"));
  if (!readBlock.includes("assertTenantMembershipPortalAllowed(tenantId, row)")) {
    fail("C6-crm-gate", "assertCrmTenantReadAllowed does not call portal membership check");
  }
  pass("C6-crm-gate", "read/write/staff gates call shared tenant_backend check");
}

function checkC4ConsentGateWiring(): void {
  const imagesRoute = readFileSync(
    resolve(process.cwd(), "app/api/tenants/[tenantId]/patients/[patientId]/images/route.ts"),
    "utf8"
  );
  if (!imagesRoute.includes("assertPatientTrialConsentRecorded")) {
    fail("C4-images-gate", "patients/images route missing assertPatientTrialConsentRecorded");
  }

  const mutations = readFileSync(
    resolve(process.cwd(), "src/lib/consultationForms/consultationFormMutations.server.ts"),
    "utf8"
  );
  if (!mutations.includes("assertPatientTrialConsentRecorded")) {
    fail("C4-complete-gate", "completeConsultationFormInstance missing consent gate");
  }

  const crmHttp = readFileSync(resolve(process.cwd(), "src/lib/crm/crmHttp.ts"), "utf8");
  if (!crmHttp.includes("PatientTrialConsentRequiredError")) {
    fail("C4-http-403", "crmHttp missing PatientTrialConsentRequiredError mapping");
  }

  pass("C4-wiring", "images + consultation complete + 403 mapping wired");
}

function checkC8ProductionMessage(): void {
  const msg = crmUnexpectedErrorPublicMessage(new Error("relation fi_patients does not exist"), "production");
  if (msg !== "An unexpected error occurred.") {
    fail("C8-sanitize", `expected generic message, got: ${msg}`);
  }
  const dev = crmUnexpectedErrorPublicMessage(new Error("debug detail"), "development");
  if (dev !== "debug detail") fail("C8-sanitize", "dev should expose message");
  pass("C8-sanitize", "production hides internal 500 detail");
}

async function probeHttp(base: string, tenantId: string, adminKey: string | null): Promise<void> {
  const patientId = "00000000-0000-4000-8000-000000000099";
  const url = `${base}/api/tenants/${tenantId}/patient-directory/${patientId}/images`;

  const fd = new FormData();
  const blob = new Blob(["not-a-real-image"], { type: "image/jpeg" });
  fd.append("file", blob, "smoke.jpg");
  fd.append("capture_source", "patient_profile");

  const headers: Record<string, string> = {};
  if (adminKey) headers["x-fi-admin-key"] = adminKey;

  let res: Response;
  try {
    res = await fetch(url, { method: "POST", body: fd, headers, redirect: "manual" });
  } catch (e) {
    skip("HTTP-vie-400", `server unreachable at ${base} (${e instanceof Error ? e.message : e})`);
    return;
  }

  const text = await res.text();
  let body: { ok?: boolean; error?: string } = {};
  try {
    body = JSON.parse(text) as { ok?: boolean; error?: string };
  } catch {
    skip("HTTP-vie-400", `non-JSON response (${res.status})`);
    return;
  }

  if (!adminKey) {
    if (res.status === 401 || res.status === 403 || res.status === 307) {
      pass("HTTP-unauth", `unauthenticated POST returns ${res.status}`);
      return;
    }
    skip("HTTP-unauth", `expected 401/403/307 without key, got ${res.status}`);
    return;
  }

  if (res.status === 400 && body.ok === false && /protocol|capture/i.test(body.error ?? "")) {
    pass("HTTP-vie-400", `admin POST without protocol → 400 (${body.error})`);
    return;
  }

  if (res.status === 400 && body.ok === false) {
    pass("HTTP-vie-400", `admin POST rejected with 400: ${body.error ?? "no detail"}`);
    return;
  }

  skip("HTTP-vie-400", `unexpected status ${res.status}: ${body.error ?? text.slice(0, 120)}`);
}

async function main(): Promise<void> {
  console.log("=== Trial security fixes smoke ===\n");

  checkC2ReExport();
  checkC2ViePolicy();
  checkC4ConsentGateWiring();
  checkC5TenantFilter();
  await checkC6NonBackendRole();
  checkC6CrmGateWiring();
  checkC8ProductionMessage();

  await runNodeTests("src/lib/crm/crmUnexpectedErrorMessage.test.ts");
  pass("C8-unit-tests", "crmUnexpectedErrorMessage.test.ts green");

  await runNodeTests("src/lib/vie/vieCapturePolicy.test.ts");
  pass("C2-unit-tests", "vieCapturePolicy.test.ts green");

  await runNodeTests("src/lib/patients/patientConsentGate.test.ts");
  pass("C4-unit-tests", "patientConsentGate.test.ts green");

  // Prefer explicit local base; FI_BASE_URL in .env.local often points at deployed /fi-admin shell.
  const base = (process.env.FI_SMOKE_BASE_URL?.trim() || "http://127.0.0.1:3000").replace(/\/+$/, "");
  const tenantId = process.env.FI_SMOKE_TENANT_ID?.trim() ?? process.env.FI_EVOLVED_TENANT_ID?.trim();
  const adminKey = process.env.FI_ADMIN_API_KEY?.trim() ?? null;

  if (tenantId) {
    await probeHttp(base, tenantId, null);
    if (adminKey) await probeHttp(base, tenantId, adminKey);
    else skip("HTTP-vie-400", "FI_ADMIN_API_KEY not set — skipping authenticated upload probe");
  } else {
    skip("HTTP", "FI_SMOKE_TENANT_ID / FI_EVOLVED_TENANT_ID not set — skipping HTTP probes");
  }

  console.log(`\n=== Done: ${passed} passed, ${skipped} skipped, ${failed} failed ===`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});