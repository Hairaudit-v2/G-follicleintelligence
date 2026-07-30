/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B — live export surface proof (read-only).
 * Proves approved export combinations and safe failures against production.
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
  "https://follicleintelligence.ai"
).replace(/\/$/, "");

function isoDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

async function magicLinkSession(email) {
  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr) throw linkErr;
  const hashed =
    linkData?.properties?.hashed_token ||
    linkData?.properties?.email_otp ||
    null;
  if (!hashed) throw new Error(`No hashed token for ${email}`);
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.verifyOtp({
    type: "email",
    token_hash: hashed,
  });
  if (error) throw error;
  return { client, session: data.session, label: email };
}

async function passwordSession(email, password) {
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(error?.message ?? "password_sign_in_failed");
  return { client, session: data.session, label: email };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function api(path, token, opts = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: opts.accept || "application/json",
    ...(opts.headers || {}),
  };
  // Default Evolved tenant context unless caller opts out (wrong-tenant probe).
  if (opts.tenantId !== null && opts.tenantId !== undefined) {
    headers["x-fi-tenant-id"] = opts.tenantId;
  } else if (opts.omitTenantHeader !== true) {
    headers["x-fi-tenant-id"] = EVOLVED_TENANT;
  }

  let last = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers,
    });
    const contentType = res.headers.get("content-type") || "";
    let bodyText = "";
    let json = null;
    bodyText = await res.text();
    if (contentType.includes("application/json") || bodyText.trim().startsWith("{")) {
      try {
        json = JSON.parse(bodyText);
      } catch {
        json = null;
      }
    }
    last = {
      status: res.status,
      contentType,
      bodyText: bodyText.slice(0, 4000),
      json,
      correlationId:
        json?.error?.correlationId ||
        res.headers.get("x-correlation-id") ||
        null,
    };
    // Export quota is 5 / user / 10 min (process-local). Back off hard before giving up.
    if (res.status !== 429) return last;
    await sleep(Math.min(120_000, 8_000 * (attempt + 1)));
  }
  return last;
}

function hasFormulaInjection(csvText) {
  // Fail if a cell value starts a line/field with = + - @ without leading apostrophe
  const lines = csvText.split(/\r?\n/).slice(1);
  for (const line of lines) {
    const cells = line.split(",");
    for (const cell of cells) {
      const raw = cell.replace(/^"/, "").replace(/"$/, "");
      if (/^[=+\-@]/.test(raw) && !raw.startsWith("'")) return true;
    }
  }
  return false;
}

