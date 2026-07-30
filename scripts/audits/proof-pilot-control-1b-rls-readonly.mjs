/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B — read-only remote RLS + API isolation proof.
 * Uses live Evolved / FI project. No enrolment, invite, Stripe, or clinical writes.
 *
 * Stop conditions: any Evolved programme row visible to wrong-tenant JWT,
 * or any successful write by authenticated/anon to pilot tables.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvLocal();

const EVOLVED_TENANT = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const PROGRAMME_KEY = "evolved_controlled_pilot_1a";
const TABLES = [
  "fi_pilot_programmes",
  "fi_pilot_enrolments",
  "fi_pilot_control_events",
  "fi_pilot_blockers",
  "fi_pilot_activation_decisions",
  "fi_pilot_cohort_candidate_reviews",
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const adminEmail = process.env.FI_E2E_PRODUCTION_ADMIN_EMAIL?.trim();
const adminPassword = process.env.FI_E2E_PRODUCTION_ADMIN_PASSWORD?.trim();
const lowEmail = process.env.FI_E2E_LOW_ROLE_EMAIL?.trim();
const lowPassword = process.env.FI_E2E_LOW_ROLE_PASSWORD?.trim();
/** Known non-Evolved membership (ihrg-global only) — used for pure wrong-tenant JWT proof. */
const WRONG_TENANT_EMAIL = "reception@evolvedhair.com.au";
const baseUrl = (
  process.env.FI_E2E_BASE_URL ||
  process.env.FI_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  ""
).replace(/\/$/, "");

if (!url || !anon || !adminEmail || !adminPassword) {
  console.error("Missing required env for RLS proof");
  process.exit(2);
}

const results = [];
let red = false;

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) red = true;
}

async function signIn(email, password) {
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`sign_in_failed:${email}:${error?.message ?? "no_session"}`);
  }
  return { client, session: data.session, user: data.user };
}

async function countAs(client, table, filter) {
  let q = client.from(table).select("id", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count, error } = await q;
  return { count: count ?? 0, error: error?.message ?? null };
}

async function selectIds(client, table, limit = 5) {
  const { data, error } = await client.from(table).select("id, tenant_id").limit(limit);
  return { rows: data ?? [], error: error?.message ?? null };
}

async function tryInsertDenied(client, table) {
  const payload =
    table === "fi_pilot_programmes"
      ? {
          tenant_id: EVOLVED_TENANT,
          programme_key: `rls_proof_must_fail_${Date.now()}`,
          display_name: "RLS proof must fail",
          status: "planned",
          cohort_key: "proof",
        }
      : table === "fi_pilot_control_events"
        ? {
            tenant_id: EVOLVED_TENANT,
            event_kind: "rls_proof_must_fail",
            source_module: "1b_rls_proof",
            payload: { proof: true },
          }
        : null;
  if (!payload) return { skipped: true };
  const { data, error } = await client.from(table).insert(payload).select("id").maybeSingle();
  return {
    skipped: false,
    wrote: Boolean(data?.id),
    error: error?.message ?? null,
    id: data?.id ?? null,
  };
}

