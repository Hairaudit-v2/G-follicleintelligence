import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureDefaultPipelineStages } from "@/src/lib/crm/pipeline";

import {
  SANDBOX_SEED_EMAIL_DOMAIN,
  SANDBOX_SEED_PHONE_PREFIX,
  SANDBOX_SEED_SOURCE,
} from "./sandboxSeedCatalog";
import { buildSandboxSeedRecordMetadata, resolveSandboxSeedPack } from "./tenantProvisioningCore";
import type {
  ClinicDeploymentPlan,
  ClinicDeploymentTemplateCode,
  SandboxSeedEntityCounts,
  SandboxSeedEntityType,
  SandboxSeedHistoryEntry,
  SandboxSeedPackCode,
  SandboxSeedPlan,
} from "./tenantProvisioningTypes";

const DEMO_PERSON_SOURCE = SANDBOX_SEED_SOURCE;
const FIXED_EPOCH = "2026-06-01T00:00:00.000Z";

type ApplyContext = {
  supabase: SupabaseClient;
  tenantId: string;
  sessionId: string;
  clinicId: string;
  timezone: string;
  plan: SandboxSeedPlan;
  deploymentPlan: ClinicDeploymentPlan;
  packCode: SandboxSeedPackCode;
  generatedAt: string;
};

type EntityMaps = {
  surgeryIds: string[];
};

function entityKey(
  packCode: SandboxSeedPackCode,
  entityType: SandboxSeedEntityType,
  index: number
): string {
  return `${packCode}:${entityType}:${String(index).padStart(3, "0")}`;
}

function sandboxMetadata(
  ctx: ApplyContext,
  entityType: SandboxSeedEntityType,
  index: number
): Record<string, unknown> {
  return buildSandboxSeedRecordMetadata({
    seedPack: ctx.packCode,
    sessionId: ctx.sessionId,
    generatedAt: ctx.generatedAt,
    entityKey: entityKey(ctx.packCode, entityType, index),
    entityType,
  });
}

function countFor(ctx: ApplyContext, entityType: SandboxSeedEntityType): number {
  const row = ctx.plan.entities.find((e) => e.entityType === entityType);
  return row?.included ? row.count : 0;
}

async function findExistingByEntityKey(
  supabase: SupabaseClient,
  table: string,
  tenantId: string,
  entityKeyValue: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("tenant_id", tenantId)
    .contains("metadata", { sandbox_entity_key: entityKeyValue })
    .maybeSingle();
  if (error || !data) return null;
  return String((data as { id: string }).id);
}

async function findExistingStaffByEntityKey(
  supabase: SupabaseClient,
  tenantId: string,
  entityKeyValue: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("fi_staff")
    .select("id")
    .eq("tenant_id", tenantId)
    .contains("staff_metadata", { sandbox_entity_key: entityKeyValue })
    .maybeSingle();
  if (error || !data) return null;
  return String((data as { id: string }).id);
}

async function loadDefaultClinicId(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("fi_clinics")
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return String((data as { id: string }).id);
}

