import type { SupabaseClient } from "@supabase/supabase-js";

import { ENTERPRISE_DEMO_CLINICS } from "@/src/lib/enterprise-demo/enterpriseDemoConstants";
import {
  buildEnterpriseDemoPatientConsultationSpecs,
  ENTERPRISE_DEMO_PATIENT_EMAIL_DOMAIN,
  type EnterpriseDemoJourneyArchetype,
  type EnterpriseDemoPatientConsultationSpec,
} from "@/src/lib/enterprise-demo/enterpriseDemoPatientsGenerator";
import { ENTERPRISE_DEMO_PATIENT_KEY_METADATA } from "@/src/lib/enterprise-demo/enterpriseDemoPatientsSeed.server";
import { ensureDefaultPipelineStages } from "@/src/lib/crm/pipeline";
import type { IhrgDemoProfileConfig } from "./ihrgDemoProfiles";

export const IHRG_DEMO_LEAD_KEY_METADATA = "demo_lead_key";
export const IHRG_DEMO_LEADFLOW_KEY_METADATA = "demo_leadflow_key";
export const IHRG_DEMO_CALENDAR_EVENT_KEY_METADATA = "demo_calendar_event_key";
export const IHRG_DEMO_ANALYTICS_KEY_METADATA = "demo_analytics_key";
export const IHRG_DEMO_RECEPTION_TASK_KEY_METADATA = "demo_reception_task_key";
export const IHRG_DEMO_CRM_TASK_KEY_METADATA = "demo_crm_task_key";
export const IHRG_DEMO_SOURCE_SYSTEM = "ihrg_demo_expansion";

export type IhrgDemoExpansionSeedResult = {
  createdCrmLeads: number;
  existingCrmLeads: number;
  createdLeadflowLeads: number;
  existingLeadflowLeads: number;
  createdCrmTasks: number;
  existingCrmTasks: number;
  createdCalendarEvents: number;
  existingCalendarEvents: number;
  createdAnalyticsEvents: number;
  existingAnalyticsEvents: number;
  createdReceptionTasks: number;
  existingReceptionTasks: number;
  createdCompetencyProjections: number;
  existingCompetencyProjections: number;
  warnings: string[];
};

type ClinicRow = { id: string; metadata: Record<string, unknown> | null };
type PersonRow = { id: string; metadata: Record<string, unknown> | null };
type PatientRow = { id: string; person_id: string; metadata: Record<string, unknown> | null };
type StaffRow = { id: string; staff_metadata: Record<string, unknown> | null };

function clinicSlug(row: ClinicRow): string | null {
  const slug = row.metadata?.slug;
  return typeof slug === "string" && slug.trim() ? slug.trim() : null;
}

function demoPatientKey(metadata: unknown): string | null {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const key = (metadata as Record<string, unknown>)[ENTERPRISE_DEMO_PATIENT_KEY_METADATA];
  return typeof key === "string" && key.trim() ? key.trim() : null;
}

function demoLeadKey(metadata: unknown): string | null {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const key = (metadata as Record<string, unknown>)[IHRG_DEMO_LEAD_KEY_METADATA];
  return typeof key === "string" && key.trim() ? key.trim() : null;
}

function stageSlugForJourney(journey: EnterpriseDemoJourneyArchetype): string {
  switch (journey) {
    case "new_lead":
      return "new";
    case "booked_consult":
      return "consult_scheduled";
    case "completed_consult":
      return "consult_completed";
    case "surgery_booked":
      return "deposit_or_booked";
    case "surgery_completed":
    case "follow_up_3_month":
    case "follow_up_6_month":
    case "follow_up_9_month":
    case "follow_up_12_month":
    case "medical_therapy_monitoring":
      return "in_treatment";
    case "repair_assessment":
    case "prp_only":
      return "treatment_planning";
    case "excellent_candidate":
      return "quote_sent";
    case "poor_donor_candidate":
      return "nurture";
    default:
      return "qualified";
  }
}

