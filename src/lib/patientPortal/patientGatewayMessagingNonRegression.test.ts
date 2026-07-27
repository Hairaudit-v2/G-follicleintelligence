/**
 * FI-PATIENT-APP-1F — webapp non-regression architectural proofs.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

describe("FI-PATIENT-APP-1F webapp non-regression", () => {
  it("AA. staff CRM communication modules remain the webapp path", async () => {
    const messages = await import("@/src/lib/crm/messages");
    const activity = await import("@/src/lib/crm/activity");
    assert.equal(typeof messages.createCrmMessagePreview, "function");
    assert.equal(typeof activity.appendCrmActivityEvent, "function");

    const crmMessagesSrc = read("src/lib/crm/messages.ts");
    assert.equal(crmMessagesSrc.includes("requirePatientGatewayContext"), false);
    assert.equal(crmMessagesSrc.includes("/api/patient/v1"), false);
  });

  it("AB. /patient/* portal does not depend on patient gateway messaging", () => {
    const portal = read("src/lib/patientPortal/patientPortalAccess.server.ts");
    assert.equal(portal.includes("patientGatewayMessaging"), false);
    assert.equal(portal.includes("/api/patient/v1/messages"), false);

    const patientLayout = read("app/patient/[tenantId]/layout.tsx");
    const patientIndex = read("app/patient/[tenantId]/page.tsx");
    assert.equal(patientLayout.includes("/api/patient/v1"), false);
    assert.equal(patientIndex.includes("/api/patient/v1"), false);
  });

  it("gateway messaging is additive and surfaces into existing staff workflows", () => {
    const messaging = read("src/lib/patientPortal/patientGatewayMessaging.server.ts");
    assert.ok(messaging.includes("appendCrmActivityEvent"));
    assert.ok(messaging.includes("appendPatientTimelineEvent"));
    assert.ok(messaging.includes("createCrmMessagePreview"));
    assert.ok(messaging.includes("fi_patient_gateway_messages"));
    // Does not replace CRM message body store semantics
    assert.equal(messaging.includes("from(\"fi_crm_messages\").update"), false);
  });
});
