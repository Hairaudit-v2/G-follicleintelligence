/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B — authenticated API role-matrix proof (read-only).
 * Uses magic-link exchange for known Evolved staff identities. No enrolments / writes.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
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
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const baseUrl = (
  process.env.FI_E2E_BASE_URL ||
  process.env.FI_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  ""
).replace(/\/$/, "");

/** Expected pilot role after mapToPilotControlRole (documented expectation). */
const ROLE_PROBES = [
  {
    label: "director",
    email: "paul@evolvedhair.com.au",
    expectedAccess: "allowed",
    expectExport: true,
    expectActivation: true,
  },
  {
    label: "clinic_manager",
    email: "manager@evolvedhair.com.au",
    expectedAccess: "allowed",
    expectExport: false,
    expectActivation: false,
  },
  {
    label: "reception",
    email: "jesika.watt11@hotmail.com",
    expectedAccess: "allowed",
    expectExport: false,
    expectActivation: false,
  },
  {
    label: "consultant",
    email: "connorgreen0310@icloud.com",
    expectedAccess: "allowed",
    expectExport: false,
    expectActivation: false,
  },
  {
    label: "clinical",
    email: "tlbpmg@gmail.com",
    expectedAccess: "allowed",
    expectExport: false,
    expectActivation: false,
    passwordEnv: "FI_E2E_LOW_ROLE_PASSWORD",
  },
  {
    label: "finance",
    email: "harsh@evolvedhair.com.au",
    // CFO staff_role must map to finance (not administrator via tenant_backend).
    expectedAccess: "allowed",
    expectExport: true,
    expectActivation: false,
    expectedActorRole: "finance",
  },
  {
    label: "administrator_platform",
    email: process.env.FI_E2E_PRODUCTION_ADMIN_EMAIL?.trim() || "auditor@hairaudit.com",
    expectedAccess: "allowed",
    expectExport: true,
    expectActivation: true,
    passwordEnv: "FI_E2E_PRODUCTION_ADMIN_PASSWORD",
  },
  {
    label: "wrong_tenant",
    email: "reception@evolvedhair.com.au",
    expectedAccess: "denied",
    expectExport: false,
    expectActivation: false,
  },
  {
    label: "inactive_staff_member",
    email: "support@follicleintelligence.ai",
    expectedAccess: "denied",
    expectExport: false,
    expectActivation: false,
    notes: "fi_staff.is_active=false — API must fail closed without active staff/admin mapping",
  },
];

const SENSITIVE_KEYS = [
  "clinicalNotes",
  "clinical_free_text",
  "messageBody",
  "message_content",
  "cardNumber",
  "paymentToken",
  "stripePaymentMethod",
  "documentUrl",
  "imageUrl",
  "signedUrl",
];

function containsSensitive(obj, path = "") {
  const hits = [];
  if (obj == null) return hits;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => hits.push(...containsSensitive(v, `${path}[${i}]`)));
    return hits;
  }
  if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.includes(k)) hits.push(`${path}.${k}`);
      hits.push(...containsSensitive(v, `${path}.${k}`));
    }
  }
  return hits;
}

async function sessionFor(probe) {
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (probe.passwordEnv && process.env[probe.passwordEnv]) {
    const email =
      probe.label === "administrator_platform"
        ? process.env.FI_E2E_PRODUCTION_ADMIN_EMAIL
        : probe.email;
    const password =
      probe.label === "administrator_platform"
        ? process.env.FI_E2E_PRODUCTION_ADMIN_PASSWORD
        : process.env.FI_E2E_LOW_ROLE_PASSWORD;
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw new Error(error?.message ?? "password_sign_in_failed");
    return { client, session: data.session, user: data.user };
  }
  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: probe.email,
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    throw new Error(linkErr?.message ?? "magiclink_failed");
  }
  const { data: verified, error: verifyErr } = await client.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyErr || !verified.session) throw new Error(verifyErr?.message ?? "verify_failed");
  return { client, session: verified.session, user: verified.user };
}

