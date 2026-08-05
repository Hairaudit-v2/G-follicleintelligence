/**
 * FI-CALENDAR-IDENTITY-LINK-1B — canonical calendar person identity states + pure resolver.
 *
 * Never auto-link on name alone. Do not copy external titles into patient-name fields.
 */

export const CALENDAR_PERSON_IDENTITY_STATES = [
  "patient_linked",
  "consultation_identity_linked",
  "enquiry_identity_linked",
  "patient_creation_pending",
  "external_identity_only",
  "ambiguous_identity",
  "identity_conflict",
] as const;

export type CalendarPersonIdentityState = (typeof CALENDAR_PERSON_IDENTITY_STATES)[number];

export const CALENDAR_IDENTITY_MATCH_METHODS = [
  "explicit_google_event_patient_mapping",
  "fios_appointment_patient",
  "consultation_patient",
  "consultation_contact",
  "enquiry_contact",
  "exact_verified_email",
  "exact_verified_phone",
  "verified_external_identity_mapping",
  "ambiguous_suggestion",
  "external_identity_only",
  "identity_conflict",
  "manual_override",
  "consultation_to_patient_promotion",
] as const;

export type CalendarIdentityMatchMethod = (typeof CALENDAR_IDENTITY_MATCH_METHODS)[number];

export type CalendarIdentityMatchEvidence = {
  method: CalendarIdentityMatchMethod;
  confidence: "high" | "medium" | "low" | "none";
  detail?: string | null;
};

export type CalendarIdentityCandidateKind = "patient" | "consultation" | "enquiry" | "person";

export type CalendarIdentityCandidate = {
  kind: CalendarIdentityCandidateKind;
  /** Primary entity id for the candidate kind. */
  id: string;
  tenantId: string;
  patientId?: string | null;
  consultationId?: string | null;
  enquiryId?: string | null;
  /** Canonical contact / `fi_persons.id`. */
  contactId?: string | null;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  label?: string | null;
};

export type CalendarPersonIdentityResolution = {
  identityState: CalendarPersonIdentityState;
  patientId: string | null;
  consultationId: string | null;
  enquiryId: string | null;
  contactId: string | null;
  displayName: string | null;
  externalDisplayTitle: string | null;
  verifiedEmail: string | null;
  verifiedPhone: string | null;
  matchEvidence: CalendarIdentityMatchEvidence;
  promotionRequired: boolean;
  /** Present when state is ambiguous — operator must choose. */
  suggestions: CalendarIdentityCandidate[];
  /** Human-readable status lines for the drawer (not the patient name). */
  identityKindLabel: string | null;
  identityStatusLabel: string | null;
  /** True only when there is no known FiOS patient/consultation/enquiry identity. */
  patientNotLinked: boolean;
};

export type ResolveCalendarPersonIdentityInput = {
  tenantId: string;
  /** Explicit Google-event → patient mapping on `fi_calendar_events.patient_id`. */
  explicitPatientId?: string | null;
  explicitConsultationId?: string | null;
  explicitEnquiryId?: string | null;
  explicitContactId?: string | null;
  /** Existing FiOS appointment (`fi_bookings`) patient, if converted. */
  appointmentPatientId?: string | null;
  appointmentContactId?: string | null;
  consultation?: {
    id: string;
    tenantId: string;
    patientId?: string | null;
    contactId?: string | null;
    enquiryId?: string | null;
    displayName?: string | null;
  } | null;
  enquiry?: {
    id: string;
    tenantId: string;
    patientId?: string | null;
    contactId?: string | null;
    displayName?: string | null;
  } | null;
  verifiedEmail?: string | null;
  verifiedPhone?: string | null;
  /** Exact email matches already scoped to this tenant. */
  emailMatches?: CalendarIdentityCandidate[];
  /** Exact normalised phone matches already scoped to this tenant. */
  phoneMatches?: CalendarIdentityCandidate[];
  /** Verified external id → patient mapping for this Google event. */
  verifiedExternalMapping?: {
    patientId: string;
    displayName?: string | null;
    contactId?: string | null;
  } | null;
  /**
   * Name-only candidates — never auto-selected; may contribute to ambiguous suggestions
   * only when other signals already produced ambiguity, or as low-confidence review list.
   */
  nameOnlySuggestions?: CalendarIdentityCandidate[];
  externalDisplayTitle?: string | null;
  /**
   * When true and an explicit patient mapping already exists that differs from a newly
   * proposed automatic candidate, return identity_conflict instead of overwriting.
   */
  protectExistingExplicitPatientMapping?: boolean;
};

