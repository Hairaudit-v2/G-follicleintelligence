/** DOM ids for case detail anchors (SurgeryOS section nav). */
export const CASE_DETAIL_SECTION_IDS = {
  summary: "case-summary",
  readiness: "case-readiness",
  caseIntelligence: "case-intelligence",
  outcomeIntelligence: "case-outcome-intelligence",
  timeline: "case-timeline",
  surgeryPlanning: "case-surgery-planning",
  procedureDay: "case-procedure-day",
  postOp: "case-post-op",
  patient: "case-patient",
  lead: "case-lead",
  bookings: "case-bookings",
  images: "case-images",
  prescriptions: "case-prescriptions",
  notes: "case-notes",
} as const;

export type CaseDetailSectionId =
  (typeof CASE_DETAIL_SECTION_IDS)[keyof typeof CASE_DETAIL_SECTION_IDS];

/** Stable heading id for `aria-labelledby` on case detail section landmarks. */
export function caseDetailSectionHeadingId(sectionId: CaseDetailSectionId): string {
  return `${sectionId}-heading`;
}

/** Hash link for SurgeryOS procedure day section (scroll target on case detail). */
export const CASE_PROCEDURE_DAY_DETAIL_HASH = `#${CASE_DETAIL_SECTION_IDS.procedureDay}`;

export function caseProcedureDayDetailHref(tenantId: string, caseId: string): string {
  const tid = tenantId.trim();
  const cid = caseId.trim();
  return `/fi-admin/${encodeURIComponent(tid)}/cases/${encodeURIComponent(cid)}${CASE_PROCEDURE_DAY_DETAIL_HASH}`;
}

/**
 * Clipboard payload for a procedure-day deep link: absolute URL when `origin` is set
 * (e.g. `window.location.origin` in the browser), otherwise the app-relative href.
 */
export function procedureDayLinkForClipboard(relativeHref: string, origin?: string | null): string {
  const href = relativeHref.trim();
  if (!href) return href;
  const o = origin?.trim();
  if (!o) return href;
  try {
    return new URL(href, o).href;
  } catch {
    return href;
  }
}

/** Order matches main page layout top-to-bottom. */
export const CASE_DETAIL_NAV_SECTIONS: { id: CaseDetailSectionId; label: string }[] = [
  { id: CASE_DETAIL_SECTION_IDS.summary, label: "Summary" },
  { id: CASE_DETAIL_SECTION_IDS.readiness, label: "Readiness" },
  { id: CASE_DETAIL_SECTION_IDS.caseIntelligence, label: "Case intelligence" },
  { id: CASE_DETAIL_SECTION_IDS.outcomeIntelligence, label: "Outcome intelligence" },
  { id: CASE_DETAIL_SECTION_IDS.timeline, label: "Timeline" },
  { id: CASE_DETAIL_SECTION_IDS.surgeryPlanning, label: "Surgery planning" },
  { id: CASE_DETAIL_SECTION_IDS.procedureDay, label: "Procedure day" },
  { id: CASE_DETAIL_SECTION_IDS.postOp, label: "Post-op / outcomes" },
  { id: CASE_DETAIL_SECTION_IDS.patient, label: "Patient" },
  { id: CASE_DETAIL_SECTION_IDS.lead, label: "Lead" },
  { id: CASE_DETAIL_SECTION_IDS.bookings, label: "Appointments" },
  { id: CASE_DETAIL_SECTION_IDS.images, label: "Images" },
  { id: CASE_DETAIL_SECTION_IDS.prescriptions, label: "Prescriptions" },
  { id: CASE_DETAIL_SECTION_IDS.notes, label: "Notes" },
];
