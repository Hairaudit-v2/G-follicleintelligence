import assert from "node:assert/strict";
import test from "node:test";
import { aggregateHubspotWorkspaceStatus, type HubspotWorkspaceRun } from "./hubspotWorkspaceStatus";

const run = (overrides: Partial<HubspotWorkspaceRun>): HubspotWorkspaceRun => ({
  id: "run", status: "completed", contactsDiscovered: 0, dealsDiscovered: 0,
  startedAt: "2026-07-15T00:00:00Z", completedAt: "2026-07-15T00:01:00Z", detail: {}, ...overrides,
});

test("completed primary followed by completed secondary keeps primary counts independent", () => {
  const status = aggregateHubspotWorkspaceStatus({ authVerified: true, runs: [
    run({ id: "secondary", detail: { milestone: "SECONDARY_OBJECT_BACKUP" }, secondaryCapabilities: { companies: {} }, secondaryCounters: {
      companies: { active: 653, archived: 0, discovered: 653, complete: true },
      tickets: { active: 682, archived: 0, discovered: 682, complete: true },
      owners: { active: 31, archived: 0, discovered: 31, complete: true },
      calls: { active: 2093, archived: 0, discovered: 2093, complete: true },
      tasks: { active: 1680, archived: 0, discovered: 1680, complete: true },
      meetings: { active: 17, archived: 0, discovered: 17, complete: true },
    }}),
    run({ id: "primary", contactsDiscovered: 4750, dealsDiscovered: 4958 }),
  ] });
  assert.deepEqual(status.primary.counts, { contacts: 4750, deals: 4958 });
  assert.equal(status.secondary.counts.calls.total, 2093);
});

test("partial backup warning is scoped to its backup", () => {
  const status = aggregateHubspotWorkspaceStatus({ authVerified: true, runs: [
    run({ id: "partial-secondary", status: "partial", detail: { milestone: "SECONDARY" }, secondaryCapabilities: { calls: {} } }),
    run({ id: "complete-secondary", detail: { milestone: "SECONDARY" }, secondaryCapabilities: { calls: {} } }),
    run({ id: "primary", contactsDiscovered: 4750, dealsDiscovered: 4958 }),
  ] });
  assert.equal(status.primary.status, "completed");
  assert.equal(status.secondary.status, "partial");
  assert.equal(status.primary.warning, null);
  assert.match(status.secondary.warning ?? "", /partial/i);
});

test("webhook degradation does not degrade either backup", () => {
  const status = aggregateHubspotWorkspaceStatus({ authVerified: true, runs: [run({ id: "primary" })], webhook: { failed: 2 } });
  assert.equal(status.webhook.status, "degraded");
  assert.equal(status.primary.status, "completed");
  assert.equal(status.primary.warning, null);
});

test("engagement runs stay out of primary and secondary aggregates", () => {
  const status = aggregateHubspotWorkspaceStatus({
    authVerified: true,
    runs: [
      run({
        id: "engagement",
        status: "partial",
        detail: { milestone: "FI-HUBSPOT-ENGAGEMENT-COMMUNICATIONS-BACKUP-1" },
        engagementCapabilities: {
          notes: { granted: true, result: "PASS" },
          emails: { granted: false, result: "MISSING_SCOPE", requiredScope: "crm.objects.emails.read" },
        },
        engagementCounters: {
          notes: { active: 244, archived: 0, discovered: 244, complete: true },
          emails: { active: 0, archived: 0, discovered: 0, complete: false },
          conversation_threads: { active: 0, archived: 0, discovered: 0, complete: false },
          conversation_messages: { active: 0, archived: 0, discovered: 0, complete: false },
          files: { active: 0, archived: 0, discovered: 0, complete: false },
          forms: { active: 0, archived: 0, discovered: 0, complete: false },
          form_submissions: { active: 0, archived: 0, discovered: 0, complete: false },
        },
      }),
      run({ id: "primary", contactsDiscovered: 4750, dealsDiscovered: 4958 }),
    ],
  });
  assert.equal(status.primary.counts.contacts, 4750);
  assert.equal(status.secondary.status, null);
  assert.equal(status.engagement.status, "partial");
  assert.equal(status.engagement.counts.notes.total, 244);
  assert.ok(status.engagement.missingScopeWarnings.some((item) => /emails/i.test(item)));
});