async function main() {
  if (!url || !anon || !serviceRole) {
    throw new Error("Missing Supabase env for live export proof");
  }

  const proofs = [];
  let red = false;

  const finance = await magicLinkSession("harsh@evolvedhair.com.au");
  const wrongTenant = await magicLinkSession("reception@evolvedhair.com.au");
  // Prefer admin password when available — spreads export quota (5/user/10min) off director.
  let privileged = null;
  const adminEmail = process.env.FI_E2E_PRODUCTION_ADMIN_EMAIL?.trim() || "auditor@hairaudit.com";
  const adminPassword = process.env.FI_E2E_PRODUCTION_ADMIN_PASSWORD?.trim();
  if (adminPassword) {
    privileged = await passwordSession(adminEmail, adminPassword);
  } else {
    privileged = await magicLinkSession("paul@evolvedhair.com.au");
  }

  const from = isoDaysAgo(7);
  const to = new Date().toISOString();
  const wideFrom = isoDaysAgo(45);

  // Spread across finance + privileged so live proofs survive the 5/export/10min cap.
  const approved = [
    { type: "patient_register", format: "csv", actor: "finance" },
    { type: "patient_register", format: "json", actor: "privileged" },
    { type: "active_blockers", format: "csv", actor: "privileged" },
    { type: "programme_summary", format: "csv", actor: "finance" },
    {
      type: "activity_summary",
      format: "csv",
      from,
      to,
      actor: "privileged",
    },
  ];

  const tokenFor = (actor) =>
    actor === "finance" ? finance.session.access_token : privileged.session.access_token;

  for (const combo of approved) {
    await sleep(500);
    const qs = new URLSearchParams({
      programmeId: PROGRAMME_KEY,
      type: combo.type,
      format: combo.format,
    });
    if (combo.from) qs.set("from", combo.from);
    if (combo.to) qs.set("to", combo.to);
    const r = await api(`/api/pilot-control/export?${qs}`, tokenFor(combo.actor), {
      accept: combo.format === "csv" ? "text/csv" : "application/json",
    });
    const ok = r.status === 200;
    if (!ok) red = true;
    proofs.push({
      case: `approved_${combo.type}_${combo.format}`,
      expected: 200,
      status: r.status,
      code: r.json?.error?.code ?? null,
      contentType: r.contentType,
      actor: combo.actor,
      pass: ok,
      formulaInjectionDetected:
        combo.format === "csv" && ok ? hasFormulaInjection(r.bodyText) : null,
    });
    if (combo.format === "csv" && ok && hasFormulaInjection(r.bodyText)) {
      red = true;
    }
  }

  // Invalid type (privileged actor — not counted against finance export quota for finance projection)
  {
    const r = await api(
      `/api/pilot-control/export?programmeId=${PROGRAMME_KEY}&format=json&type=overview`,
      privileged.session.access_token
    );
    const pass =
      r.status === 400 && r.json?.error?.code === "PILOT_CONTROL_INVALID_EXPORT_TYPE";
    if (!pass) red = true;
    proofs.push({
      case: "invalid_type_overview",
      expected: "400 PILOT_CONTROL_INVALID_EXPORT_TYPE",
      status: r.status,
      code: r.json?.error?.code ?? null,
      pass,
    });
  }

  // Invalid format
  {
    const r = await api(
      `/api/pilot-control/export?programmeId=${PROGRAMME_KEY}&format=xlsx&type=programme_summary`,
      finance.session.access_token
    );
    const pass =
      r.status === 400 &&
      r.json?.error?.code === "PILOT_CONTROL_INVALID_EXPORT_FORMAT";
    if (!pass) red = true;
    proofs.push({
      case: "invalid_format_xlsx",
      expected: "400 PILOT_CONTROL_INVALID_EXPORT_FORMAT",
      status: r.status,
      code: r.json?.error?.code ?? null,
      pass,
    });
  }

  // Activity range > 31 days
  {
    const qs = new URLSearchParams({
      programmeId: PROGRAMME_KEY,
      type: "activity_summary",
      format: "json",
      from: wideFrom,
      to,
    });
    const r = await api(`/api/pilot-control/export?${qs}`, privileged.session.access_token);
    const pass =
      r.status === 400 &&
      (r.json?.error?.code === "PILOT_CONTROL_DATE_RANGE_TOO_WIDE" ||
        r.json?.error?.code === "PILOT_CONTROL_INVALID_FILTER");
    if (!pass) red = true;
    proofs.push({
      case: "activity_range_too_wide",
      expected: "400 DATE_RANGE_TOO_WIDE or INVALID_FILTER",
      status: r.status,
      code: r.json?.error?.code ?? null,
      pass,
    });
  }

  // Wrong tenant — no existence leak of Evolved programme
  {
    const r = await api(
      `/api/pilot-control/export?programmeId=${PROGRAMME_KEY}&format=json&type=programme_summary&tenantId=${EVOLVED_TENANT}`,
      wrongTenant.session.access_token
    );
    const pass = r.status === 403 || r.status === 404;
    const body = JSON.stringify(r.json ?? {});
    const leak =
      /enrolment|patient_register|rowCount|evolved_controlled_pilot/i.test(body) &&
      r.status === 200;
    if (!pass || leak) red = true;
    proofs.push({
      case: "wrong_tenant_export",
      expected: "403/404 no disclosure",
      status: r.status,
      code: r.json?.error?.code ?? null,
      pass: pass && !leak,
      bodySnippet: body.slice(0, 240),
    });
  }

  // Finance export: permitted fields only
  {
    const r = await api(
      `/api/pilot-control/export?programmeId=${PROGRAMME_KEY}&format=json&type=patient_register`,
      finance.session.access_token
    );
    const body = r.bodyText || "";
    const clinicalLeak = /clinicalDetail|pathologyDetail|pathologyProvenance|medicationDetail/i.test(
      body
    );
    const pass = r.status === 200 && !clinicalLeak;
    if (!pass) red = true;
    proofs.push({
      case: "finance_patient_register_projection",
      expected: "200 without clinical/pathology fields",
      status: r.status,
      code: r.json?.error?.code ?? null,
      actorRole: r.json?.meta?.actorRole ?? null,
      pass,
      clinicalLeak,
    });
  }

  // Activation denied for finance (overview may omit activationGate)
  {
    const overview = await api(
      `/api/pilot-control/overview?programmeId=${PROGRAMME_KEY}`,
      finance.session.access_token
    );
    const actorRole = overview.json?.meta?.actorRole ?? null;
    const hasActivation = Boolean(overview.json?.data?.activationGate);
    const pass =
      overview.status === 200 &&
      actorRole === "finance" &&
      hasActivation === false;
    if (!pass) red = true;
    proofs.push({
      case: "finance_activation_surface_denied",
      expected: "actorRole=finance and no activationGate",
      status: overview.status,
      actorRole,
      hasActivationGate: hasActivation,
      pass,
    });
  }

  // Audit event metadata-only check via service role (latest export event)
  let auditProof = { pass: false, note: "not_checked" };
  {
    const admin = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin
      .from("fi_pilot_control_events")
      .select("id, event_kind, payload, created_at, actor_type")
      .eq("event_kind", "pilot_control_export_created")
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) {
      auditProof = { pass: false, note: error.message.slice(0, 200) };
      red = true;
    } else {
      const latest = (data ?? [])[0];
      const payload = latest?.payload ?? {};
      const forbidden = ["rows", "data", "records", "patients", "blockers", "csv", "body"];
      const hasContent = forbidden.some((k) => payload?.[k] != null);
      const hasMeta =
        payload?.exportType != null &&
        payload?.format != null &&
        payload?.rowCount != null;
      auditProof = {
        pass: Boolean(latest) && hasMeta && !hasContent,
        latestId: latest?.id ?? null,
        createdAt: latest?.created_at ?? null,
        payloadKeys: latest ? Object.keys(payload) : [],
        hasRowContent: hasContent,
        hasMeta,
      };
      if (!auditProof.pass) red = true;
    }
  }

  await privileged.client.auth.signOut();
  await finance.client.auth.signOut();
  await wrongTenant.client.auth.signOut();

  const out = {
    phase: "FI-CONTROLLED-PILOT-ACTIVATION-1B",
    proofType: "authenticated_export_surface_readonly",
    timestamp: new Date().toISOString(),
    programmeKey: PROGRAMME_KEY,
    tenantId: EVOLVED_TENANT,
    baseUrl,
    gitCommitSha: process.env.FI_DEPLOY_SHA || null,
    red,
    proofs,
    auditEvent: auditProof,
  };

  const outPath = resolve(
    process.cwd(),
    "docs/audits/evidence-fi-pilot-control-1b-live-export.json"
  );
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ red, passed: proofs.filter((p) => p.pass).length, total: proofs.length, outPath }, null, 2));
  for (const p of proofs) {
    console.log(`${p.pass ? "PASS" : "FAIL"}  ${p.case} status=${p.status} code=${p.code ?? "-"}`);
  }
  console.log(`${auditProof.pass ? "PASS" : "FAIL"}  export_audit_event`);
  if (red) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
