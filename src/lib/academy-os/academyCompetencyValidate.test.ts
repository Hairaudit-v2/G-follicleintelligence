import assert from "node:assert/strict";
import { test } from "node:test";

import { FI_COMPETENCY_EXPORT_PAYLOAD_V1_VERSION } from "@follicle/intelligence-core/contracts";

import { validateCompetencyExportPayload } from "./academyCompetencyValidate";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: FI_COMPETENCY_EXPORT_PAYLOAD_V1_VERSION,
    exportEventId: "22222222-2222-4222-8222-222222222222",
    tenantId: TENANT_ID,
    exportedAt: "2026-06-09T12:00:00.000Z",
    globalProfessionalId: "iiohr:prof:001",
    competencies: [
      {
        competencyKey: "fue_extraction_level_1",
        competencyStatus: "active",
        readinessBand: "supervised",
        certificationLevel: "level_1",
        evidenceCount: 3,
        lastVerifiedAt: "2026-06-01T10:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

test("validateCompetencyExportPayload accepts valid payload", () => {
  const result = validateCompetencyExportPayload(validPayload());
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.payload.competencies.length, 1);
    assert.equal(result.payload.competencies[0]!.competencyKey, "fue_extraction_level_1");
  }
});

test("validateCompetencyExportPayload rejects unsupported schema version", () => {
  const result = validateCompetencyExportPayload(validPayload({ schemaVersion: 99 }));
  assert.equal(result.ok, false);
});

test("validateCompetencyExportPayload rejects empty competencies", () => {
  const result = validateCompetencyExportPayload(validPayload({ competencies: [] }));
  assert.equal(result.ok, false);
});

test("validateCompetencyExportPayload rejects missing identity fields", () => {
  const result = validateCompetencyExportPayload(
    validPayload({
      globalProfessionalId: null,
      academyProfileId: null,
      iiohrUserId: null,
      staffEmail: null,
    })
  );
  assert.equal(result.ok, false);
});

test("validateCompetencyExportPayload accepts snake_case aliases", () => {
  const result = validateCompetencyExportPayload({
    schema_version: FI_COMPETENCY_EXPORT_PAYLOAD_V1_VERSION,
    export_event_id: "evt-1",
    tenant_id: TENANT_ID,
    exported_at: "2026-06-09T12:00:00.000Z",
    academy_profile_id: "academy-profile-1",
    competencies: [
      {
        competency_key: "infection_control_protocol",
        competency_status: "restricted",
        last_verified_at: "2026-06-01T10:00:00.000Z",
      },
    ],
  });
  assert.equal(result.ok, true);
});

test("validateCompetencyExportPayload rejects invalid competency status", () => {
  const result = validateCompetencyExportPayload(
    validPayload({
      competencies: [
        {
          competencyKey: "bad_status",
          competencyStatus: "unknown",
          lastVerifiedAt: "2026-06-01T10:00:00.000Z",
        },
      ],
    })
  );
  assert.equal(result.ok, false);
});
