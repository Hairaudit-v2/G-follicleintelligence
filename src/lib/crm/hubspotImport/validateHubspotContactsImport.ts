import { normalizeEmail } from "@/src/lib/fi/foundation/normalize";
import { mapLeadStatusToKey, mapStageOfJourneyToPipelineSlug } from "./hubspotImportMappings";
import type { HubspotContactParsedRow } from "./hubspotContactCsvColumns";

/** Stage 1 HubSpot contact disposition for CRM import (not Timely `classifyRowDisposition`). */
export type HubspotImportClassification = "patient" | "lead_only" | "mixed_patient_lead";

export type HubspotContactRowIssue = {
  code: string;
  message: string;
  blocking: boolean;
};

export type HubspotContactRowValidation = {
  rowIndex: number;
  recordId: string | null;
  issues: HubspotContactRowIssue[];
  classification: HubspotImportClassification;
  mappedPipelineSlug: string | null;
  mappedLeadStatusKey: string | null;
  journeyUnmapped: boolean;
  leadStatusUnmapped: boolean;
};

export type HubspotContactsDryRunReport = {
  generatedAt: string;
  totalRows: number;
  rowResults: HubspotContactRowValidation[];
  blockingCount: number;
  warningCount: number;
  duplicateRecordIdsInFile: string[];
  duplicateEmailsInFile: string[];
  duplicatePhonesInFile: string[];
  passed: boolean;
};

function digitsOnly(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const d = phone.replace(/\D/g, "");
  return d.length >= 8 ? d : null;
}

function parseOptionalDate(raw: string | null): { ok: boolean; invalid: boolean } {
  if (raw == null || !String(raw).trim()) return { ok: true, invalid: false };
  const t = String(raw).trim();
  const ms = Date.parse(t.replace(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/, "$3-$1-$2"));
  if (Number.isNaN(ms)) return { ok: false, invalid: true };
  return { ok: true, invalid: false };
}