function leadflowStageForJourney(journey: EnterpriseDemoJourneyArchetype): string {
  switch (journey) {
    case "new_lead":
      return "new";
    case "booked_consult":
      return "consult_booked";
    case "completed_consult":
      return "consult_completed";
    case "surgery_booked":
      return "surgery_booked";
    case "surgery_completed":
      return "surgery_completed";
    case "follow_up_3_month":
      return "follow_up_3m";
    case "follow_up_6_month":
      return "follow_up_6m";
    case "follow_up_9_month":
      return "follow_up_9m";
    case "follow_up_12_month":
      return "outcome_12m";
    case "repair_assessment":
      return "repair_review";
    case "poor_donor_candidate":
      return "not_candidate";
    case "excellent_candidate":
      return "high_intent";
    case "prp_only":
      return "prp_pathway";
    case "medical_therapy_monitoring":
      return "medical_monitoring";
    default:
      return "new";
  }
}

function predictedProcedureForJourney(
  journey: EnterpriseDemoJourneyArchetype
): "fue_transplant" | "prp" | "exosomes" | "repair_case" | "consultation_only" | "unknown" {
  if (journey === "prp_only") return "prp";
  if (journey === "repair_assessment") return "repair_case";
  if (journey === "poor_donor_candidate" || journey === "medical_therapy_monitoring") {
    return "consultation_only";
  }
  if (journey === "excellent_candidate" || journey.startsWith("surgery") || journey.startsWith("follow_up")) {
    return "fue_transplant";
  }
  return "unknown";
}

function buildLeadflowEmail(clinicSlug: string, index: number): string {
  return `titan.leadflow.${clinicSlug}.${String(index).padStart(2, "0")}@${ENTERPRISE_DEMO_PATIENT_EMAIL_DOMAIN}`;
}

function buildLeadflowDemoKey(clinicSlug: string, index: number): string {
  return `${clinicSlug}-leadflow-${String(index).padStart(2, "0")}`;
}

function buildCrmLeadDemoKey(spec: EnterpriseDemoPatientConsultationSpec): string {
  return `${spec.demoPatientKey}-crm-lead`;
}

function buildCalendarEventDemoKey(spec: EnterpriseDemoPatientConsultationSpec): string {
  return `${spec.demoPatientKey}-calendar-consult`;
}

function buildReceptionTaskDemoKey(spec: EnterpriseDemoPatientConsultationSpec): string {
  return `${spec.demoPatientKey}-reception-followup`;
}

function buildCrmTaskDemoKey(leadKey: string): string {
  return `${leadKey}-crm-task`;
}

const ANALYTICS_EVENT_SPECS: ReadonlyArray<{
  module_name: "leadflow" | "consultation_os" | "surgery_os" | "patient_os" | "imaging_os" | "financial_os" | "clinic_os";
  event_type: string;
}> = [
  { module_name: "leadflow", event_type: "lead_created" },
  { module_name: "leadflow", event_type: "lead_stage_changed" },
  { module_name: "consultation_os", event_type: "consultation_completed" },
  { module_name: "consultation_os", event_type: "quote_issued" },
  { module_name: "surgery_os", event_type: "surgery_scheduled" },
  { module_name: "surgery_os", event_type: "graft_session_closed" },
  { module_name: "patient_os", event_type: "patient_record_viewed" },
  { module_name: "imaging_os", event_type: "imaging_session_completed" },
  { module_name: "financial_os", event_type: "invoice_paid" },
  { module_name: "clinic_os", event_type: "booking_confirmed" },
];

const COMPETENCY_KEYS = [
  "fue_extraction_fundamentals",
  "graft_handling_safety",
  "patient_consultation_standards",
  "infection_control_clinical",
] as const;

async function loadClinics(supabase: SupabaseClient, tenantId: string): Promise<ClinicRow[]> {
  const { data, error } = await supabase.from("fi_clinics").select("id, metadata").eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const raw = row as { id: string; metadata: unknown };
    const metadata =
      raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : null;
    return { id: String(raw.id), metadata };
  });
}

async function loadPersons(supabase: SupabaseClient, tenantId: string): Promise<PersonRow[]> {
  const { data, error } = await supabase.from("fi_persons").select("id, metadata").eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const raw = row as { id: string; metadata: unknown };
    const metadata =
      raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : null;
    return { id: String(raw.id), metadata };
  });
}

async function loadPatients(supabase: SupabaseClient, tenantId: string): Promise<PatientRow[]> {
  const { data, error } = await supabase
    .from("fi_patients")
    .select("id, person_id, metadata")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const raw = row as { id: string; person_id: string; metadata: unknown };
    const metadata =
      raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : null;
    return { id: String(raw.id), person_id: String(raw.person_id), metadata };
  });
}

