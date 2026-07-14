/**
 * FI-UX-REBUILD-1 S2 — Staff-facing terminology map.
 *
 * Stable product terms for clinic staff UI. Internal routes, modules, flags,
 * and engineering identifiers may still use *OS names — only visible copy uses these.
 */

/** Approved staff-facing labels (canonical). */
export const FI_OS_STAFF_TERMS = {
  frontDesk: "Front desk",
  clinic: "Clinic",
  clinicFlow: "Clinic flow",
  surgery: "Surgery",
  surgeryDay: "Surgery day",
  readyForSurgery: "Ready for surgery",
  surgeryReadiness: "Surgery readiness",
  surgeryInsights: "Surgery insights",
  team: "Team",
  teamOverview: "Team overview",
  teamInsights: "Team insights",
  teamDirectory: "Team directory",
  roster: "Roster",
  onboarding: "Onboarding",
  money: "Money",
  finances: "Money",
  takePayment: "Take payment",
  insights: "Insights",
  patients: "Patients",
  healthRecord: "Health record",
  enquiries: "Enquiries",
  pipeline: "Pipeline",
  followUpQueue: "Follow-up queue",
  qualityReview: "Quality review",
  clinicalInsights: "Clinical insights",
  overview: "Overview",
  doctorOverview: "Doctor overview",
  platformAdmin: "Platform administration",
  recommendations: "Recommendations",
  suggestedActions: "Suggested actions",
  calendar: "Calendar",
  receptionBoard: "Reception board",
  tomorrowBoard: "Tomorrow board",
  cases: "Cases",
  staffAccess: "Staff access",
} as const;

export type FiOsStaffTermKey = keyof typeof FI_OS_STAFF_TERMS;

/**
 * Legacy architecture language → approved staff label.
 * Used for audits, migrations of copy, and documentation.
 */
export const FI_OS_LEGACY_TO_STAFF_TERM: ReadonlyArray<{
  legacy: string;
  approved: string;
  notes?: string;
}> = [
  { legacy: "ReceptionOS", approved: FI_OS_STAFF_TERMS.frontDesk },
  { legacy: "ClinicOS", approved: FI_OS_STAFF_TERMS.frontDesk, notes: "Or Clinic in ops context" },
  { legacy: "SurgeryOS", approved: FI_OS_STAFF_TERMS.surgery },
  { legacy: "WorkforceOS", approved: FI_OS_STAFF_TERMS.team },
  { legacy: "HR OS", approved: FI_OS_STAFF_TERMS.team },
  { legacy: "FinancialOS", approved: FI_OS_STAFF_TERMS.finances },
  { legacy: "AnalyticsOS", approved: FI_OS_STAFF_TERMS.insights },
  { legacy: "PatientOS", approved: FI_OS_STAFF_TERMS.patients },
  { legacy: "OnboardingOS", approved: FI_OS_STAFF_TERMS.onboarding },
  {
    legacy: "LeadFlow",
    approved: FI_OS_STAFF_TERMS.pipeline,
    notes: "Staff nav label after S4.5D",
  },
  { legacy: "Patient Twin", approved: FI_OS_STAFF_TERMS.healthRecord },
  { legacy: "Digital Twin", approved: FI_OS_STAFF_TERMS.healthRecord },
  { legacy: "Procedure Day", approved: FI_OS_STAFF_TERMS.surgeryDay },
  { legacy: "Procedure Day Board", approved: FI_OS_STAFF_TERMS.surgeryDay },
  { legacy: "Readiness Board", approved: FI_OS_STAFF_TERMS.readyForSurgery },
  { legacy: "Surgical Readiness", approved: FI_OS_STAFF_TERMS.surgeryReadiness },
  { legacy: "Command Centre", approved: FI_OS_STAFF_TERMS.overview },
  { legacy: "Command Center", approved: FI_OS_STAFF_TERMS.overview },
  { legacy: "Workforce Command Centre", approved: FI_OS_STAFF_TERMS.teamOverview },
  { legacy: "Reception Command Centre", approved: FI_OS_STAFF_TERMS.frontDesk },
  { legacy: "Audit Intelligence", approved: FI_OS_STAFF_TERMS.qualityReview },
  { legacy: "Workforce Intelligence", approved: FI_OS_STAFF_TERMS.teamInsights },
  { legacy: "Surgical Intelligence", approved: FI_OS_STAFF_TERMS.surgeryInsights },
  { legacy: "Clinical Intelligence", approved: FI_OS_STAFF_TERMS.clinicalInsights },
  { legacy: "Global Command", approved: FI_OS_STAFF_TERMS.platformAdmin },
  { legacy: "Doctor Command Centre", approved: FI_OS_STAFF_TERMS.doctorOverview },
  { legacy: "Operations Board", approved: FI_OS_STAFF_TERMS.clinicFlow },
  { legacy: "Bookings Board", approved: FI_OS_STAFF_TERMS.calendar },
  { legacy: "Onboarding Centre", approved: FI_OS_STAFF_TERMS.onboarding },
];