const EMPTY_EVIDENCE: CalendarIdentityMatchEvidence = {
  method: "external_identity_only",
  confidence: "none",
};

function trimId(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t || null;
}

function sameTenant(candidateTenantId: string, tenantId: string): boolean {
  return candidateTenantId.trim() === tenantId.trim();
}

function rejectCrossTenant<T extends { tenantId: string }>(
  items: T[] | undefined,
  tenantId: string
): { accepted: T[]; rejected: T[] } {
  const accepted: T[] = [];
  const rejected: T[] = [];
  for (const item of items ?? []) {
    if (sameTenant(item.tenantId, tenantId)) accepted.push(item);
    else rejected.push(item);
  }
  return { accepted, rejected };
}

function uniqueCandidates(items: CalendarIdentityCandidate[]): CalendarIdentityCandidate[] {
  const seen = new Set<string>();
  const out: CalendarIdentityCandidate[] = [];
  for (const c of items) {
    const key = `${c.kind}:${c.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function consultationLabel(displayName: string | null | undefined): string {
  const name = displayName?.trim() || "Consultation identity";
  return `${name} — New consultation — Patient record pending`;
}

function result(partial: Omit<CalendarPersonIdentityResolution, "patientNotLinked"> & {
  patientNotLinked?: boolean;
}): CalendarPersonIdentityResolution {
  const state = partial.identityState;
  const knownFiOsIdentity =
    state === "patient_linked" ||
    state === "consultation_identity_linked" ||
    state === "enquiry_identity_linked" ||
    state === "patient_creation_pending";
  return {
    ...partial,
    patientNotLinked: partial.patientNotLinked ?? !knownFiOsIdentity,
  };
}

/**
 * Single canonical identity resolution pathway (pure).
 *
 * Order:
 * 1. Explicit Google-event→patient mapping
 * 2. FiOS appointment patientId
 * 3. Consultation patientId
 * 4. Consultation/contact identity
 * 5. Enquiry/contact identity
 * 6. Exact verified email
 * 7. Exact verified phone
 * 8. Verified external identity mapping
 * 9. Ambiguous suggestions
 * 10. External identity only
 */
export function resolveCalendarPersonIdentity(
  input: ResolveCalendarPersonIdentityInput
): CalendarPersonIdentityResolution {
  const tenantId = input.tenantId.trim();
  const externalDisplayTitle = input.externalDisplayTitle?.trim() || null;
  const verifiedEmail = input.verifiedEmail?.trim().toLowerCase() || null;
  const verifiedPhone = input.verifiedPhone?.trim() || null;

  const explicitPatientId = trimId(input.explicitPatientId);
  const appointmentPatientId = trimId(input.appointmentPatientId);
  const explicitConsultationId = trimId(input.explicitConsultationId);
  const explicitEnquiryId = trimId(input.explicitEnquiryId);
  const explicitContactId = trimId(input.explicitContactId);

  const consultation =
    input.consultation && sameTenant(input.consultation.tenantId, tenantId)
      ? input.consultation
      : null;
  const enquiry =
    input.enquiry && sameTenant(input.enquiry.tenantId, tenantId) ? input.enquiry : null;

  const emailAccepted = rejectCrossTenant(input.emailMatches, tenantId);
  const phoneAccepted = rejectCrossTenant(input.phoneMatches, tenantId);
  const nameAccepted = rejectCrossTenant(input.nameOnlySuggestions, tenantId);

  // 1. Explicit Google-event → patient mapping
  if (explicitPatientId) {
    return result({
      identityState: "patient_linked",
      patientId: explicitPatientId,
      consultationId: consultation?.id ?? explicitConsultationId,
      enquiryId: enquiry?.id ?? explicitEnquiryId,
      contactId: consultation?.contactId ?? enquiry?.contactId ?? explicitContactId,
      displayName:
        consultation?.displayName?.trim() ||
        enquiry?.displayName?.trim() ||
        null,
      externalDisplayTitle,
      verifiedEmail,
      verifiedPhone,
      matchEvidence: {
        method: "explicit_google_event_patient_mapping",
        confidence: "high",
      },
      promotionRequired: false,
      suggestions: [],
      identityKindLabel: null,
      identityStatusLabel: null,
    });
  }

  // 2. Existing FiOS appointment patientId
  if (appointmentPatientId) {
    if (
      input.protectExistingExplicitPatientMapping &&
      explicitPatientId &&
      explicitPatientId !== appointmentPatientId
    ) {
      return result({
        identityState: "identity_conflict",
        patientId: explicitPatientId,
        consultationId: consultation?.id ?? explicitConsultationId,
        enquiryId: enquiry?.id ?? explicitEnquiryId,
        contactId: explicitContactId,
        displayName: null,
        externalDisplayTitle,
        verifiedEmail,
        verifiedPhone,
        matchEvidence: {
          method: "identity_conflict",
          confidence: "high",
          detail: "Appointment patient differs from explicit event patient mapping.",
        },
        promotionRequired: false,
        suggestions: [],
        identityKindLabel: "Identity conflict",
        identityStatusLabel: "Manual review required",
      });
    }
    return result({
      identityState: "patient_linked",
      patientId: appointmentPatientId,
      consultationId: consultation?.id ?? explicitConsultationId,
      enquiryId: enquiry?.id ?? explicitEnquiryId,
      contactId:
        trimId(input.appointmentContactId) ??
        consultation?.contactId ??
        enquiry?.contactId ??
        explicitContactId,
      displayName: consultation?.displayName?.trim() || enquiry?.displayName?.trim() || null,
      externalDisplayTitle,
      verifiedEmail,
      verifiedPhone,
      matchEvidence: { method: "fios_appointment_patient", confidence: "high" },
      promotionRequired: false,
      suggestions: [],
      identityKindLabel: null,
      identityStatusLabel: null,
    });
  }

  // 3. Existing consultation patientId
  const consultationPatientId = trimId(consultation?.patientId);
  if (consultation && consultationPatientId) {
    return result({
      identityState: "patient_linked",
      patientId: consultationPatientId,
      consultationId: consultation.id,
      enquiryId: trimId(consultation.enquiryId) ?? enquiry?.id ?? explicitEnquiryId,
      contactId: trimId(consultation.contactId) ?? explicitContactId,
      displayName: consultation.displayName?.trim() || null,
      externalDisplayTitle,
      verifiedEmail,
      verifiedPhone,
      matchEvidence: { method: "consultation_patient", confidence: "high" },
      promotionRequired: false,
      suggestions: [],
      identityKindLabel: null,
      identityStatusLabel: null,
    });
  }

  // 4. Existing consultation / contact identity (no canonical patient yet)
  if (consultation && (trimId(consultation.contactId) || consultation.id)) {
    const name = consultation.displayName?.trim() || null;
    return result({
      identityState: "consultation_identity_linked",
      patientId: null,
      consultationId: consultation.id,
      enquiryId: trimId(consultation.enquiryId) ?? enquiry?.id ?? explicitEnquiryId,
      contactId: trimId(consultation.contactId) ?? explicitContactId,
      displayName: name,
      externalDisplayTitle,
      verifiedEmail,
      verifiedPhone,
      matchEvidence: { method: "consultation_contact", confidence: "high" },
      promotionRequired: true,
      suggestions: [],
      identityKindLabel: "New consultation",
      identityStatusLabel: "Patient record pending",
    });
  }

  // Explicit consultation id without loaded row still counts as linked consultation identity.
  if (explicitConsultationId) {
    return result({
      identityState: "consultation_identity_linked",
      patientId: null,
      consultationId: explicitConsultationId,
      enquiryId: enquiry?.id ?? explicitEnquiryId,
      contactId: explicitContactId,
      displayName: null,
      externalDisplayTitle,
      verifiedEmail,
      verifiedPhone,
      matchEvidence: { method: "consultation_contact", confidence: "medium" },
      promotionRequired: true,
      suggestions: [],
      identityKindLabel: "New consultation",
      identityStatusLabel: "Patient record pending",
    });
  }

  // 5. Existing enquiry / contact identity
  if (enquiry) {
    const enquiryPatientId = trimId(enquiry.patientId);
    if (enquiryPatientId) {
      return result({
        identityState: "patient_linked",
        patientId: enquiryPatientId,
        consultationId: null,
        enquiryId: enquiry.id,
        contactId: trimId(enquiry.contactId) ?? explicitContactId,
        displayName: enquiry.displayName?.trim() || null,
        externalDisplayTitle,
        verifiedEmail,
        verifiedPhone,
        matchEvidence: { method: "enquiry_contact", confidence: "high" },
        promotionRequired: false,
        suggestions: [],
        identityKindLabel: null,
        identityStatusLabel: null,
      });
    }
    return result({
      identityState: "enquiry_identity_linked",
      patientId: null,
      consultationId: null,
      enquiryId: enquiry.id,
      contactId: trimId(enquiry.contactId) ?? explicitContactId,
      displayName: enquiry.displayName?.trim() || null,
      externalDisplayTitle,
      verifiedEmail,
      verifiedPhone,
      matchEvidence: { method: "enquiry_contact", confidence: "high" },
      promotionRequired: true,
      suggestions: [],
      identityKindLabel: "Enquiry",
      identityStatusLabel: "Patient record pending",
    });
  }

  if (explicitEnquiryId) {
    return result({
      identityState: "enquiry_identity_linked",
      patientId: null,
      consultationId: null,
      enquiryId: explicitEnquiryId,
      contactId: explicitContactId,
      displayName: null,
      externalDisplayTitle,
      verifiedEmail,
      verifiedPhone,
      matchEvidence: { method: "enquiry_contact", confidence: "medium" },
      promotionRequired: true,
      suggestions: [],
      identityKindLabel: "Enquiry",
      identityStatusLabel: "Patient record pending",
    });
  }

  // 6–7. Exact verified email / phone (never name)
  const exactHits = uniqueCandidates([...emailAccepted.accepted, ...phoneAccepted.accepted]);
  if (exactHits.length === 1) {
    const hit = exactHits[0]!;
    const method: CalendarIdentityMatchMethod = emailAccepted.accepted.some((c) => c.id === hit.id)
      ? "exact_verified_email"
      : "exact_verified_phone";
    if (hit.kind === "patient" || hit.patientId) {
      return result({
        identityState: "patient_linked",
        patientId: hit.patientId ?? hit.id,
        consultationId: hit.consultationId ?? null,
        enquiryId: hit.enquiryId ?? null,
        contactId: hit.contactId ?? null,
        displayName: hit.displayName?.trim() || null,
        externalDisplayTitle,
        verifiedEmail,
        verifiedPhone,
        matchEvidence: { method, confidence: "high" },
        promotionRequired: false,
        suggestions: [],
        identityKindLabel: null,
        identityStatusLabel: null,
      });
    }
    if (hit.kind === "consultation" || hit.consultationId) {
      return result({
        identityState: "consultation_identity_linked",
        patientId: null,
        consultationId: hit.consultationId ?? hit.id,
        enquiryId: hit.enquiryId ?? null,
        contactId: hit.contactId ?? null,
        displayName: hit.displayName?.trim() || null,
        externalDisplayTitle,
        verifiedEmail,
        verifiedPhone,
        matchEvidence: { method, confidence: "high" },
        promotionRequired: true,
        suggestions: [],
        identityKindLabel: "New consultation",
        identityStatusLabel: "Patient record pending",
      });
    }
    if (hit.kind === "enquiry" || hit.enquiryId) {
      return result({
        identityState: "enquiry_identity_linked",
        patientId: null,
        consultationId: null,
        enquiryId: hit.enquiryId ?? hit.id,
        contactId: hit.contactId ?? null,
        displayName: hit.displayName?.trim() || null,
        externalDisplayTitle,
        verifiedEmail,
        verifiedPhone,
        matchEvidence: { method, confidence: "high" },
        promotionRequired: true,
        suggestions: [],
        identityKindLabel: "Enquiry",
        identityStatusLabel: "Patient record pending",
      });
    }
  }

  if (exactHits.length > 1) {
    return result({
      identityState: "ambiguous_identity",
      patientId: null,
      consultationId: null,
      enquiryId: null,
      contactId: null,
      displayName: null,
      externalDisplayTitle,
      verifiedEmail,
      verifiedPhone,
      matchEvidence: {
        method: "ambiguous_suggestion",
        confidence: "medium",
        detail: "Multiple exact email/phone matches require operator review.",
      },
      promotionRequired: false,
      suggestions: exactHits.map((h) => ({
        ...h,
        label:
          h.kind === "consultation"
            ? consultationLabel(h.displayName)
            : h.displayName?.trim() || h.label || h.id,
      })),
      identityKindLabel: "Ambiguous match",
      identityStatusLabel: "Confirm identity",
    });
  }

  // 8. Verified external identity mapping
  const verified = input.verifiedExternalMapping;
  if (verified?.patientId?.trim()) {
    return result({
      identityState: "patient_linked",
      patientId: verified.patientId.trim(),
      consultationId: null,
      enquiryId: null,
      contactId: trimId(verified.contactId),
      displayName: verified.displayName?.trim() || null,
      externalDisplayTitle,
      verifiedEmail,
      verifiedPhone,
      matchEvidence: {
        method: "verified_external_identity_mapping",
        confidence: "high",
      },
      promotionRequired: false,
      suggestions: [],
      identityKindLabel: null,
      identityStatusLabel: null,
    });
  }

  // 9. Name-only remains suggestion material — never automatic link.
  // If only name hits exist, surface as ambiguous review (or external_only with empty high-conf).
  if (nameAccepted.accepted.length > 0) {
    return result({
      identityState: "ambiguous_identity",
      patientId: null,
      consultationId: null,
      enquiryId: null,
      contactId: null,
      displayName: null,
      externalDisplayTitle,
      verifiedEmail,
      verifiedPhone,
      matchEvidence: {
        method: "ambiguous_suggestion",
        confidence: "low",
        detail: "Name-only matches require human confirmation; never auto-linked.",
      },
      promotionRequired: false,
      suggestions: nameAccepted.accepted.map((h) => ({
        ...h,
        label:
          h.kind === "consultation"
            ? consultationLabel(h.displayName)
            : h.displayName?.trim() || h.label || h.id,
      })),
      identityKindLabel: "Possible match",
      identityStatusLabel: "Confirm identity",
    });
  }

  if (emailAccepted.rejected.length > 0 || phoneAccepted.rejected.length > 0) {
    return result({
      identityState: "external_identity_only",
      patientId: null,
      consultationId: null,
      enquiryId: null,
      contactId: null,
      displayName: null,
      externalDisplayTitle,
      verifiedEmail,
      verifiedPhone,
      matchEvidence: {
        method: "external_identity_only",
        confidence: "none",
        detail: "Cross-tenant identity matches were rejected.",
      },
      promotionRequired: false,
      suggestions: [],
      identityKindLabel: null,
      identityStatusLabel: null,
    });
  }

  // 10. External identity only
  return result({
    identityState: "external_identity_only",
    patientId: null,
    consultationId: null,
    enquiryId: null,
    contactId: null,
    displayName: null,
    externalDisplayTitle,
    verifiedEmail,
    verifiedPhone,
    matchEvidence: EMPTY_EVIDENCE,
    promotionRequired: false,
    suggestions: [],
    identityKindLabel: null,
    identityStatusLabel: null,
  });
}

/** Drawer / card display fields derived from a resolution (never copies title into patient name). */
export function calendarIdentityDisplayFields(
  resolution: CalendarPersonIdentityResolution
): {
  anchorLabel: string;
  identityKindLabel: string | null;
  identityStatusLabel: string | null;
  patientNotLinked: boolean;
  identityState: CalendarPersonIdentityState;
  displayName: string | null;
  externalDisplayTitle: string | null;
  promotionRequired: boolean;
} {
  const external = resolution.externalDisplayTitle;
  if (resolution.identityState === "consultation_identity_linked") {
    return {
      anchorLabel: resolution.displayName?.trim() || "Consultation identity",
      identityKindLabel: resolution.identityKindLabel ?? "New consultation",
      identityStatusLabel: resolution.identityStatusLabel ?? "Patient record pending",
      patientNotLinked: false,
      identityState: resolution.identityState,
      displayName: resolution.displayName,
      externalDisplayTitle: external,
      promotionRequired: true,
    };
  }
  if (resolution.identityState === "enquiry_identity_linked") {
    return {
      anchorLabel: resolution.displayName?.trim() || "Enquiry identity",
      identityKindLabel: resolution.identityKindLabel ?? "Enquiry",
      identityStatusLabel: resolution.identityStatusLabel ?? "Patient record pending",
      patientNotLinked: false,
      identityState: resolution.identityState,
      displayName: resolution.displayName,
      externalDisplayTitle: external,
      promotionRequired: true,
    };
  }
  if (resolution.identityState === "patient_linked") {
    return {
      anchorLabel: resolution.displayName?.trim() || "Linked patient",
      identityKindLabel: null,
      identityStatusLabel: null,
      patientNotLinked: false,
      identityState: resolution.identityState,
      displayName: resolution.displayName,
      externalDisplayTitle: external,
      promotionRequired: false,
    };
  }
  if (
    resolution.identityState === "ambiguous_identity" ||
    resolution.identityState === "identity_conflict"
  ) {
    return {
      anchorLabel: resolution.identityKindLabel ?? "Confirm identity",
      identityKindLabel: resolution.identityKindLabel,
      identityStatusLabel: resolution.identityStatusLabel,
      patientNotLinked: false,
      identityState: resolution.identityState,
      displayName: resolution.displayName,
      externalDisplayTitle: external,
      promotionRequired: false,
    };
  }
  if (resolution.identityState === "patient_creation_pending") {
    return {
      anchorLabel: resolution.displayName?.trim() || "Patient creation pending",
      identityKindLabel: "Patient creation pending",
      identityStatusLabel: null,
      patientNotLinked: false,
      identityState: resolution.identityState,
      displayName: resolution.displayName,
      externalDisplayTitle: external,
      promotionRequired: false,
    };
  }
  return {
    anchorLabel: "Patient not linked",
    identityKindLabel: null,
    identityStatusLabel: null,
    patientNotLinked: true,
    identityState: "external_identity_only",
    displayName: null,
    externalDisplayTitle: external,
    promotionRequired: false,
  };
}

/** Format consultation hit for Link patient UI. */
export function formatConsultationIdentitySearchLabel(displayName: string | null | undefined): string {
  return consultationLabel(displayName);
}
