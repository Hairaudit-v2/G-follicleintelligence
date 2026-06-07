/** DOM ids for case detail anchors (SurgeryOS section nav). */
export const CASE_DETAIL_SECTION_IDS = {
  summary: "case-summary",
  readiness: "case-readiness",
  timeline: "case-timeline",
  surgeryPlanning: "case-surgery-planning",
  procedureDay: "case-procedure-day",
  postOp: "case-post-op",
  patient: "case-patient",
  lead: "case-lead",
  bookings: "case-bookings",
  images: "case-images",
  notes: "case-notes",
} as const;

export type CaseDetailSectionId = (typeof CASE_DETAIL_SECTION_IDS)[keyof typeof CASE_DETAIL_SECTION_IDS];

/** Stable heading id for `aria-labelledby` on case detail section landmarks. */
export function caseDetailSectionHeadingId(sectionId: CaseDetailSectionId): string {
  return `${sectionId}-heading`;
}

/** Order matches main page layout top-to-bottom. */
export const CASE_DETAIL_NAV_SECTIONS: { id: CaseDetailSectionId; label: string }[] = [
  { id: CASE_DETAIL_SECTION_IDS.summary, label: "Summary" },
  { id: CASE_DETAIL_SECTION_IDS.readiness, label: "Readiness" },
  { id: CASE_DETAIL_SECTION_IDS.timeline, label: "Timeline" },
  { id: CASE_DETAIL_SECTION_IDS.surgeryPlanning, label: "Surgery planning" },
  { id: CASE_DETAIL_SECTION_IDS.procedureDay, label: "Procedure day" },
  { id: CASE_DETAIL_SECTION_IDS.postOp, label: "Post-op / outcomes" },
  { id: CASE_DETAIL_SECTION_IDS.patient, label: "Patient" },
  { id: CASE_DETAIL_SECTION_IDS.lead, label: "Lead" },
  { id: CASE_DETAIL_SECTION_IDS.bookings, label: "Appointments" },
  { id: CASE_DETAIL_SECTION_IDS.images, label: "Images" },
  { id: CASE_DETAIL_SECTION_IDS.notes, label: "Notes" },
];
