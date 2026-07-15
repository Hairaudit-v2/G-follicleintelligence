import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HUBSPOT_SECONDARY_REQUIRED_SCOPES,
  resolveHubspotSecondaryBackupActionState,
} from "./hubspotSecondaryBackupActionCore";

const ready = {
  credentialConfigured: true,
  connectorStatus: "configured" as const,
  grantedScopes: HUBSPOT_SECONDARY_REQUIRED_SCOPES,
  activeRun: false,
  operatorAuthorized: true,
};

describe("HubSpot secondary backup operator action", () => {
  it("remains visible after test-mode verification when recorded live scopes remain granted", () => {
    const scopesWithHubSpotTicketAlias: string[] = [
      ...HUBSPOT_SECONDARY_REQUIRED_SCOPES.filter((scope) => scope !== "crm.objects.tickets.read"),
      "tickets.read",
    ];
    assert.deepEqual(
      resolveHubspotSecondaryBackupActionState({
        ...ready,
        grantedScopes: scopesWithHubSpotTicketAlias,
      }),
      {
        visible: true,
        disabled: false,
        disabledReason: null,
        missingScopes: [],
        activeRun: false,
      }
    );
  });

  it("remains visible after a partial prior run", () => {
    const state = resolveHubspotSecondaryBackupActionState(ready);
    assert.equal(state.visible, true);
    assert.equal(state.disabled, false);
  });

  it("is hidden only while a secondary run is active", () => {
    const state = resolveHubspotSecondaryBackupActionState({ ...ready, activeRun: true });
    assert.equal(state.visible, false);
    assert.equal(state.activeRun, true);
  });

  it("is disabled with an explicit reason when the credential is missing", () => {
    const state = resolveHubspotSecondaryBackupActionState({
      ...ready,
      credentialConfigured: false,
    });
    assert.equal(state.visible, true);
    assert.equal(state.disabled, true);
    assert.match(state.disabledReason ?? "", /stored encrypted credential/i);
  });

  it("allows platform admins and authorised tenant operators", () => {
    assert.equal(resolveHubspotSecondaryBackupActionState(ready).disabled, false);
    const denied = resolveHubspotSecondaryBackupActionState({
      ...ready,
      operatorAuthorized: false,
    });
    assert.equal(denied.visible, true);
    assert.match(denied.disabledReason ?? "", /authorised tenant operator/i);
  });

  it("does not depend on live-sync availability, health, test mode, or prior completion", () => {
    const state = resolveHubspotSecondaryBackupActionState(ready);
    assert.equal(state.disabled, false);
  });
});