async function seedStaff(ctx: ApplyContext, counts: SandboxSeedEntityCounts): Promise<string[]> {
  const total = countFor(ctx, "staff");
  const roleSeeds = ctx.deploymentPlan.rolePack.staffRoleSeeds ?? [
    "consultant",
    "crm_operator",
    "nurse",
  ];
  const ids: string[] = [];

  for (let i = 0; i < total; i += 1) {
    const key = entityKey(ctx.packCode, "staff", i);
    const existingId = await findExistingStaffByEntityKey(ctx.supabase, ctx.tenantId, key);
    if (existingId) {
      ids.push(existingId);
      counts.staff = {
        created: counts.staff?.created ?? 0,
        existing: (counts.staff?.existing ?? 0) + 1,
      };
      continue;
    }

    const role = roleSeeds[i % roleSeeds.length] ?? "consultant";
    const label = String.fromCharCode(65 + (i % 26));
    const fullName = `Sandbox Staff ${label}-${String(i + 1).padStart(2, "0")}`;
    const email = `sandbox-staff-${role}-${String(i + 1).padStart(2, "0")}@${SANDBOX_SEED_EMAIL_DOMAIN}`;

    const { data, error } = await ctx.supabase
      .from("fi_staff")
      .insert({
        tenant_id: ctx.tenantId,
        full_name: fullName,
        staff_role: role,
        email,
        mobile: `${SANDBOX_SEED_PHONE_PREFIX}${String(10 + i).padStart(2, "0")}`,
        default_timezone: ctx.timezone,
        working_hours: {
          weekly: {
            mon: { enabled: true, start: "09:00", end: "17:00" },
            tue: { enabled: true, start: "09:00", end: "17:00" },
            wed: { enabled: true, start: "09:00", end: "17:00" },
            thu: { enabled: true, start: "09:00", end: "17:00" },
            fri: { enabled: true, start: "09:00", end: "17:00" },
            sat: { enabled: false },
            sun: { enabled: false },
          },
        },
        staff_metadata: sandboxMetadata(ctx, "staff", i),
        calendar_color: ["#0ea5e9", "#22c55e", "#a855f7", "#f97316", "#14b8a6"][i % 5],
        is_active: true,
      })
      .select("id")
      .single();

    if (error || !data) throw new Error(error?.message ?? "Failed to insert sandbox staff.");
    ids.push(String((data as { id: string }).id));
    counts.staff = {
      created: (counts.staff?.created ?? 0) + 1,
      existing: counts.staff?.existing ?? 0,
    };
  }

  return ids;
}

async function seedPatients(
  ctx: ApplyContext,
  counts: SandboxSeedEntityCounts
): Promise<{ personIds: string[]; patientIds: string[] }> {
  const total = countFor(ctx, "patients");
  const personIds: string[] = [];
  const patientIds: string[] = [];

  for (let i = 0; i < total; i += 1) {
    const key = entityKey(ctx.packCode, "patients", i);
    const existingPatientId = await findExistingByEntityKey(
      ctx.supabase,
      "fi_patients",
      ctx.tenantId,
      key
    );
    if (existingPatientId) {
      patientIds.push(existingPatientId);
      counts.patients = {
        created: counts.patients?.created ?? 0,
        existing: (counts.patients?.existing ?? 0) + 1,
      };
      const { data: patientRow } = await ctx.supabase
        .from("fi_patients")
        .select("person_id")
        .eq("id", existingPatientId)
        .maybeSingle();
      if (patientRow) personIds.push(String((patientRow as { person_id: string }).person_id));
      continue;
    }

    const label = String.fromCharCode(65 + (i % 26));
    const displayName = `Sandbox Patient ${label}-${String(i + 1).padStart(3, "0")}`;
    const email = `sandbox-patient-${String(i + 1).padStart(3, "0")}@${SANDBOX_SEED_EMAIL_DOMAIN}`;
    const personMeta = {
      ...sandboxMetadata(ctx, "patients", i),
      display_name: displayName,
      email,
      phone: `${SANDBOX_SEED_PHONE_PREFIX}${String(20 + i).padStart(2, "0")}`,
    };

    const { data: person, error: personErr } = await ctx.supabase
      .from("fi_persons")
      .insert({ tenant_id: ctx.tenantId, metadata: personMeta })
      .select("id")
      .single();
    if (personErr || !person)
      throw new Error(personErr?.message ?? "Failed to insert sandbox person.");

    const personId = String((person as { id: string }).id);
    personIds.push(personId);

    await ctx.supabase.from("fi_person_source_ids").insert({
      tenant_id: ctx.tenantId,
      person_id: personId,
      source_system: DEMO_PERSON_SOURCE,
      source_person_id: key,
    });

    const { data: patient, error: patientErr } = await ctx.supabase
      .from("fi_patients")
      .insert({
        tenant_id: ctx.tenantId,
        person_id: personId,
        primary_clinic_id: ctx.clinicId,
        metadata: sandboxMetadata(ctx, "patients", i),
      })
      .select("id")
      .single();
    if (patientErr || !patient)
      throw new Error(patientErr?.message ?? "Failed to insert sandbox patient.");

    const patientId = String((patient as { id: string }).id);
    patientIds.push(patientId);

    await ctx.supabase.from("fi_patient_source_ids").insert({
      tenant_id: ctx.tenantId,
      patient_id: patientId,
      source_system: DEMO_PERSON_SOURCE,
      source_patient_id: key,
    });

    counts.patients = {
      created: (counts.patients?.created ?? 0) + 1,
      existing: counts.patients?.existing ?? 0,
    };
  }

  return { personIds, patientIds };
}

