import assert from "node:assert/strict";
import { test } from "node:test";

import { buildAcademyCompetencySignalsFromProjections } from "./academyWorkforceSignalAdapter";
import type { FiStaffCompetencyProjectionRow } from "./academyCompetencyTypes";

const NOW = new Date("2026-06-09T12:00:00.000Z");

function projection(
  overrides: Partial<FiStaffCompetencyProjectionRow> & Pick<FiStaffCompetencyProjectionRow, "competencyKey" | "competencyStatus">
): FiStaffCompetencyProjectionRow {
  return {
    id: "proj-1",
    tenantId: "11111111-1111-4111-8111-111111111111",
    staffId: "22222222-2222-4222-8222-222222222222",
    sourceSystem: "iiohr_academy",
    globalProfessionalId: null,
    iiohrUserId: null,
    academyProfileId: null,
    readinessBand: null,
    certificationLevel: null,
    evidenceCount: 0,
    latestCertificate: null,
    sourceExportEventId: null,
    metadata: {},
    expiresAt: null,
    lastVerifiedAt: "2026-06-01T10:00:00.000Z",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

test("empty projections return hasProjection false", () => {
  const signals = buildAcademyCompetencySignalsFromProjections([], NOW);
  assert.equal(signals.hasProjection, false);
  assert.equal(signals.competencyRisk, "medium");
});

test("detects expired and restricted competencies", () => {
  const signals = buildAcademyCompetencySignalsFromProjections(
    [
      projection({ id: "1", competencyKey: "a", competencyStatus: "expired" }),
      projection({ id: "2", competencyKey: "b", competencyStatus: "restricted" }),
    ],
    NOW
  );
  assert.equal(signals.expiredCompetencies, 1);
  assert.equal(signals.restrictedCompetencies, 1);
  assert.equal(signals.competencyRisk, "critical");
});

test("detects expiring certifications soon", () => {
  const signals = buildAcademyCompetencySignalsFromProjections(
    [
      projection({
        id: "1",
        competencyKey: "cert",
        competencyStatus: "expiring",
        certificationLevel: "level_2",
      }),
    ],
    NOW
  );
  assert.equal(signals.certificationsExpiringSoon, 1);
  assert.equal(signals.competencyRisk, "high");
});

test("resolves highest readiness band", () => {
  const signals = buildAcademyCompetencySignalsFromProjections(
    [
      projection({ id: "1", competencyKey: "a", competencyStatus: "active", readinessBand: "developing" }),
      projection({ id: "2", competencyKey: "b", competencyStatus: "active", readinessBand: "advanced" }),
    ],
    NOW
  );
  assert.equal(signals.highestReadinessBand, "advanced");
  assert.equal(signals.activeCompetencies, 2);
  assert.equal(signals.competencyRisk, "low");
});
