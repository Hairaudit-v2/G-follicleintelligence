/**
 * FI-HAIRAUDIT-LINK-COMPATIBILITY-AUDIT-1 — inventory of HairAudit link creation/read paths
 * and metadata keys. Pure documentation + legacy resolution snapshots (no runtime mutations).
 */

/** Where HairAudit links are CREATED (writes / ingest / navigation builders). */
export const HAIRAUDIT_LINK_CREATION_PATHS = [
  "app/api/fi/events/route.ts — POST ingest dispatches hairaudit.* handlers",
  "lib/fi/events/handlers/hairauditCaseSubmitted.ts — case submitted ingest",
  "lib/fi/events/handlers/hairauditImagesUploaded.ts — image upload ingest + dual-write",
  "lib/fi/events/mapping.ts — resolveOrCreateGlobalCase, ensureFiCase, linkEventToEntities",
  "src/lib/fi/foundation/dualWriteEvent.ts — foundation dual-write on ingest",
  "src/lib/fi/foundation/hairauditPatientImageDualWriteCore.ts — image metadata builder",
  "src/lib/fi/foundation/hairauditPatientImageDualWrite.server.ts — fi_patient_images insert",
  "src/lib/imaging-os/adapters/hairauditImageAdapter.ts — ingestion request builder",
  "src/lib/hairaudit/fiOsHairAuditImageClassifyService.ts — classifier request mapping",
  "src/lib/imaging-os/imagingDeepLinksCore.ts — staff hairAuditCase deep link",
  "src/lib/patientTwin/patientTwinImagingIntelligenceCore.ts — patient twin deep links",
  "src/lib/hair-intelligence/photoProtocols/protocolDeepLinks.ts — photo protocol placeholder href",
  "src/lib/hair-intelligence/photoProtocols/protocolAlertDelivery.ts — alert deep_links.hairaudit_case",
  "src/lib/fiOs/fiOsRedirect.server.ts — fi_auditor post-login redirect",
  "app/hair-audit/admin/page.tsx — tenant list → /fi-admin/{tenantId}/audit",
] as const;

/** Where HairAudit links are READ / OPENED (loaders, resolvers, routes, UI). */
export const HAIRAUDIT_LINK_READ_PATHS = [
  "app/hair-audit/admin/page.tsx — HairAudit OS admin hub",
  "app/(fi-admin)/fi-admin/[tenantId]/audit/page.tsx — AuditOS dashboard",
  "app/(fi-admin)/fi-admin/[tenantId]/audit/[reportId]/page.tsx — report review",
  "app/api/fi/audit/queue/route.ts — audit queue by fi_reports",
  "app/api/fi/audit/dashboard/route.ts — dashboard snapshot",
  "src/lib/fiAdmin/auditDashboardRead.server.ts — fi_reports report_id + case_id",
  "src/lib/fiAdmin/auditIntelligencePresentation.ts — recent case rows + attention links",
  "src/components/fi-admin/audit/AuditOsDashboard.tsx — /audit/{reportId} case rows",
  "lib/fi/events/mapping.ts — global case/patient resolution by source IDs",
  "src/lib/fi/foundation/caseRecord.ts — universal case record source identifiers",
  "src/lib/imaging-os/patientVisualSummaryReportLoad.server.ts — upload_source hairaudit filter",
  "src/lib/patientTwin/patientTwinImagingGallery.server.ts — gallery deep links",
  "src/lib/imaging-os/imagingClinicalReviewQueue.server.ts — review queue deep links",
] as const;

/** Metadata keys used for HairAudit identity bridging (current production contract). */
export const HAIRAUDIT_METADATA_KEY_INVENTORY = {
  caseId: ["source_case_id", "hairaudit_source_case_id", "hair_audit_case_id", "hairaudit_case_id"],
  reportId: ["report_id", "audit_report_id", "fi_report_id"],
  imageId: ["fi_upload_id", "global_case_id", "fi_event_id"],
  patientId: ["source_patient_id"],
  pathway: ["patient_review_pathway"],
  sourceSystem: ["source_system", "upload_source", "capture_source"],
} as const;

export type LegacyHairAuditLinkSnapshot = {
  hairaudit_case_id: string | null;
  audit_report_id: string | null;
  fi_report_id: string | null;
  patient_review_pathway: string | null;
  source_system: string | null;
  source_case_id: string | null;
  source_patient_id: string | null;
  linked_image_ids: string[];
};

function readString(meta: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/**
 * Pre-linkage legacy parser snapshot — mirrors keys used before structured `hair_audit_link`.
 * Tolerates missing new fields; does not require structured linkage block.
 */
export function parseLegacyHairAuditLinkMetadataSnapshot(
  metadata: Record<string, unknown>
): LegacyHairAuditLinkSnapshot {
  const hairauditCaseId =
    readString(metadata, "hairaudit_case_id", "hair_audit_case_id", "hairaudit_source_case_id") ??
    (readString(metadata, "source_system") === "hairaudit"
      ? readString(metadata, "source_case_id")
      : null);

  const linkedImageIds: string[] = [];
  const rawImageIds = metadata.linked_image_ids;
  if (Array.isArray(rawImageIds)) {
    for (const id of rawImageIds) {
      if (typeof id === "string" && id.trim()) linkedImageIds.push(id.trim());
    }
  }
  const singleImageId = readString(metadata, "image_id", "fi_patient_image_id");
  if (singleImageId && !linkedImageIds.includes(singleImageId)) {
    linkedImageIds.push(singleImageId);
  }

  return {
    hairaudit_case_id: hairauditCaseId,
    audit_report_id: readString(metadata, "audit_report_id", "hairaudit_report_id"),
    fi_report_id: readString(metadata, "report_id", "fi_report_id"),
    patient_review_pathway: readString(metadata, "patient_review_pathway"),
    source_system: readString(metadata, "source_system", "upload_source", "capture_source"),
    source_case_id: readString(metadata, "source_case_id"),
    source_patient_id: readString(metadata, "source_patient_id"),
    linked_image_ids: linkedImageIds,
  };
}

/** FI Admin audit report route — unchanged legacy contract. */
export function buildLegacyFiAuditReportHref(tenantId: string, reportId: string): string {
  return `/fi-admin/${tenantId.trim()}/audit/${reportId.trim()}`;
}

/** HairAudit OS admin hub — unchanged legacy contract. */
export function buildLegacyHairAuditAdminHref(): string {
  return "/hair-audit/admin";
}

/** Whether legacy metadata yields an openable HairAudit admin link. */
export function legacyHairAuditAdminLinkAvailable(snapshot: LegacyHairAuditLinkSnapshot): boolean {
  return Boolean(snapshot.hairaudit_case_id || snapshot.source_case_id);
}

/** Whether legacy metadata yields an openable FI audit report link. */
export function legacyFiAuditReportLinkAvailable(snapshot: LegacyHairAuditLinkSnapshot): boolean {
  return Boolean(snapshot.fi_report_id || snapshot.audit_report_id);
}
