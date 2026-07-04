/**
 * FI-OUTCOME-INTELLIGENCE-HAIRAUDIT-LINK-1 — additive SurgeryOS / ImagingOS → HairAudit linkage.
 * Legacy identifiers are checked first; structured fields never overwrite legacy metadata.
 */

export const HAIR_AUDIT_LINK_METADATA_KEY = "hair_audit_link" as const;

export const HAIRAUDIT_LINK_ORIGINS = ["legacy", "structured", "resolved_match"] as const;
export type HairAuditLinkOrigin = (typeof HAIRAUDIT_LINK_ORIGINS)[number];

export type ParsedLegacyHairAuditLink = {
  hairaudit_case_id: string | null;
  audit_report_id: string | null;
  fi_report_id: string | null;
  patient_review_pathway: string | null;
  source_system: string | null;
  source_case_id: string | null;
  source_patient_id: string | null;
  linked_image_ids: string[];
  legacy_metadata_keys_found: string[];
};

export type StructuredHairAuditLink = {
  hairaudit_case_id?: string;
  audit_report_id?: string;
  fi_report_id?: string;
  patient_review_pathway?: string;
  source_system?: string;
  linked_image_ids?: string[];
  link_origin: HairAuditLinkOrigin;
  linkage_conflict?: boolean;
  linkage_conflict_detail?: string;
  linked_at?: string;
  surgery_id?: string;
};

export type HairAuditAuditReadiness = {
  linked: boolean;
  has_report: boolean;
  has_pathway: boolean;
  ready_for_audit: boolean;
  needs_operator_review: boolean;
};

export type HairAuditLinkHrefs = {
  hairaudit_admin_href: string | null;
  audit_report_href: string | null;
};

export type HairAuditLinkResolution = {
  hairaudit_case_id: string | null;
  audit_report_id: string | null;
  fi_report_id: string | null;
  patient_review_pathway: string | null;
  source_system: string | null;
  linked_image_ids: string[];
  link_origin: HairAuditLinkOrigin | null;
  linkage_conflict: boolean;
  linkage_conflict_detail: string | null;
  audit_readiness: HairAuditAuditReadiness;
  hrefs: HairAuditLinkHrefs;
};

export type ResolveHairAuditLinkForSurgeryInput = {
  tenantId: string;
  surgeryId: string;
  caseId?: string | null;
  patientId?: string | null;
  caseMetadata?: Record<string, unknown> | null;
  surgeryMetadata?: Record<string, unknown> | null;
  imageMetadataSamples?: readonly Record<string, unknown>[];
  globalCaseSourceIds?: readonly { source_system: string; source_case_id: string }[];
  fiReportId?: string | null;
};

