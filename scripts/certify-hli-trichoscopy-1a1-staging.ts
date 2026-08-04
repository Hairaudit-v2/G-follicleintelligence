/**
 * FI-TRICHOSCOPY-1A.1 — Live staging certification harness.
 *
 * Modes:
 *   --preflight                 Check env / stub detection; never mutate staging
 *   --init-run                  Create runs/<run-id>/ from the manifest template
 *   --execute-security-probes   POST invalid / expired / cross-tenant events to staging
 *
 * GREEN clinical round-trip (request → HLI lifecycle → pack → UI) is operator-supervised;
 * this harness certifies auth probes and scaffolds the evidence folder.
 *
 * Usage:
 *   npm run certify:trichoscopy-1a1 -- --preflight
 *   npm run certify:trichoscopy-1a1 -- --init-run
 *   npm run certify:trichoscopy-1a1 -- --execute-security-probes
 *
 * Required for security probes:
 *   FI_TRICHOSCOPY_CERT_BASE_URL (or FI_E2E_BASE_URL / NEXT_PUBLIC_SITE_URL)
 *   FI_ENABLE_HLI_TRICHOSCOPY=1
 *   HLI_TRICHOSCOPY_WEBHOOK_SECRET (or SIGNING_SECRET)
 *   FI_TRICHOSCOPY_CERT_TENANT_ID (or FI_E2E_TENANT_ID)
 *   FI_TRICHOSCOPY_CERT_OTHER_TENANT_ID (negative-control tenant UUID)
 *   HLI_TRICHOSCOPY_API_BASE_URL + SERVICE_KEY + SIGNING_SECRET (for live outbound preflight)
 */