async function seedLeads(
  ctx: ApplyContext,
  counts: SandboxSeedEntityCounts,
  personIds: string[],
  patientIds: string[]
): Promise<string[]> {
  const total = Math.min(countFor(ctx, "leads"), personIds.length);
  const leadIds: string[] = [];
  const { stages } = await ensureDefaultPipelineStages({ tenantId: ctx.tenantId }, ctx.supabase);
  const entryStage = stages.find((s) => s.is_entry) ?? stages[0] ?? null;

  for (let i = 0; i < total; i += 1) {
    const key = entityKey(ctx.packCode, "leads", i);
    const existingId = await findExistingByEntityKey(
      ctx.supabase,
      "fi_crm_leads",
      ctx.tenantId,
      key
    );
    if (existingId) {
      leadIds.push(existingId);
      counts.leads = {
        created: counts.leads?.created ?? 0,
        existing: (counts.leads?.existing ?? 0) + 1,
      };
      continue;
    }

    const { data, error } = await ctx.supabase
      .from("fi_crm_leads")
      .insert({
        tenant_id: ctx.tenantId,
        clinic_id: ctx.clinicId,
        person_id: personIds[i],
        patient_id: patientIds[i] ?? null,
        current_stage_id: entryStage?.id ?? null,
        status: "open",
        summary: `Sandbox lead inquiry #${i + 1}`,
        metadata: sandboxMetadata(ctx, "leads", i),
      })
      .select("id")
      .single();

    if (error || !data) throw new Error(error?.message ?? "Failed to insert sandbox lead.");
    leadIds.push(String((data as { id: string }).id));
    counts.leads = {
      created: (counts.leads?.created ?? 0) + 1,
      existing: counts.leads?.existing ?? 0,
    };
  }

  return leadIds;
}

