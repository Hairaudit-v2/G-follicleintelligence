import { normalizeEmail } from "@/src/lib/fi/foundation/normalize";
import { mapLeadStatusToKey, mapStageOfJourneyToPipelineSlug } from "./hubspotImportMappings";
import type { HubspotContactParsedRow } from "./hubspotContactCsvColumns";

export type HubspotImportClassification = "patient" | "lead_only";

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

function inferClassification(row: HubspotContactParsedRow): HubspotImportClassification {
  const ct = row.contactType?.toLowerCase() ?? "";
  const ls = row.leadStatus?.toLowerCase() ?? "";
  const lc = row.lifecycleStage?.toLowerCase() ?? "";
  if (ct.includes("patient")) return "patient";
  if (lc.includes("customer") || lc.includes("patient")) return "patient";
  if (ls.includes("patient") || ls.includes("customer")) return "patient";
  return "lead_only";
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

    const classification = inferClassification(row);

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
