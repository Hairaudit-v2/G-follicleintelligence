/**
 * Shared validation for the public Platform & Migration Review enquiry form.
 * Used by the client form and POST /api/public/platform-review.
 */

export const PLATFORM_REVIEW_LOCATION_OPTIONS = [
  "1",
  "2–3",
  "4–10",
  "11+",
  "Not sure",
] as const;

export const PLATFORM_REVIEW_STAFF_OPTIONS = [
  "1–10",
  "11–25",
  "26–50",
  "51–100",
  "100+",
  "Not sure",
] as const;

export const PLATFORM_REVIEW_VOLUME_OPTIONS = [
  "Under 50",
  "50–150",
  "151–400",
  "400+",
  "Not sure",
] as const;

export const PLATFORM_REVIEW_SYSTEM_OPTIONS = [
  "HubSpot",
  "Pabau",
  "Cliniko",
  "Timely",
  "Salesforce",
  "Google Calendar",
  "Outlook / Microsoft 365",
  "Spreadsheets",
  "None",
  "Not sure",
  "Other",
] as const;

export const PLATFORM_REVIEW_INTEREST_OPTIONS = [
  "Improve enquiry and follow-up",
  "Connect HubSpot to FI",
  "Transition away from HubSpot",
  "Clinic operations",
  "Consultation workflows",
  "SurgeryOS",
  "Imaging and outcomes",
  "Workforce and training",
  "Analytics and reporting",
  "Multi-site standardisation",
  "Strategic partnership, research or investment",
  "Other",
] as const;

export const PLATFORM_REVIEW_ADOPTION_OPTIONS = [
  "Exploring",
  "Planning within 12 months",
  "Planning within 6 months",
  "Actively evaluating systems",
  "Ready to discuss a pilot or migration",
  "Strategic or investment discussion",
] as const;

export const PLATFORM_REVIEW_CONTACT_METHOD_OPTIONS = [
  "Email",
  "Phone",
  "Either",
] as const;

export type PlatformReviewFormValues = {
  firstName: string;
  lastName: string;
  workEmail: string;
  phone: string;
  role: string;
  organisation: string;
  country: string;
  cityRegion: string;
  locations: string;
  staffCount: string;
  monthlyEnquiries: string;
  monthlyConsultations: string;
  monthlyProcedures: string;
  crmSystem: string;
  bookingSystem: string;
  patientRecordSystem: string;
  imagingSystem: string;
  trainingSystem: string;
  otherSystems: string;
  primaryInterest: string;
  adoptionStage: string;
  mainProblems: string;
  priorityWorkflows: string;
  additionalContext: string;
  preferredTimezone: string;
  preferredContactMethod: string;
  consentContact: boolean;
  /** Honeypot — must remain empty. */
  companyWebsite: string;
  /** Client-generated token for basic duplicate suppression. */
  submissionKey: string;
  landingPage: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
};

export type PlatformReviewFieldErrors = Partial<Record<keyof PlatformReviewFormValues, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function required(value: string, label: string): string | null {
  if (!value.trim()) return `${label} is required.`;
  return null;
}

export function emptyPlatformReviewFormValues(
  overrides: Partial<PlatformReviewFormValues> = {}
): PlatformReviewFormValues {
  return {
    firstName: "",
    lastName: "",
    workEmail: "",
    phone: "",
    role: "",
    organisation: "",
    country: "",
    cityRegion: "",
    locations: "",
    staffCount: "",
    monthlyEnquiries: "",
    monthlyConsultations: "",
    monthlyProcedures: "",
    crmSystem: "",
    bookingSystem: "",
    patientRecordSystem: "",
    imagingSystem: "",
    trainingSystem: "",
    otherSystems: "",
    primaryInterest: "",
    adoptionStage: "",
    mainProblems: "",
    priorityWorkflows: "",
    additionalContext: "",
    preferredTimezone: "",
    preferredContactMethod: "Either",
    consentContact: false,
    companyWebsite: "",
    submissionKey: "",
    landingPage: "",
    referrer: "",
    utmSource: "",
    utmMedium: "",
    utmCampaign: "",
    utmContent: "",
    utmTerm: "",
    ...overrides,
  };
}