async function apiGet(path, cookieHeader) {
  if (!baseUrl) return { skipped: true };
  const res = await fetch(`${baseUrl}${path}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
    redirect: "manual",
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { skipped: false, status: res.status, json, text: text.slice(0, 400) };
}

function cookieFromSession(session) {
  // App uses cookie session via SSR; for API we also try Authorization bearer where accepted.
  return null;
}

async function main() {
  console.log("=== 1B RLS / isolation proof (read-only) ===");
  console.log(`project_url=${url}`);
  console.log(`evolved_tenant=${EVOLVED_TENANT}`);
  console.log(`base_url=${baseUrl || "(none)"}`);

  // Anon negative
  {
    const anonClient = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    for (const table of TABLES) {
      const { count, error } = await countAs(anonClient, table);
      const { rows } = await selectIds(anonClient, table);
      const ok = rows.length === 0 && (count === 0 || count === null || error);
      record(`anon_cannot_read_${table}`, ok, `count=${count} rows=${rows.length} err=${error ?? "none"}`);
    }
    const write = await tryInsertDenied(anonClient, "fi_pilot_control_events");
    record(
      "anon_cannot_insert_fi_pilot_control_events",
      !write.wrote,
      write.wrote ? `LEAK_WRITE_ID=${write.id}` : `err=${write.error ?? "denied"}`
    );
  }

  // Evolved authorised positive (production admin)
  const evolved = await signIn(adminEmail, adminPassword);
  record("evolved_admin_sign_in", true, `auth_user=${evolved.user.id}`);

  {
    const { data: membership } = await evolved.client
      .from("fi_users")
      .select("tenant_id, role, email")
      .eq("auth_user_id", evolved.user.id);
    const tenants = [...new Set((membership ?? []).map((m) => m.tenant_id))];
    record(
      "evolved_admin_tenant_membership_includes_evolved",
      tenants.includes(EVOLVED_TENANT),
      `tenants=${tenants.join(",") || "none"}`
    );
  }

  {
    const { data, error } = await evolved.client
      .from("fi_pilot_programmes")
      .select("id, programme_key, activation_state, tenant_id, metadata")
      .eq("programme_key", PROGRAMME_KEY);
    const row = data?.[0];
    record(
      "evolved_can_see_programme",
      Boolean(row) && row.tenant_id === EVOLVED_TENANT && !error,
      row
        ? `id=${row.id} activation_state=${row.activation_state} invites=${row.metadata?.real_patient_invites}`
        : `err=${error?.message ?? "missing"}`
    );
    if (row) {
      record(
        "programme_remains_planned",
        row.activation_state === "planned",
        `activation_state=${row.activation_state}`
      );
      record(
        "invites_remain_disabled",
        row.metadata?.real_patient_invites === false,
        `real_patient_invites=${row.metadata?.real_patient_invites}`
      );
    }
  }

  for (const table of [
    "fi_pilot_enrolments",
    "fi_pilot_blockers",
    "fi_pilot_activation_decisions",
    "fi_pilot_cohort_candidate_reviews",
  ]) {
    const { count, error } = await countAs(evolved.client, table, (q) =>
      q.eq("tenant_id", EVOLVED_TENANT)
    );
    record(
      `evolved_can_query_${table}`,
      !error,
      `count=${count} err=${error ?? "none"}`
    );
  }

  {
    const write = await tryInsertDenied(evolved.client, "fi_pilot_control_events");
    record(
      "authenticated_cannot_insert_events_without_service_role",
      !write.wrote,
      write.wrote ? `LEAK_WRITE_ID=${write.id}` : `err=${write.error ?? "denied"}`
    );
    if (write.wrote && write.id) {
      // Emergency cleanup via service role only if a write leaked — should not happen.
      console.error("RED: unexpected write succeeded; manual cleanup required:", write.id);
    }
  }

  // Low-role path (may still be Evolved member — documents same-tenant SELECT vs API projection)
  if (lowEmail && lowPassword && lowEmail.toLowerCase() !== adminEmail.toLowerCase()) {
    const low = await signIn(lowEmail, lowPassword);
    const { data: membership } = await low.client
      .from("fi_users")
      .select("tenant_id, role, email")
      .eq("auth_user_id", low.user.id);
    const tenants = [...new Set((membership ?? []).map((m) => m.tenant_id))];
    const isWrongTenant = !tenants.includes(EVOLVED_TENANT);
    record(
      "low_role_identity_resolved",
      true,
      `tenants=${tenants.join(",") || "none"} wrong_tenant=${isWrongTenant}`
    );

    const { data: programmes, error } = await low.client
      .from("fi_pilot_programmes")
      .select("id, programme_key, tenant_id")
      .eq("programme_key", PROGRAMME_KEY);
    if (isWrongTenant) {
      const leaked = (programmes ?? []).some((p) => p.tenant_id === EVOLVED_TENANT);
      record(
        "wrong_tenant_cannot_discover_evolved_programme",
        !leaked && (programmes ?? []).length === 0,
        `rows=${(programmes ?? []).length} err=${error?.message ?? "none"}`
      );
    } else {
      record(
        "low_role_same_tenant_rls_allows_programme_select",
        Boolean((programmes ?? []).length) && !error,
        `rows=${(programmes ?? []).length} (API role projection tested separately)`
      );
    }
    await low.client.auth.signOut();
  } else {
    record("low_role_credential", false, "FI_E2E_LOW_ROLE_* missing or same as admin");
  }

  // Pure wrong-tenant JWT via magic-link exchange (no password; no clinical writes)
  if (serviceRole) {
    const adminClient = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: WRONG_TENANT_EMAIL,
    });
    if (linkErr || !linkData?.properties?.hashed_token) {
      record(
        "wrong_tenant_magiclink_issue",
        false,
        linkErr?.message ?? "no_hashed_token"
      );
    } else {
      const wrongClient = createClient(url, anon, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: verified, error: verifyErr } = await wrongClient.auth.verifyOtp({
        type: "magiclink",
        token_hash: linkData.properties.hashed_token,
      });
      if (verifyErr || !verified.session) {
        record("wrong_tenant_session", false, verifyErr?.message ?? "no_session");
      } else {
        const { data: membership } = await wrongClient
          .from("fi_users")
          .select("tenant_id, email")
          .eq("auth_user_id", verified.user.id);
        const tenants = [...new Set((membership ?? []).map((m) => m.tenant_id))];
        const isPureWrong = !tenants.includes(EVOLVED_TENANT);
        record(
          "wrong_tenant_identity_is_non_evolved",
          isPureWrong,
          `email=${WRONG_TENANT_EMAIL} tenants=${tenants.join(",") || "none"}`
        );

        const { data: programmes, error } = await wrongClient
          .from("fi_pilot_programmes")
          .select("id, programme_key, tenant_id")
          .eq("programme_key", PROGRAMME_KEY);
        const leaked = (programmes ?? []).some((p) => p.tenant_id === EVOLVED_TENANT);
        record(
          "wrong_tenant_cannot_discover_evolved_programme",
          isPureWrong && !leaked && (programmes ?? []).length === 0,
          `rows=${(programmes ?? []).length} err=${error?.message ?? "none"}`
        );

        for (const table of [
          "fi_pilot_enrolments",
          "fi_pilot_blockers",
          "fi_pilot_activation_decisions",
          "fi_pilot_cohort_candidate_reviews",
          "fi_pilot_control_events",
        ]) {
          const { rows } = await selectIds(wrongClient, table, 20);
          const evolvedLeak = rows.some((r) => r.tenant_id === EVOLVED_TENANT);
          record(
            `wrong_tenant_cannot_read_${table}`,
            !evolvedLeak,
            `rows=${rows.length} evolved_leak=${evolvedLeak}`
          );
        }

        if (baseUrl && verified.session?.access_token) {
          const apiRes = await fetch(
            `${baseUrl}/api/pilot-control/overview?programmeId=${PROGRAMME_KEY}&tenantId=${EVOLVED_TENANT}`,
            {
              headers: {
                Authorization: `Bearer ${verified.session.access_token}`,
                "x-fi-tenant-id": EVOLVED_TENANT,
              },
            }
          );
          const apiBody = await apiRes.json().catch(() => ({}));
          record(
            "wrong_tenant_api_overview_denied",
            apiRes.status >= 400,
            `status=${apiRes.status} code=${apiBody?.error?.code ?? "n/a"}`
          );
        }

        await wrongClient.auth.signOut();
      }
    }
  } else {
    record("wrong_tenant_proof", false, "SUPABASE_SERVICE_ROLE_KEY missing");
  }

  // Unauthenticated API denials (read-only)
  if (baseUrl) {
    for (const path of [
      `/api/pilot-control/overview?programmeId=${PROGRAMME_KEY}&tenantId=${EVOLVED_TENANT}`,
      `/api/pilot-control/patients?programmeId=${PROGRAMME_KEY}&tenantId=${EVOLVED_TENANT}`,
      `/api/pilot-control/blockers?programmeId=${PROGRAMME_KEY}&tenantId=${EVOLVED_TENANT}`,
      `/api/pilot-control/adoption?programmeId=${PROGRAMME_KEY}&tenantId=${EVOLVED_TENANT}`,
      `/api/pilot-control/export?programmeId=${PROGRAMME_KEY}&tenantId=${EVOLVED_TENANT}`,
    ]) {
      const res = await apiGet(path);
      record(
        `unauth_api_denied_${path.split("?")[0]}`,
        res.status >= 401,
        `status=${res.status} code=${res.json?.error?.code ?? "n/a"}`
      );
    }
  }

  // Bearer token API probes (authorised + explicit tenant)
  {
    const headers = {
      Authorization: `Bearer ${evolved.session.access_token}`,
      "x-fi-tenant-id": EVOLVED_TENANT,
    };
    if (baseUrl) {
      const overview = await fetch(
        `${baseUrl}/api/pilot-control/overview?programmeId=${PROGRAMME_KEY}`,
        { headers }
      );
      const body = await overview.json().catch(() => ({}));
      record(
        "evolved_bearer_overview",
        overview.status < 500,
        `status=${overview.status} code=${body?.error?.code ?? "ok_or_other"}`
      );

      // Wrong tenant hint must not succeed for Evolved-only member using foreign tenant id
      const wrongHint = await fetch(
        `${baseUrl}/api/pilot-control/overview?programmeId=${PROGRAMME_KEY}&tenantId=cef53cb8-04b6-4e06-878a-5ba065c22425`,
        {
          headers: {
            Authorization: `Bearer ${evolved.session.access_token}`,
            "x-fi-tenant-id": "cef53cb8-04b6-4e06-878a-5ba065c22425",
          },
        }
      );
      const wrongBody = await wrongHint.json().catch(() => ({}));
      record(
        "evolved_user_wrong_tenant_hint_denied",
        wrongHint.status >= 400,
        `status=${wrongHint.status} code=${wrongBody?.error?.code ?? "n/a"}`
      );
    }
  }

  await evolved.client.auth.signOut();

  console.log("\n=== summary ===");
  const pass = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  console.log(JSON.stringify({ pass, fail, red, results }, null, 2));
  if (red) process.exit(1);
}

main().catch((err) => {
  console.error("PROOF_SCRIPT_ERROR", err);
  process.exit(1);
});
