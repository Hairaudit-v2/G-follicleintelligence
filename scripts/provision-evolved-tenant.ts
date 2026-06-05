/**
 * Idempotent provision: Evolved Hair Clinics tenant (AU Perth), branding, CRM pipeline stages,
 * starter reminder templates, and seed CRM operator rows.
 *
 * Run (from repo root, with Supabase service role in env — same as the Next app):
 *   npm run dev:provision:evolved
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional:
 *   FI_EVOLVED_TENANT_SLUG (default `evolved`)
 *   FI_EVOLVED_TENANT_NAME (default `Evolved Hair Clinics`) — stored as fi_tenants.name (org display name)
 *   FI_EVOLVED_DEFAULT_TIMEZONE (default `Australia/Perth`)
 *
 * Note: `tsx` does not read `.env.local` (Next.js does). This file loads `.env.local` then `.env`
 * from the repo root so the same keys work as with `npm run dev`.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { supabaseAdmin } from "../lib/supabaseAdmin";
import { buildDefaultPipelineStageInsertRows } from "../src/lib/crm/pipelineSeedPayload";

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

loadRepoEnvFiles();

const DEFAULT_SLUG = "evolved";
const DEFAULT_NAME = "Evolved Hair Clinics";
const DEFAULT_TZ = "Australia/Perth";

/** Colours + support contact for fi_tenant_settings (brand display name = fi_tenants.name at runtime). */
const BRAND = {
  primary_colour: "#0c4a6e",
  secondary_colour: "#075985",
  accent_colour: "#0ea5e9",
  support_email: "hello@evolvedhair.com.au",
} as const;

type TemplateSeed = {
  name: string;
  type: "email" | "sms";
  trigger_event: "booking_24h_before" | "booking_48h_before" | "post_consult";
  subject: string | null;
  body: string;
};

/** Three operational templates: day-before confirm, 48h, post-consult. */
const TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    name: "24h appointment confirmation (email)",
    type: "email",
    trigger_event: "booking_24h_before",
    subject: "Tomorrow: your appointment at {{clinic_name}}",
    body: "Hi {{patient_name}}, this confirms your appointment tomorrow at {{booking_time}} at {{clinic_name}}. Reply if you need to reschedule.",
  },
  {
    name: "48h reminder (email)",
    type: "email",
    trigger_event: "booking_48h_before",
    subject: "Reminder: appointment in 48 hours",
    body: "Hi {{patient_name}}, a quick reminder about your appointment at {{booking_time}} at {{clinic_name}} (in about 48 hours).",
  },
  {
    name: "Post-consult follow-up (email)",
    type: "email",
    trigger_event: "post_consult",
    subject: "After your consultation",
    body: "Hi {{patient_name}}, thank you for visiting {{clinic_name}}. If you have any questions after your consultation, reply to this email.",
  },
];

const SEED_CRM_USERS: { email: string; role: string }[] = [
  { email: "evolved.crm.seed1@follicleintelligence.local", role: "crm_operator" },
  { email: "evolved.crm.seed2@follicleintelligence.local", role: "crm_operator" },
  { email: "evolved.crm.seed3@follicleintelligence.local", role: "crm_operator" },
];