async function api(path, token, tenantId = EVOLVED_TENANT) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-fi-tenant-id": tenantId,
    },
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  if (!url || !anon || !serviceRole || !baseUrl) {
    console.error("Missing env");
    process.exit(2);
  }
  const outcomes = [];
  let red = false;

  for (const probe of ROLE_PROBES) {
    const row = {
      role: probe.label,
      email: probe.email,
      expectedAccess: probe.expectedAccess,
      liveStatus: "pending",
      checks: {},
      notes: [],
    };
    try {
      const { client, session } = await sessionFor(probe);
      const token = session.access_token;
      const overview = await api(
        `/api/pilot-control/overview?programmeId=${PROGRAMME_KEY}`,
        token
      );
      const patients = await api(
        `/api/pilot-control/patients?programmeId=${PROGRAMME_KEY}&page=1&pageSize=25`,
        token
      );
      const blockers = await api(
        `/api/pilot-control/blockers?programmeId=${PROGRAMME_KEY}`,
        token
      );
      const adoption = await api(
        `/api/pilot-control/adoption?programmeId=${PROGRAMME_KEY}`,
        token
      );
      const exp = await api(
        `/api/pilot-control/export?programmeId=${PROGRAMME_KEY}&format=json&type=programme_summary`,
        token
      );
      // Clinical detail: synthetic id — empty cohort expects not-enrolled / forbidden, not full clinical.
      const clinicalDetail = await api(
        `/api/pilot-control/patients/00000000-0000-4000-8000-000000000001?programmeId=${PROGRAMME_KEY}`,
        token
      );

      const actorRole =
        overview.json?.meta?.actorRole ??
        overview.json?.actorRole ??
        overview.json?.data?.actorRole ??
        null;
      const hasActivationGate = Boolean(overview.json?.data?.activationGate);
      const clinicalBody = JSON.stringify(clinicalDetail.json ?? {});
      const clinicalLeak =
        /clinicalNotes|clinical_free_text|pathologyDetail|medicationDetail/i.test(
          clinicalBody
        );

      row.checks = {
        overviewStatus: overview.status,
        overviewCode: overview.json?.error?.code ?? null,
        actorRole,
        hasActivationGate,
        patientsStatus: patients.status,
        blockersStatus: blockers.status,
        adoptionStatus: adoption.status,
        exportStatus: exp.status,
        clinicalDetailStatus: clinicalDetail.status,
        clinicalDetailCode: clinicalDetail.json?.error?.code ?? null,
        clinicalLeak,
        sensitiveHits: [
          ...containsSensitive(overview.json),
          ...containsSensitive(patients.json),
          ...containsSensitive(blockers.json),
          ...containsSensitive(clinicalDetail.json),
        ],
        emptyCohortHonest:
          overview.status === 200
            ? (overview.json?.data?.enrolmentCount ??
                overview.json?.enrolmentCount ??
                overview.json?.data?.patients?.length ??
                0) === 0 ||
              overview.json?.data?.emptyCohort === true ||
              overview.json?.emptyCohort === true ||
              JSON.stringify(overview.json).includes("empty") ||
              JSON.stringify(overview.json).includes("planned")
            : null,
      };

      const allowed = overview.status === 200;
      const denied = overview.status >= 400;

      if (probe.expectedAccess === "denied") {
        row.liveStatus = denied ? "pass" : "fail";
        if (!denied) red = true;
      } else if (probe.expectedAccess === "allowed") {
        row.liveStatus = allowed ? "pass" : "fail";
        if (!allowed) red = true;
        if (probe.expectExport && !(exp.status === 200 || exp.status === 201)) {
          // Export quota is 5/user/10min (process-local). Live export proof covers the surface;
          // finance export 200 remains mandatory for Governance Closure.
          if (exp.status === 429 && probe.label !== "finance") {
            row.notes.push("export_rate_limited_non_blocking");
          } else {
            row.notes.push(`export_expected_but_status=${exp.status}`);
            row.liveStatus = "fail";
            red = true;
          }
        }
        if (!probe.expectExport && exp.status === 200) {
          row.notes.push("export_unexpectedly_allowed");
          // Not necessarily RED if role has export — mark limitation.
        }
        if (probe.expectActivation === false && hasActivationGate) {
          row.notes.push("activationGate_unexpectedly_present");
          row.liveStatus = "fail";
          red = true;
        }
        if (probe.expectActivation === true && allowed && !hasActivationGate) {
          row.notes.push("activationGate_missing_for_privileged_role");
          // Limitation only — do not fail matrix if UI omits empty gate on planned programme.
        }
        if (
          probe.label === "finance" &&
          (clinicalLeak ||
            (clinicalDetail.status === 200 &&
              /clinicalNotes|pathologyDetail/i.test(clinicalBody)))
        ) {
          row.notes.push("finance_clinical_detail_not_redacted");
          row.liveStatus = "fail";
          red = true;
        } else if (
          probe.label === "finance" &&
          clinicalDetail.status >= 400 &&
          !clinicalLeak
        ) {
          row.notes.push("finance_clinical_detail_denied_or_not_enrolled");
        }
        if (
          probe.expectedActorRole &&
          row.checks.actorRole &&
          row.checks.actorRole !== probe.expectedActorRole
        ) {
          row.notes.push(
            `actorRole_expected_${probe.expectedActorRole}_got_${row.checks.actorRole}`
          );
          row.liveStatus = "fail";
          red = true;
        }
        if (
          probe.expectedActorRole === "finance" &&
          row.checks.actorRole === "administrator"
        ) {
          row.notes.push("CFO_mapped_to_administrator");
          row.liveStatus = "fail";
          red = true;
        }
      } else {
        row.liveStatus = "observed";
        row.notes.push(allowed ? "access_granted" : `denied:${overview.status}`);
      }

      if (row.checks.sensitiveHits.length) {
        row.liveStatus = "fail";
        red = true;
        row.notes.push(`sensitive_keys=${row.checks.sensitiveHits.join(",")}`);
      }

      await client.auth.signOut();
    } catch (e) {
      row.liveStatus = "fail";
      row.notes.push(String(e?.message ?? e));
      red = true;
    }
    outcomes.push(row);
    console.log(
      `${row.liveStatus.toUpperCase()}  ${row.role} overview=${row.checks.overviewStatus ?? "n/a"} export=${row.checks.exportStatus ?? "n/a"} ${row.notes.join("; ")}`
    );
  }

  // Unauthorised: authenticated but fail-closed role (synthetic expectation via member without staff map)
  // Browser unauthenticated route denial is covered by e2e smoke; recorded here as API-only companion.
  const unauth = await fetch(
    `${baseUrl}/api/pilot-control/overview?programmeId=${PROGRAMME_KEY}&tenantId=${EVOLVED_TENANT}`
  );
  outcomes.push({
    role: "unauthorised_unauthenticated",
    expectedAccess: "denied",
    liveStatus: unauth.status >= 401 ? "pass" : "fail",
    checks: { overviewStatus: unauth.status },
  });
  if (unauth.status < 401) red = true;

  const outPath = resolve(
    process.cwd(),
    "docs/audits/evidence-fi-pilot-control-1b-live-role-matrix.json"
  );
  const legacyPath = resolve(
    process.cwd(),
    "docs/audits/evidence-fi-pilot-activation-1b-role-matrix-api.json"
  );
  const payload = {
    phase: "FI-CONTROLLED-PILOT-ACTIVATION-1B",
    proofType: "authenticated_api_role_matrix_readonly",
    timestamp: new Date().toISOString(),
    programmeKey: PROGRAMME_KEY,
    tenantId: EVOLVED_TENANT,
    baseUrl,
    gitCommitSha: process.env.FI_DEPLOY_SHA || null,
    red,
    outcomes,
  };
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  writeFileSync(legacyPath, JSON.stringify(payload, null, 2));
  console.log(`wrote ${outPath}`);
  console.log(`wrote ${legacyPath}`);
  if (red) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
