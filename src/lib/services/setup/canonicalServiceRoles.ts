/**
 * Canonical FiOS service-role identifiers for Services Setup eligibility.
 * Distinct from platform OS roles (`fi_os_identities.os_role`) and staff-access keys —
 * these are scheduling/delivery roles stored on `fi_service_staff_eligibility.staff_role`.
 */

export const CANONICAL_SERVICE_ROLES = [
  "doctor",
  "surgeon",
  "consultant",
  "trichologist",
  "nurse",
  "technician",
  "clinical_assistant",
  "coordinator",
  "reception",
  "admin",
] as const;

export type CanonicalServiceRoleId = (typeof CANONICAL_SERVICE_ROLES)[number];

export type CanonicalServiceRoleDefinition = {
  id: CanonicalServiceRoleId;
  label: string;
  description: string;
  clinical: boolean;
};

export const CANONICAL_SERVICE_ROLE_DEFINITIONS: Record<
  CanonicalServiceRoleId,
  CanonicalServiceRoleDefinition
> = {
  doctor: {
    id: "doctor",
    label: "Doctor",
    description: "Medical doctor / physician.",
    clinical: true,
  },
  surgeon: {
    id: "surgeon",
    label: "Surgeon",
    description: "Hair transplant / surgical lead.",
    clinical: true,
  },
  consultant: {
    id: "consultant",
    label: "Consultant",
    description: "Patient consultant / advisor.",
    clinical: true,
  },
  trichologist: {
    id: "trichologist",
    label: "Trichologist",
    description: "Trichology / diagnostic clinician.",
    clinical: true,
  },
  nurse: {
    id: "nurse",
    label: "Nurse",
    description: "Clinical nursing staff.",
    clinical: true,
  },
  technician: {
    id: "technician",
    label: "Technician",
    description: "Surgical / regenerative technician.",
    clinical: true,
  },
  clinical_assistant: {
    id: "clinical_assistant",
    label: "Clinical assistant",
    description: "Clinical support assistant.",
    clinical: true,
  },
  coordinator: {
    id: "coordinator",
    label: "Coordinator",
    description: "Care / surgery coordinator.",
    clinical: false,
  },
  reception: {
    id: "reception",
    label: "Reception",
    description: "Front-of-house / reception.",
    clinical: false,
  },
  admin: {
    id: "admin",
    label: "Admin",
    description: "Administrative staff.",
    clinical: false,
  },
};

/** Legacy free-text aliases → canonical role (lowercased keys). */
export const LEGACY_SERVICE_ROLE_ALIASES: Record<string, CanonicalServiceRoleId> = {
  doctor: "doctor",
  physicians: "doctor",
  physician: "doctor",
  gp: "doctor",
  dermatologist: "doctor",
  "medical doctor": "doctor",
  md: "doctor",
  surgeon: "surgeon",
  "hair surgeon": "surgeon",
  consultants: "consultant",
  consultant: "consultant",
  advisor: "consultant",
  trichologist: "trichologist",
  trichology: "trichologist",
  nurse: "nurse",
  nurses: "nurse",
  rn: "nurse",
  technician: "technician",
  tech: "technician",
  technicians: "technician",
  assistant: "clinical_assistant",
  assistants: "clinical_assistant",
  "clinical assistant": "clinical_assistant",
  "clinical_assistant": "clinical_assistant",
  coordinator: "coordinator",
  coordinators: "coordinator",
  reception: "reception",
  receptionist: "reception",
  front_desk: "reception",
  "front desk": "reception",
  admin: "admin",
  administrative: "admin",
  administration: "admin",
};

export function normalizeServiceRoleToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isCanonicalServiceRole(value: string | null | undefined): value is CanonicalServiceRoleId {
  const n = normalizeServiceRoleToken(String(value ?? ""));
  return (CANONICAL_SERVICE_ROLES as readonly string[]).includes(n);
}

export function resolveCanonicalServiceRole(
  value: string | null | undefined
): CanonicalServiceRoleId | null {
  const n = normalizeServiceRoleToken(String(value ?? ""));
  if (!n) return null;
  if (isCanonicalServiceRole(n)) return n;
  return LEGACY_SERVICE_ROLE_ALIASES[n] ?? null;
}