/**
 * Prohibited substrings in ordinary staff-facing labels (nav, page titles, chrome).
 * Matching is case-insensitive whole-phrase / OS-suffix aware.
 */
export const FI_OS_PROHIBITED_STAFF_LABEL_PATTERNS: readonly RegExp[] = [
  /\bReceptionOS\b/i,
  /\bSurgeryOS\b/i,
  /\bWorkforceOS\b/i,
  /\bFinancialOS\b/i,
  /\bPatientOS\b/i,
  /\bAnalyticsOS\b/i,
  /\bClinicOS\b/i,
  /\bOnboardingOS\b/i,
  /\bConsultationOS\b/i,
  /\bAuditOS\b/i,
  /\bAcademyOS\b/i,
  /\bImagingOS\b/i,
  /\bCalendarOS\b/i,
  /\bFoundationOS\b/i,
  /\bRevenueOS\b/i,
  /\bHR\s*OS\b/i,
  /\bPatient\s+Twin\b/i,
  /\bDigital\s+Twin\b/i,
  /\bStaff\s+Twin\b/i,
  /\bCommand\s+Cent(?:re|er)\b/i,
  /\bProcedure\s+Day\b/i,
  /\bReadiness\s+Board\b/i,
  /\bAudit\s+Intelligence\b/i,
  /\bWorkforce\s+Intelligence\b/i,
  /\bSurgical\s+Intelligence\b/i,
  /\bOutcome\s+Intelligence\b/i,
  /\bPresence\s+Intelligence\b/i,
  /\bLeadFlow\b/i,
  /\bGlobal\s+Command\b/i,
  /\bOnboarding\s+Centre\b/i,
  /\bIntelligence\s+Centre\b/i,
  /\bAccess\s+Centre\b/i,
  /** Generic *OS product suffix (e.g. "SomethingOS") — not FI OS product name alone. */
  /\b(?!FI\b)\w+OS\b/i,
];

/** True when a staff-facing display label still uses architecture language. */
export function staffLabelHasProhibitedArchitectureLanguage(label: string): boolean {
  const t = label.trim();
  if (!t) return false;
  // Allow bare "FI OS" / "FI" product name in rare chrome; block module *OS.
  if (/^FI\s*OS$/i.test(t) || /^Follicle Intelligence$/i.test(t)) return false;
  return FI_OS_PROHIBITED_STAFF_LABEL_PATTERNS.some((re) => re.test(t));
}

/**
 * Labels that may intentionally retain technical language (platform admin, diagnostics).
 * Callers pass surface context — this is documentation for exceptions, not an auto-allowlist of strings.
 */
export const FI_OS_TECHNICAL_LABEL_SURFACE_NOTES = {
  platformAdmin: "Platform administration may name internal tools plainly for operators.",
  routePaths: "URL segments such as /surgery-os stay until later finish-track stages.",
  codeIdentifiers: "Component names, feature keys, and event ids are not display strings.",
  marketingSite: "Public marketing may use product architecture language.",
} as const;

/** Resolve approved label for a known legacy term (exact, case-insensitive). */
export function resolveApprovedStaffTerm(legacyOrCurrent: string): string | null {
  const needle = legacyOrCurrent.trim().toLowerCase();
  if (!needle) return null;
  for (const row of FI_OS_LEGACY_TO_STAFF_TERM) {
    if (row.legacy.toLowerCase() === needle) return row.approved;
  }
  return null;
}

/** Hub titles used by consolidated workspaces. */
export const FI_OS_STAFF_HUB_TITLES = {
  frontDesk: FI_OS_STAFF_TERMS.frontDesk,
  surgery: FI_OS_STAFF_TERMS.surgery,
  team: FI_OS_STAFF_TERMS.team,
  reports: FI_OS_STAFF_TERMS.insights,
  finances: FI_OS_STAFF_TERMS.finances,
  patients: FI_OS_STAFF_TERMS.patients,
  calendar: FI_OS_STAFF_TERMS.calendar,
  enquiries: FI_OS_STAFF_TERMS.enquiries,
  doctor: FI_OS_STAFF_TERMS.doctorOverview,
} as const;

/** Common surgery navigation labels. */
export const FI_OS_STAFF_SURGERY_LABELS = {
  overview: FI_OS_STAFF_TERMS.overview,
  cases: FI_OS_STAFF_TERMS.cases,
  surgeryDay: FI_OS_STAFF_TERMS.surgeryDay,
  review: "Review",
  readyForSurgery: FI_OS_STAFF_TERMS.readyForSurgery,
  surgeryInsights: FI_OS_STAFF_TERMS.surgeryInsights,
} as const;
