/**
 * FI-PATIENT-APP-1B — patient-safe /me DTO builders (pure).
 */

import type { PatientGatewayMeClinic, PatientGatewayMeResponse } from "./patientGatewayTypes";

function asTrimmedString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

function readHubspot(meta: Record<string, unknown>): Record<string, unknown> {
  const h = meta.hubspot;
  if (h && typeof h === "object" && !Array.isArray(h)) return h as Record<string, unknown>;
  return {};
}

/** Only expose http(s) logo URLs — never storage paths or signed URLs from this layer. */
export function sanitizePatientGatewayLogoUrl(raw: string | null | undefined): string | null {
  const s = asTrimmedString(raw);
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return null;
}

export function derivePatientGatewayNameFields(input: {
  personMetadata: Record<string, unknown>;
  patientMetadata?: Record<string, unknown> | null;
}): {
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
} {
  const person = input.personMetadata;
  const patient =
    input.patientMetadata &&
    typeof input.patientMetadata === "object" &&
    !Array.isArray(input.patientMetadata)
      ? input.patientMetadata
      : {};

  const hubPerson = readHubspot(person);
  const hubPatient = readHubspot(patient);
  const hub = { ...hubPatient, ...hubPerson };

  const firstName =
    asTrimmedString(hub.first_name) ||
    asTrimmedString(person.first_name) ||
    asTrimmedString(patient.first_name) ||
    null;
  const lastName =
    asTrimmedString(hub.last_name) ||
    asTrimmedString(person.last_name) ||
    asTrimmedString(patient.last_name) ||
    null;

  const preferredName =
    asTrimmedString(person.preferred_name) ||
    asTrimmedString(patient.preferred_name) ||
    asTrimmedString(person.display_name) ||
    asTrimmedString(patient.display_name) ||
    asTrimmedString(hub.preferred_name) ||
    null;

  return { firstName, lastName, preferredName };
}

export function buildPatientGatewayMeResponse(input: {
  patientId: string;
  clinicId: string;
  clinicName: string | null;
  personMetadata: Record<string, unknown>;
  patientMetadata?: Record<string, unknown> | null;
  branding?: {
    logoUrl?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    accentColor?: string | null;
  } | null;
}): PatientGatewayMeResponse {
  const names = derivePatientGatewayNameFields({
    personMetadata: input.personMetadata,
    patientMetadata: input.patientMetadata,
  });

  const clinic: PatientGatewayMeClinic = {
    id: input.clinicId.trim(),
    name: asTrimmedString(input.clinicName),
    branding: {
      logoUrl: sanitizePatientGatewayLogoUrl(input.branding?.logoUrl),
      primaryColor: asTrimmedString(input.branding?.primaryColor),
      secondaryColor: asTrimmedString(input.branding?.secondaryColor),
      accentColor: asTrimmedString(input.branding?.accentColor),
    },
  };

  return {
    ok: true,
    patientId: input.patientId.trim(),
    firstName: names.firstName,
    lastName: names.lastName,
    preferredName: names.preferredName,
    clinic,
  };
}
