/**
 * Pure MedicationOS → Patient Twin clinical slice (bounded caps, no I/O).
 */
import { toPatientTherapyEventPreview } from "../medicationOs/medicationOsMappers";
import type { ActiveTherapyPlanSummary, PatientTherapyEventRow } from "../medicationOs/medicationOsTypes";
import type {
  PatientTwinMedicationActiveItem,
  PatientTwinMedicationsSection,
  PatientTwinTherapyEventPreview,
} from "./patientTwinTypes";

export const PATIENT_TWIN_MEDICATION_OS_ACTIVE_ITEMS_CAP = 24;
export const PATIENT_TWIN_MEDICATION_OS_EVENTS_PREVIEW_CAP = 16;
/** Loader read cap (≥ preview cap). */
export const PATIENT_TWIN_MEDICATION_OS_EVENTS_READ_CAP = 32;

const ITEM_CAP_HARD_MAX = 80;
const EVENT_PREVIEW_HARD_MAX = 100;

function medicationSourceTables(): readonly ["fi_patient_therapy_plan_items", "fi_medication_os_canonical"] {
  return ["fi_patient_therapy_plan_items", "fi_medication_os_canonical"] as const;
}

export function emptyPatientTwinMedicationsSection(): PatientTwinMedicationsSection {
  return {
    active_plan_count: 0,
    active_items: [],
    therapy_events_preview: [],
    active_item_cap: PATIENT_TWIN_MEDICATION_OS_ACTIVE_ITEMS_CAP,
    therapy_events_preview_cap: PATIENT_TWIN_MEDICATION_OS_EVENTS_PREVIEW_CAP,
  };
}

export function buildPatientTwinMedicationsSection(
  summary: ActiveTherapyPlanSummary,
  therapyEvents: PatientTherapyEventRow[],
  caps?: { activeItems?: number; eventsPreview?: number }
): PatientTwinMedicationsSection {
  const activeItemCap = Math.min(
    Math.max(1, caps?.activeItems ?? PATIENT_TWIN_MEDICATION_OS_ACTIVE_ITEMS_CAP),
    ITEM_CAP_HARD_MAX
  );
  const eventsPreviewCap = Math.min(
    Math.max(1, caps?.eventsPreview ?? PATIENT_TWIN_MEDICATION_OS_EVENTS_PREVIEW_CAP),
    EVENT_PREVIEW_HARD_MAX
  );

  const active_items: PatientTwinMedicationActiveItem[] = [];
  outer: for (const pl of summary.plans) {
    for (const it of pl.items) {
      if (active_items.length >= activeItemCap) break outer;
      active_items.push({
        plan_item_id: it.planItemId,
        plan_id: it.planId,
        plan_title: pl.title,
        plan_type: pl.plan_type,
        canonical_code: it.canonical_code,
        display_name: it.display_name,
        role: it.role,
        dosing_summary: it.dosing_summary,
        pathology_gate: it.pathology_gate,
        sessions_planned: it.sessions_planned,
        sessions_completed: it.sessions_completed,
        prescription_id: it.prescription_id?.trim() || null,
        prescription_item_id: it.prescription_item_id?.trim() || null,
        source_tables: medicationSourceTables(),
      });
    }
  }

  const therapy_events_preview: PatientTwinTherapyEventPreview[] = therapyEvents
    .slice(0, eventsPreviewCap)
    .map((row) => {
      const p = toPatientTherapyEventPreview(row);
      return {
        id: p.id,
        event_type: p.event_type,
        occurred_at: p.occurred_at,
        title: p.title,
        canonical_code: p.canonical_code,
        plan_id: p.plan_id,
        source_table: "fi_patient_therapy_events",
      };
    });

  return {
    active_plan_count: summary.active_plan_count,
    active_items,
    therapy_events_preview,
    active_item_cap: activeItemCap,
    therapy_events_preview_cap: eventsPreviewCap,
  };
}
