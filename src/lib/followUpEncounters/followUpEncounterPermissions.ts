/**
 * Permission helpers for follow-up encounter workflows (pure; testable without DB).
 */

export type FollowUpEncounterPermissionRole =
  | "fi_admin"
  | "admin"
  | "owner"
  | "clinician"
  | "doctor"
  | "nurse"
  | "surgical_assistant"
  | "reception"
  | "unknown";

export function normalizeFollowUpRole(raw: string | null | undefined): FollowUpEncounterPermissionRole {
  const r = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (r === "fi_admin" || r === "admin" || r === "owner") return r === "owner" ? "owner" : r === "fi_admin" ? "fi_admin" : "admin";
  if (r === "doctor" || r === "clinician") return r === "doctor" ? "doctor" : "clinician";
  if (r === "nurse" || r === "rn") return "nurse";
  if (r === "surgical_assistant" || r === "surgical_assist") return "surgical_assistant";
  if (r === "reception" || r === "receptionist" || r === "front_desk") return "reception";
  return "unknown";
}

/** Roles allowed to create follow-up encounters and upload photos. */
const FOLLOW_UP_CREATE_ROLES = new Set<FollowUpEncounterPermissionRole>([
  "fi_admin",
  "admin",
  "owner",
  "clinician",
  "doctor",
  "nurse",
  "surgical_assistant",
  "reception",
]);

/** Reception may create photos-only or follow-up shell encounters. */
const RECEPTION_ALLOWED_ENCOUNTER_TYPES = new Set(["photos_only", "follow_up", "legacy_follow_up"]);

export function canCreateFollowUpEncounter(
  role: FollowUpEncounterPermissionRole,
  encounterType: string
): boolean {
  if (!FOLLOW_UP_CREATE_ROLES.has(role)) return false;
  if (role === "reception") {
    return RECEPTION_ALLOWED_ENCOUNTER_TYPES.has(encounterType);
  }
  return true;
}

/** Clinical notes and AI interpretation require clinical PHI access. */
const CLINICAL_PHI_ROLES = new Set<FollowUpEncounterPermissionRole>([
  "fi_admin",
  "admin",
  "owner",
  "clinician",
  "doctor",
  "nurse",
  "surgical_assistant",
]);

export function canReadFollowUpClinicalPhi(role: FollowUpEncounterPermissionRole): boolean {
  return CLINICAL_PHI_ROLES.has(role);
}

export function canApproveAiImagingSummary(role: FollowUpEncounterPermissionRole): boolean {
  return CLINICAL_PHI_ROLES.has(role) && role !== "reception";
}
