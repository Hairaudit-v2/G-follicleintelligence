/**
 * Read-only Timely API probe (Phase: investigate direct API sync).
 *
 * Verifies authentication and inspects the SHAPE of a small appointments fetch so we can map
 * Timely fields → FI OS fields before building any sync. It prints field NAMES and value TYPES
 * only — never patient-sensitive values, and never the API key.
 *
 *   npx tsx scripts/timely-api-probe.ts
 *
 * Requires (see .env.example): TIMELY_API_KEY, TIMELY_API_BASE_URL.
 * `tsx` does not auto-load `.env.local` (Next.js does), so this loads repo-root env files first.
 *
 * This probe NEVER mutates Timely and does NOT build the cron sync — that comes only after the
 * probe succeeds and the endpoint/field contract is confirmed.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  detectTimelyCanonicalFields,
  extractFirstAppointmentRecord,
  fetchTimelyAppointments,
  fetchTimelyServices,
  resolveTimelyApiConfig,
  summarizeRecordShape,
  TIMELY_API_ENDPOINTS,
  TIMELY_API_ENV,
  TimelyApiError,
  verifyTimelyAuth,
  type TimelyApiConfig,
} from "../src/lib/integrations/timely/timelyApiClient.server";

/** Fill `process.env` from repo-root env files (tsx does not auto-load `.env.local`). */
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

function line(msg = ""): void {
  console.log(msg);
}

function yyyyMmDd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Print an actionable hint when an endpoint is unconfirmed, then rethrow for the exit handler. */
function explainEndpointError(label: string, e: TimelyApiError): void {
  line(`✗ ${label} failed: ${e.message}`);
  line(`  endpoint: ${e.endpoint}`);
  if (e.kind === "not_found" || e.kind === "parse") {
    line("");
    line("  This usually means the endpoint path or response format is not what the client assumes.");
    line("  TODO(timely-api): confirm the correct path against the Timely API docs and update");
    line("  TIMELY_API_ENDPOINTS in src/lib/integrations/timely/timelyApiClient.server.ts.");
    line(`  Current assumptions: ${JSON.stringify(TIMELY_API_ENDPOINTS)}`);
  }
  if (e.kind === "auth") {
    line("");
    line(`  TODO(timely-api): confirm the auth scheme. The client sends 'Authorization: Bearer <${TIMELY_API_ENV.apiKey}>'.`);
    line("  If Timely needs OAuth2 access tokens or a custom header, adjust buildAuthHeaders().");
  }
  if (e.kind === "network" && /UNABLE_TO_VERIFY|CERT|SELF_SIGNED/i.test(e.message)) {
    line("");
    line("  TLS verification failed — this network is likely intercepting HTTPS with a proxy whose");
    line("  certificate Node does not trust. Run the probe from a network without TLS interception,");
    line("  or point NODE_EXTRA_CA_CERTS at your corporate root CA. (Do NOT disable TLS verification");
    line("  with NODE_TLS_REJECT_UNAUTHORIZED=0 against a real API key.)");
  }
}

async function probeServices(config: TimelyApiConfig): Promise<void> {
  line("— Services —");
  try {
    const services = await fetchTimelyServices(config);
    const record = extractFirstAppointmentRecord(services);
    if (!record) {
      line("  Reached the services endpoint but found no object records to summarize.");
      return;
    }
    line("  Sanitized field shape (names + types only):");
    for (const field of summarizeRecordShape(record)) line(`    • ${field}`);
  } catch (e) {
    if (e instanceof TimelyApiError) {
      explainEndpointError("services fetch", e);
      return;
    }
    throw e;
  }
}

async function probeAppointments(config: TimelyApiConfig): Promise<boolean> {
  line("");
  line("— Appointments (small date range) —");
  const start = new Date();
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  const startDate = yyyyMmDd(start);
  const endDate = yyyyMmDd(end);
  line(`  Range: ${startDate} → ${endDate} (page 1, limit 5)`);

  let payload: unknown;
  try {
    payload = await fetchTimelyAppointments(config, { startDate, endDate, page: 1, limit: 5 });
  } catch (e) {
    if (e instanceof TimelyApiError) {
      explainEndpointError("appointments fetch", e);
      return false;
    }
    throw e;
  }

  const record = extractFirstAppointmentRecord(payload);
  if (!record) {
    line("  Reached the appointments endpoint, but the response held no appointment records in this");
    line("  date range (or the envelope shape is unrecognized). Top-level keys present:");
    const keys =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? Object.keys(payload as Record<string, unknown>)
        : [`(${Array.isArray(payload) ? "array" : typeof payload} response)`];
    line(`    ${keys.join(", ") || "(none)"}`);
    line("  Try a wider/known-busy date range, then re-run.");
    return true;
  }

  line("  Sanitized field shape (names + types only — NO values):");
  for (const field of summarizeRecordShape(record)) line(`    • ${field}`);

  line("");
  line("  Canonical FI field mapping (Timely field NAME per concept; null = confirm manually):");
  const mapping = detectTimelyCanonicalFields(record);
  for (const [concept, fieldName] of Object.entries(mapping)) {
    line(`    • ${concept.padEnd(16)} → ${fieldName ?? "‹not detected — see shape above›"}`);
  }
  return true;
}

async function main(): Promise<void> {
  loadRepoEnvFiles();

  line("Timely API probe (read-only) — no Timely data is mutated.");
  line("");

  const resolved = resolveTimelyApiConfig();
  if (!resolved.ok) {
    line("✗ Timely API is not configured.");
    line(`  Missing required env: ${resolved.missing.join(", ")}`);
    line("");
    line("  Set these in .env.local (see .env.example):");
    line(`    ${TIMELY_API_ENV.apiKey}=<your Timely API key>   # never logged, server-only`);
    line(`    ${TIMELY_API_ENV.baseUrl}=https://api.gettimely.com/v1   # confirm host/region for your account`);
    process.exitCode = 1;
    return;
  }

  const { config } = resolved;
  line(`Base URL: ${config.baseUrl}`);
  line(`API key: present (${config.apiKey.length} chars) — value not shown.`);
  line("");

  line("— Authentication —");
  try {
    await verifyTimelyAuth(config);
    line("✓ Authentication succeeded.");
  } catch (e) {
    if (e instanceof TimelyApiError) {
      explainEndpointError("authentication", e);
      process.exitCode = 1;
      return;
    }
    throw e;
  }
  line("");

  await probeServices(config);
  const appointmentsReached = await probeAppointments(config);

  line("");
  if (appointmentsReached) {
    line("Probe complete. Review the field mapping above before building the cron sync.");
  } else {
    line("Probe reached auth but could not read appointments — resolve the endpoint TODOs above, then re-run.");
    process.exitCode = 1;
  }
}

main().catch((e) => {
  // Last-resort handler. TimelyApiError messages are already sanitized; for anything else, print
  // the message only (never dump env / the key).
  const msg = e instanceof Error ? e.message : String(e);
  line("");
  line(`✗ Unexpected probe failure: ${msg}`);
  process.exitCode = 1;
});
