import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ENTERPRISE_DEMO_BOOKING_KEY_METADATA,
  ENTERPRISE_DEMO_CASE_KEY_METADATA,
  ENTERPRISE_DEMO_IMAGE_KEY_METADATA,
  ENTERPRISE_DEMO_INVOICE_KEY_METADATA,
  ENTERPRISE_DEMO_PAYMENT_KEY_METADATA,
  ENTERPRISE_DEMO_PROTOCOL_SESSION_KEY_METADATA,
  ENTERPRISE_DEMO_SURGERY_KEY_METADATA,
} from "@/src/lib/enterprise-demo/enterpriseDemoConstants";
import {
  ENTERPRISE_DEMO_CONSULTATION_KEY_METADATA,
  ENTERPRISE_DEMO_PATIENT_METADATA_FLAG,
} from "@/src/lib/enterprise-demo/enterpriseDemoPatientsSeed.server";
import {
  ENTERPRISE_DEMO_BOOKING_METADATA_FLAG,
  ENTERPRISE_DEMO_CASE_METADATA_FLAG,
  ENTERPRISE_DEMO_SURGERY_METADATA_FLAG,
} from "@/src/lib/enterprise-demo/enterpriseDemoSurgeriesSeed.server";
import {
  ENTERPRISE_DEMO_IMAGE_METADATA_FLAG,
  ENTERPRISE_DEMO_PROTOCOL_SESSION_METADATA_FLAG,
} from "@/src/lib/enterprise-demo/enterpriseDemoImagingAuditSeed.server";
import {
  emptyShowcaseFixturePresence,
  scoreShowcaseFixtureCompleteness,
  type ShowcaseFixturePresence,
} from "@/src/lib/demo-day";
import { SHOWCASE_JAMES_CHEN_PATIENT_KEY, SHOWCASE_PACKAGE_B } from "@/src/lib/demo-day";
import {
  CLINIC_SHOWCASE_JAMES_IMAGE_SLOTS,
  assertClinicShowcaseJamesSpecConsistent,
  buildClinicShowcaseJamesChenSpec,
  clinicDemoImageKeyForSlot,
} from "./clinicDemoShowcaseJamesChenModel";
import { CLINIC_DEMO_TENANT_SLUG } from "./clinicDemoConstants";

const SOURCE_SYSTEM = "clinic_demo";
const PROTOCOL_TEMPLATE = "titan_surgery_outcome";
const SHOWCASE_FLAG = SHOWCASE_PACKAGE_B.showcaseFlag;

export type ClinicShowcaseJamesChenSeedResult = {
  ok: boolean;
  patientId: string | null;
  personId: string | null;
  caseId: string | null;
  surgeryId: string | null;
  created: Record<string, number>;
  existing: Record<string, number>;
  fixturePresence: ShowcaseFixturePresence;
  completenessScore: number;
  completenessBand: string;
  warnings: string[];
  error?: string;
};

type JsonRecord = Record<string, unknown>;
type Row = Record<string, unknown> & { id: string };