import { createHash, createHmac, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

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
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

loadRepoEnvFiles();

const HDR_TENANT = "x-fi-tenant-id";
const HDR_REQUEST_ID = "x-fi-request-id";
const HDR_TIMESTAMP = "x-fi-timestamp";
const HDR_SIG_VERSION = "x-fi-signature-version";
const HDR_SIGNATURE = "x-fi-signature";

type StepResult = { id: string; ok: boolean; detail: string };

const results: StepResult[] = [];

function isAffirmative(raw: string | undefined): boolean {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function hostOnly(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return "[invalid-url]";
  }
}

function loadConfig() {
  const enabled = isAffirmative(process.env.FI_ENABLE_HLI_TRICHOSCOPY);
  const apiBaseUrl = process.env.HLI_TRICHOSCOPY_API_BASE_URL?.trim() || null;
  const serviceKey = process.env.HLI_TRICHOSCOPY_SERVICE_KEY?.trim() || null;
  const signingSecret = process.env.HLI_TRICHOSCOPY_SIGNING_SECRET?.trim() || null;
  const webhookSecret =
    process.env.HLI_TRICHOSCOPY_WEBHOOK_SECRET?.trim() || signingSecret;
  const useStub = !apiBaseUrl || !serviceKey || !signingSecret;
  const baseUrl = (
    process.env.FI_TRICHOSCOPY_CERT_BASE_URL ||
    process.env.FI_E2E_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    ""
  ).replace(/\/$/, "");
  const tenantId =
    process.env.FI_TRICHOSCOPY_CERT_TENANT_ID?.trim() ||
    process.env.FI_E2E_TENANT_ID?.trim() ||
    "";
  const otherTenantId = process.env.FI_TRICHOSCOPY_CERT_OTHER_TENANT_ID?.trim() || "";
  return {
    enabled,
    apiBaseUrl,
    serviceKeyPresent: Boolean(serviceKey),
    signingSecretPresent: Boolean(signingSecret),
    webhookSecret,
    useStub,
    baseUrl,
    tenantId,
    otherTenantId,
  };
}

function sha256HexOfBody(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

function signPayload(opts: {
  secret: string;
  timestamp: string;
  requestId: string;
  tenantId: string;
  body: string;
}): string {
  const canonical = `${opts.timestamp}.${opts.requestId}.${opts.tenantId}.${sha256HexOfBody(opts.body)}`;
  return createHmac("sha256", opts.secret).update(canonical).digest("hex");
}

function buildHeaders(opts: {
  tenantId: string;
  secret: string;
  body: string;
  nowMs?: number;
  signatureOverride?: string;
}): Record<string, string> {
  const requestId = randomUUID();
  const timestamp = String(opts.nowMs ?? Date.now());
  const signature =
    opts.signatureOverride ??
    signPayload({
      secret: opts.secret,
      timestamp,
      requestId,
      tenantId: opts.tenantId,
      body: opts.body,
    });
  return {
    [HDR_TENANT]: opts.tenantId,
    [HDR_REQUEST_ID]: requestId,
    [HDR_TIMESTAMP]: timestamp,
    [HDR_SIG_VERSION]: "v1",
    [HDR_SIGNATURE]: signature,
    "content-type": "application/json",
  };
}

function record(id: string, ok: boolean, detail: string): void {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} [${id}] ${detail}`);
}

function runPreflight(): boolean {
  const cfg = loadConfig();
  console.log("\n=== FI-TRICHOSCOPY-1A.1 preflight ===\n");
  console.log(
    JSON.stringify(
      {
        platformEnabled: cfg.enabled,
        useStub: cfg.useStub,
        hliApiHost: hostOnly(cfg.apiBaseUrl),
        serviceKeyPresent: cfg.serviceKeyPresent,
        signingSecretPresent: cfg.signingSecretPresent,
        webhookSecretPresent: Boolean(cfg.webhookSecret),
        fiosBaseUrl: cfg.baseUrl || null,
        entitledTenantPresent: Boolean(cfg.tenantId),
        otherTenantPresent: Boolean(cfg.otherTenantId),
      },
      null,
      2
    )
  );

  record("P2_platform_flag", cfg.enabled, cfg.enabled ? "FI_ENABLE_HLI_TRICHOSCOPY on" : "flag off or unset");
  record(
    "P3_hli_credentials",
    Boolean(cfg.apiBaseUrl && cfg.serviceKeyPresent && cfg.signingSecretPresent),
    cfg.useStub ? "missing API URL / service key / signing secret → stub mode" : "live credential keys present"
  );
  record("P4_not_stub", !cfg.useStub, cfg.useStub ? "stub transport would be used — cannot GREEN" : "useStub=false");
  record("P1_base_url", Boolean(cfg.baseUrl), cfg.baseUrl ? cfg.baseUrl : "set FI_TRICHOSCOPY_CERT_BASE_URL");
  record(
    "P6_tenants",
    Boolean(cfg.tenantId && cfg.otherTenantId),
    cfg.tenantId && cfg.otherTenantId
      ? "entitled + negative-control tenant ids present"
      : "set FI_TRICHOSCOPY_CERT_TENANT_ID and FI_TRICHOSCOPY_CERT_OTHER_TENANT_ID"
  );

  const localSigOk = (() => {
    const secret = "local-preflight-secret-not-used-remotely";
    const tenantId = "preflight-tenant";
    const body = '{"ok":true}';
    const headers = buildHeaders({ tenantId, secret, body });
    const expected = signPayload({
      secret,
      timestamp: headers[HDR_TIMESTAMP],
      requestId: headers[HDR_REQUEST_ID],
      tenantId,
      body,
    });
    return expected === headers[HDR_SIGNATURE];
  })();
  record("local_signature_roundtrip", localSigOk, localSigOk ? "HMAC v1 verifies" : "HMAC broken");

  return results.every((r) => r.ok);
}

function initRunFolder(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  const runId = `${stamp}-staging`;
  const runDir = resolve(process.cwd(), "docs/fios/trichoscopy/evidence/runs", runId);
  const template = resolve(
    process.cwd(),
    "docs/fios/trichoscopy/evidence/templates/certification-run-manifest.template.json"
  );
  mkdirSync(resolve(runDir, "attachments"), { recursive: true });
  const manifestPath = resolve(runDir, "manifest.json");
  copyFileSync(template, manifestPath);
  const cfg = loadConfig();
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
  manifest.runId = runId;
  manifest.executedAt = new Date().toISOString();
  manifest.deployment = {
    ...(manifest.deployment as object),
    fiosBaseUrl: cfg.baseUrl || null,
    fiosCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT || null,
    hliApiBaseUrlHostOnly: hostOnly(cfg.apiBaseUrl),
    stubTransportInvoked: cfg.useStub,
  };
  manifest.actors = {
    ...(manifest.actors as object),
    entitledTenantId: cfg.tenantId || null,
    negativeControlTenantId: cfg.otherTenantId || null,
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  writeFileSync(
    resolve(runDir, "README.md"),
    `# Run ${runId}\n\nComplete \`manifest.json\` during the live staging journey. Commit only redacted artifacts.\n`,
    "utf8"
  );
  console.log(`Initialized ${runDir}`);
  return runDir;
}

