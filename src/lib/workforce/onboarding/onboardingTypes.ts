/** WorkforceOS staff onboarding invitation statuses. */
export const ONBOARDING_INVITATION_STATUSES = ["pending", "accepted", "expired"] as const;
export type OnboardingInvitationStatus = (typeof ONBOARDING_INVITATION_STATUSES)[number];

/** Isolated onboarding PIN setup token statuses. */
export const ONBOARDING_PIN_SETUP_STATUSES = ["pending", "completed", "expired"] as const;
export type OnboardingPinSetupStatus = (typeof ONBOARDING_PIN_SETUP_STATUSES)[number];

export const ONBOARDING_EMPLOYMENT_TYPES = [
  "full_time",
  "part_time",
  "casual",
  "contractor",
] as const;
export type OnboardingEmploymentType = (typeof ONBOARDING_EMPLOYMENT_TYPES)[number];

export const ONBOARDING_EMPLOYMENT_TYPE_LABELS: Record<OnboardingEmploymentType, string> = {
  full_time: "Full time",
  part_time: "Part time",
  casual: "Casual",
  contractor: "Contractor",
};

/** Default invitation validity (days). */
export const ONBOARDING_INVITE_EXPIRY_DAYS = 14;

export type OnboardingChecklistState = {
  accountCreated: boolean;
  pinChosen: boolean;
  permissionsAssigned: boolean;
  trainingPending: boolean;
};

export type OnboardingStaffRow = {
  id: string;
  fullName: string;
  email: string | null;
  roleCode: string | null;
  clinicId: string | null;
  clinicName: string | null;
  employmentType: string | null;
  employmentStatus: string;
  fiStaffId: string | null;
  createdAt: string;
  invitation: {
    id: string;
    status: OnboardingInvitationStatus;
    invitedAt: string;
    expiresAt: string;
    acceptedAt: string | null;
  } | null;
  checklist: OnboardingChecklistState;
};

export type OnboardingClinicOption = {
  id: string;
  name: string;
};

export type OnboardingPageModel = {
  staff: OnboardingStaffRow[];
  clinics: OnboardingClinicOption[];
  roleOptions: { value: string; label: string }[];
};

export type CreateOnboardingStaffInput = {
  fullName: string;
  email: string;
  roleCode: string;
  clinicId: string | null;
  employmentType: OnboardingEmploymentType;
};

export type OnboardingInvitePageModel = {
  tenantId: string;
  staffMemberId: string;
  staffName: string;
  email: string;
  roleCode: string | null;
  invitationStatus: OnboardingInvitationStatus;
  pinSetupToken: string | null;
  expiresAt: string;
};
