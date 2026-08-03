import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildConsentAccessPath,
  channelFromDeviceFlag,
  classifyConsentTokenAccess,
  consentAccessTokenExpiresAt,
  generateConsentAccessToken,
  hashConsentAccessToken,
  isDraftConsentBody,
  patientSafeMessageForTokenOutcome,
  renderConsentBodyMarkdownSafe,
  surgeryConsentKeysSatisfied,
  validateConsentSignInput,
} from "./consentAccessTokenCore";

describe("consentAccessTokenCore", () => {
  it("issues opaque tokens and stores only hash equality", () => {
    const raw = generateConsentAccessToken();
    assert.ok(raw.length >= 32);
    const hash = hashConsentAccessToken(raw);
    assert.equal(hash.length, 64);
    assert.notEqual(hash, raw);
    assert.equal(hashConsentAccessToken(raw), hash);
    assert.notEqual(hashConsentAccessToken(raw + "x"), hash);
  });

  it("does not embed PHI-like structure in token path", () => {
    const raw = generateConsentAccessToken();
    const path = buildConsentAccessPath(raw);
    assert.ok(path.startsWith("/consent/"));
    assert.ok(!path.includes("patient"));
    assert.ok(!path.includes("@"));
    assert.equal(buildConsentAccessPath(raw, { clinicDevice: true }), `${path}?device=clinic`);
  });

  it("expiry is ~7 days by default", () => {
    const from = new Date("2026-08-01T12:00:00.000Z");
    const exp = consentAccessTokenExpiresAt(from, 7);
    assert.equal(exp.toISOString(), "2026-08-08T12:00:00.000Z");
  });

  it("classify: valid / expired / already signed / unknown", () => {
    const future = "2099-01-01T00:00:00.000Z";
    const past = "2020-01-01T00:00:00.000Z";
    assert.equal(
      classifyConsentTokenAccess({
        tokenFound: true,
        expiresAt: future,
        instanceStatus: "outstanding",
      }),
      "valid"
    );
    assert.equal(
      classifyConsentTokenAccess({
        tokenFound: true,
        expiresAt: past,
        instanceStatus: "outstanding",
      }),
      "expired"
    );
    assert.equal(
      classifyConsentTokenAccess({
        tokenFound: true,
        expiresAt: future,
        instanceStatus: "signed",
      }),
      "already_signed"
    );
    assert.equal(
      classifyConsentTokenAccess({
        tokenFound: false,
        expiresAt: future,
        instanceStatus: "outstanding",
      }),
      "not_found"
    );
  });

  it("sign validation requires name + agreement", () => {
    assert.equal(validateConsentSignInput({ signedName: "A", agreed: true }).ok, false);
    assert.equal(validateConsentSignInput({ signedName: "Jane Doe", agreed: false }).ok, false);
    const ok = validateConsentSignInput({ signedName: "  Jane   Doe ", agreed: true });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.signedName, "Jane Doe");
  });

  it("channel from clinic device flag", () => {
    assert.equal(channelFromDeviceFlag(false), "fi_patient_link");
    assert.equal(channelFromDeviceFlag(true), "fi_clinic_device");
  });

  it("surgeryConsentKeysSatisfied requires surgery_procedure signed", () => {
    assert.equal(
      surgeryConsentKeysSatisfied({
        required: ["privacy_treatment", "surgery_procedure"],
        signed: ["privacy_treatment"],
      }),
      false
    );
    assert.equal(
      surgeryConsentKeysSatisfied({
        required: ["privacy_treatment", "surgery_procedure"],
        signed: ["privacy_treatment", "surgery_procedure"],
      }),
      true
    );
    assert.equal(
      surgeryConsentKeysSatisfied({
        required: ["privacy_treatment"],
        signed: ["privacy_treatment"],
      }),
      false
    );
  });

  it("safe markdown escapes HTML and supports bold", () => {
    const html = renderConsentBodyMarkdownSafe('Hello **world**\n\n<script>x</script>');
    assert.ok(html.includes("<strong>world</strong>"));
    assert.ok(html.includes("&lt;script&gt;"));
    assert.ok(!html.includes("<script>"));
  });

  it("draft body detection", () => {
    assert.equal(isDraftConsentBody("**DRAFT — not legal-final.**\n\nText"), true);
    assert.equal(isDraftConsentBody("Final approved text"), false);
  });

  it("patient-safe messages are generic", () => {
    assert.ok(patientSafeMessageForTokenOutcome("not_found").includes("not valid"));
    assert.ok(patientSafeMessageForTokenOutcome("expired").includes("expired"));
    assert.ok(patientSafeMessageForTokenOutcome("already_signed").includes("already"));
  });
});
