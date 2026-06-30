import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  buildReceptionOsPilotBanner,
  buildReceptionOsSystemStatus,
  deriveReceptionOsProviderMode,
  isReceptionOsPilotModeActive,
  providerModeLabel,
} from "@/src/lib/receptionOs/receptionOsPilotStatusModel";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("receptionOsPilotStatusModel", () => {
  const closeoutBase = {
    operatingDate: "2026-06-19",
    existingCloseoutId: null,
    failedCommunications: [],
    itemCounts: {
      info: 0,
      warning: 0,
      critical: 0,
      blocked: 0,
      total: 0,
      failed_communications: 0,
    },
  };

  it("defaults to dry_run provider mode when dry-run enabled", () => {
    assert.equal(
      deriveReceptionOsProviderMode({
        dryRunEnabled: true,
        emailSendEnabled: true,
        smsSendEnabled: true,
        resendConfigured: true,
        twilioConfigured: true,
      }),
      "dry_run"
    );
  });

  it("marks pilot mode active when dry-run is on", () => {
    const status = buildReceptionOsSystemStatus({
      dryRunEnabled: true,
      emailSendEnabled: false,
      smsSendEnabled: false,
      resendConfigured: false,
      twilioConfigured: false,
      loadedAt: "2026-06-19T10:00:00.000Z",
      closeout: closeoutBase,
    });
    assert.equal(status.pilotModeActive, true);
    assert.equal(status.providerMode, "dry_run");
    assert.ok(status.pilotBanner);
    assert.match(status.pilotBanner!.title, /pilot/i);
  });

  it("shows no pilot banner when live both channels configured and dry-run off", () => {
    const status = buildReceptionOsSystemStatus({
      dryRunEnabled: false,
      emailSendEnabled: true,
      smsSendEnabled: true,
      resendConfigured: true,
      twilioConfigured: true,
      loadedAt: "2026-06-19T10:00:00.000Z",
      closeout: closeoutBase,
    });
    assert.equal(status.pilotModeActive, false);
    assert.equal(status.pilotBanner, null);
    assert.equal(status.providerMode, "live_both");
  });

  it("flags live_blocked when channel flags on but providers missing", () => {
    assert.equal(
      isReceptionOsPilotModeActive({
        dryRunEnabled: false,
        emailSendEnabled: true,
        smsSendEnabled: false,
        providerMode: "live_blocked",
      }),
      true
    );
    const banner = buildReceptionOsPilotBanner({
      pilotModeActive: true,
      dryRunEnabled: false,
      emailSendEnabled: true,
      smsSendEnabled: false,
      providerMode: "live_blocked",
      resendConfigured: false,
      twilioConfigured: false,
    });
    assert.equal(banner?.variant, "danger");
  });

  it("surfaces failed sends and closeout status from closeout snapshot", () => {
    const status = buildReceptionOsSystemStatus({
      dryRunEnabled: true,
      emailSendEnabled: false,
      smsSendEnabled: false,
      resendConfigured: false,
      twilioConfigured: false,
      loadedAt: "2026-06-19T10:00:00.000Z",
      closeout: {
        ...closeoutBase,
        existingCloseoutId: "close-1",
        failedCommunications: [
          {
            id: "f1",
            channel: "sms",
            provider: "twilio",
            deliveryStatus: "failed",
            errorMessage: "bad",
            sentAt: null,
            templateKey: "deposit_reminder",
            toAddress: "+6100",
            externalMessageId: null,
            leadId: null,
            patientId: null,
            createdAt: "2026-06-19T09:00:00.000Z",
          },
        ],
      },
    });
    assert.equal(status.failedSendsToday, 1);
    assert.equal(status.closeoutStatus, "closed");
  });

  it("labels provider modes for status panel", () => {
    assert.match(providerModeLabel("dry_run"), /Dry-run/i);
    assert.match(providerModeLabel("live_both"), /Live email \+ SMS/);
  });
});
