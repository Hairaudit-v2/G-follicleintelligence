/**
 * One-off probe: demo patient bookings + live /appointments (no secrets printed).
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

loadRepoEnvFiles();

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const patientId = "cb007f3d-2b91-4868-b3d4-88bc0667bc35";
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

  if (!url || !service || !anon) {
    console.error(JSON.stringify({ ok: false, error: "missing_env" }));
    process.exit(1);
  }

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: rows, error } = await admin
    .from("fi_bookings")
    .select("id, title, booking_status, start_at, patient_id, metadata")
    .eq("patient_id", patientId)
    .order("start_at", { ascending: false })
    .limit(20);

  console.log(
    JSON.stringify(
      {
        step: "db_bookings",
        error: error?.message ?? null,
        count: rows?.length ?? 0,
        rows: (rows ?? []).map((r) => ({
          id: r.id,
          title: r.title,
          status: r.booking_status,
          start_at: r.start_at,
          fixtureFlag: Boolean(
            r.metadata &&
              typeof r.metadata === "object" &&
              (r.metadata as Record<string, unknown>).e2e_patient_gateway_mobile_booking_fixture ===
                true
          ),
        })),
      },
      null,
      2
    )
  );

  const sb = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error: signErr } = await sb.auth.signInWithPassword({ email, password });
  if (signErr || !data.session?.access_token) {
    console.error(JSON.stringify({ step: "signin", ok: false, error: signErr?.message ?? "no_token" }));
    process.exit(2);
  }

  const token = data.session.access_token;
  const meRes = await fetch(`${apiBase}/api/patient/v1/me`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const meBody = await meRes.json().catch(() => null);
  console.log(
    JSON.stringify(
      {
        step: "gateway_me",
        status: meRes.status,
        patientId: meBody?.patientId ?? null,
        clinicId: meBody?.clinic?.id ?? null,
        clinicName: meBody?.clinic?.name ?? null,
      },
      null,
      2
    )
  );

  const { data: patientRow } = await admin
    .from("fi_patients")
    .select("id, tenant_id, portal_auth_user_id")
    .eq("id", patientId)
    .maybeSingle();
  console.log(
    JSON.stringify(
      {
        step: "db_patient",
        patientId,
        tenantId: patientRow?.tenant_id ?? null,
        portalAuthMatches: patientRow?.portal_auth_user_id === data.user?.id,
        authUserId: data.user?.id ?? null,
      },
      null,
      2
    )
  );

  const { data: bookingTenants } = await admin
    .from("fi_bookings")
    .select("id, tenant_id, patient_id")
    .eq("patient_id", patientId);
  console.log(
    JSON.stringify(
      {
        step: "booking_tenants",
        rows: bookingTenants ?? [],
      },
      null,
      2
    )
  );

  const apptRes = await fetch(`${apiBase}/api/patient/v1/appointments?_=${Date.now()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Cache-Control": "no-cache",
    },
  });
  const apptText = await apptRes.text();
  let apptBody: any = null;
  try {
    apptBody = JSON.parse(apptText);
  } catch {
    apptBody = { parseError: true, rawPrefix: apptText.slice(0, 200) };
  }
  console.log(
    JSON.stringify(
      {
        step: "gateway_appointments",
        status: apptRes.status,
        bodyLength: apptText.length,
        cacheControl: apptRes.headers.get("cache-control"),
        vercelCache: apptRes.headers.get("x-vercel-cache"),
        upcomingCount: Array.isArray(apptBody?.upcoming) ? apptBody.upcoming.length : null,
        pastCount: Array.isArray(apptBody?.past) ? apptBody.past.length : null,
        raw: apptText.slice(0, 500),
      },
      null,
      2
    )
  );

  const detailId = "213b2ee7-0c8c-40ba-b0d7-a833a0b6b1e4";
  const detailRes = await fetch(`${apiBase}/api/patient/v1/appointments/${detailId}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const detailBody = await detailRes.json().catch(() => null);
  console.log(
    JSON.stringify(
      {
        step: "gateway_appointment_detail",
        status: detailRes.status,
        code: detailBody?.code ?? null,
        error: detailBody?.error ?? null,
        title: detailBody?.appointment?.title ?? null,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
