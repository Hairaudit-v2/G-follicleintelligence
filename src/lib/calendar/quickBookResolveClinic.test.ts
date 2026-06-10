import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findEvolvedPerthStyleClinicId, resolveQuickBookClinicId } from "./quickBookResolveClinic";

const PERTH = { id: "cl-perth", display_name: "Evolved Hair Restoration Perth" };
const SYDNEY = { id: "cl-syd", display_name: "Sydney Clinic" };

describe("quickBookResolveClinic", () => {
  it("uses column clinic first", () => {
    const r = resolveQuickBookClinicId({
      columnClinicId: PERTH.id,
      prefillDefaultClinicId: SYDNEY.id,
      calendarQueryClinicId: SYDNEY.id,
      operatorPrimaryClinicId: null,
      clinics: [PERTH, SYDNEY],
    });
    assert.equal(r.ok && r.clinicId, PERTH.id);
  });

  it("falls back to single clinic", () => {
    const r = resolveQuickBookClinicId({
      clinics: [PERTH],
    });
    assert.equal(r.ok && r.clinicId, PERTH.id);
  });

  it("matches Evolved Perth by name when ambiguous", () => {
    const r = resolveQuickBookClinicId({
      clinics: [SYDNEY, PERTH],
    });
    assert.equal(r.ok && r.clinicId, PERTH.id);
  });

  it("returns ambiguous when no signals and multiple unrelated clinics", () => {
    const r = resolveQuickBookClinicId({
      clinics: [
        { id: "a", display_name: "Alpha" },
        { id: "b", display_name: "Beta" },
      ],
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "ambiguous");
  });

  it("findEvolvedPerthStyleClinicId is case-insensitive on evolved+perth", () => {
    assert.equal(findEvolvedPerthStyleClinicId([{ id: "x", display_name: "EVOLVED hair (Perth)" }]), "x");
  });
});