function lc(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/** HubSpot lifecycle values that still indicate sales/lead tracking alongside a patient journey. */
function hubspotLifecycleIsLeadPipeline(lifecycleStage: string | null | undefined): boolean {
  const t = lc(lifecycleStage);
  if (!t) return false;
  if (/\bcustomer\b/.test(t)) return false;
  if (/\bevangelist\b/.test(t)) return false;
  if (/\bpatient\b/.test(t) && !/\blead\b/.test(t)) return false;
  return /\blead\b|subscriber|\b(sql|mql)\b|marketing qualified|sales qualified|opportunity\b/.test(t);
}

function hubspotMarketingLeadContactType(contactType: string | null | undefined): boolean {
  return /\bmarketing\s*lead\b/i.test((contactType ?? "").trim());
}

/** Rule 1 — Stage of Journey phrases that indicate an active or historical patient relationship. */
function journeyIndicatesPatient(stageOfJourney: string | null | undefined): boolean {
  const j = lc(stageOfJourney);
  if (!j) return false;
  if (j.includes("surgery done")) return true;
  if (j.includes("surgery booked")) return true;
  if (/post[\s-]*op|postop|postoperative/.test(j)) return true;
  if (/follow[\s/-]*up/.test(j)) return true;
  if (j.includes("existing patient")) return true;
  if (/\bpatient\b/.test(j)) return true;
  return false;
}

function contactTypeIndicatesPatient(contactType: string | null | undefined): boolean {
  const t = lc(contactType);
  if (!t) return false;
  return t.includes("existing patient") || t.includes("patient");
}

function lifecycleIndicatesPatient(lifecycleStage: string | null | undefined): boolean {
  const t = lc(lifecycleStage);
  if (!t) return false;
  return /\bcustomer\b/.test(t) || /\bpatient\b/.test(t);
}

/**
 * Rule 4 — Associated deal text sometimes includes HubSpot won labels; this export often only has deal names.
 * Treat obvious closed-won / completion language as surgery completed when a deal row is present.
 */
function associatedDealIndicatesSurgeryCompleted(associatedDeal: string | null | undefined): boolean {
  const d = (associatedDeal ?? "").trim();
  if (!d) return false;
  const x = d.toLowerCase();
  return /closed[\s_-]*won|closedwon|deal\s*won|won\s*deal|surgery\s*(complete|done|completed)|procedure\s*(complete|done|completed)|post[\s_-]?(op|operative)/i.test(
    x
  );
}

/**
 * Rule 5 — Consult completed plus commercial acceptance (quote / deposit / contract), using journey + lead status text
 * and mapped pipeline slugs where helpful.
 */
function hasCompletedConsultAndQuoteAccepted(row: HubspotContactParsedRow): boolean {
  const journeySlug = mapStageOfJourneyToPipelineSlug(row.stageOfJourney).slug;
  const leadKey = mapLeadStatusToKey(row.leadStatus).key;
  const j = lc(row.stageOfJourney);
  const ls = lc(row.leadStatus);
  const consultDone =
    journeySlug === "consult_completed" || /consultation?\s*(done|complete)|post[\s-]?consult/.test(j + " " + ls);
  if (!consultDone) return false;
  if (leadKey === "customer") return true;
  if (
    journeySlug === "treatment_planning" ||
    journeySlug === "quote_sent" ||
    journeySlug === "deposit_or_booked"
  ) {
    return true;
  }
  if (/quote\s*accepted|accepted\s*quote|treatment\s*accepted|deposit\s*(paid|received|taken)/.test(j + " " + ls)) {
    return true;
  }
  if (/signed\s*contract|contract\s*signed|booking\s*(fee\s*)?(paid|received)/.test(j + " " + ls)) {
    return true;
  }
  return false;
}

/**
 * Strong patient signals: post-sale / explicit patient identity / won deal / consult+quote — overrides lead lifecycle for `patient`.
 */
function hasStrongPatientSignal(row: HubspotContactParsedRow): boolean {
  const j = lc(row.stageOfJourney);
  if (j.includes("surgery done")) return true;
  if (/post[\s-]*op|postop|postoperative/.test(j)) return true;
  if (j.includes("existing patient")) return true;
  if (/follow[\s/-]*up/.test(j)) return true;
  if (/\bpatient\b/.test(j)) return true;
  if (lifecycleIndicatesPatient(row.lifecycleStage)) return true;
  if (contactTypeIndicatesPatient(row.contactType)) return true;
  if (associatedDealIndicatesSurgeryCompleted(row.associatedDeal)) return true;
  if (hasCompletedConsultAndQuoteAccepted(row)) return true;
  const ls = lc(row.leadStatus);
  if (ls.includes("patient") || /\bcustomer\b/.test(ls)) return true;
  return false;
}

/** Any rule 1–5 patient signal (journey includes Surgery Booked, lifecycle, contact type, deal, consult+quote). */
function hasHubspotPatientSignal(row: HubspotContactParsedRow): boolean {
  if (journeyIndicatesPatient(row.stageOfJourney)) return true;
  if (lifecycleIndicatesPatient(row.lifecycleStage)) return true;
  if (contactTypeIndicatesPatient(row.contactType)) return true;
  const deal = (row.associatedDeal ?? "").trim();
  if (deal && associatedDealIndicatesSurgeryCompleted(row.associatedDeal)) return true;
  if (hasCompletedConsultAndQuoteAccepted(row)) return true;
  const ls = lc(row.leadStatus);
  if (ls.includes("patient") || /\bcustomer\b/.test(ls)) return true;
  return false;
}

/**
 * Classifies a HubSpot contact CSV row for Stage 1 import.
 * - `mixed_patient_lead`: patient journey or deal context while HubSpot lifecycle still looks like a lead/opportunity.
 * - `patient`: definitive patient / customer context, or strong journey (e.g. Surgery Done) even if lifecycle lags.
 */
export function classifyHubspotContactRow(row: HubspotContactParsedRow): HubspotImportClassification {
  if (!hasHubspotPatientSignal(row)) return "lead_only";
  const leadFraming =
    hubspotLifecycleIsLeadPipeline(row.lifecycleStage) || hubspotMarketingLeadContactType(row.contactType);
  if (leadFraming && !hasStrongPatientSignal(row)) return "mixed_patient_lead";
  return "patient";
}

function missingName(row: HubspotContactParsedRow): boolean {
  return !(row.firstName?.trim() || row.lastName?.trim());
}

function missingEmail(row: HubspotContactParsedRow): boolean {
  return !normalizeEmail(row.email);
}

function missingPhone(row: HubspotContactParsedRow): boolean {
  return !row.phoneNumber?.trim();
}

export function validateHubspotContactsRows(rows: HubspotContactParsedRow[]): HubspotContactsDryRunReport {
  const generatedAt = new Date().toISOString();
  const recordIdCounts = new Map<string, number>();
  const emailKeyCounts = new Map<string, number>();
  const phoneKeyCounts = new Map<string, number>();

  for (const row of rows) {
    const rid = row.recordId?.trim();
    if (rid) recordIdCounts.set(rid, (recordIdCounts.get(rid) ?? 0) + 1);
    const em = normalizeEmail(row.email);
    if (em) emailKeyCounts.set(em, (emailKeyCounts.get(em) ?? 0) + 1);
    const ph = digitsOnly(row.phoneNumber);
    if (ph) phoneKeyCounts.set(ph, (phoneKeyCounts.get(ph) ?? 0) + 1);
  }

  const duplicateRecordIdsInFile = Array.from(recordIdCounts.entries())
    .filter(([, n]) => n > 1)
    .map(([k]) => k);
  const duplicateEmailsInFile = Array.from(emailKeyCounts.entries())
    .filter(([, n]) => n > 1)
    .map(([k]) => k);
  const duplicatePhonesInFile = Array.from(phoneKeyCounts.entries())
    .filter(([, n]) => n > 1)
    .map(([k]) => k);

  const rowResults: HubspotContactRowValidation[] = [];

  for (const row of rows) {
    const issues: HubspotContactRowIssue[] = [];
    const rid = row.recordId?.trim() ?? null;

    if (!rid) {
      issues.push({ code: "missing_record_id", message: "Record ID is required.", blocking: true });
    } else if ((recordIdCounts.get(rid) ?? 0) > 1) {
      issues.push({
        code: "duplicate_record_id",
        message: `Duplicate Record ID in file: ${rid}`,
        blocking: true,
      });
    }

    const em = normalizeEmail(row.email);
    if (em && (emailKeyCounts.get(em) ?? 0) > 1) {
      issues.push({
        code: "duplicate_email",
        message: `Duplicate email in file: ${em}`,
        blocking: true,
      });
    }

    const phKey = digitsOnly(row.phoneNumber);
    if (phKey && (phoneKeyCounts.get(phKey) ?? 0) > 1) {
      issues.push({
        code: "duplicate_phone",
        message: "Duplicate normalised phone number in file.",
        blocking: false,
      });
    }

    if (missingName(row)) {
      issues.push({
        code: "missing_name",
        message: "Missing first and last name.",
        blocking: false,
      });
    }
    if (missingEmail(row)) {
      issues.push({ code: "missing_email", message: "Missing email.", blocking: false });
    }
    if (missingPhone(row)) {
      issues.push({ code: "missing_phone", message: "Missing phone number.", blocking: false });
    }

    const cd = parseOptionalDate(row.createDate);
    if (cd.invalid) {
      issues.push({ code: "invalid_create_date", message: "Create Date is not parseable.", blocking: false });
    }
    const md = parseOptionalDate(row.lastModifiedDate);
    if (md.invalid) {
      issues.push({
        code: "invalid_last_modified_date",
        message: "Last Modified Date is not parseable.",
        blocking: false,
      });
    }
    const nd = parseOptionalDate(row.nextAppointmentDate);
    if (nd.invalid) {
      issues.push({
        code: "invalid_next_appointment_date",
        message: "Next Appointment Date is not parseable.",
        blocking: false,
      });
    }

    const journey = mapStageOfJourneyToPipelineSlug(row.stageOfJourney);
    const leadMap = mapLeadStatusToKey(row.leadStatus);
    if (journey.unmapped && row.stageOfJourney?.trim()) {
      issues.push({
        code: "unmapped_stage_of_journey",
        message: `Unmapped Stage of Journey: ${row.stageOfJourney.trim()}`,
        blocking: false,
      });
    }
    if (leadMap.unmapped && row.leadStatus?.trim()) {
      issues.push({
        code: "unmapped_lead_status",
        message: `Unmapped Lead Status: ${row.leadStatus.trim()}`,
        blocking: false,
      });
    }

    const classification = classifyHubspotContactRow(row);

    rowResults.push({
      rowIndex: row.rowIndex,
      recordId: rid,
      issues,
      classification,
      mappedPipelineSlug: journey.slug,
      mappedLeadStatusKey: leadMap.key,
      journeyUnmapped: Boolean(row.stageOfJourney?.trim() && journey.unmapped),
      leadStatusUnmapped: Boolean(row.leadStatus?.trim() && leadMap.unmapped),
    });
  }

  let blockingCount = 0;
  let warningCount = 0;
  for (const rr of rowResults) {
    for (const i of rr.issues) {
      if (i.blocking) blockingCount++;
      else warningCount++;
    }
  }

  const passed = blockingCount === 0;

  return {
    generatedAt,
    totalRows: rows.length,
    rowResults,
    blockingCount,
    warningCount,
    duplicateRecordIdsInFile,
    duplicateEmailsInFile,
    duplicatePhonesInFile,
    passed,
  };
}

export function rowHasBlockingIssues(v: HubspotContactRowValidation): boolean {
  return v.issues.some((i) => i.blocking);
}
