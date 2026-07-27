/**
 * Live FI-PATIENT-APP-2A.1 parity probe (prints status/code only; redacts UUIDs/JWTs).
 * Usage: node scripts/run-with-system-ca.mjs tsx scripts/probe-patient-gateway-mobile-parity.ts
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
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

function redact(text: string): string {
  return text
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[uuid]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt]")
    .slice(0, 200);
}

loadRepoEnvFiles();

async function probe(
  base: string,
  path: string,
  token: string | null,
  label?: string
): Promise<void> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { headers });
  const text = await res.text();
  let ok: unknown = null;
  let code: unknown = null;
  try {
    const json = JSON.parse(text) as { ok?: unknown; code?: unknown };
    ok = json.ok ?? null;
    code = json.code ?? null;
  } catch {
    /* non-json */
  }
  console.log(
    JSON.stringify({
      label: label ?? path,
      status: res.status,
      ok,
      code,
      bodyPreview: redact(text),
    })
  );
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const email =
    process.env.FI_E2E_PATIENT_GATEWAY_MOBILE_EMAIL?.trim() ||
    "e2e-patient-gateway-mobile@fi-demo.example";
  const password =
    process.env.FI_E2E_PATIENT_GATEWAY_MOBILE_PASSWORD?.trim() ||
    "E2ePatientGatewayMobile!2026";
  const base = (process.env.FIOS_API_BASE_URL || "https://follicleintelligence.ai").replace(
    /\/+$/,
    ""
  );

  if (!url || !anon) {
    console.error("Missing Supabase public env.");
    process.exit(1);
  }

  const sb = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session?.access_token) {
    console.error("signin_failed");
    process.exit(1);
  }
  const token = data.session.access_token;

  const paths = [
    "/api/patient/v1/me",
    "/api/patient/v1/journey",
    "/api/patient/v1/appointments",
    "/api/patient/v1/billing",
    "/api/patient/v1/messages",
  ];
  for (const path of paths) {
    await probe(base, path, token);
  }

  await probe(base, "/api/patient/v1/me", "invalid-token-2a1", "invalid bearer /me");
  await probe(
    base,
    "/api/patient/v1/me?patientId=00000000-0000-4000-8000-000000000099",
    token,
    "foreign patientId claim /me"
  );
  await probe(
    base,
    "/api/patient/v1/me?tenantId=00000000-0000-4000-8000-000000000098",
    token,
    "wrong tenant claim /me"
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