async function postEvent(opts: {
  baseUrl: string;
  headers: Record<string, string>;
  body: string;
}): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${opts.baseUrl}/api/integrations/hli/trichoscopy/events`, {
    method: "POST",
    headers: opts.headers,
    body: opts.body,
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = {};
  }
  return { status: res.status, json };
}

function syntheticEnvelope(tenantId: string, eventId: string) {
  return {
    eventId,
    eventType: "trichoscopy.session_created",
    eventVersion: "1",
    occurredAt: new Date().toISOString(),
    tenantReference: tenantId,
    patientReference: `cert-hli-pt-${tenantId.slice(0, 8)}`,
    episodeId: `cert-ep-${randomUUID()}`,
    idempotencyKey: `cert-idem-${eventId}`,
  };
}

async function executeSecurityProbes(): Promise<boolean> {
  const cfg = loadConfig();
  console.log("\n=== FI-TRICHOSCOPY-1A.1 security probes ===\n");

  if (!cfg.baseUrl) {
    record("security_base_url", false, "FI_TRICHOSCOPY_CERT_BASE_URL unset");
    return false;
  }
  if (!cfg.enabled) {
    record("security_platform_flag", false, "FI_ENABLE_HLI_TRICHOSCOPY must be on for probes");
    return false;
  }
  if (!cfg.webhookSecret) {
    record("security_webhook_secret", false, "HLI_TRICHOSCOPY_WEBHOOK_SECRET / SIGNING_SECRET required");
    return false;
  }
  if (!cfg.tenantId || !cfg.otherTenantId) {
    record("security_tenants", false, "entitled + other tenant ids required");
    return false;
  }
  if (cfg.useStub) {
    record("security_not_stub", false, "refuse probes while outbound adapter would use stub — set live HLI_* first");
    return false;
  }

  // Invalid signature
  {
    const body = JSON.stringify(syntheticEnvelope(cfg.tenantId, `inv-${randomUUID()}`));
    const headers = buildHeaders({
      tenantId: cfg.tenantId,
      secret: cfg.webhookSecret,
      body,
      signatureOverride: "00".repeat(32),
    });
    const res = await postEvent({ baseUrl: cfg.baseUrl, headers, body });
    const pass = res.status === 401 && String(res.json.reason ?? "") === "signature_invalid";
    record(
      "A8_invalid_signature",
      pass,
      `status=${res.status} reason=${String(res.json.reason ?? "none")}`
    );
  }

  // Expired timestamp (skew > 5 minutes)
  {
    const body = JSON.stringify(syntheticEnvelope(cfg.tenantId, `exp-${randomUUID()}`));
    const headers = buildHeaders({
      tenantId: cfg.tenantId,
      secret: cfg.webhookSecret,
      body,
      nowMs: Date.now() - 15 * 60 * 1000,
    });
    const res = await postEvent({ baseUrl: cfg.baseUrl, headers, body });
    const pass = res.status === 401 && String(res.json.reason ?? "") === "timestamp_skew";
    record(
      "A8_expired_timestamp",
      pass,
      `status=${res.status} reason=${String(res.json.reason ?? "none")}`
    );
  }

  // Cross-tenant: header tenant ≠ event tenantReference
  {
    const body = JSON.stringify(syntheticEnvelope(cfg.otherTenantId, `xt-${randomUUID()}`));
    const headers = buildHeaders({
      tenantId: cfg.tenantId,
      secret: cfg.webhookSecret,
      body,
    });
    const res = await postEvent({ baseUrl: cfg.baseUrl, headers, body });
    const pass = res.status === 403 && String(res.json.reason ?? "") === "tenant_mismatch";
    record(
      "A7_cross_tenant",
      pass,
      `status=${res.status} reason=${String(res.json.reason ?? "none")}`
    );
  }

  return results.filter((r) => r.id.startsWith("A")).every((r) => r.ok);
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const wantPreflight = args.has("--preflight") || args.size === 0;
  const wantInit = args.has("--init-run");
  const wantProbes = args.has("--execute-security-probes");

  if (wantInit && !wantPreflight && !wantProbes) {
    initRunFolder();
    console.log("\nRun folder ready. Fill manifest during the live clinical journey.");
    return;
  }

  let exitOk = true;

  if (wantPreflight || wantProbes) {
    const preflightOk = runPreflight();
    if (!preflightOk) exitOk = false;
    if (wantProbes && !preflightOk) {
      console.error("\nPreflight failed — refusing security probes.");
    }
  }

  if (wantInit) {
    initRunFolder();
  }

  if (wantProbes && exitOk) {
    const probeOk = await executeSecurityProbes();
    if (!probeOk) exitOk = false;
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nSummary: ${results.length - failed.length}/${results.length} checks passed`);
  if (!exitOk || failed.length) {
    console.error(
      "\nVerdict remains AMBER until live clinical round-trip evidence is committed under docs/fios/trichoscopy/evidence/runs/."
    );
    process.exit(1);
  }
  console.log("\nPreflight/probes OK. Complete the supervised clinical journey before flipping GREEN.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
