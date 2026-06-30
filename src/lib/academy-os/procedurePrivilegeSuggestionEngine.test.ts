import assert from "node:assert/strict";
import { test } from "node:test";

import type { FiStaffCompetencyProjectionRow } from "@/src/lib/academy-os/academyCompetencyTypes";
import {
  filterNovelPrivilegeSuggestions,
  suggestProcedurePrivilegesFromProjection,
} from "@/src/lib/academy-os/procedurePrivilegeSuggestionEngine";
import type { FiStaffProcedurePrivilegeRow } from "@/src/lib/academy-os/procedurePrivilegeTypes";

function projection(
  overrides: Partial<FiStaffCompetencyProjectionRow>
): FiStaffCompetencyProjectionRow {
  return {
    id: overrides.id ?? "proj-1",
    tenantId: overrides.tenantId ?? "tenant-1",
    staffId: overrides.staffId ?? "staff-1",
    sourceSystem: overrides.sourceSystem ?? "iiohr_academy",
    globalProfessionalId: overrides.globalProfessionalId ?? null,
    iiohrUserId: overrides.iiohrUserId ?? null,
    academyProfileId: overrides.academyProfileId ?? null,
    competencyKey: overrides.competencyKey ?? "fue_extraction_level_1",
    competencyStatus: overrides.competencyStatus ?? "active",
    readinessBand: overrides.readinessBand ?? "supervised",
    certificationLevel: overrides.certificationLevel ?? null,
    evidenceCount: overrides.evidenceCount ?? 1,
    latestCertificate: overrides.latestCertificate ?? null,
    sourceExportEventId: overrides.sourceExportEventId ?? null,
    metadata: overrides.metadata ?? {},
    expiresAt: overrides.expiresAt ?? null,
    lastVerifiedAt: overrides.lastVerifiedAt ?? "2026-06-01T00:00:00.000Z",
    createdAt: overrides.createdAt ?? "2026-06-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-06-01T00:00:00.000Z",
  };
}

test("suggestProcedurePrivilegesFromProjection maps fue_extraction_level_1", () => {
  const result = suggestProcedurePrivilegesFromProjection(
    projection({ competencyKey: "fue_extraction_level_1" })
  );

  assert.equal(result.suggestedPrivileges.length, 1);
  assert.equal(result.suggestedPrivileges[0]?.procedureKey, "fue_extraction");
  assert.equal(result.suggestedPrivileges[0]?.privilegeLevel, "perform_supervised");
});

test("suggestProcedurePrivilegesFromProjection maps theatre assistant to multiple procedures", () => {
  const result = suggestProcedurePrivilegesFromProjection(
    projection({ competencyKey: "theatre_assistant_level_2" })
  );

  assert.equal(result.suggestedPrivileges.length, 2);
  assert.deepEqual(result.suggestedPrivileges.map((s) => s.procedureKey).sort(), [
    "graft_sorting",
    "theatre_setup",
  ]);
});

test("suggestProcedurePrivilegesFromProjection skips expired competency", () => {
  const result = suggestProcedurePrivilegesFromProjection(
    projection({ competencyKey: "hair_consultation_certified", competencyStatus: "expired" })
  );

  assert.equal(result.suggestedPrivileges.length, 0);
});

test("filterNovelPrivilegeSuggestions removes already granted privileges", () => {
  const suggestions = [
    suggestProcedurePrivilegesFromProjection(
      projection({ competencyKey: "fue_extraction_level_1" })
    ),
  ];
  const existing: FiStaffProcedurePrivilegeRow[] = [
    {
      id: "p1",
      tenantId: "tenant-1",
      clinicId: null,
      staffId: "staff-1",
      procedureKey: "fue_extraction",
      privilegeLevel: "perform_supervised",
      privilegeStatus: "active",
      sourceSystem: "fi_os",
      sourceCompetencyKey: null,
      sourceProjectionId: null,
      grantedBy: null,
      grantedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: null,
      reviewedAt: null,
      reviewDueAt: null,
      restrictionReason: null,
      notes: null,
      metadata: {},
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  const filtered = filterNovelPrivilegeSuggestions({ suggestions, existingPrivileges: existing });
  assert.equal(filtered[0]?.suggestedPrivileges.length, 0);
});