/** Pure validation — no I/O. Returns field errors; empty object means valid (except honeypot). */
export function validatePlatformReviewForm(
  values: PlatformReviewFormValues
): { ok: true; values: PlatformReviewFormValues } | { ok: false; errors: PlatformReviewFieldErrors } {
  const errors: PlatformReviewFieldErrors = {};

  // Honeypot filled → treat as invalid without revealing why to bots (API still rejects silently).
  if (values.companyWebsite.trim()) {
    return { ok: false, errors: { companyWebsite: "Invalid submission." } };
  }

  const set = (key: keyof PlatformReviewFormValues, msg: string | null) => {
    if (msg) errors[key] = msg;
  };

  set("firstName", required(values.firstName, "First name"));
  set("lastName", required(values.lastName, "Last name"));
  set("workEmail", required(values.workEmail, "Work email"));
  if (values.workEmail.trim() && !EMAIL_RE.test(values.workEmail.trim())) {
    errors.workEmail = "Enter a valid work email address.";
  }
  set("phone", required(values.phone, "Phone number"));
  set("role", required(values.role, "Role or position"));
  set("organisation", required(values.organisation, "Clinic or organisation name"));
  set("country", required(values.country, "Country"));
  set("cityRegion", required(values.cityRegion, "City or region"));
  set("locations", required(values.locations, "Number of clinic locations"));
  set("staffCount", required(values.staffCount, "Approximate number of staff"));
  set("monthlyEnquiries", required(values.monthlyEnquiries, "Approximate monthly enquiries"));
  set(
    "monthlyConsultations",
    required(values.monthlyConsultations, "Approximate monthly consultations")
  );
  set(
    "monthlyProcedures",
    required(values.monthlyProcedures, "Approximate monthly procedures or treatments")
  );
  set("crmSystem", required(values.crmSystem, "CRM"));
  set("bookingSystem", required(values.bookingSystem, "Booking or calendar system"));
  set(
    "patientRecordSystem",
    required(values.patientRecordSystem, "Patient or clinical record system")
  );
  set("imagingSystem", required(values.imagingSystem, "Imaging or photography system"));
  set("trainingSystem", required(values.trainingSystem, "Training or learning system"));
  set("primaryInterest", required(values.primaryInterest, "Primary interest"));
  set("adoptionStage", required(values.adoptionStage, "Adoption stage"));
  set("mainProblems", required(values.mainProblems, "Main problems"));
  set("priorityWorkflows", required(values.priorityWorkflows, "Priority workflows"));

  if (!values.consentContact) {
    errors.consentContact = "Consent is required so we can respond to your enquiry.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    values: {
      ...values,
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      workEmail: values.workEmail.trim().toLowerCase(),
      phone: values.phone.trim(),
      role: values.role.trim(),
      organisation: values.organisation.trim(),
      country: values.country.trim(),
      cityRegion: values.cityRegion.trim(),
      otherSystems: values.otherSystems.trim(),
      mainProblems: values.mainProblems.trim(),
      priorityWorkflows: values.priorityWorkflows.trim(),
      additionalContext: values.additionalContext.trim(),
      preferredTimezone: values.preferredTimezone.trim(),
      submissionKey: values.submissionKey.trim(),
    },
  };
}

export function formatPlatformReviewEmailBody(values: PlatformReviewFormValues): string {
  const lines: string[] = [
    "Platform and Migration Review enquiry",
    "====================================",
    "",
    "Contact",
    `Name: ${values.firstName} ${values.lastName}`,
    `Email: ${values.workEmail}`,
    `Phone: ${values.phone}`,
    `Role: ${values.role}`,
    `Organisation: ${values.organisation}`,
    `Country: ${values.country}`,
    `City / region: ${values.cityRegion}`,
    `Preferred contact: ${values.preferredContactMethod || "Either"}`,
    `Timezone: ${values.preferredTimezone || "—"}`,
    "",
    "Clinic profile",
    `Locations: ${values.locations}`,
    `Staff: ${values.staffCount}`,
    `Monthly enquiries: ${values.monthlyEnquiries}`,
    `Monthly consultations: ${values.monthlyConsultations}`,
    `Monthly procedures: ${values.monthlyProcedures}`,
    "",
    "Current systems",
    `CRM: ${values.crmSystem}`,
    `Booking / calendar: ${values.bookingSystem}`,
    `Patient / clinical records: ${values.patientRecordSystem}`,
    `Imaging: ${values.imagingSystem}`,
    `Training: ${values.trainingSystem}`,
    `Other systems: ${values.otherSystems || "—"}`,
    "",
    "Priorities",
    `Primary interest: ${values.primaryInterest}`,
    `Adoption stage: ${values.adoptionStage}`,
    "",
    "Main problems:",
    values.mainProblems,
    "",
    "Priority workflows:",
    values.priorityWorkflows,
    "",
    "Additional context:",
    values.additionalContext || "—",
    "",
    "Attribution",
    `Landing page: ${values.landingPage || "—"}`,
    `Referrer: ${values.referrer || "—"}`,
    `UTM source: ${values.utmSource || "—"}`,
    `UTM medium: ${values.utmMedium || "—"}`,
    `UTM campaign: ${values.utmCampaign || "—"}`,
    `UTM content: ${values.utmContent || "—"}`,
    `UTM term: ${values.utmTerm || "—"}`,
    `Consent to contact: yes`,
    `Submission key: ${values.submissionKey || "—"}`,
  ];
  return lines.join("\n");
}

export function platformReviewDuplicateFingerprint(values: PlatformReviewFormValues): string {
  return [
    values.workEmail.trim().toLowerCase(),
    values.organisation.trim().toLowerCase(),
    values.primaryInterest.trim().toLowerCase(),
  ].join("|");
}