function readString(meta: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function collectLinkedImageIds(meta: Record<string, unknown>): string[] {
  const ids: string[] = [];
  const raw = meta.linked_image_ids;
  if (Array.isArray(raw)) {
    for (const id of raw) {
      if (typeof id === "string" && id.trim() && !ids.includes(id.trim())) ids.push(id.trim());
    }
  }
  for (const key of ["image_id", "fi_patient_image_id"]) {
    const value = readString(meta, key);
    if (value && !ids.includes(value)) ids.push(value);
  }
  return ids;
}

function trackFoundKeys(meta: Record<string, unknown>, keys: readonly string[]): string[] {
  return keys.filter((key) => {
    const value = meta[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

/** Parse links created before structured `hair_audit_link` existed. */
export function parseLegacyHairAuditLinkMetadata(
  metadata: Record<string, unknown>
): ParsedLegacyHairAuditLink {
  const legacyKeys = [
    "hairaudit_case_id",
    "hair_audit_case_id",
    "hairaudit_source_case_id",
    "audit_report_id",
    "hairaudit_report_id",
    "report_id",
    "fi_report_id",
    "patient_review_pathway",
    "source_system",
    "source_case_id",
    "source_patient_id",
  ] as const;

  const hairauditCaseId =
    readString(
      metadata,
      "hairaudit_case_id",
      "hair_audit_case_id",
      "hairaudit_source_case_id"
    ) ??
    (readString(metadata, "source_system") === "hairaudit"
      ? readString(metadata, "source_case_id")
      : null);

  return {
    hairaudit_case_id: hairauditCaseId,
    audit_report_id: readString(metadata, "audit_report_id", "hairaudit_report_id"),
    fi_report_id: readString(metadata, "report_id", "fi_report_id"),
    patient_review_pathway: readString(metadata, "patient_review_pathway"),
    source_system: readString(metadata, "source_system", "upload_source", "capture_source"),
    source_case_id: readString(metadata, "source_case_id"),
    source_patient_id: readString(metadata, "source_patient_id"),
    linked_image_ids: collectLinkedImageIds(metadata),
    legacy_metadata_keys_found: trackFoundKeys(metadata, legacyKeys),
  };
}

export function parseStructuredHairAuditLink(
  metadata: Record<string, unknown>
): StructuredHairAuditLink | null {
  const raw = metadata[HAIR_AUDIT_LINK_METADATA_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const block = raw as Record<string, unknown>;
  const origin = readString(block, "link_origin");
  if (
    origin !== "legacy" &&
    origin !== "structured" &&
    origin !== "resolved_match"
  ) {
    return null;
  }
  const linkedImageIds = collectLinkedImageIds(block);
  return {
    ...(readString(block, "hairaudit_case_id")
      ? { hairaudit_case_id: readString(block, "hairaudit_case_id")! }
      : {}),
    ...(readString(block, "audit_report_id")
      ? { audit_report_id: readString(block, "audit_report_id")! }
      : {}),
    ...(readString(block, "fi_report_id")
      ? { fi_report_id: readString(block, "fi_report_id")! }
      : {}),
    ...(readString(block, "patient_review_pathway")
      ? { patient_review_pathway: readString(block, "patient_review_pathway")! }
      : {}),
    ...(readString(block, "source_system")
      ? { source_system: readString(block, "source_system")! }
      : {}),
    ...(linkedImageIds.length > 0 ? { linked_image_ids: linkedImageIds } : {}),
    link_origin: origin,
    ...(block.linkage_conflict === true ? { linkage_conflict: true } : {}),
    ...(readString(block, "linkage_conflict_detail")
      ? { linkage_conflict_detail: readString(block, "linkage_conflict_detail")! }
      : {}),
    ...(readString(block, "linked_at") ? { linked_at: readString(block, "linked_at")! } : {}),
    ...(readString(block, "surgery_id") ? { surgery_id: readString(block, "surgery_id")! } : {}),
  };
}

function mergeLegacySnapshots(
  ...snapshots: readonly ParsedLegacyHairAuditLink[]
): ParsedLegacyHairAuditLink {
  const merged: ParsedLegacyHairAuditLink = {
    hairaudit_case_id: null,
    audit_report_id: null,
    fi_report_id: null,
    patient_review_pathway: null,
    source_system: null,
    source_case_id: null,
    source_patient_id: null,
    linked_image_ids: [],
    legacy_metadata_keys_found: [],
  };

  for (const snapshot of snapshots) {
    merged.hairaudit_case_id ??= snapshot.hairaudit_case_id;
    merged.audit_report_id ??= snapshot.audit_report_id;
    merged.fi_report_id ??= snapshot.fi_report_id;
    merged.patient_review_pathway ??= snapshot.patient_review_pathway;
    merged.source_system ??= snapshot.source_system;
    merged.source_case_id ??= snapshot.source_case_id;
    merged.source_patient_id ??= snapshot.source_patient_id;
    for (const id of snapshot.linked_image_ids) {
      if (!merged.linked_image_ids.includes(id)) merged.linked_image_ids.push(id);
    }
    for (const key of snapshot.legacy_metadata_keys_found) {
      if (!merged.legacy_metadata_keys_found.includes(key)) {
        merged.legacy_metadata_keys_found.push(key);
      }
    }
  }

  return merged;
}

export function detectHairAuditLinkageConflict(input: {
  legacy: ParsedLegacyHairAuditLink;
  structured: StructuredHairAuditLink | null;
  resolvedCaseId: string | null;
}): { conflict: boolean; detail: string | null } {
  if (input.structured?.linkage_conflict) {
    return {
      conflict: true,
      detail:
        input.structured.linkage_conflict_detail ??
        "Structured linkage marked linkage_conflict.",
    };
  }

  const legacyCase = input.legacy.hairaudit_case_id;
  const structuredCase = input.structured?.hairaudit_case_id ?? null;
  if (legacyCase && structuredCase && legacyCase !== structuredCase) {
    return {
      conflict: true,
      detail: `Legacy HairAudit case ${legacyCase} disagrees with structured case ${structuredCase}.`,
    };
  }

  if (legacyCase && input.resolvedCaseId && legacyCase !== input.resolvedCaseId) {
    return {
      conflict: true,
      detail: `Legacy HairAudit case ${legacyCase} disagrees with resolved match ${input.resolvedCaseId}.`,
    };
  }

  const legacyReport = input.legacy.audit_report_id ?? input.legacy.fi_report_id;
  const structuredReport =
    input.structured?.audit_report_id ?? input.structured?.fi_report_id ?? null;
  if (legacyReport && structuredReport && legacyReport !== structuredReport) {
    return {
      conflict: true,
      detail: `Legacy report ${legacyReport} disagrees with structured report ${structuredReport}.`,
    };
  }

  return { conflict: false, detail: null };
}

export function buildHairAuditAdminHref(): string {
  return "/hair-audit/admin";
}

export function buildFiAuditReportHref(tenantId: string, reportId: string): string {
  return `/fi-admin/${tenantId.trim()}/audit/${reportId.trim()}`;
}

export function deriveHairAuditAuditReadiness(
  resolution: Pick<
    HairAuditLinkResolution,
    | "hairaudit_case_id"
    | "audit_report_id"
    | "fi_report_id"
    | "patient_review_pathway"
    | "linkage_conflict"
  >
): HairAuditAuditReadiness {
  const linked = Boolean(resolution.hairaudit_case_id);
  const hasReport = Boolean(resolution.audit_report_id || resolution.fi_report_id);
  const hasPathway = Boolean(resolution.patient_review_pathway);
  return {
    linked,
    has_report: hasReport,
    has_pathway: hasPathway,
    ready_for_audit: linked && hasReport && !resolution.linkage_conflict,
    needs_operator_review: resolution.linkage_conflict,
  };
}

/**
 * Compatibility resolver — legacy locations first, then structured block, then safe source match.
 */
export function resolveHairAuditLinkForSurgery(
  input: ResolveHairAuditLinkForSurgeryInput
): HairAuditLinkResolution {
  const legacySources: ParsedLegacyHairAuditLink[] = [];
  if (input.caseMetadata) legacySources.push(parseLegacyHairAuditLinkMetadata(input.caseMetadata));
  if (input.surgeryMetadata) {
    legacySources.push(parseLegacyHairAuditLinkMetadata(input.surgeryMetadata));
  }
  for (const sample of input.imageMetadataSamples ?? []) {
    legacySources.push(parseLegacyHairAuditLinkMetadata(sample));
  }
  const legacy = mergeLegacySnapshots(...legacySources);

  const structured = input.caseMetadata
    ? parseStructuredHairAuditLink(input.caseMetadata)
    : null;

  let resolvedCaseId: string | null = null;
  let resolvedOrigin: HairAuditLinkOrigin | null = null;

  if (legacy.hairaudit_case_id) {
    resolvedCaseId = legacy.hairaudit_case_id;
    resolvedOrigin = "legacy";
  } else if (structured?.hairaudit_case_id) {
    resolvedCaseId = structured.hairaudit_case_id;
    resolvedOrigin = "structured";
  } else {
    const hairauditBridge = (input.globalCaseSourceIds ?? []).find(
      (row) => row.source_system.trim() === "hairaudit" && row.source_case_id.trim()
    );
    if (hairauditBridge) {
      resolvedCaseId = hairauditBridge.source_case_id.trim();
      resolvedOrigin = "resolved_match";
    }
  }

  const conflict = detectHairAuditLinkageConflict({
    legacy,
    structured,
    resolvedCaseId: resolvedOrigin === "resolved_match" ? resolvedCaseId : null,
  });

  const preferLegacyOnConflict = conflict.conflict;

  const hairauditCaseId = preferLegacyOnConflict
    ? legacy.hairaudit_case_id ?? resolvedCaseId
    : resolvedCaseId ?? legacy.hairaudit_case_id ?? structured?.hairaudit_case_id ?? null;

  const auditReportId = preferLegacyOnConflict
    ? legacy.audit_report_id ?? structured?.audit_report_id ?? null
    : structured?.audit_report_id ?? legacy.audit_report_id ?? null;

  let fiReportId = preferLegacyOnConflict
    ? legacy.fi_report_id ?? structured?.fi_report_id ?? input.fiReportId ?? null
    : structured?.fi_report_id ?? legacy.fi_report_id ?? input.fiReportId ?? null;

  if (!fiReportId && input.fiReportId && !conflict.conflict) {
    fiReportId = input.fiReportId;
    resolvedOrigin ??= "resolved_match";
  }

  const patientReviewPathway =
    legacy.patient_review_pathway ?? structured?.patient_review_pathway ?? null;

  const linkedImageIds = [
    ...legacy.linked_image_ids,
    ...(structured?.linked_image_ids ?? []),
  ].filter((id, index, all) => all.indexOf(id) === index);

  const sourceSystem =
    legacy.source_system ?? structured?.source_system ?? (hairauditCaseId ? "hairaudit" : null);

  const linkOrigin = structured?.link_origin ?? resolvedOrigin;

  const hrefs: HairAuditLinkHrefs = {
    hairaudit_admin_href: hairauditCaseId ? buildHairAuditAdminHref() : null,
    audit_report_href:
      fiReportId && input.tenantId.trim()
        ? buildFiAuditReportHref(input.tenantId, fiReportId)
        : null,
  };

  const resolution: HairAuditLinkResolution = {
    hairaudit_case_id: hairauditCaseId,
    audit_report_id: auditReportId,
    fi_report_id: fiReportId,
    patient_review_pathway: patientReviewPathway,
    source_system: sourceSystem,
    linked_image_ids: linkedImageIds,
    link_origin: linkOrigin,
    linkage_conflict: conflict.conflict,
    linkage_conflict_detail: conflict.detail,
    hrefs,
    audit_readiness: deriveHairAuditAuditReadiness({
      hairaudit_case_id: hairauditCaseId,
      audit_report_id: auditReportId,
      fi_report_id: fiReportId,
      patient_review_pathway: patientReviewPathway,
      linkage_conflict: conflict.conflict,
    }),
  };

  resolution.audit_readiness = deriveHairAuditAuditReadiness(resolution);
  return resolution;
}

/** Additive metadata merge — never removes or overwrites legacy keys. */
export function mergeAdditiveCaseHairAuditMetadata(
  existingMetadata: Record<string, unknown>,
  structuredLink: StructuredHairAuditLink
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...existingMetadata };
  const current = merged[HAIR_AUDIT_LINK_METADATA_KEY];
  const currentBlock =
    current && typeof current === "object" && !Array.isArray(current)
      ? ({ ...(current as Record<string, unknown>) } as Record<string, unknown>)
      : {};

  for (const [key, value] of Object.entries(structuredLink)) {
    if (value === undefined) continue;
    if (!(key in currentBlock)) {
      currentBlock[key] = value;
    }
  }

  merged[HAIR_AUDIT_LINK_METADATA_KEY] = currentBlock;
  return merged;
}

export function buildStructuredHairAuditLinkFromLegacy(input: {
  legacy: ParsedLegacyHairAuditLink;
  surgeryId: string;
  linkedAt?: string;
}): StructuredHairAuditLink | null {
  if (
    !input.legacy.hairaudit_case_id &&
    !input.legacy.audit_report_id &&
    !input.legacy.fi_report_id &&
    !input.legacy.patient_review_pathway
  ) {
    return null;
  }

  return {
    ...(input.legacy.hairaudit_case_id
      ? { hairaudit_case_id: input.legacy.hairaudit_case_id }
      : {}),
    ...(input.legacy.audit_report_id
      ? { audit_report_id: input.legacy.audit_report_id }
      : {}),
    ...(input.legacy.fi_report_id ? { fi_report_id: input.legacy.fi_report_id } : {}),
    ...(input.legacy.patient_review_pathway
      ? { patient_review_pathway: input.legacy.patient_review_pathway }
      : {}),
    ...(input.legacy.source_system ? { source_system: input.legacy.source_system } : {}),
    ...(input.legacy.linked_image_ids.length > 0
      ? { linked_image_ids: [...input.legacy.linked_image_ids] }
      : {}),
    link_origin: "legacy",
    surgery_id: input.surgeryId.trim(),
    linked_at: input.linkedAt ?? new Date().toISOString(),
  };
}

export function buildStructuredHairAuditLinkFromResolution(input: {
  resolution: HairAuditLinkResolution;
  surgeryId: string;
  linkedAt?: string;
}): StructuredHairAuditLink | null {
  if (!input.resolution.hairaudit_case_id && !input.resolution.fi_report_id) return null;
  return {
    ...(input.resolution.hairaudit_case_id
      ? { hairaudit_case_id: input.resolution.hairaudit_case_id }
      : {}),
    ...(input.resolution.audit_report_id
      ? { audit_report_id: input.resolution.audit_report_id }
      : {}),
    ...(input.resolution.fi_report_id
      ? { fi_report_id: input.resolution.fi_report_id }
      : {}),
    ...(input.resolution.patient_review_pathway
      ? { patient_review_pathway: input.resolution.patient_review_pathway }
      : {}),
    ...(input.resolution.source_system
      ? { source_system: input.resolution.source_system }
      : {}),
    ...(input.resolution.linked_image_ids.length > 0
      ? { linked_image_ids: [...input.resolution.linked_image_ids] }
      : {}),
    link_origin: input.resolution.link_origin ?? "resolved_match",
    ...(input.resolution.linkage_conflict
      ? {
          linkage_conflict: true,
          ...(input.resolution.linkage_conflict_detail
            ? { linkage_conflict_detail: input.resolution.linkage_conflict_detail }
            : {}),
        }
      : {}),
    surgery_id: input.surgeryId.trim(),
    linked_at: input.linkedAt ?? new Date().toISOString(),
  };
}

export function formatHairAuditLinkDashboardLabel(
  resolution: HairAuditLinkResolution
): string {
  if (resolution.linkage_conflict) return "Conflict — review";
  if (resolution.audit_readiness.ready_for_audit) return "Audit ready";
  if (resolution.hairaudit_case_id && !resolution.fi_report_id) return "Linked — no report";
  if (resolution.hairaudit_case_id) return "HairAudit linked";
  return "Not linked";
}