function asRecord(value: unknown): JsonRecord {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function increment(bucket: Record<string, number>, key: string): void {
  bucket[key] = (bucket[key] ?? 0) + 1;
}

function isDemo(metadata: unknown, flag?: string): boolean {
  const m = asRecord(metadata);
  return (
    m[SHOWCASE_FLAG] === true || m.enterprise_demo === true || (flag ? m[flag] === true : false)
  );
}

function makeResult(): ClinicShowcaseJamesChenSeedResult {
  return {
    ok: true,
    patientId: null,
    personId: null,
    caseId: null,
    surgeryId: null,
    created: {},
    existing: {},
    fixturePresence: emptyShowcaseFixturePresence(),
    completenessScore: 0,
    completenessBand: "poor",
    warnings: [],
  };
}

function finish(result: ClinicShowcaseJamesChenSeedResult): ClinicShowcaseJamesChenSeedResult {
  const score = scoreShowcaseFixtureCompleteness(result.fixturePresence);
  result.completenessScore = score.score;
  result.completenessBand = score.band;
  if (!score.meets_excellent_target) {
    result.warnings.push(
      `James Chen showcase completeness is ${score.score} (${score.band}); target is at least 85.`
    );
  }
  return result;
}

async function findByJsonKey(
  supabase: SupabaseClient,
  table: string,
  tenantId: string,
  column: string,
  key: string,
  value: string,
  select = "*"
): Promise<Row | null> {
  const { data, error } = await supabase
    .from(table)
    .select(select)
    .eq("tenant_id", tenantId)
    .contains(column, { [key]: value })
    .limit(1);
  if (error) throw new Error(`${table}: ${error.message}`);
  return ((data ?? [])[0] as unknown as Row | undefined) ?? null;
}

async function ensurePersonSource(
  supabase: SupabaseClient,
  tenantId: string,
  personId: string,
  result: ClinicShowcaseJamesChenSeedResult
): Promise<void> {
  const { data, error } = await supabase
    .from("fi_person_source_ids")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("source_system", SOURCE_SYSTEM)
    .eq("source_person_id", SHOWCASE_JAMES_CHEN_PATIENT_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) {
    increment(result.existing, "personSourceIds");
    return;
  }
  const { error: insertError } = await supabase.from("fi_person_source_ids").insert({
    tenant_id: tenantId,
    person_id: personId,
    source_system: SOURCE_SYSTEM,
    source_person_id: SHOWCASE_JAMES_CHEN_PATIENT_KEY,
  });
  if (insertError && insertError.code !== "23505") throw new Error(insertError.message);
  increment(insertError ? result.existing : result.created, "personSourceIds");
}

type StaffRow = Row & {
  email?: string | null;
  fi_user_id?: string | null;
  staff_metadata?: JsonRecord | null;
};

async function ensureShowcaseStaff(
  supabase: SupabaseClient,
  tenantId: string,
  clinicId: string,
  role: "consultant" | "surgeon" | "nurse" | "technician",
  demoStaffKey: string,
  nowIso: string,
  result: ClinicShowcaseJamesChenSeedResult
): Promise<StaffRow> {
  const existing = await findByJsonKey(
    supabase,
    "fi_staff",
    tenantId,
    "staff_metadata",
    "demo_staff_key",
    demoStaffKey,
    "id, email, fi_user_id, staff_metadata"
  );
  if (existing) {
    increment(result.existing, "staff");
    return existing as StaffRow;
  }

  const roleLabels = {
    consultant: "Consultant",
    surgeon: "Lead Surgeon",
    nurse: "Lead Nurse",
    technician: "Technician",
  } as const;
  const email = `${demoStaffKey}@follicle-demo-clinic.demo`;
  const staffRole =
    role === "surgeon" ? "doctor" : role === "consultant" ? "consultant" : role === "nurse" ? "nurse" : "technician";

  const { data, error } = await supabase
    .from("fi_staff")
    .insert({
      tenant_id: tenantId,
      full_name: `Demo ${roleLabels[role]} — James showcase`,
      staff_role: staffRole,
      email,
      default_timezone: "Australia/Sydney",
      working_hours: {
        _profile: { primary_clinic_id: clinicId },
        weekly: {
          mon: { enabled: true, start: "09:00", end: "17:00" },
          tue: { enabled: true, start: "09:00", end: "17:00" },
          wed: { enabled: true, start: "09:00", end: "17:00" },
          thu: { enabled: true, start: "09:00", end: "17:00" },
          fri: { enabled: true, start: "09:00", end: "17:00" },
        },
      },
      staff_metadata: {
        clinic_demo_showcase: true,
        clinic_demo: true,
        demo_staff_key: demoStaffKey,
        showcase_role: role,
      },
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("id, email, fi_user_id, staff_metadata")
    .single();
  if (error) throw new Error(error.message);
  increment(result.created, "staff");
  return data as StaffRow;
}

async function ensureDemoFiUser(
  supabase: SupabaseClient,
  tenantId: string,
  staff: StaffRow,
  nowIso: string,
  result: ClinicShowcaseJamesChenSeedResult
): Promise<string | null> {
  if (staff.fi_user_id) {
    increment(result.existing, "users");
    return String(staff.fi_user_id);
  }
  const email = staff.email?.trim().toLowerCase();
  if (!email) return null;
  const { data: found, error: findError } = await supabase
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("email", email)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  let userId: string;
  if (found?.id) {
    userId = String(found.id);
    increment(result.existing, "users");
  } else {
    const { data, error } = await supabase
      .from("fi_users")
      .insert({
        tenant_id: tenantId,
        email,
        role: "member",
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    userId = String((data as { id: string }).id);
    increment(result.created, "users");
  }
  const { error: updateError } = await supabase
    .from("fi_staff")
    .update({ fi_user_id: userId, updated_at: nowIso })
    .eq("tenant_id", tenantId)
    .eq("id", staff.id);
  if (updateError) throw new Error(updateError.message);
  staff.fi_user_id = userId;
  return userId;
}

async function seedOptionalLead(opts: {
  supabase: SupabaseClient;
  tenantId: string;
  clinicId: string;
  personId: string;
  patientId: string;
  leadKey: string;
  result: ClinicShowcaseJamesChenSeedResult;
}): Promise<void> {
  try {
    const existing = await findByJsonKey(
      opts.supabase,
      "fi_crm_leads",
      opts.tenantId,
      "metadata",
      "demo_lead_key",
      opts.leadKey,
      "id, metadata"
    );
    if (existing) {
      increment(opts.result.existing, "crmLeads");
      return;
    }
    const { data: stages, error: stageError } = await opts.supabase
      .from("fi_crm_stages")
      .select("id")
      .eq("tenant_id", opts.tenantId)
      .order("sort_order", { ascending: true })
      .limit(1);
    if (stageError) throw new Error(stageError.message);
    const stageId = (stages?.[0] as { id?: string } | undefined)?.id;
    if (!stageId) throw new Error("no CRM stage available");
    const { error } = await opts.supabase.from("fi_crm_leads").insert({
      tenant_id: opts.tenantId,
      clinic_id: opts.clinicId,
      person_id: opts.personId,
      patient_id: opts.patientId,
      current_stage_id: stageId,
      status: "converted",
      priority: "normal",
      summary: "James Chen web enquiry converted to surgical care.",
      metadata: {
        clinic_demo: true,
        [SHOWCASE_FLAG]: true,
        demo_lead_key: opts.leadKey,
        [SHOWCASE_PACKAGE_B.patientKeyField]: SHOWCASE_JAMES_CHEN_PATIENT_KEY,
      },
    });
    if (error) throw new Error(error.message);
    increment(opts.result.created, "crmLeads");
  } catch (error) {
    opts.result.warnings.push(
      `Optional CRM lead skipped: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function seedFinancials(opts: {
  supabase: SupabaseClient;
  tenantId: string;
  clinicId: string;
  patientId: string;
  consultationId: string;
  caseId: string;
  nowIso: string;
  spec: ReturnType<typeof buildClinicShowcaseJamesChenSpec>;
  result: ClinicShowcaseJamesChenSeedResult;
}): Promise<boolean> {
  const invoices = [
    {
      key: opts.spec.keys.quoteInvoiceKey,
      kind: "consultation_quote",
      amount: opts.spec.finances.quoteCents,
      issuedAt: opts.spec.schedule.byId.quote.iso,
      title: "Surgical treatment quote",
    },
    {
      key: `${opts.spec.keys.depositPaymentKey}-invoice`,
      kind: "surgery_deposit",
      amount: opts.spec.finances.depositCents,
      issuedAt: opts.spec.schedule.byId.deposit.iso,
      title: "Surgery deposit",
    },
    {
      key: opts.spec.keys.balanceInvoiceKey,
      kind: "surgery_balance",
      amount: opts.spec.finances.balanceCents,
      issuedAt: opts.spec.schedule.byId.economics_balance.iso,
      title: "Surgery balance",
    },
  ];
  let invoicesReady = 0;
  let paymentsReady = 0;
  for (const invoice of invoices) {
    let invoiceId: string;
    const existing = await findByJsonKey(
      opts.supabase,
      "fi_invoices",
      opts.tenantId,
      "metadata",
      ENTERPRISE_DEMO_INVOICE_KEY_METADATA,
      invoice.key,
      "id, metadata"
    );
    if (existing) {
      if (!isDemo(existing.metadata, "enterprise_demo_invoice")) {
        opts.result.warnings.push(`Invoice key collision for "${invoice.key}"; skipped.`);
        continue;
      }
      invoiceId = String(existing.id);
      increment(opts.result.existing, "invoices");
    } else {
      const number = `CLINIC-${invoice.key.replace(/[^a-z0-9]+/gi, "-").slice(0, 42)}`.toUpperCase();
      const { data, error } = await opts.supabase
        .from("fi_invoices")
        .insert({
          tenant_id: opts.tenantId,
          clinic_id: opts.clinicId,
          patient_id: opts.patientId,
          consultation_id: opts.consultationId,
          case_id: opts.caseId,
          invoice_kind: invoice.kind,
          status: "paid",
          amount_cents: invoice.amount,
          tax_cents: 0,
          total_cents: invoice.amount,
          amount_paid_cents: invoice.amount,
          currency: "AUD",
          due_date: invoice.issuedAt.slice(0, 10),
          issued_at: invoice.issuedAt,
          invoice_number: number,
          title: invoice.title,
          metadata: {
            enterprise_demo_invoice: true,
            enterprise_demo: true,
            [SHOWCASE_FLAG]: true,
            [ENTERPRISE_DEMO_INVOICE_KEY_METADATA]: invoice.key,
            demo_patient_key: opts.spec.keys.patientKey,
            demo_case_key: opts.spec.keys.caseKey,
          },
          automation_hints: { enterprise_demo: true },
          created_at: opts.nowIso,
          updated_at: opts.nowIso,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      invoiceId = String((data as { id: string }).id);
      increment(opts.result.created, "invoices");
    }
    invoicesReady += 1;

    const paymentKey =
      invoice.kind === "surgery_deposit"
        ? opts.spec.keys.depositPaymentKey
        : `${invoice.key}-payment`;
    const existingPayment = await findByJsonKey(
      opts.supabase,
      "fi_payments",
      opts.tenantId,
      "metadata",
      ENTERPRISE_DEMO_PAYMENT_KEY_METADATA,
      paymentKey,
      "id, metadata"
    );
    if (existingPayment) {
      increment(opts.result.existing, "payments");
      paymentsReady += 1;
      continue;
    }
    const { error: paymentError } = await opts.supabase.from("fi_payments").insert({
      tenant_id: opts.tenantId,
      clinic_id: opts.clinicId,
      patient_id: opts.patientId,
      consultation_id: opts.consultationId,
      case_id: opts.caseId,
      invoice_id: invoiceId,
      status: "succeeded",
      amount_cents: invoice.amount,
      tax_cents: 0,
      total_cents: invoice.amount,
      currency: "AUD",
      provider: "demo",
      provider_ref: `demo-${paymentKey}`,
      metadata: {
        enterprise_demo_payment: true,
        enterprise_demo: true,
        [SHOWCASE_FLAG]: true,
        [ENTERPRISE_DEMO_PAYMENT_KEY_METADATA]: paymentKey,
        [ENTERPRISE_DEMO_INVOICE_KEY_METADATA]: invoice.key,
      },
      created_at: invoice.issuedAt,
      updated_at: opts.nowIso,
    });
    if (paymentError) throw new Error(paymentError.message);
    increment(opts.result.created, "payments");
    paymentsReady += 1;
  }
  return invoicesReady === invoices.length && paymentsReady === invoices.length;
}

export async function seedClinicShowcaseJamesChen(
  supabase: SupabaseClient,
  tenantId: string,
  now: Date = new Date()
): Promise<ClinicShowcaseJamesChenSeedResult> {
  const result = makeResult();
  const spec = buildClinicShowcaseJamesChenSpec(now);
  const nowIso = now.toISOString();
  try {
    assertClinicShowcaseJamesSpecConsistent(spec);
    if (
      Object.values(spec.keys).some(
        (k) => typeof k === "string" && (k.includes("demo_day_key") || k.includes("ihrg-demo-day"))
      )
    ) {
      throw new Error("Package B James keys must not reuse Demo Day booking namespace");
    }

    const { data: clinics, error: clinicError } = await supabase
      .from("fi_clinics")
      .select("id, metadata, display_name")
      .eq("tenant_id", tenantId);
    if (clinicError) throw new Error(clinicError.message);
    const clinic =
      ((clinics ?? []).find(
        (row) => asRecord((row as { metadata?: unknown }).metadata).slug === CLINIC_DEMO_TENANT_SLUG
      ) as { id: string } | undefined) ??
      ((clinics ?? [])[0] as { id: string } | undefined);
    if (!clinic) throw new Error(`No clinic found for Package B tenant.`);
    const clinicId = String(clinic.id);

    // Ensure theatre + consultant staff before longitudinal spine writes.
    const staffRoleSpecs = [
      ["consultant", spec.staffKeys.consultant],
      ["surgeon", spec.staffKeys.surgeon],
      ["nurse", spec.staffKeys.nurse],
      ["technician", spec.staffKeys.technician],
    ] as const;
    const userByKey = new Map<string, string>();
    const staffIdByKey = new Map<string, string>();
    for (const [role, key] of staffRoleSpecs) {
      const staff = await ensureShowcaseStaff(
        supabase,
        tenantId,
        clinicId,
        role,
        key,
        nowIso,
        result
      );
      staffIdByKey.set(key, String(staff.id));
      const userId = await ensureDemoFiUser(supabase, tenantId, staff, nowIso, result);
      if (userId) userByKey.set(key, userId);
    }
    const surgeonUserId = userByKey.get(spec.staffKeys.surgeon) ?? null;

    let person = await findByJsonKey(
      supabase,
      "fi_persons",
      tenantId,
      "metadata",
      SHOWCASE_PACKAGE_B.patientKeyField,
      spec.keys.patientKey,
      "id, metadata"
    );
    if (person && !isDemo(person.metadata, "clinic_demo_person")) {
      result.warnings.push(
        `Person key collision for "${spec.keys.patientKey}"; showcase branch aborted.`
      );
      return finish(result);
    }
    if (!person) {
      const metadata = {
        clinic_demo_person: true,
        clinic_demo: true,
        [SHOWCASE_FLAG]: true,
        [SHOWCASE_PACKAGE_B.patientKeyField]: spec.keys.patientKey,
        demo_person_key: spec.keys.personKey,
        display_name: spec.identity.displayName,
        given_name: spec.identity.givenName,
        family_name: spec.identity.familyName,
        email: spec.identity.email,
        email_normalized: spec.identity.email,
        gender: spec.identity.sex,
        birth_date: spec.identity.birthDateYmd,
        age_band: spec.identity.ageBand,
        demo_clinic_slug: spec.clinicSlug,
      };
      const { data, error } = await supabase
        .from("fi_persons")
        .insert({ tenant_id: tenantId, metadata, created_at: nowIso, updated_at: nowIso })
        .select("id, metadata")
        .single();
      if (error) throw new Error(error.message);
      person = data as Row;
      increment(result.created, "persons");
    } else {
      increment(result.existing, "persons");
    }
    result.personId = String(person.id);
    await ensurePersonSource(supabase, tenantId, result.personId, result);

    let patient = await findByJsonKey(
      supabase,
      "fi_patients",
      tenantId,
      "metadata",
      SHOWCASE_PACKAGE_B.patientKeyField,
      spec.keys.patientKey,
      "id, person_id, metadata"
    );
    if (patient && !isDemo(patient.metadata, "clinic_demo_patient") && !isDemo(patient.metadata, ENTERPRISE_DEMO_PATIENT_METADATA_FLAG)) {
      result.warnings.push(
        `Patient key collision for "${spec.keys.patientKey}"; showcase branch aborted.`
      );
      return finish(result);
    }
    const patientMetadata = {
      ...(patient ? asRecord(patient.metadata) : {}),
      ...spec.patientMetadata,
      clinic_demo_patient: true,
      clinic_demo: true,
      [SHOWCASE_PACKAGE_B.patientKeyField]: spec.keys.patientKey,
      demo_clinic_slug: spec.clinicSlug,
      lead_source: spec.identity.leadSource,
      norwood_scale: spec.identity.norwoodBaseline,
      diagnosis_summary: "Male pattern hair loss, Norwood 3V.",
      hli_baseline_notes: "Stable Norwood 3V pattern with favourable donor characteristics.",
      projected_outcome: {
        status: "approved",
        milestone: spec.schedule.byId.projected_outcome.iso,
        graft_target: spec.graftTarget,
      },
    };
    if (patient) {
      const { error } = await supabase
        .from("fi_patients")
        .update({ primary_clinic_id: clinicId, metadata: patientMetadata, updated_at: nowIso })
        .eq("tenant_id", tenantId)
        .eq("id", patient.id);
      if (error) throw new Error(error.message);
      increment(result.existing, "patients");
    } else {
      const { data, error } = await supabase
        .from("fi_patients")
        .insert({
          tenant_id: tenantId,
          person_id: result.personId,
          primary_clinic_id: clinicId,
          patient_status: "active",
          reminder_consent: true,
          metadata: patientMetadata,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select("id, person_id, metadata")
        .single();
      if (error) throw new Error(error.message);
      patient = data as Row;
      increment(result.created, "patients");
    }
    result.patientId = String(patient.id);

    const { data: clinical, error: clinicalFindError } = await supabase
      .from("fi_patient_clinical_details")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("patient_id", result.patientId)
      .maybeSingle();
    if (clinicalFindError) throw new Error(clinicalFindError.message);
    if (clinical) {
      increment(result.existing, "clinicalDetails");
    } else {
      const { error } = await supabase.from("fi_patient_clinical_details").insert({
        tenant_id: tenantId,
        patient_id: result.patientId,
        person_id: result.personId,
        primary_hair_concern: "Frontal and vertex thinning",
        treatment_interest: "FUE hair restoration",
        norwood_scale: spec.identity.norwoodBaseline,
        primary_concern: "Male pattern hair loss",
        metadata: {
          enterprise_demo: true,
          [SHOWCASE_FLAG]: true,
          demo_patient_key: spec.keys.patientKey,
          hli_notes: "Baseline risk low; donor density suitable for 2,800 graft plan.",
        },
        created_at: nowIso,
        updated_at: nowIso,
      });
      if (error) throw new Error(error.message);
      increment(result.created, "clinicalDetails");
    }

    let consultation = await findByJsonKey(
      supabase,
      "fi_consultations",
      tenantId,
      "structured_data",
      ENTERPRISE_DEMO_CONSULTATION_KEY_METADATA,
      spec.keys.consultationKey,
      "id, case_id, structured_data"
    );
    if (!consultation) {
      const { data, error } = await supabase
        .from("fi_consultations")
        .insert({
          tenant_id: tenantId,
          person_id: result.personId,
          patient_id: result.patientId,
          consultation_type: "scalp_hair_transplant",
          status: "converted_to_case",
          consultant_staff_id: staffIdByKey.get(spec.staffKeys.consultant) ?? null,
          consultation_date: spec.schedule.byId.consultation.ymd,
          structured_data: {
            clinic_demo: true,
            [SHOWCASE_FLAG]: true,
            [ENTERPRISE_DEMO_CONSULTATION_KEY_METADATA]: spec.keys.consultationKey,
            [SHOWCASE_PACKAGE_B.patientKeyField]: spec.keys.patientKey,
            medical_treatment: {
              finasteride: "1mg daily",
              minoxidil: "5% topical",
              start_at: spec.schedule.byId.medical_start.iso,
              end_at: spec.schedule.byId.medical_end.iso,
            },
            adjunct_treatment: { prp: "Recommended as post-operative adjunct" },
            consent: { captured: true, captured_at: spec.schedule.byId.consent.iso },
          },
          live_notes: "Medical therapy and PRP adjunct reviewed.",
          recommendation_notes: "Proceed with 2,800 graft FUE after approved planning.",
          quote_data: {
            price_quoted: spec.finances.quoteCents / 100,
            graft_estimate: spec.graftTarget,
            quote_status: "accepted",
          },
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select("id, case_id, structured_data")
        .single();
      if (error) throw new Error(error.message);
      consultation = data as Row;
      increment(result.created, "consultations");
    } else {
      increment(result.existing, "consultations");
    }
    const consultationId = String(consultation.id);
    await seedOptionalLead({
      supabase,
      tenantId,
      clinicId,
      personId: result.personId,
      patientId: result.patientId,
      leadKey: spec.keys.leadKey,
      result,
    });

    let caseRow = await findByJsonKey(
      supabase,
      "fi_cases",
      tenantId,
      "metadata",
      ENTERPRISE_DEMO_CASE_KEY_METADATA,
      spec.keys.caseKey,
      "id, external_id, metadata"
    );
    if (caseRow && !isDemo(caseRow.metadata, ENTERPRISE_DEMO_CASE_METADATA_FLAG)) {
      result.warnings.push(`Case key collision for "${spec.keys.caseKey}"; case branch aborted.`);
      return finish(result);
    }
    if (!caseRow) {
      const { data, error } = await supabase
        .from("fi_cases")
        .insert({
          tenant_id: tenantId,
          external_id: spec.keys.caseKey,
          clinic_id: clinicId,
          foundation_patient_id: result.patientId,
          status: "complete",
          metadata: {
            [ENTERPRISE_DEMO_CASE_METADATA_FLAG]: true,
            enterprise_demo: true,
            [SHOWCASE_FLAG]: true,
            [ENTERPRISE_DEMO_CASE_KEY_METADATA]: spec.keys.caseKey,
            demo_patient_key: spec.keys.patientKey,
            projected_outcome: {
              status: "approved",
              generated_at: spec.schedule.byId.projected_outcome.iso,
              target_grafts: spec.graftTarget,
            },
            consent: { status: "approved", approved_at: spec.schedule.byId.consent.iso },
          },
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select("id, external_id, metadata")
        .single();
      if (error) throw new Error(error.message);
      caseRow = data as Row;
      increment(result.created, "cases");
    } else {
      increment(result.existing, "cases");
    }
    result.caseId = String(caseRow.id);
    if (consultation.case_id !== result.caseId) {
      const { error } = await supabase
        .from("fi_consultations")
        .update({ case_id: result.caseId, updated_at: nowIso })
        .eq("tenant_id", tenantId)
        .eq("id", consultationId);
      if (error) throw new Error(error.message);
      increment(result.created, "consultationCaseLinks");
    }

    let booking = await findByJsonKey(
      supabase,
      "fi_bookings",
      tenantId,
      "metadata",
      ENTERPRISE_DEMO_BOOKING_KEY_METADATA,
      spec.keys.bookingKey,
      "id, metadata"
    );
    if (!booking) {
      const procedure = spec.schedule.byId.procedure;
      const endAt = new Date(new Date(procedure.iso).getTime() + 8 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("fi_bookings")
        .insert({
          tenant_id: tenantId,
          person_id: result.personId,
          patient_id: result.patientId,
          case_id: result.caseId,
          clinic_id: clinicId,
          assigned_user_id: surgeonUserId,
          booking_type: "surgery",
          booking_status: "completed",
          title: "James Chen - FUE procedure",
          description: "Completed 2,800 graft FUE procedure.",
          start_at: procedure.iso,
          end_at: endAt,
          timezone: spec.timeZone,
          location: spec.clinicSlug,
          metadata: {
            [ENTERPRISE_DEMO_BOOKING_METADATA_FLAG]: true,
            clinic_demo: true,
            [SHOWCASE_FLAG]: true,
            [ENTERPRISE_DEMO_BOOKING_KEY_METADATA]: spec.keys.bookingKey,
            demo_case_key: spec.keys.caseKey,
            [SHOWCASE_PACKAGE_B.patientKeyField]: spec.keys.patientKey,
            technique: "FUE",
          },
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select("id, metadata")
        .single();
      if (error) throw new Error(error.message);
      booking = data as Row;
      increment(result.created, "bookings");
    } else {
      increment(result.existing, "bookings");
    }

    let surgery = await findByJsonKey(
      supabase,
      "fi_surgeries",
      tenantId,
      "metadata",
      ENTERPRISE_DEMO_SURGERY_KEY_METADATA,
      spec.keys.surgeryKey,
      "id, metadata"
    );
    if (!surgery) {
      const startAt = spec.schedule.byId.procedure.iso;
      const endAt = new Date(new Date(startAt).getTime() + 8 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("fi_surgeries")
        .insert({
          tenant_id: tenantId,
          patient_id: result.patientId,
          case_id: result.caseId,
          booking_id: booking.id,
          clinic_id: clinicId,
          surgeon_fi_user_id: surgeonUserId,
          status: "completed",
          live_status: "completed",
          procedure_phase: "completed",
          target_grafts: spec.graftTarget,
          scheduled_date: spec.schedule.byId.procedure.ymd,
          scheduled_start_at: startAt,
          scheduled_end_at: endAt,
          actual_start_at: startAt,
          actual_end_at: endAt,
          readiness_percent: 100,
          readiness_risk_level: "low",
          metadata: {
            [ENTERPRISE_DEMO_SURGERY_METADATA_FLAG]: true,
            enterprise_demo: true,
            [SHOWCASE_FLAG]: true,
            [ENTERPRISE_DEMO_SURGERY_KEY_METADATA]: spec.keys.surgeryKey,
            demo_case_key: spec.keys.caseKey,
            demo_patient_key: spec.keys.patientKey,
            technique: "FUE",
            extraction_technique: "FUE",
            transection_rate_percent: 2.1,
            transection_band: "low",
          },
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select("id, metadata")
        .single();
      if (error) throw new Error(error.message);
      surgery = data as Row;
      increment(result.created, "surgeries");
    } else {
      increment(result.existing, "surgeries");
    }
    result.surgeryId = String(surgery.id);

    let teamReady = 0;
    const roles = [
      [spec.staffKeys.surgeon, "surgeon"],
      [spec.staffKeys.nurse, "nurse"],
      [spec.staffKeys.technician, "technician"],
    ] as const;
    for (const [staffKey, role] of roles) {
      const userId = userByKey.get(staffKey);
      if (!userId) continue;
      const { data: assignment, error: findError } = await supabase
        .from("fi_surgery_team_assignments")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("surgery_id", result.surgeryId)
        .eq("fi_user_id", userId)
        .eq("role", role)
        .maybeSingle();
      if (findError) throw new Error(findError.message);
      if (assignment) {
        increment(result.existing, "teamAssignments");
      } else {
        const { error } = await supabase.from("fi_surgery_team_assignments").insert({
          tenant_id: tenantId,
          surgery_id: result.surgeryId,
          fi_user_id: userId,
          role,
          assignment_status: "completed",
          assigned_at: spec.schedule.byId.workforce_on_procedure.iso,
          metadata: {
            enterprise_demo: true,
            [SHOWCASE_FLAG]: true,
            demo_staff_key: staffKey,
            demo_surgery_key: spec.keys.surgeryKey,
            competency_valid_on_procedure_date: true,
          },
          updated_at: nowIso,
        });
        if (error) throw new Error(error.message);
        increment(result.created, "teamAssignments");
      }
      teamReady += 1;
    }

    let graftReady = false;
    try {
      const { data: existingGraft, error: graftFindError } = await supabase
        .from("fi_surgery_graft_sessions")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("surgery_id", result.surgeryId)
        .maybeSingle();
      if (graftFindError) throw new Error(graftFindError.message);
      if (existingGraft) {
        increment(result.existing, "graftSessions");
        graftReady = true;
      } else {
        const { error } = await supabase.from("fi_surgery_graft_sessions").insert({
          tenant_id: tenantId,
          surgery_id: result.surgeryId,
          phase: "reconciliation",
          target_grafts: spec.graftTarget,
          extracted_grafts: 2860,
          implanted_grafts: spec.graftTarget,
          discarded_grafts: 60,
          remaining_grafts: 0,
          singles: 620,
          doubles: 1420,
          triples: 650,
          multiples: 110,
          total_hairs: 5940,
          average_hairs_per_graft: 2.12,
          reconciliation_status: "completed",
          created_by_fi_user_id: surgeonUserId,
          reconciled_by_fi_user_id: surgeonUserId,
          reconciled_at: spec.schedule.byId.immediate_imaging.iso,
          created_at: nowIso,
          updated_at: nowIso,
        });
        if (error) throw new Error(error.message);
        increment(result.created, "graftSessions");
        graftReady = true;
      }
    } catch (error) {
      result.warnings.push(
        `Optional graft session skipped: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    let { data: plan, error: planFindError } = await supabase
      .from("fi_case_surgery_plans")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("case_id", result.caseId)
      .maybeSingle();
    if (planFindError) throw new Error(planFindError.message);
    if (!plan) {
      const inserted = await supabase
        .from("fi_case_surgery_plans")
        .insert({
          tenant_id: tenantId,
          case_id: result.caseId,
          planning_status: "approved",
          planned_procedure_type: "FUE",
          planned_session_type: "single_day",
          planned_zones: spec.plannedZones,
          estimated_grafts_min: spec.graftTarget,
          estimated_grafts_max: spec.graftTarget,
          donor_strategy_notes: "Conservative occipital and temporal donor harvest.",
          recipient_strategy_notes: "Hairline, mid-scalp and crown allocation.",
          planning_notes: "Approved James Chen showcase surgical plan.",
          surgical_plan_summary: "2,800 graft FUE with natural mature hairline.",
          metadata: {
            enterprise_demo: true,
            [SHOWCASE_FLAG]: true,
            demo_case_key: spec.keys.caseKey,
          },
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select("id")
        .single();
      if (inserted.error) throw new Error(inserted.error.message);
      plan = inserted.data as { id: string };
      increment(result.created, "surgeryPlans");
    } else {
      increment(result.existing, "surgeryPlans");
    }
    const { data: design, error: designFindError } = await supabase
      .from("fi_case_hairline_designs")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("case_id", result.caseId)
      .eq("design_version", 1)
      .maybeSingle();
    if (designFindError) throw new Error(designFindError.message);
    if (!design) {
      const { error } = await supabase.from("fi_case_hairline_designs").insert({
        tenant_id: tenantId,
        case_id: result.caseId,
        surgical_plan_id: plan.id,
        design_version: 1,
        status: "approved",
        source_image_ref: "demo://ihrg-showcase-james-chen-v1-hairline",
        source_image_checksum: spec.keys.hairlineDesignKey,
        source_view: "frontal",
        orientation_degrees: 0,
        geometry: spec.hairlineGeometry,
        approved_by: "IHRG showcase clinical team",
        approved_at: spec.schedule.byId.surgical_plan.iso,
        created_at: nowIso,
        updated_at: nowIso,
      });
      if (error) throw new Error(error.message);
      increment(result.created, "hairlineDesigns");
    } else {
      increment(result.existing, "hairlineDesigns");
    }

    const imageIds = new Map<string, string>();
    for (const slot of CLINIC_SHOWCASE_JAMES_IMAGE_SLOTS) {
      const imageKey = clinicDemoImageKeyForSlot(slot);
      const existingImage = await findByJsonKey(
        supabase,
        "fi_patient_images",
        tenantId,
        "metadata",
        ENTERPRISE_DEMO_IMAGE_KEY_METADATA,
        imageKey,
        "id, metadata"
      );
      if (existingImage) {
        increment(result.existing, "images");
        imageIds.set(slot, String(existingImage.id));
        continue;
      }
      const isOutcome = slot === "3_month" || slot === "6_month";
      const isProcedure = slot === "immediate_post_op" || slot === "graft_tray";
      const takenAt =
        slot === "3_month"
          ? spec.schedule.byId.observed_outcome_3m.iso
          : slot === "6_month"
            ? spec.schedule.byId.observed_outcome_6m.iso
            : isProcedure
              ? spec.schedule.byId.immediate_imaging.iso
              : spec.schedule.byId.hli_baseline.iso;
      const { data, error } = await supabase
        .from("fi_patient_images")
        .insert({
          tenant_id: tenantId,
          patient_id: result.patientId,
          person_id: result.personId,
          case_id: result.caseId,
          booking_id: booking.id,
          consultation_id: consultationId,
          clinic_id: clinicId,
          image_category: isOutcome ? "progress" : isProcedure ? "post_op" : "consult",
          image_status: "active",
          imaging_library_axis: isOutcome ? "follow_up" : isProcedure ? "surgery" : "consultation",
          anatomical_region: slot === "donor" ? "donor" : slot === "crown" ? "crown" : "global",
          visit_type: isOutcome ? "follow_up" : isProcedure ? "surgery" : "consultation",
          follow_up_interval: isOutcome ? slot : null,
          imaging_protocol_template_slug: PROTOCOL_TEMPLATE,
          imaging_protocol_slot_slug: slot,
          storage_bucket: "patient-images",
          storage_path: `clinic-demo/synthetic/${imageKey}.jpg`,
          original_filename: `${imageKey}.jpg`,
          content_type: "image/jpeg",
          file_size_bytes: 0,
          caption: `TITAN demo — James Chen ${slot}`,
          taken_at: takenAt,
          metadata: {
            [ENTERPRISE_DEMO_IMAGE_METADATA_FLAG]: true,
            enterprise_demo: true,
            [SHOWCASE_FLAG]: true,
            [ENTERPRISE_DEMO_IMAGE_KEY_METADATA]: imageKey,
            demo_patient_key: spec.keys.patientKey,
            demo_case_key: spec.keys.caseKey,
            protocol_slot: slot,
            quality_status: "pass",
            synthetic: true,
          },
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      imageIds.set(slot, String((data as { id: string }).id));
      increment(result.created, "images");
    }

    const { data: protocol, error: protocolFindError } = await supabase
      .from("fi_imaging_protocol_sessions")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("case_id", result.caseId)
      .eq("template_slug", PROTOCOL_TEMPLATE)
      .maybeSingle();
    if (protocolFindError) throw new Error(protocolFindError.message);
    if (protocol) {
      increment(result.existing, "protocolSessions");
    } else {
      const progress: JsonRecord = {
        _demo: {
          [ENTERPRISE_DEMO_PROTOCOL_SESSION_METADATA_FLAG]: true,
          [ENTERPRISE_DEMO_PROTOCOL_SESSION_KEY_METADATA]: spec.keys.protocolSessionKey,
          enterprise_demo_showcase: true,
          slots_expected: CLINIC_SHOWCASE_JAMES_IMAGE_SLOTS.length,
          slots_filled: imageIds.size,
        },
      };
      for (const [slot, id] of imageIds) progress[slot] = id;
      const { error } = await supabase.from("fi_imaging_protocol_sessions").insert({
        tenant_id: tenantId,
        patient_id: result.patientId,
        case_id: result.caseId,
        consultation_id: consultationId,
        template_slug: PROTOCOL_TEMPLATE,
        progress,
        created_at: nowIso,
        updated_at: nowIso,
      });
      if (error) throw new Error(error.message);
      increment(result.created, "protocolSessions");
    }

    let outcomesReady = 0;
    for (const [checkpoint, milestone, density, satisfaction] of [
      ["month_3", "observed_outcome_3m", 72, 8],
      ["month_6", "observed_outcome_6m", 91, 9],
    ] as const) {
      const auditKey = `${spec.keys.outcomeAuditKey}-${checkpoint}`;
      const existingOutcome = await findByJsonKey(
        supabase,
        "fi_patient_outcome_measurements",
        tenantId,
        "metadata",
        "demo_audit_key",
        auditKey,
        "id, metadata"
      );
      if (existingOutcome) {
        increment(result.existing, "outcomeMeasurements");
        outcomesReady += 1;
        continue;
      }
      const resolved = spec.schedule.byId[milestone];
      const { error } = await supabase.from("fi_patient_outcome_measurements").insert({
        tenant_id: tenantId,
        patient_id: result.patientId,
        case_id: result.caseId,
        checkpoint_key: checkpoint,
        measurement_date: resolved.ymd,
        metric_values: {
          density_percent_of_target: density,
          graft_survival_quality: "high",
          patient_satisfaction_10: satisfaction,
          observation_status: resolved.isFuture ? "projected_fixture" : "observed",
        },
        imaging_refs: [imageIds.get(checkpoint === "month_3" ? "3_month" : "6_month")].filter(
          Boolean
        ),
        audit_refs: [],
        confidence_level: "high",
        visibility_scope: "tenant_clinical",
        metadata: {
          enterprise_demo_audit: true,
          enterprise_demo: true,
          [SHOWCASE_FLAG]: true,
          demo_audit_key: auditKey,
          audit_status: "approved",
          future_dated_fixture: resolved.isFuture,
        },
        created_at: nowIso,
        updated_at: nowIso,
      });
      if (error) throw new Error(error.message);
      increment(result.created, "outcomeMeasurements");
      outcomesReady += 1;
    }

    const economicsReady = await seedFinancials({
      supabase,
      tenantId,
      clinicId,
      patientId: result.patientId,
      consultationId,
      caseId: result.caseId,
      nowIso,
      spec,
      result,
    });

    result.fixturePresence.baseline =
      Boolean(result.patientId) &&
      (result.created.clinicalDetails ?? 0) + (result.existing.clinicalDetails ?? 0) > 0 &&
      imageIds.size === CLINIC_SHOWCASE_JAMES_IMAGE_SLOTS.length;
    result.fixturePresence.treatment = Boolean(consultationId);
    result.fixturePresence.surgical_plan = Boolean(plan?.id);
    result.fixturePresence.procedure = Boolean(result.surgeryId) && graftReady && teamReady > 0;
    result.fixturePresence.outcomes = outcomesReady === 2;
    result.fixturePresence.governance = Boolean(result.caseId && consultationId);
    result.fixturePresence.workforce = teamReady === roles.length;
    result.fixturePresence.economics = economicsReady;
    return finish(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.ok = false;
    result.error = message;
    result.warnings.push(message);
    return finish(result);
  }
}
