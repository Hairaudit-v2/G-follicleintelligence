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
  /**
   * True when the phone number appears to be Excel-mangled scientific notation
   * (e.g. "6.14123E+10") or is otherwise unparseable. The corrupted value is
   * NOT stored as a contact phone and NOT used for deduplication.
   */
  phoneCorrupted: boolean;
  /**
   * Normalised digit-only phone string for deduplication purposes.
   * Null when: phone absent, corrupted (scientific notation), placeholder, or < 8 digits.
   */
  effectivePhoneDigits: string | null;
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
  /** Rows that have a blocking issue — will be skipped on commit. */
  rowsBlockedCount: number;
  /** Rows with no blocking issues — eligible for import. */
  rowsImportableCount: number;
  /** Rows whose phone was quarantined (scientific notation / placeholder); phone is ignored, row may still import. */
  quarantinedPhoneCount: number;
};

// ---------------------------------------------------------------------------
// Phone helpers
// ---------------------------------------------------------------------------

/**
 * True when the raw phone string looks like Excel scientific-notation mangling.
 * Excel converts large integers (phone numbers without leading +) to e.g.:
 *   "6.14123456789E+10"  →  should be "61412345678" (Australian mobile)
 *   "4.155551234E+9"     →  should be "4155551234"
 */
function isScientificNotationPhone(phone: string | null | undefined): boolean {
  if (!phone?.trim()) return false;
  return /^\d+(\.\d+)?[eE][+\-]\d+$/.test(phone.trim());
}

/**
 * Known-bad placeholder digit strings: all-same digit, sequential ascending/descending,
 * or classic North American test numbers.
 */
const PLACEHOLDER_PHONE_RE =
  /^(\d)\1{6,}$|^0{6,}$|^1234567890$|^0123456789$|^9876543210$|^12345678$|^87654321$/;

function isPlaceholderPhone(digits: string): boolean {
  return PLACEHOLDER_PHONE_RE.test(digits);
}

/**
 * Normalise phone to digit-only string for deduplication.
 * Returns null for: empty, scientific notation, < 8 digits after stripping.
 */
function digitsOnly(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  // Guard: do not attempt to extract digits from mangled scientific-notation values.
  if (isScientificNotationPhone(phone)) return null;
  const d = phone.replace(/\D/g, "");
  return d.length >= 8 ? d : null;
}

