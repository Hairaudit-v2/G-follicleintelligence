import { createHash } from "node:crypto";

export const HUBSPOT_CONTACT_REFRESH_MILESTONE = "FI-HUBSPOT-IMPORT-1E-R";

export type ContactRefreshSource = {
  id: string;
  createdAt: string | null;
  updatedAt: string | null;
  archived?: boolean;
  properties?: Record<string, string | null | undefined>;
};

export function normalizeContactRefreshIds(ids: string[]): string[] {
  const normalized = ids.map((id) => id.trim()).filter(Boolean).sort();
  if (new Set(normalized).size !== normalized.length) {
    throw new Error("CONTACT_REFRESH_GUARD: duplicate source contact ID");
  }
  return normalized;
}

export function assertContactRefreshFixedCutoff(input: {
  cutoffTo: string;
  contacts: ContactRefreshSource[];
}): void {
  const cutoffMs = Date.parse(input.cutoffTo);
  if (!Number.isFinite(cutoffMs)) {
    throw new Error("CONTACT_REFRESH_GUARD: cutoff-to must be an explicit UTC timestamp");
  }
  for (const contact of input.contacts) {
    const updatedMs = contact.updatedAt ? Date.parse(contact.updatedAt) : Number.NaN;
    const createdMs = contact.createdAt ? Date.parse(contact.createdAt) : Number.NaN;
    const sourceMs = Number.isFinite(updatedMs) ? updatedMs : createdMs;
    if (!Number.isFinite(sourceMs)) {
      throw new Error(`CONTACT_REFRESH_GUARD: contact ${contact.id} has no valid source timestamp`);
    }
    if (sourceMs >= cutoffMs) {
      throw new Error(
        `CONTACT_REFRESH_GUARD: contact ${contact.id} is at or beyond fixed cutoff ${input.cutoffTo}`
      );
    }
  }
}

export function computeContactRefreshChecksum(input: {
  tenantId: string;
  integrationId: string;
  portalId: string;
  cutoffTo: string;
  contacts: ContactRefreshSource[];
}): string {
  const canonical = [
    input.tenantId,
    input.integrationId,
    input.portalId,
    new Date(input.cutoffTo).toISOString(),
    ...[...input.contacts]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((contact) =>
        [
          contact.id,
          contact.createdAt ?? "",
          contact.updatedAt ?? "",
          contact.archived ? "1" : "0",
          JSON.stringify(contact.properties ?? {}),
        ].join("|")
      ),
  ].join("\n");
  return createHash("sha256").update(canonical).digest("hex");
}

export function assertPortalOwnership(input: {
  configuredPortalId: string;
  livePortalId: string;
}): void {
  if (!input.configuredPortalId || input.configuredPortalId !== input.livePortalId) {
    throw new Error("CONTACT_REFRESH_GUARD: HubSpot portal does not match tenant integration");
  }
}

export function assertRefreshMutationIsolation(input: {
  leadsBefore: number;
  leadsAfter: number;
  patientsBefore: number;
  patientsAfter: number;
  staffBefore: number;
  staffAfter: number;
  usersBefore: number;
  usersAfter: number;
  mappingsBefore: number;
  mappingsAfter: number;
  notesWatermarkBefore: string | null;
  notesWatermarkAfter: string | null;
  contactWatermarkBefore: string | null;
  contactWatermarkAfter: string | null;
}): void {
  if (input.leadsBefore !== input.leadsAfter) throw new Error("LEAD_GUARD: FI lead count changed");
  if (input.patientsBefore !== input.patientsAfter) {
    throw new Error("PATIENT_GUARD: FI patient count changed");
  }
  if (input.staffBefore !== input.staffAfter) throw new Error("STAFF_GUARD: FI staff count changed");
  if (input.usersBefore !== input.usersAfter) throw new Error("USER_GUARD: FI user count changed");
  if (input.mappingsBefore !== input.mappingsAfter) {
    throw new Error("MAPPING_GUARD: contact-to-lead mappings changed");
  }
  if (input.notesWatermarkBefore !== input.notesWatermarkAfter) {
    throw new Error("WATERMARK_GUARD: notes watermark changed");
  }
  if (input.contactWatermarkBefore !== input.contactWatermarkAfter) {
    throw new Error("WATERMARK_GUARD: contact watermark changed");
  }
}