async function seedConsultations(
  ctx: ApplyContext,
  counts: SandboxSeedEntityCounts,
  personIds: string[],
  patientIds: string[],
  leadIds: string[]
): Promise<string[]> {
  const total = Math.min(countFor(ctx, "consultations"), patientIds.length);
  const consultationIds: string[] = [];
  const consultationTypes = ["scalp_hair_transplant", "medical_hair_loss", "prp_prf"] as const;

  for (let i = 0; i < total; i += 1) {
    const key = entityKey(ctx.packCode, "consultations", i);
    const { data: existing } = await ctx.supabase
      .from("fi_consultations")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .contains("structured_data", { sandbox_entity_key: key })
      .maybeSingle();

    if (existing) {
      consultationIds.push(String((existing as { id: string }).id));
      counts.consultations = {
        created: counts.consultations?.created ?? 0,
        existing: (counts.consultations?.existing ?? 0) + 1,
      };
      continue;
    }

    const consultationDate = new Date(Date.parse(FIXED_EPOCH) + i * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const structured = {
      ...sandboxMetadata(ctx, "consultations", i),
      sandbox_training_note: "Demo consultation workspace — not real clinical data.",
    };

    const { data, error } = await ctx.supabase
      .from("fi_consultations")
      .insert({
        tenant_id: ctx.tenantId,
        person_id: personIds[i] ?? null,
        patient_id: patientIds[i] ?? null,
        lead_id: leadIds[i] ?? null,
        consultation_type: consultationTypes[i % consultationTypes.length],
        status: i % 3 === 0 ? "completed" : "quoted",
        consultant_name: "Sandbox Consultant",
        consultation_date: consultationDate,
        structured_data: structured,
        quote_data: { price_quoted: 250000 + i * 10000, quote_status: "issued", synthetic: true },
      })
      .select("id")
      .single();

    if (error || !data) throw new Error(error?.message ?? "Failed to insert sandbox consultation.");
    consultationIds.push(String((data as { id: string }).id));
    counts.consultations = {
      created: (counts.consultations?.created ?? 0) + 1,
      existing: counts.consultations?.existing ?? 0,
    };
  }

  return consultationIds;
}

async function seedAppointments(
  ctx: ApplyContext,
  counts: SandboxSeedEntityCounts,
  personIds: string[],
  patientIds: string[],
  leadIds: string[],
  staffIds: string[]
): Promise<string[]> {
  const total = countFor(ctx, "appointments");
  const bookingIds: string[] = [];
  const bookingTypes = ["consultation", "follow_up", "prp", "surgery"] as const;

  for (let i = 0; i < total; i += 1) {
    const key = entityKey(ctx.packCode, "appointments", i);
    const existingId = await findExistingByEntityKey(
      ctx.supabase,
      "fi_bookings",
      ctx.tenantId,
      key
    );
    if (existingId) {
      bookingIds.push(existingId);
      counts.appointments = {
        created: counts.appointments?.created ?? 0,
        existing: (counts.appointments?.existing ?? 0) + 1,
      };
      continue;
    }

    const personIdx = i % Math.max(personIds.length, 1);
    const start = new Date(Date.parse(FIXED_EPOCH) + (i + 1) * 86_400_000 + 10 * 3_600_000);
    const end = new Date(start.getTime() + 45 * 60_000);

    const { data, error } = await ctx.supabase
      .from("fi_bookings")
      .insert({
        tenant_id: ctx.tenantId,
        clinic_id: ctx.clinicId,
        person_id: personIds[personIdx] ?? null,
        patient_id: patientIds[personIdx] ?? null,
        lead_id: leadIds[personIdx] ?? null,
        assigned_staff_id: staffIds[i % Math.max(staffIds.length, 1)] ?? null,
        booking_type: bookingTypes[i % bookingTypes.length],
        booking_status: i % 4 === 0 ? "completed" : "confirmed",
        title: `Sandbox appointment #${i + 1}`,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        timezone: ctx.timezone,
        metadata: sandboxMetadata(ctx, "appointments", i),
      })
      .select("id")
      .single();

    if (error || !data) throw new Error(error?.message ?? "Failed to insert sandbox booking.");
    bookingIds.push(String((data as { id: string }).id));
    counts.appointments = {
      created: (counts.appointments?.created ?? 0) + 1,
      existing: counts.appointments?.existing ?? 0,
    };
  }

  return bookingIds;
}

async function seedSurgeries(
  ctx: ApplyContext,
  counts: SandboxSeedEntityCounts,
  patientIds: string[],
  bookingIds: string[]
): Promise<string[]> {
  const total = Math.min(countFor(ctx, "surgeries"), patientIds.length);
  const surgeryIds: string[] = [];

  for (let i = 0; i < total; i += 1) {
    const key = entityKey(ctx.packCode, "surgeries", i);
    const existingId = await findExistingByEntityKey(
      ctx.supabase,
      "fi_surgeries",
      ctx.tenantId,
      key
    );
    if (existingId) {
      surgeryIds.push(existingId);
      counts.surgeries = {
        created: counts.surgeries?.created ?? 0,
        existing: (counts.surgeries?.existing ?? 0) + 1,
      };
      continue;
    }

    const scheduledDate = new Date(Date.parse(FIXED_EPOCH) + (i + 14) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const metadata = {
      ...sandboxMetadata(ctx, "surgeries", i),
      surgery_os_metric_placeholder: {
        target_grafts: 1800 + i * 100,
        extraction_rate_per_hour: 900 + i * 10,
        implantation_completion_pct: 55 + i * 5,
      },
    };

    const { data, error } = await ctx.supabase
      .from("fi_surgeries")
      .insert({
        tenant_id: ctx.tenantId,
        patient_id: patientIds[i],
        booking_id: bookingIds[i] ?? null,
        status: i === 0 ? "scheduled" : "pre_op",
        live_status: "waiting",
        procedure_phase: "pre_op",
        target_grafts: 1800 + i * 100,
        scheduled_date: scheduledDate,
        readiness_percent: 40 + i * 5,
        readiness_risk_level: "medium",
        metadata,
      })
      .select("id")
      .single();

    if (error || !data) throw new Error(error?.message ?? "Failed to insert sandbox surgery.");
    surgeryIds.push(String((data as { id: string }).id));
    counts.surgeries = {
      created: (counts.surgeries?.created ?? 0) + 1,
      existing: counts.surgeries?.existing ?? 0,
    };
  }

  return surgeryIds;
}

async function seedInvoicesAndPayments(
  ctx: ApplyContext,
  counts: SandboxSeedEntityCounts,
  patientIds: string[],
  leadIds: string[],
  consultationIds: string[]
): Promise<void> {
  const invoiceTotal = Math.min(countFor(ctx, "invoices"), patientIds.length);
  const paymentTotal = countFor(ctx, "payments");
  const invoiceIds: string[] = [];

  for (let i = 0; i < invoiceTotal; i += 1) {
    const key = entityKey(ctx.packCode, "invoices", i);
    const existingId = await findExistingByEntityKey(
      ctx.supabase,
      "fi_invoices",
      ctx.tenantId,
      key
    );
    if (existingId) {
      invoiceIds.push(existingId);
      counts.invoices = {
        created: counts.invoices?.created ?? 0,
        existing: (counts.invoices?.existing ?? 0) + 1,
      };
      continue;
    }

    const amountCents = 150000 + i * 25000;
    const metadata = {
      ...sandboxMetadata(ctx, "invoices", i),
      financial_os_metric_placeholder: {
        collection_rate_pct: 72 + i,
        outstanding_cents: amountCents / 2,
        synthetic: true,
      },
    };

    const { data, error } = await ctx.supabase
      .from("fi_invoices")
      .insert({
        tenant_id: ctx.tenantId,
        clinic_id: ctx.clinicId,
        patient_id: patientIds[i],
        lead_id: leadIds[i] ?? null,
        consultation_id: consultationIds[i] ?? null,
        invoice_kind: i % 2 === 0 ? "consultation_quote" : "surgery_deposit",
        status: i % 3 === 0 ? "paid" : "issued",
        amount_cents: amountCents,
        tax_cents: Math.round(amountCents * 0.1),
        total_cents: amountCents + Math.round(amountCents * 0.1),
        amount_paid_cents: i % 3 === 0 ? amountCents : 0,
        currency: "AUD",
        due_date: new Date(Date.parse(FIXED_EPOCH) + (i + 30) * 86_400_000)
          .toISOString()
          .slice(0, 10),
        invoice_number: `SBX-INV-${String(i + 1).padStart(4, "0")}`,
        title: `Sandbox invoice #${i + 1}`,
        metadata,
      })
      .select("id")
      .single();

    if (error || !data) throw new Error(error?.message ?? "Failed to insert sandbox invoice.");
    const invoiceId = String((data as { id: string }).id);
    invoiceIds.push(invoiceId);
    counts.invoices = {
      created: (counts.invoices?.created ?? 0) + 1,
      existing: counts.invoices?.existing ?? 0,
    };

    await ctx.supabase.from("fi_invoice_items").insert({
      tenant_id: ctx.tenantId,
      invoice_id: invoiceId,
      description: "Sandbox treatment line item (demo only)",
      quantity: 1,
      unit_amount_cents: amountCents,
      line_total_cents: amountCents,
      metadata: sandboxMetadata(ctx, "invoices", i),
    });
  }

  for (let i = 0; i < Math.min(paymentTotal, invoiceIds.length); i += 1) {
    const key = entityKey(ctx.packCode, "payments", i);
    const { data: existing } = await ctx.supabase
      .from("fi_payments")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .contains("metadata", { sandbox_entity_key: key })
      .maybeSingle();

    if (existing) {
      counts.payments = {
        created: counts.payments?.created ?? 0,
        existing: (counts.payments?.existing ?? 0) + 1,
      };
      continue;
    }

    const amountCents = 75000 + i * 15000;
    const taxCents = Math.round(amountCents * 0.1);
    const { error } = await ctx.supabase.from("fi_payments").insert({
      tenant_id: ctx.tenantId,
      clinic_id: ctx.clinicId,
      invoice_id: invoiceIds[i],
      patient_id: patientIds[i] ?? null,
      status: "succeeded",
      amount_cents: amountCents,
      tax_cents: taxCents,
      total_cents: amountCents + taxCents,
      currency: "AUD",
      provider: "sandbox_demo",
      provider_ref: key,
      metadata: sandboxMetadata(ctx, "payments", i),
    });

    if (error) throw new Error(error.message);
    counts.payments = {
      created: (counts.payments?.created ?? 0) + 1,
      existing: counts.payments?.existing ?? 0,
    };
  }
}

async function seedMetricPlaceholders(
  ctx: ApplyContext,
  counts: SandboxSeedEntityCounts,
  maps: EntityMaps
): Promise<void> {
  const academyCount = countFor(ctx, "academy_readiness");
  const surgeryMetricCount = countFor(ctx, "surgery_os_metrics");
  const financialMetricCount = countFor(ctx, "financial_os_metrics");

  if (academyCount + surgeryMetricCount + financialMetricCount === 0) return;

  const { data: settingsRow, error: loadErr } = await ctx.supabase
    .from("fi_tenant_settings")
    .select("id, metadata")
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);

  const existingMeta =
    settingsRow?.metadata &&
    typeof settingsRow.metadata === "object" &&
    !Array.isArray(settingsRow.metadata)
      ? (settingsRow.metadata as Record<string, unknown>)
      : {};

  const placeholders = {
    academy_readiness: Array.from({ length: academyCount }, (_, i) => ({
      ...sandboxMetadata(ctx, "academy_readiness", i),
      track_code:
        ctx.deploymentPlan.academyAssignments[
          i % Math.max(ctx.deploymentPlan.academyAssignments.length, 1)
        ]?.trackCode ?? "fi_clinical_foundations",
      readiness_pct: 35 + i * 8,
      mandatory: i % 2 === 0,
    })),
    surgery_os_metrics: Array.from({ length: surgeryMetricCount }, (_, i) => ({
      ...sandboxMetadata(ctx, "surgery_os_metrics", i),
      surgery_id: maps.surgeryIds[i] ?? null,
      theatre_utilisation_pct: 62 + i * 3,
      graft_velocity_per_hour: 850 + i * 15,
    })),
    financial_os_metrics: Array.from({ length: financialMetricCount }, (_, i) => ({
      ...sandboxMetadata(ctx, "financial_os_metrics", i),
      revenue_mtd_cents: 450000 + i * 50000,
      collection_rate_pct: 68 + i * 2,
      outstanding_invoices: 2 + i,
    })),
  };

  const nextMeta = {
    ...existingMeta,
    onboarding_sandbox_seed_placeholders: placeholders,
    demo_data: true,
    source: SANDBOX_SEED_SOURCE,
    seed_pack: ctx.packCode,
    session_id: ctx.sessionId,
    generated_at: ctx.generatedAt,
  };

  if (settingsRow) {
    const { error } = await ctx.supabase
      .from("fi_tenant_settings")
      .update({ metadata: nextMeta, updated_at: new Date().toISOString() })
      .eq("id", (settingsRow as { id: string }).id);
    if (error) throw new Error(error.message);
  }

  if (academyCount > 0) counts.academy_readiness = { created: academyCount, existing: 0 };
  if (surgeryMetricCount > 0)
    counts.surgery_os_metrics = { created: surgeryMetricCount, existing: 0 };
  if (financialMetricCount > 0)
    counts.financial_os_metrics = { created: financialMetricCount, existing: 0 };
}

function summariseCounts(
  counts: SandboxSeedEntityCounts
): Partial<Record<SandboxSeedEntityType, number>> {
  const summary: Partial<Record<SandboxSeedEntityType, number>> = {};
  for (const [key, value] of Object.entries(counts)) {
    const entityType = key as SandboxSeedEntityType;
    summary[entityType] = (value?.created ?? 0) + (value?.existing ?? 0);
  }
  return summary;
}

export async function executeSandboxSeedApply(opts: {
  supabase: SupabaseClient;
  tenantId: string;
  sessionId: string;
  timezone: string;
  plan: SandboxSeedPlan;
  deploymentPlan: ClinicDeploymentPlan;
  packCode: SandboxSeedPackCode;
  generatedAt: string;
}): Promise<{ entityCounts: SandboxSeedEntityCounts; warnings: string[] }> {
  const clinicId = await loadDefaultClinicId(opts.supabase, opts.tenantId);
  if (!clinicId) throw new Error("Default clinic not found for tenant.");

  const ctx: ApplyContext = {
    supabase: opts.supabase,
    tenantId: opts.tenantId,
    sessionId: opts.sessionId,
    clinicId,
    timezone: opts.timezone,
    plan: opts.plan,
    deploymentPlan: opts.deploymentPlan,
    packCode: opts.packCode,
    generatedAt: opts.generatedAt,
  };

  const counts: SandboxSeedEntityCounts = {};
  const warnings: string[] = [];

  const staffIds = await seedStaff(ctx, counts);
  const { personIds, patientIds } = await seedPatients(ctx, counts);
  const leadIds = await seedLeads(ctx, counts, personIds, patientIds);
  const consultationIds = await seedConsultations(ctx, counts, personIds, patientIds, leadIds);
  const bookingIds = await seedAppointments(ctx, counts, personIds, patientIds, leadIds, staffIds);
  const surgeryIds = await seedSurgeries(ctx, counts, patientIds, bookingIds);
  await seedInvoicesAndPayments(ctx, counts, patientIds, leadIds, consultationIds);
  await seedMetricPlaceholders(ctx, counts, { surgeryIds });

  if (opts.plan.totalRecords === 0) {
    warnings.push("No entities were included — check sandbox toggles and module entitlements.");
  }

  return { entityCounts: counts, warnings };
}

export function buildHistoryEntryFromApply(opts: {
  plan: SandboxSeedPlan;
  appliedAt: string;
  entityCounts: SandboxSeedEntityCounts;
  actorAuthUserId: string;
}): { entry: SandboxSeedHistoryEntry; summary: Partial<Record<SandboxSeedEntityType, number>> } {
  const summary = summariseCounts(opts.entityCounts);
  return {
    summary,
    entry: {
      packCode: opts.plan.packCode,
      appliedAt: opts.appliedAt,
      entityCounts: summary,
      actorAuthUserId: opts.actorAuthUserId,
      sessionId: opts.plan.sessionId,
      seedFingerprint: opts.plan.seedFingerprint,
    },
  };
}

export function resolvePackForApply(
  templateCode: ClinicDeploymentTemplateCode,
  packCode?: SandboxSeedPackCode | null
): SandboxSeedPackCode {
  const pack = resolveSandboxSeedPack(templateCode, packCode);
  if (!pack) throw new Error("Unknown sandbox seed pack.");
  return pack.code;
}