/** True when a name field appears to contain an email address. */
function hasEmailPattern(s: string | null | undefined): boolean {
  return /.+@.+\..+/.test((s ?? "").trim());
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function parseOptionalDate(raw: string | null): { ok: boolean; invalid: boolean } {
  if (raw == null || !String(raw).trim()) return { ok: true, invalid: false };
  const t = String(raw).trim();
  const ms = Date.parse(t.replace(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/, "$3-$1-$2"));
  if (Number.isNaN(ms)) return { ok: false, invalid: true };
  return { ok: true, invalid: false };
}

// ---------------------------------------------------------------------------
// String helpers
// ---------------------------------------------------------------------------

function lc(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Classification helpers (unchanged from original)
// ---------------------------------------------------------------------------

/** HubSpot lifecycle values that still indicate sales/lead tracking alongside a patient journey. */
function hubspotLifecycleIsLeadPipeline(lifecycleStage: string | null | undefined): boolean {
  const t = lc(lifecycleStage);
  if (!t) return false;
  if (/\bcustomer\b/.test(t)) return false;
  if (/\bevangelist\b/.test(t)) return false;
  if (/\bpatient\b/.test(t) && !/\blead\b/.test(t)) return false;
  return /\blead\b|subscriber|\b(sql|mql)\b|marketing qualified|sales qualified|opportunity\b/.test(
    t
  );
}

function hubspotMarketingLeadContactType(contactType: string | null | undefined): boolean {
  return /\bmarketing\s*lead\b/i.test((contactType ?? "").trim());
}

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

function associatedDealIndicatesSurgeryCompleted(
  associatedDeal: string | null | undefined
): boolean {
  const d = (associatedDeal ?? "").trim();
  if (!d) return false;
  const x = d.toLowerCase();
  return /closed[\s_-]*won|closedwon|deal\s*won|won\s*deal|surgery\s*(complete|done|completed)|procedure\s*(complete|done|completed)|post[\s_-]?(op|operative)/i.test(
    x
  );
}

function hasCompletedConsultAndQuoteAccepted(row: HubspotContactParsedRow): boolean {
  const journeySlug = mapStageOfJourneyToPipelineSlug(row.stageOfJourney).slug;
  const leadKey = mapLeadStatusToKey(row.leadStatus).key;
  const j = lc(row.stageOfJourney);
  const ls = lc(row.leadStatus);
  const consultDone =
    journeySlug === "consult_completed" ||
    /consultation?\s*(done|complete)|post[\s-]?consult/.test(j + " " + ls);
  if (!consultDone) return false;
  if (leadKey === "customer") return true;
  if (
    journeySlug === "treatment_planning" ||
    journeySlug === "quote_sent" ||
    journeySlug === "deposit_or_booked"
  ) {
    return true;
  }
  if (
    /quote\s*accepted|accepted\s*quote|treatment\s*accepted|deposit\s*(paid|received|taken)/.test(
      j + " " + ls
    )
  ) {
    return true;
  }
  if (/signed\s*contract|contract\s*signed|booking\s*(fee\s*)?(paid|received)/.test(j + " " + ls)) {
    return true;
  }
  return false;
}

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

export function classifyHubspotContactRow(
  row: HubspotContactParsedRow
): HubspotImportClassification {
  if (!hasHubspotPatientSignal(row)) return "lead_only";
  const leadFraming =
    hubspotLifecycleIsLeadPipeline(row.lifecycleStage) ||
    hubspotMarketingLeadContactType(row.contactType);
  if (leadFraming && !hasStrongPatientSignal(row)) return "mixed_patient_lead";
  return "patient";
}

// ---------------------------------------------------------------------------
// Field-presence helpers
// ---------------------------------------------------------------------------

function missingName(row: HubspotContactParsedRow): boolean {
  return !(row.firstName?.trim() || row.lastName?.trim());
}

function missingEmail(row: HubspotContactParsedRow): boolean {
  return !normalizeEmail(row.email);
}

function missingPhone(row: HubspotContactParsedRow): boolean {
  return !row.phoneNumber?.trim();
}

// ---------------------------------------------------------------------------
// Main validator
// ---------------------------------------------------------------------------

export function validateHubspotContactsRows(
  rows: HubspotContactParsedRow[]
): HubspotContactsDryRunReport {
  const generatedAt = new Date().toISOString();
  const recordIdCounts = new Map<string, number>();
  const emailKeyCounts = new Map<string, number>();
  const phoneKeyCounts = new Map<string, number>();

  // First pass: compute deduplication keys.
  // Scientific-notation phones produce digitsOnly() == null and are excluded from phone dedup.
  for (const row of rows) {
    const rid = row.recordId?.trim();
    if (rid) recordIdCounts.set(rid, (recordIdCounts.get(rid) ?? 0) + 1);
    const em = normalizeEmail(row.email);
    if (em) emailKeyCounts.set(em, (emailKeyCounts.get(em) ?? 0) + 1);
    const ph = digitsOnly(row.phoneNumber);
    if (ph && !isPlaceholderPhone(ph)) {
      phoneKeyCounts.set(ph, (phoneKeyCounts.get(ph) ?? 0) + 1);
    }
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

    // --- Record ID ---
    if (!rid) {
      issues.push({ code: "missing_record_id", message: "Record ID is required.", blocking: true });
    } else if ((recordIdCounts.get(rid) ?? 0) > 1) {
      issues.push({
        code: "duplicate_record_id",
        message: "Duplicate Record ID in file: " + rid,
        blocking: true,
      });
    }

    // --- Email ---
    const em = normalizeEmail(row.email);
    if (em && (emailKeyCounts.get(em) ?? 0) > 1) {
      issues.push({
        code: "duplicate_email",
        message: "Duplicate email in file: " + em,
        blocking: true,
      });
    }

    // --- Phone: scientific-notation detection ---
    const phoneCorrupted = isScientificNotationPhone(row.phoneNumber);
    if (phoneCorrupted) {
      issues.push({
        code: "scientific_notation_phone",
        message:
          "Phone number appears to be Excel scientific-notation mangled (e.g. 6.14E+10). " +
          "The raw value has been quarantined and will not be stored or used for deduplication. " +
          "Verify the correct number and re-upload if needed.",
        blocking: false,
      });
    }

    // --- Phone: compute effective digits (null when corrupted) ---
    const effectivePhoneDigits = phoneCorrupted ? null : digitsOnly(row.phoneNumber);

    // --- Phone: placeholder detection ---
    if (!phoneCorrupted && effectivePhoneDigits && isPlaceholderPhone(effectivePhoneDigits)) {
      issues.push({
        code: "placeholder_phone",
        message:
          "Phone number looks like a placeholder (e.g. all-same digit, sequential). " +
          "It will not be used for deduplication.",
        blocking: false,
      });
    }

    // --- Phone: in-file duplicate (only for valid, non-placeholder phones) ---
    if (
      effectivePhoneDigits &&
      !isPlaceholderPhone(effectivePhoneDigits) &&
      (phoneKeyCounts.get(effectivePhoneDigits) ?? 0) > 1
    ) {
      issues.push({
        code: "duplicate_phone",
        message: "Duplicate normalised phone number in file.",
        blocking: false,
      });
    }

    // --- Name ---
    if (missingName(row)) {
      issues.push({
        code: "missing_name",
        message: "Missing first and last name.",
        blocking: false,
      });
    }

    // --- Email in name field ---
    if (hasEmailPattern(row.firstName)) {
      issues.push({
        code: "email_in_first_name",
        message:
          "First Name field appears to contain an email address (" +
          (row.firstName ?? "") +
          "). This may be a paste error.",
        blocking: false,
      });
    }
    if (hasEmailPattern(row.lastName)) {
      issues.push({
        code: "email_in_last_name",
        message:
          "Last Name field appears to contain an email address (" +
          (row.lastName ?? "") +
          "). This may be a paste error.",
        blocking: false,
      });
    }

    // --- Contact-method completeness ---
    if (missingEmail(row)) {
      issues.push({ code: "missing_email", message: "Missing email.", blocking: false });
    }
    if (missingPhone(row)) {
      issues.push({ code: "missing_phone", message: "Missing phone number.", blocking: false });
    }
    if (missingEmail(row) && missingPhone(row)) {
      issues.push({
        code: "no_contact_method",
        message: "No email and no phone number. Cannot contact or identify this person.",
        blocking: true,
      });
    }

    // --- Dates ---
    const cd = parseOptionalDate(row.createDate);
    if (cd.invalid) {
      issues.push({
        code: "invalid_create_date",
        message: "Create Date is not parseable.",
        blocking: false,
      });
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

    // --- Stage of Journey / Lead Status ---
    const journey = mapStageOfJourneyToPipelineSlug(row.stageOfJourney);
    const leadMap = mapLeadStatusToKey(row.leadStatus);

    if (journey.unmapped && row.stageOfJourney?.trim()) {
      issues.push({
        code: "unmapped_stage_of_journey",
        message: "Unmapped Stage of Journey: " + row.stageOfJourney.trim(),
        blocking: false,
      });
    }

    // Missing Lead Status (empty field)
    if (!row.leadStatus?.trim()) {
      issues.push({
        code: "missing_lead_status",
        message: "Lead Status is empty. The row will be imported with no mapped status key.",
        blocking: false,
      });
    } else if (leadMap.unmapped) {
      // Non-empty but unrecognised value
      issues.push({
        code: "unmapped_lead_status",
        message: "Unmapped Lead Status: " + row.leadStatus.trim(),
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
      phoneCorrupted,
      effectivePhoneDigits:
        effectivePhoneDigits && !isPlaceholderPhone(effectivePhoneDigits)
          ? effectivePhoneDigits
          : null,
    });
  }

  let blockingCount = 0;
  let warningCount = 0;
  let rowsBlockedCount = 0;
  let rowsImportableCount = 0;
  let quarantinedPhoneCount = 0;

  for (const rr of rowResults) {
    let rowBlocking = false;
    for (const i of rr.issues) {
      if (i.blocking) {
        blockingCount++;
        rowBlocking = true;
      } else {
        warningCount++;
      }
    }
    if (rowBlocking) {
      rowsBlockedCount++;
    } else {
      rowsImportableCount++;
    }
    if (rr.phoneCorrupted) {
      quarantinedPhoneCount++;
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
    rowsBlockedCount,
    rowsImportableCount,
    quarantinedPhoneCount,
  };
}

export function rowHasBlockingIssues(v: HubspotContactRowValidation): boolean {
  return v.issues.some((i) => i.blocking);
}