async function main(): Promise<void> {
  const slug = (process.env.FI_EVOLVED_TENANT_SLUG ?? DEFAULT_SLUG).trim() || DEFAULT_SLUG;
  const name = (process.env.FI_EVOLVED_TENANT_NAME ?? DEFAULT_NAME).trim() || DEFAULT_NAME;
  const defaultTimezone = (process.env.FI_EVOLVED_DEFAULT_TIMEZONE ?? DEFAULT_TZ).trim() || DEFAULT_TZ;

  const supabase = supabaseAdmin();

  let tenantId: string;
  const { data: bySlug, error: findErr } = await supabase.from("fi_tenants").select("id").eq("slug", slug).maybeSingle();
  if (findErr) throw new Error(findErr.message);

  if (bySlug?.id) {
    tenantId = String((bySlug as { id: string }).id);
    console.log(`Tenant already exists (slug=${slug}): ${tenantId}`);
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from("fi_tenants")
      .insert({ name, slug })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);
    tenantId = String((inserted as { id: string }).id);
    console.log(`Created tenant (slug=${slug}, name/org_name): ${tenantId}`);
  }

  const now = new Date().toISOString();
  const { error: settingsErr } = await supabase.from("fi_tenant_settings").upsert(
    {
      tenant_id: tenantId,
      brand_name: name,
      default_timezone: defaultTimezone,
      ...BRAND,
      updated_at: now,
    },
    { onConflict: "tenant_id" }
  );
  if (settingsErr) throw new Error(settingsErr.message);
  console.log(`Upserted fi_tenant_settings (default_timezone=${defaultTimezone}, branding) for tenant ${tenantId}`);

  let stagesSeeded = 0;
  const { count: stageCount, error: stageCountErr } = await supabase
    .from("fi_crm_pipeline_stages")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .is("organisation_id", null)
    .is("clinic_id", null)
    .eq("pipeline_key", "hair_restoration_default");
  if (stageCountErr) throw new Error(stageCountErr.message);
  if ((stageCount ?? 0) === 0) {
    const insertRows = buildDefaultPipelineStageInsertRows({
      tenantId,
      organisationId: null,
      clinicId: null,
      pipelineKey: "hair_restoration_default",
    });
    const { error: stErr } = await supabase.from("fi_crm_pipeline_stages").insert(insertRows);
    if (stErr) {
      if (stErr.code === "23505") {
        console.log("CRM pipeline stages race — another writer seeded first; skipping.");
      } else {
        throw new Error(stErr.message);
      }
    } else {
      stagesSeeded = insertRows.length;
      console.log(`Inserted ${stagesSeeded} default CRM pipeline stage(s).`);
    }
  } else {
    console.log(`Skipping CRM pipeline seed (${stageCount} stage row(s) already exist for tenant default scope).`);
  }

  let templatesInserted = 0;
  const { count: tplCount, error: countErr } = await supabase
    .from("fi_reminder_templates")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if (countErr) throw new Error(countErr.message);
  if ((tplCount ?? 0) === 0) {
    const rows = TEMPLATE_SEEDS.map((t) => ({
      tenant_id: tenantId,
      name: t.name,
      type: t.type,
      trigger_event: t.trigger_event,
      subject: t.subject,
      body: t.body,
      is_active: true,
      metadata: {},
      created_at: now,
      updated_at: now,
    }));
    const { error: tplErr } = await supabase.from("fi_reminder_templates").insert(rows);
    if (tplErr) throw new Error(tplErr.message);
    templatesInserted = rows.length;
    console.log(`Inserted ${templatesInserted} reminder template(s).`);
  } else {
    console.log(`Skipping reminder template seed (${tplCount} template(s) already exist).`);
  }

  let usersInserted = 0;
  for (const u of SEED_CRM_USERS) {
    const { data: existing, error: exErr } = await supabase
      .from("fi_users")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("email", u.email)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (existing?.id) continue;
    const { error: uErr } = await supabase.from("fi_users").insert({
      tenant_id: tenantId,
      email: u.email,
      role: u.role,
      auth_user_id: null,
      created_at: now,
      updated_at: now,
    });
    if (uErr) throw new Error(uErr.message);
    usersInserted += 1;
    console.log(`Inserted fi_users seed: ${u.email} (${u.role})`);
  }
  if (usersInserted === 0) {
    console.log("Seed fi_users rows already present (matched by email).");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        tenantId,
        slug,
        orgName: name,
        defaultTimezone,
        branding: { brand_name: name, ...BRAND },
        stagesSeeded,
        templatesInserted,
        usersInserted,
        clinicOsNav:
          "Clinic OS shell: Dashboard, Calendar, Patients, Consultations, Cases, Sales (CRM when role is crm_operator or fi_admin); link auth.users to fi_users for sign-in.",
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
