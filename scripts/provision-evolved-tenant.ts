/**
 * Idempotent dev seed: Evolved Hair Clinics tenant, UK default timezone, starter reminder templates.
 *
 * Run (from repo root, with Supabase service role in env — same as the Next app):
 *   npm run dev:provision:evolved
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: FI_EVOLVED_TENANT_SLUG (default `evolved`), FI_EVOLVED_TENANT_NAME (default `Evolved Hair Clinics`)
 */
import { supabaseAdmin } from "../lib/supabaseAdmin";

const DEFAULT_SLUG = "evolved";
const DEFAULT_NAME = "Evolved Hair Clinics";
const UK_TZ = "Europe/London";

type TemplateSeed = {
  name: string;
  type: "email" | "sms";
  trigger_event:
    | "booking_created"
    | "booking_48h_before"
    | "booking_24h_before"
    | "lead_created"
    | "post_consult";
  subject: string | null;
  body: string;
};

const TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    name: "Booking confirmation (email)",
    type: "email",
    trigger_event: "booking_created",
    subject: "Your appointment at {{clinic_name}}",
    body: "Hi {{patient_name}}, your booking is confirmed for {{booking_time}}. We look forward to seeing you.",
  },
  {
    name: "48h reminder (email)",
    type: "email",
    trigger_event: "booking_48h_before",
    subject: "Reminder: appointment in 48 hours",
    body: "Hi {{patient_name}}, this is a reminder about your appointment at {{booking_time}} at {{clinic_name}}.",
  },
  {
    name: "24h reminder (email)",
    type: "email",
    trigger_event: "booking_24h_before",
    subject: "Tomorrow: your appointment",
    body: "Hi {{patient_name}}, your appointment is tomorrow at {{booking_time}} ({{clinic_name}}).",
  },
  {
    name: "24h reminder (SMS)",
    type: "sms",
    trigger_event: "booking_24h_before",
    subject: null,
    body: "Hi {{patient_name}}, reminder: appt {{booking_time}} at {{clinic_name}}.",
  },
  {
    name: "New lead follow-up (email)",
    type: "email",
    trigger_event: "lead_created",
    subject: "Thanks for your interest",
    body: "Hi {{patient_name}}, thanks for reaching out to {{clinic_name}}. A member of our team will be in touch shortly.",
  },
  {
    name: "Post-consult summary (email)",
    type: "email",
    trigger_event: "post_consult",
    subject: "After your consultation",
    body: "Hi {{patient_name}}, thank you for visiting {{clinic_name}}. If you have any questions following your consultation, reply to this email.",
  },
];

async function main(): Promise<void> {
  const slug = (process.env.FI_EVOLVED_TENANT_SLUG ?? DEFAULT_SLUG).trim() || DEFAULT_SLUG;
  const name = (process.env.FI_EVOLVED_TENANT_NAME ?? DEFAULT_NAME).trim() || DEFAULT_NAME;

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
    console.log(`Created tenant (slug=${slug}): ${tenantId}`);
  }

  const now = new Date().toISOString();
  const { error: settingsErr } = await supabase.from("fi_tenant_settings").upsert(
    {
      tenant_id: tenantId,
      brand_name: name,
      default_timezone: UK_TZ,
      updated_at: now,
    },
    { onConflict: "tenant_id" }
  );
  if (settingsErr) throw new Error(settingsErr.message);
  console.log(`Upserted fi_tenant_settings.default_timezone=${UK_TZ} for tenant ${tenantId}`);

  const { count, error: countErr } = await supabase
    .from("fi_reminder_templates")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if (countErr) throw new Error(countErr.message);
  if ((count ?? 0) > 0) {
    console.log(`Skipping reminder template seed (${count} template(s) already exist).`);
    console.log(JSON.stringify({ ok: true, tenantId, slug, templatesInserted: 0 }, null, 2));
    return;
  }

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
  console.log(`Inserted ${rows.length} reminder template(s).`);
  console.log(JSON.stringify({ ok: true, tenantId, slug, templatesInserted: rows.length }, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
