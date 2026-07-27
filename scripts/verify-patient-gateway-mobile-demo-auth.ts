/**
 * FI-PATIENT-APP-2A.2 — verify seeded mobile demo credentials against Supabase + /me.
 * Prints status only; never prints password or full bearer token.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const email =
    process.env.FI_E2E_PATIENT_GATEWAY_MOBILE_EMAIL?.trim() ||
    "e2e-patient-gateway-mobile@fi-demo.example";
  const password =
    process.env.FI_E2E_PATIENT_GATEWAY_MOBILE_PASSWORD?.trim() ||
    "E2ePatientGatewayMobile!2026";
  const apiBase = (process.env.FIOS_API_BASE_URL || "https://follicleintelligence.ai").replace(
    /\/+$/,
    ""
  );

  if (!url || !anon) {
    console.error(JSON.stringify({ ok: false, step: "env", error: "missing_supabase_public_env" }));
    process.exit(1);
  }

  // Capture locally without committing password (file is gitignored via .env*).
  const localCredPath = resolve(process.cwd(), ".env.patient-gateway-mobile.local");
  writeFileSync(
    localCredPath,
    [
      `# Local-only FI-PATIENT-APP-2A.2 credentials — do not commit`,
      `FI_E2E_PATIENT_GATEWAY_MOBILE_EMAIL=${email}`,
      `FI_E2E_PATIENT_GATEWAY_MOBILE_PASSWORD=${password}`,
      `EXPO_PUBLIC_SUPABASE_URL=${url}`,
      `EXPO_PUBLIC_FIOS_API_URL=${apiBase}`,
      "",
    ].join("\n"),
    { encoding: "utf8" }
  );

  console.log(
    JSON.stringify({
      ok: true,
      step: "capture_local",
      email,
      supabaseHost: new URL(url).host,
      apiBase,
      localCredPath: ".env.patient-gateway-mobile.local",
      passwordCommitted: false,
    })
  );

  const sb = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session?.access_token) {
    console.error(
      JSON.stringify({
        ok: false,
        step: "supabase_signin",
        supabaseHost: new URL(url).host,
        email,
        errorName: error?.name ?? null,
        errorStatus: (error as { status?: number } | null)?.status ?? null,
        errorMessage: error?.message ?? "no_session",
        hasUser: Boolean(data.user?.id),
        emailConfirmedAt: data.user?.email_confirmed_at ?? null,
      })
    );
    process.exit(2);
  }

  const token = data.session.access_token;
  console.log(
    JSON.stringify({
      ok: true,
      step: "supabase_signin",
      supabaseHost: new URL(url).host,
      email,
      authUserId: data.user?.id ?? null,
      emailConfirmedAtPresent: Boolean(data.user?.email_confirmed_at),
      bearerPresent: Boolean(token),
      bearerPrefix: token.slice(0, 12) + "…",
      expiresIn: data.session.expires_in ?? null,
    })
  );

  const meRes = await fetch(`${apiBase}/api/patient/v1/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const meText = await meRes.text();
  let meOk: unknown = null;
  let meCode: unknown = null;
  let preferredNamePresent = false;
  try {
    const json = JSON.parse(meText) as {
      ok?: unknown;
      code?: unknown;
      preferredName?: unknown;
    };
    meOk = json.ok ?? null;
    meCode = json.code ?? null;
    preferredNamePresent = typeof json.preferredName === "string" && json.preferredName.length > 0;
  } catch {
    /* non-json */
  }

  const mePass = meRes.status === 200 && meOk === true;
  console.log(
    JSON.stringify({
      ok: mePass,
      step: "gateway_me",
      status: meRes.status,
      okField: meOk,
      code: meCode,
      preferredNamePresent,
    })
  );

  if (!mePass) process.exit(3);
  console.log(JSON.stringify({ ok: true, step: "2a2_complete" }));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, step: "fatal", error: String(e) }));
  process.exit(1);
});
