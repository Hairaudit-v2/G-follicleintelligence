/**
 * Build operational facts pack from profile foundation data (no free-text notes).
 */

import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";
import { derivePatientIdentityContact } from "@/src/lib/patients/patientIdentityContact";
import type {
  PatientAiSummaryFacts,
  PatientAiSummaryTimelineItem,
} from "./patientAiSummaryTypes";

function ymd(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const s = String(iso).trim();
  if (!s) return null;
  return s.slice(0, 10);
}

/**
 * Map loaded patient profile into LLM-safe operational facts.
 * Intentionally omits admin_note body, clinical free text, and meds.
 */
export function buildPatientAiSummaryFacts(
  data: PatientProfileFoundationData
): PatientAiSummaryFacts {
  const idc = derivePatientIdentityContact({
    personMetadata: data.person.metadata,
    patientMetadata: data.patient.metadata,
    preferredContactMethod: data.patient.preferred_contact_method,
    reminderConsent: data.patient.reminder_consent,
  });

  const images = data.patientImages;
  const imageCount = images?.counts?.total ?? images?.activeWithSignedUrls?.length ?? 0;
  // Best-effort baseline detection without clinical interpretation
  const hasBaselinePhotos = Boolean(
    images?.activeWithSignedUrls?.some((tile) => {
      const cat = String(tile.image?.image_category ?? "").toLowerCase();
      return cat.includes("baseline") || cat.includes("before");
    })
  );

  const missingPhotoCategories: string[] = [];
  const completeness = data.vieImagingCompleteness;
  if (completeness?.headline?.slots?.length) {
    for (const s of completeness.headline.slots) {
      if (s.status === "missing") {
        missingPhotoCategories.push(s.label || s.slug);
      }
      if (missingPhotoCategories.length >= 8) break;
    }
  }

  const upcoming = data.bookings?.upcoming ?? [];
  const past = data.bookings?.past ?? [];
  const nextAppointmentOn = upcoming[0] ? ymd(upcoming[0].start_at) : null;

  const timelineItems: PatientAiSummaryTimelineItem[] = [];
  for (const item of data.patientTimeline?.items ?? []) {
    // Prefer structured type titles over free-text that may be sensitive
    const occurredOn = ymd(item.occurred_at) ?? "unknown";
    const kind = String(item.item_type ?? "other").slice(0, 40);
    const label = item.is_sensitive
      ? `${kind.replace(/_/g, " ")} (details on record)`
      : String(item.title ?? kind).slice(0, 160);
    if (label) timelineItems.push({ occurredOn, kind, label });
    if (timelineItems.length >= 8) break;
  }

  // Activity fallback
  if (timelineItems.length === 0 && data.activity?.length) {
    for (const a of data.activity.slice(0, 6)) {
      timelineItems.push({
        occurredOn: ymd(a.occurred_at) ?? "unknown",
        kind: String(a.activity_kind ?? "activity").slice(0, 40),
        label: String(a.title ?? a.activity_kind ?? "Activity").slice(0, 160),
      });
    }
  }

  const recentActivityKinds = [
    ...new Set(
      (data.activity ?? [])
        .slice(0, 12)
        .map((a) => String(a.activity_kind ?? "").trim())
        .filter(Boolean)
    ),
  ].slice(0, 8);

  const caseStatuses = (data.cases ?? [])
    .map((c) => String(c.status ?? "").trim())
    .filter(Boolean)
    .slice(0, 8);

  // Scale fields: only presence flags from clinical details metadata keys if present — never scores
  const scalesRecordedFlags: string[] = [];
  const clinicalMeta = data.clinicalDetails?.row
    ? ((data.clinicalDetails.row as { metadata?: Record<string, unknown> }).metadata ?? null)
    : null;
  if (clinicalMeta && typeof clinicalMeta === "object") {
    for (const key of ["sgfhc_recorded", "green_scale_recorded", "adfhl_recorded", "scales_complete"]) {
      if (clinicalMeta[key] === true) scalesRecordedFlags.push(key);
    }
  }

  const openLeads = (data.leads ?? []).filter((l) => {
    const stage = String(l.lead?.stage_key ?? l.stageLabel ?? "").toLowerCase();
    return !stage.includes("won") && !stage.includes("lost") && !stage.includes("closed");
  });

  return {
    patientId: data.foundationPatientId,
    tenantId: data.tenantId,
    displayName: idc.fullName?.split(/\s+/)[0] ?? null,
    patientStatus: data.patient.patient_status ?? null,
    recordCreatedOn: ymd(data.patient.created_at),
    imageCount: Number(imageCount) || 0,
    hasBaselinePhotos,
    missingPhotoCategories,
    upcomingAppointmentCount: upcoming.length,
    nextAppointmentOn,
    pastAppointmentCount: past.length,
    openLeadCount: openLeads.length,
    openCaseCount: (data.cases ?? []).length,
    caseStatuses,
    recentActivityKinds,
    timelineItems,
    scalesRecordedFlags,
    hasAdminNote: Boolean(data.patient.admin_note?.trim()),
    reminderConsent:
      data.patient.reminder_consent === true
        ? true
        : data.patient.reminder_consent === false
          ? false
          : null,
  };
}
