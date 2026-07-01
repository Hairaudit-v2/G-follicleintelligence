import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

import {
  APPOINTMENT_PROCEDURE_CAPTURE_SOURCE,
  APPOINTMENT_PROCEDURE_ADMIN_FALLBACK_SOURCE,
  APPOINTMENT_PROCEDURE_PROTOCOL_REQUIRED_MESSAGE,
  appointmentProcedureUploadBlockedReason,
} from "./appointmentProcedureCapture";
import { assertVieProtocolCapturePolicy } from "./vieCapturePolicy.server";

describe("appointment procedure capture policy", () => {
  it("blocks appointment_procedure upload without protocol session", () => {
    assert.throws(
      () =>
        assertVieProtocolCapturePolicy({
          captureSource: APPOINTMENT_PROCEDURE_CAPTURE_SOURCE,
          protocolSessionId: null,
          protocolTemplateSlug: "surgery_day",
          protocolSlotSlug: "graft_tray_overview",
        }),
      /active capture protocol/i
    );
  });

  it("allows appointment_procedure upload with valid protocol session", () => {
    assert.doesNotThrow(() =>
      assertVieProtocolCapturePolicy({
        captureSource: APPOINTMENT_PROCEDURE_CAPTURE_SOURCE,
        protocolSessionId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        protocolTemplateSlug: "surgery_day",
        protocolSlotSlug: "graft_tray_overview",
      })
    );
  });

  it("appointmentProcedureUploadBlockedReason requires capture_source", () => {
    assert.equal(
      appointmentProcedureUploadBlockedReason({
        captureSource: null,
        protocolSessionId: null,
      }),
      APPOINTMENT_PROCEDURE_PROTOCOL_REQUIRED_MESSAGE
    );
  });

  it("admin fallback requires admin key", () => {
    assert.match(
      appointmentProcedureUploadBlockedReason({
        captureSource: APPOINTMENT_PROCEDURE_ADMIN_FALLBACK_SOURCE,
        protocolSessionId: null,
        hasAdminFallbackKey: false,
      }) ?? "",
      /admin key/i
    );
    assert.equal(
      appointmentProcedureUploadBlockedReason({
        captureSource: APPOINTMENT_PROCEDURE_ADMIN_FALLBACK_SOURCE,
        protocolSessionId: null,
        hasAdminFallbackKey: true,
      }),
      null
    );
  });

  it("AppointmentProcedurePhotosPanel surfaces protocol guidance and gallery", () => {
    const panelPath = path.join(
      process.cwd(),
      "src/components/fi/appointments/detail/AppointmentProcedurePhotosPanel.tsx"
    );
    const src = fs.readFileSync(panelPath, "utf8");
    assert.match(src, /StartCaptureProtocolButton/);
    assert.match(src, /APPOINTMENT_PROCEDURE_PROTOCOL_REQUIRED_MESSAGE/);
    assert.match(src, /LeadPhotoGalleryPanel/);
    assert.match(src, /APPOINTMENT_PROCEDURE_ADMIN_FALLBACK_SOURCE/);
  });
});