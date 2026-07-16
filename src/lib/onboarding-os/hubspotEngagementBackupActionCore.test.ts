import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HUBSPOT_ENGAGEMENT_REQUIRED_SCOPES,
  resolveHubspotEngagementBackupActionState,
} from "./hubspotEngagementBackupActionCore";

describe("HubSpot engagement backup action gate", () => {
  it("requires credential, connector, live probe, and at least one engagement scope", () => {
    const blocked = resolveHubspotEngagementBackupActionState({
      credentialConfigured: false,
      connectorStatus: "draft",
      grantedScopes: [],
      activeRun: false,
      liveCapabilitiesVerified: false,
      operatorAuthorized: true,
    });
    assert.equal(blocked.disabled, true);
    assert.match(blocked.disabledReason ?? "", /stored encrypted credential/i);

    const partial = resolveHubspotEngagementBackupActionState({
      credentialConfigured: true,
      connectorStatus: "active",
      grantedScopes: ["crm.objects.notes.read"],
      activeRun: false,
      liveCapabilitiesVerified: true,
      operatorAuthorized: true,
    });
    assert.equal(partial.disabled, false);
    assert.deepEqual(partial.grantedEngagementScopes, ["crm.objects.notes.read"]);
    assert.ok(partial.missingScopes.includes("conversations.read"));
    assert.ok(HUBSPOT_ENGAGEMENT_REQUIRED_SCOPES.length >= 5);
  });

  it("accepts email and files scope aliases", () => {
    const state = resolveHubspotEngagementBackupActionState({
      credentialConfigured: true,
      connectorStatus: "configured",
      grantedScopes: [
        "crm.objects.notes.read",
        "sales-email-read",
        "conversations.read",
        "files.ui_hidden.read",
        "forms",
      ],
      activeRun: false,
      liveCapabilitiesVerified: true,
      operatorAuthorized: true,
    });
    assert.equal(state.disabled, false);
    assert.equal(state.missingScopes.length, 0);
  });

  it("hides the action while an engagement run is active", () => {
    const state = resolveHubspotEngagementBackupActionState({
      credentialConfigured: true,
      connectorStatus: "active",
      grantedScopes: ["forms"],
      activeRun: true,
      liveCapabilitiesVerified: true,
      operatorAuthorized: true,
    });
    assert.equal(state.visible, false);
    assert.equal(state.activeRun, true);
  });
});
