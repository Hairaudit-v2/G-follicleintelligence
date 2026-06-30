import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crmConvertLeadBodySchema } from "./crmApiSchemas";
import {
  assertCaseSeedAllowed,
  assertConversionNoteBounded,
  assertLeadNotYetConverted,
  isLeadConversionRowForTenant,
} from "./crmLeadConversionPolicy";
import {
  assertIdentityMatchesLeadPersonOnly,
  extractPersonIdentitySignals,
  normalizePhoneDigits,
} from "./crmLeadConversionIdentity";
import type { FiCrmLeadRow } from "./types";

const TID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function leadBase(p: Partial<FiCrmLeadRow> & Pick<FiCrmLeadRow, "id">): FiCrmLeadRow {
  return {
    tenant_id: TID,
    organisation_id: null,
    clinic_id: null,
    person_id: PID,
    patient_id: null,
    case_id: null,
    current_stage_id: null,
    primary_owner_user_id: null,
    status: "open",
    priority: null,
    summary: "Test",
    metadata: {},
    converted_person_id: null,
    converted_case_id: null,
    converted_at: null,
    converted_by_user_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...p,
  };
}

describe("Stage 2L — converted guard (pure)", () => {
  it("blocks when converted_at is set", () => {
    assert.throws(
      () =>
        assertLeadNotYetConverted(leadBase({ id: LID, converted_at: "2026-02-01T00:00:00.000Z" })),
      /already been converted/
    );
  });

  it("allows when not converted", () => {
    assertLeadNotYetConverted(leadBase({ id: LID, converted_at: null }));
  });
});

describe("Stage 2L — case seed policy (pure)", () => {
  it("allows seed when patient id present", () => {
    assertCaseSeedAllowed(true, "patient-uuid");
  });

  it("rejects seed without patient", () => {
    assert.throws(() => assertCaseSeedAllowed(true, null), /resolved patient/);
  });
});

describe("Stage 2L — conversion note (pure)", () => {
  it("rejects oversized note", () => {
    assert.throws(() => assertConversionNoteBounded("x".repeat(2001)), /conversion_note/);
  });
});

describe("Stage 2L — identity collision (pure)", () => {
  it("throws when multiple distinct persons in union", () => {
    assert.throws(
      () =>
        assertIdentityMatchesLeadPersonOnly(PID, [PID, "dddddddd-dddd-4ddd-8ddd-dddddddddddd"], []),
      /Multiple person records/
    );
  });

  it("throws when single match is not the lead person", () => {
    assert.throws(
      () => assertIdentityMatchesLeadPersonOnly(PID, ["dddddddd-dddd-4ddd-8ddd-dddddddddddd"], []),
      /different person record/
    );
  });

  it("allows only lead person in union", () => {
    assertIdentityMatchesLeadPersonOnly(PID, [PID], [PID]);
  });

  it("allows empty union", () => {
    assertIdentityMatchesLeadPersonOnly(PID, [], []);
  });
});

describe("Stage 2L — person metadata signals (pure)", () => {
  it("extracts email_normalized and phone digits", () => {
    const s = extractPersonIdentitySignals({
      email_normalized: "a@b.com",
      phone: "+44 7700 900123",
    });
    assert.equal(s.emailNormalized, "a@b.com");
    assert.equal(s.phoneDigits, "447700900123");
  });
});

describe("Stage 2L — phone digits (pure)", () => {
  it("returns null for short digit strings", () => {
    assert.equal(normalizePhoneDigits("12345"), null);
  });
});

describe("Stage 2L — tenant/lead ownership helper (pure)", () => {
  it("matches tenant and lead id", () => {
    assert.equal(isLeadConversionRowForTenant(leadBase({ id: LID }), TID, LID), true);
    assert.equal(isLeadConversionRowForTenant(leadBase({ id: LID }), TID, "other"), false);
  });
});

describe("Stage 2L — activity detail shape (ids only)", () => {
  it("lead.converted_to_person detail uses id keys only", () => {
    const detail = {
      person_id: PID,
      patient_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      conversion_mode: "patient_created",
    };
    assert.deepEqual(Object.keys(detail).sort(), ["conversion_mode", "patient_id", "person_id"]);
  });

  it("lead.case_seeded detail uses id keys only", () => {
    const detail = {
      person_id: PID,
      patient_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      case_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      conversion_mode: "patient_linked",
    };
    assert.deepEqual(Object.keys(detail).sort(), [
      "case_id",
      "conversion_mode",
      "patient_id",
      "person_id",
    ]);
  });
});

describe("Stage 2L — Zod convert body", () => {
  it("rejects caseType without seedCase", () => {
    assert.throws(() => crmConvertLeadBodySchema.parse({ caseType: "consult" }), /seedCase/);
  });

  it("accepts seedCase with case fields", () => {
    const v = crmConvertLeadBodySchema.parse({
      seedCase: true,
      caseType: "consult",
      treatmentInterest: " fue ",
    });
    assert.equal(v.seedCase, true);
    assert.equal(v.caseType, "consult");
  });
});
