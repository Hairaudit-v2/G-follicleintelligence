import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPatientGatewayMeResponse,
  derivePatientGatewayNameFields,
  sanitizePatientGatewayLogoUrl,
} from "./patientGatewayMeCore";

describe("patientGatewayMeCore", () => {
  it("derives names from hubspot metadata without CRM internals", () => {
    const names = derivePatientGatewayNameFields({
      personMetadata: {
        hubspot: { first_name: "Ada", last_name: "Lovelace", preferred_name: "Ada" },
        import_batch_id: "should-not-surface-here",
      },
      patientMetadata: { admin_note: "staff only" },
    });
    assert.equal(names.firstName, "Ada");
    assert.equal(names.lastName, "Lovelace");
    assert.equal(names.preferredName, "Ada");
  });

  it("sanitizes non-http logo urls", () => {
    assert.equal(sanitizePatientGatewayLogoUrl("https://cdn.example/logo.png"), "https://cdn.example/logo.png");
    assert.equal(sanitizePatientGatewayLogoUrl("tenant-branding/path/logo.png"), null);
    assert.equal(sanitizePatientGatewayLogoUrl("javascript:alert(1)"), null);
  });

  it("builds patient-safe me response", () => {
    const me = buildPatientGatewayMeResponse({
      patientId: "11111111-1111-4111-8111-111111111111",
      clinicId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      clinicName: "Demo Clinic",
      locationName: "Perth",
      personMetadata: {
        hubspot: { first_name: "Ada", last_name: "Lovelace" },
        display_name: "Ada L",
      },
      branding: {
        logoUrl: "https://cdn.example/logo.png",
        primaryColor: "#112233",
        secondaryColor: null,
        accentColor: "#445566",
      },
    });
    assert.equal(me.ok, true);
    assert.equal(me.patientId, "11111111-1111-4111-8111-111111111111");
    assert.equal(me.firstName, "Ada");
    assert.equal(me.lastName, "Lovelace");
    assert.equal(me.preferredName, "Ada L");
    assert.equal(me.clinic.name, "Demo Clinic");
    assert.equal(me.clinic.locationName, "Perth");
    assert.equal(me.clinic.branding.logoUrl, "https://cdn.example/logo.png");
    assert.equal("portal_auth_user_id" in me, false);
    assert.equal("admin_note" in me, false);
  });
});