async function loadStaff(supabase: SupabaseClient, tenantId: string): Promise<StaffRow[]> {
  const { data, error } = await supabase
    .from("fi_staff")
    .select("id, staff_metadata")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const raw = row as { id: string; staff_metadata: unknown };
    const staff_metadata =
      raw.staff_metadata && typeof raw.staff_metadata === "object" && !Array.isArray(raw.staff_metadata)
        ? (raw.staff_metadata as Record<string, unknown>)
        : null;
    return { id: String(raw.id), staff_metadata };
  });
}

export async function seedIhrgDemoExpansion(
  supabase: SupabaseClient,
  tenantId: string,
  profile: IhrgDemoProfileConfig
): Promise<IhrgDemoExpansionSeedResult> {
  const warnings: string[] = [];
  const result: IhrgDemoExpansionSeedResult = {
    createdCrmLeads: 0,
    existingCrmLeads: 0,
    createdLeadflowLeads: 0,
    existingLeadflowLeads: 0,
    createdCrmTasks: 0,
    existingCrmTasks: 0,
    createdCalendarEvents: 0,
    existingCalendarEvents: 0,
    createdAnalyticsEvents: 0,
    existingAnalyticsEvents: 0,
    createdReceptionTasks: 0,
    existingReceptionTasks: 0,
    createdCompetencyProjections: 0,
    existingCompetencyProjections: 0,
    warnings,
  };

  const { stages } = await ensureDefaultPipelineStages({ tenantId }, supabase);
  const stageIdBySlug = new Map(stages.map((s) => [s.slug, s.id]));

  const clinics = await loadClinics(supabase, tenantId);
  const clinicIdBySlug = new Map<string, string>();
  for (const clinic of clinics) {
    const slug = clinicSlug(clinic);
    if (slug) clinicIdBySlug.set(slug, clinic.id);
  }

  const persons = await loadPersons(supabase, tenantId);
  const patients = await loadPatients(supabase, tenantId);
  const personIdByPatientKey = new Map<string, string>();
  const patientIdByKey = new Map<string, string>();

  for (const person of persons) {
    const key = demoPatientKey(person.metadata);
    if (key) personIdByPatientKey.set(key, person.id);
  }
  for (const patient of patients) {
    const key = demoPatientKey(patient.metadata);
    if (key) patientIdByKey.set(key, patient.id);
  }

  const patientSpecs = buildEnterpriseDemoPatientConsultationSpecs(profile);
  const now = new Date().toISOString();

  const { data: existingCrmLeads, error: crmLeadsErr } = await supabase
    .from("fi_crm_leads")
    .select("id, metadata")
    .eq("tenant_id", tenantId);
  if (crmLeadsErr) throw new Error(crmLeadsErr.message);

  const crmLeadIdByKey = new Map<string, string>();
  for (const row of existingCrmLeads ?? []) {
    const key = demoLeadKey((row as { metadata: unknown }).metadata);
    if (key) crmLeadIdByKey.set(key, String((row as { id: string }).id));
  }

  const { data: existingCrmTasks, error: crmTasksErr } = await supabase
    .from("fi_crm_tasks")
    .select("id, metadata")
    .eq("tenant_id", tenantId);
  if (crmTasksErr) throw new Error(crmTasksErr.message);

  const crmTaskKeySet = new Set<string>();
  for (const row of existingCrmTasks ?? []) {
    const metadata = (row as { metadata: unknown }).metadata;
    if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
      const key = (metadata as Record<string, unknown>)[IHRG_DEMO_CRM_TASK_KEY_METADATA];
      if (typeof key === "string") crmTaskKeySet.add(key);
    }
  }

  let crmTasksCreatedBudget = profile.crmTasksPerClinic * ENTERPRISE_DEMO_CLINICS.length;

  for (const spec of patientSpecs.slice(0, profile.crmLeadsPerClinic * ENTERPRISE_DEMO_CLINICS.length)) {
    const clinicId = clinicIdBySlug.get(spec.clinicSlug);
    const personId = personIdByPatientKey.get(spec.demoPatientKey);
    const patientId = patientIdByKey.get(spec.demoPatientKey);
    if (!clinicId || !personId) {
      warnings.push(`Skipped CRM lead for "${spec.demoPatientKey}" — missing clinic or person.`);
      continue;
    }

    const demoLeadKey = buildCrmLeadDemoKey(spec);
    if (crmLeadIdByKey.has(demoLeadKey)) {
      result.existingCrmLeads += 1;
      continue;
    }

    const stageSlug = stageSlugForJourney(spec.journeyArchetype);
    const stageId = stageIdBySlug.get(stageSlug) ?? null;

    const { data: inserted, error } = await supabase
      .from("fi_crm_leads")
      .insert({
        tenant_id: tenantId,
        clinic_id: clinicId,
        person_id: personId,
        patient_id: patientId ?? null,
        current_stage_id: stageId,
        status: "open",
        priority: spec.journeyArchetype === "excellent_candidate" ? "high" : "normal",
        summary: `Demo lead — ${spec.displayName} (${spec.journeyArchetype.replace(/_/g, " ")})`,
        metadata: {
          enterprise_demo: true,
          [IHRG_DEMO_LEAD_KEY_METADATA]: demoLeadKey,
          demo_patient_key: spec.demoPatientKey,
          journey_archetype: spec.journeyArchetype,
          lead_source: spec.leadSource,
        },
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const leadId = String((inserted as { id: string }).id);
    crmLeadIdByKey.set(demoLeadKey, leadId);
    result.createdCrmLeads += 1;

    const crmTaskKey = buildCrmTaskDemoKey(demoLeadKey);
    if (crmTaskKeySet.has(crmTaskKey)) {
      result.existingCrmTasks += 1;
    } else if (crmTasksCreatedBudget > 0) {
      const { error: taskErr } = await supabase.from("fi_crm_tasks").insert({
        tenant_id: tenantId,
        lead_id: leadId,
        patient_id: patientId ?? null,
        title: `Follow up — ${spec.displayName}`,
        description: "Demo CRM follow-up task for pipeline review.",
        task_type: "follow_up",
        status: "open",
        due_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          enterprise_demo: true,
          [IHRG_DEMO_CRM_TASK_KEY_METADATA]: crmTaskKey,
          journey_archetype: spec.journeyArchetype,
        },
        created_at: now,
        updated_at: now,
      });
      if (taskErr) throw new Error(taskErr.message);
      crmTaskKeySet.add(crmTaskKey);
      crmTasksCreatedBudget -= 1;
      result.createdCrmTasks += 1;
    }
  }

  const { data: existingLeadflow } = await supabase
    .from("fi_leads")
    .select("id, email")
    .eq("tenant_id", tenantId);
  if (existingLeadflow === null) {
    const { error } = await supabase.from("fi_leads").select("id").limit(1);
    if (error) throw new Error(error.message);
  }

  const leadflowEmailSet = new Set(
    (existingLeadflow ?? [])
      .map((row) => (row as { email: string | null }).email?.toLowerCase())
      .filter((email): email is string => Boolean(email))
  );

  for (const clinic of ENTERPRISE_DEMO_CLINICS) {
    for (let i = 1; i <= profile.leadflowLeadsPerClinic; i++) {
      const demoKey = buildLeadflowDemoKey(clinic.slug, i);
      const email = buildLeadflowEmail(clinic.slug, i);
      if (leadflowEmailSet.has(email.toLowerCase())) {
        result.existingLeadflowLeads += 1;
        continue;
      }

      const journeyIndex = (i - 1) % 14;
      const journey = [
        "new_lead",
        "booked_consult",
        "completed_consult",
        "surgery_booked",
        "prp_only",
        "excellent_candidate",
        "poor_donor_candidate",
        "repair_assessment",
      ][journeyIndex % 8] as EnterpriseDemoJourneyArchetype;

      const { error } = await supabase.from("fi_leads").insert({
        tenant_id: tenantId,
        hubspot_contact_id: `${IHRG_DEMO_SOURCE_SYSTEM}:${demoKey}`,
        first_name: "Demo",
        last_name: `Lead ${clinic.city} ${i}`,
        email,
        phone: `+1-555-01${String(i).padStart(2, "0")}`,
        lead_source: "website",
        procedure_interest: predictedProcedureForJourney(journey),
        country: clinic.country,
        budget_range: i % 3 === 0 ? "15k_25k" : "8k_15k",
        current_stage: leadflowStageForJourney(journey),
        lead_score: 35 + (i * 7) % 55,
        conversion_probability: 20 + (i * 11) % 60,
        priority_band: i % 4 === 0 ? "high" : "medium",
        predicted_procedure: predictedProcedureForJourney(journey),
        scoring_reasons: ["demo_profile_seed", `clinic:${clinic.slug}`],
        risk_flags: journey === "poor_donor_candidate" ? ["donor_limited_demo_flag"] : [],
        scored_at: now,
        created_at: now,
        updated_at: now,
      });
      if (error) throw new Error(error.message);
      leadflowEmailSet.add(email.toLowerCase());
      result.createdLeadflowLeads += 1;
    }
  }

  const { data: existingCalendar } = await supabase
    .from("fi_calendar_events")
    .select("id, metadata")
    .eq("tenant_id", tenantId);
  if (existingCalendar === null) {
    const { error } = await supabase.from("fi_calendar_events").select("id").limit(1);
    if (error) throw new Error(error.message);
  }

  const calendarKeySet = new Set<string>();
  for (const row of existingCalendar ?? []) {
    const metadata = (row as { metadata: unknown }).metadata;
    if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
      const key = (metadata as Record<string, unknown>)[IHRG_DEMO_CALENDAR_EVENT_KEY_METADATA];
      if (typeof key === "string") calendarKeySet.add(key);
    }
  }

  const calendarSpecs = patientSpecs
    .filter((s) =>
      ["booked_consult", "completed_consult", "surgery_booked", "surgery_completed"].includes(
        s.journeyArchetype
      )
    )
    .slice(0, profile.calendarEventsPerClinic * ENTERPRISE_DEMO_CLINICS.length);

  for (const spec of calendarSpecs) {
    const demoCalendarKey = buildCalendarEventDemoKey(spec);
    if (calendarKeySet.has(demoCalendarKey)) {
      result.existingCalendarEvents += 1;
      continue;
    }

    const patientId = patientIdByKey.get(spec.demoPatientKey) ?? null;
    const start = new Date(spec.consultationDate);
    start.setUTCHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const { error } = await supabase.from("fi_calendar_events").insert({
      tenant_id: tenantId,
      provider: "google",
      calendar_id: `ihrg-demo-${spec.clinicSlug}@follicleintelligence.local`,
      title: `Consultation — ${spec.displayName}`,
      description: "Demo calendar booking for IHRG expansion pack.",
      location: spec.clinicSlug,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      event_type: "consultation",
      patient_id: patientId,
      metadata: {
        enterprise_demo: true,
        [IHRG_DEMO_CALENDAR_EVENT_KEY_METADATA]: demoCalendarKey,
        demo_patient_key: spec.demoPatientKey,
        journey_archetype: spec.journeyArchetype,
      },
      created_at: now,
      updated_at: now,
    });
    if (error) throw new Error(error.message);
    calendarKeySet.add(demoCalendarKey);
    result.createdCalendarEvents += 1;
  }

  const { data: existingAnalytics } = await supabase
    .from("fi_analytics_events")
    .select("id, event_metadata")
    .eq("tenant_id", tenantId);
  if (existingAnalytics === null) {
    const { error } = await supabase.from("fi_analytics_events").select("id").limit(1);
    if (error) throw new Error(error.message);
  }

  const analyticsKeySet = new Set<string>();
  for (const row of existingAnalytics ?? []) {
    const metadata = (row as { event_metadata: unknown }).event_metadata;
    if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
      const key = (metadata as Record<string, unknown>)[IHRG_DEMO_ANALYTICS_KEY_METADATA];
      if (typeof key === "string") analyticsKeySet.add(key);
    }
  }

  const clinicIds = [...clinicIdBySlug.values()];
  for (let i = 0; i < profile.analyticsEventsTotal; i++) {
    const spec = ANALYTICS_EVENT_SPECS[i % ANALYTICS_EVENT_SPECS.length];
    const demoAnalyticsKey = `ihrg-analytics-${String(i + 1).padStart(4, "0")}`;
    if (analyticsKeySet.has(demoAnalyticsKey)) {
      result.existingAnalyticsEvents += 1;
      continue;
    }

    const occurredAt = new Date(Date.now() - (i + 1) * 6 * 60 * 60 * 1000).toISOString();
    const clinicId = clinicIds[i % clinicIds.length] ?? null;

    const { error } = await supabase.from("fi_analytics_events").insert({
      tenant_id: tenantId,
      clinic_id: clinicId,
      module_name: spec.module_name,
      event_type: spec.event_type,
      event_metadata: {
        enterprise_demo: true,
        [IHRG_DEMO_ANALYTICS_KEY_METADATA]: demoAnalyticsKey,
        profile: profile.profile,
      },
      occurred_at: occurredAt,
      created_at: now,
    });
    if (error) throw new Error(error.message);
    analyticsKeySet.add(demoAnalyticsKey);
    result.createdAnalyticsEvents += 1;
  }

  const { data: existingReception } = await supabase
    .from("fi_reception_tasks")
    .select("id, source_ref_id")
    .eq("tenant_id", tenantId);
  if (existingReception === null) {
    const { error } = await supabase.from("fi_reception_tasks").select("id").limit(1);
    if (error) throw new Error(error.message);
  }

  const receptionRefSet = new Set(
    (existingReception ?? [])
      .map((row) => (row as { source_ref_id: string | null }).source_ref_id)
      .filter((ref): ref is string => Boolean(ref))
  );

  const receptionSpecs = patientSpecs.slice(0, profile.receptionTasksPerClinic * ENTERPRISE_DEMO_CLINICS.length);
  for (const spec of receptionSpecs) {
    const sourceRef = buildReceptionTaskDemoKey(spec);
    if (receptionRefSet.has(sourceRef)) {
      result.existingReceptionTasks += 1;
      continue;
    }

    const patientId = patientIdByKey.get(spec.demoPatientKey) ?? null;
    const { error } = await supabase.from("fi_reception_tasks").insert({
      tenant_id: tenantId,
      title: `Front desk follow-up — ${spec.displayName}`,
      description: "Demo reception task for consult confirmation or outcome check-in.",
      source_type: "consultation",
      severity: spec.journeyArchetype === "poor_donor_candidate" ? "warning" : "info",
      status: "open",
      patient_id: patientId,
      source_ref_id: sourceRef,
      due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        enterprise_demo: true,
        [IHRG_DEMO_RECEPTION_TASK_KEY_METADATA]: sourceRef,
        journey_archetype: spec.journeyArchetype,
      },
      created_at: now,
      updated_at: now,
    });
    if (error) throw new Error(error.message);
    receptionRefSet.add(sourceRef);
    result.createdReceptionTasks += 1;
  }

  const staffRows = await loadStaff(supabase, tenantId);
  const demoStaff = staffRows.filter((s) => s.staff_metadata?.enterprise_demo_staff === true);

  for (const staff of demoStaff) {
    for (let i = 0; i < profile.competencyProjectionsPerStaff; i++) {
      const competencyKey = COMPETENCY_KEYS[i % COMPETENCY_KEYS.length];
      const { data: existing } = await supabase
        .from("fi_staff_competency_projections")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("staff_id", staff.id)
        .eq("competency_key", competencyKey)
        .maybeSingle();

      if (existing?.id) {
        result.existingCompetencyProjections += 1;
        continue;
      }

      const status = i === 0 ? "active" : i === 1 ? "expiring" : "active";
      const readiness = i === 0 ? "advanced" : i === 1 ? "supervised" : "developing";

      const { error } = await supabase.from("fi_staff_competency_projections").insert({
        tenant_id: tenantId,
        staff_id: staff.id,
        source_system: IHRG_DEMO_SOURCE_SYSTEM,
        competency_key: competencyKey,
        competency_status: status,
        readiness_band: readiness,
        certification_level: readiness === "advanced" ? "certified" : "in_progress",
        evidence_count: 2 + i,
        latest_certificate: `IHRG-DEMO-${competencyKey}`,
        metadata: {
          enterprise_demo: true,
          demo_staff_key: staff.staff_metadata?.demo_staff_key ?? null,
        },
        last_verified_at: now,
        expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: now,
        updated_at: now,
      });
      if (error) throw new Error(error.message);
      result.createdCompetencyProjections += 1;
    }
  }

  return result;
}
