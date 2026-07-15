import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyFormSubmission,
  engagementScopeFor,
  HUBSPOT_ENGAGEMENT_KINDS,
  HUBSPOT_ENGAGEMENT_MILESTONE,
  isEngagementHubspotMilestone,
  probeHubspotEngagementCapabilities,
  runHubspotEngagementBackup,
} from "./hubspotEngagementBackupEngine.server";

describe("HubSpot engagement backup engine", () => {
  it("defines engagement kinds and scopes without secondary milestone collision", () => {
    assert.deepEqual(HUBSPOT_ENGAGEMENT_KINDS, [
      "notes",
      "emails",
      "conversation_threads",
      "conversation_messages",
      "files",
      "forms",
      "form_submissions",
    ]);
    assert.equal(engagementScopeFor("notes"), "crm.objects.notes.read");
    assert.equal(engagementScopeFor("emails"), "crm.objects.emails.read");
    assert.equal(engagementScopeFor("conversation_threads"), "conversations.read");
    assert.equal(engagementScopeFor("files"), "files");
    assert.equal(engagementScopeFor("forms"), "forms");
    assert.ok(isEngagementHubspotMilestone(HUBSPOT_ENGAGEMENT_MILESTONE));
    assert.equal(isEngagementHubspotMilestone("FI-HUBSPOT-SECONDARY-OBJECT-BACKUP-1"), false);
  });

  it("classifies restricted clinical intake from form metadata only", () => {
    assert.equal(
      classifyFormSubmission("Brisbane Pre-Consultation Questionnaire"),
      "restricted_clinical_intake"
    );
    assert.equal(classifyFormSubmission("Contact us", ["email", "firstname"]), "standard");
  });

  it("probes capabilities via GET-only calls and never retains response bodies on denial", async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/crm/v3/objects/notes")) {
        return new Response("secret note body", { status: 403 });
      }
      if (url.includes("/crm/v3/objects/emails")) {
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
      if (url.includes("/conversations/v3/conversations/threads") && !url.includes("/messages")) {
        return new Response(JSON.stringify({ results: [{ id: "t1" }] }), { status: 200 });
      }
      if (url.includes("/messages")) {
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
      if (url.includes("/files/v3/files")) {
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
      if (url.includes("/marketing/v3/forms/")) {
        return new Response(JSON.stringify({ results: [{ id: "f1", name: "Contact" }] }), {
          status: 200,
        });
      }
      if (url.includes("/form-integrations/v1/submissions/forms/")) {
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    };
    try {
      const result = await probeHubspotEngagementCapabilities("token");
      assert.equal(result.notes.result, "MISSING_SCOPE");
      assert.equal(result.notes.granted, false);
      assert.equal(result.emails.granted, true);
      assert.equal(result.conversation_threads.granted, true);
      assert.equal(result.conversation_messages.granted, true);
      assert.equal(result.forms.granted, true);
      assert.equal(JSON.stringify(result).includes("secret note body"), false);
      assert.ok(calls.every((url) => url.startsWith("https://api.hubapi.com")));
      assert.ok(calls.length >= 8);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("runs a partial missing-scope backup for notes while staging emails", async () => {
    const originalFetch = globalThis.fetch;
    const upserts: { table: string; rows: unknown }[] = [];
    const checkpoints: Record<string, unknown>[] = [];

    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/crm/v3/objects/notes")) {
        return new Response("", { status: 403 });
      }
      if (url.includes("/crm/v3/objects/emails")) {
        if (url.includes("archived=true")) {
          return new Response(JSON.stringify({ results: [] }), { status: 200 });
        }
        return new Response(
          JSON.stringify({
            results: [
              {
                id: "e1",
                createdAt: "2026-01-01T00:00:00Z",
                updatedAt: "2026-01-01T00:00:00Z",
                archived: false,
                properties: {
                  hs_email_direction: "INCOMING",
                  hs_email_status: "SENT",
                  hs_attachment_ids: "file-1",
                },
                associations: {
                  contacts: { results: [{ id: "c1", type: "email_to_contact" }] },
                },
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (url.includes("/conversations/v3/conversations/threads")) {
        return new Response("", { status: 403 });
      }
      if (url.includes("/files/v3/files/file-1")) {
        return new Response(
          JSON.stringify({
            id: "file-1",
            type: "application/pdf",
            size: 12,
            createdAt: "2026-01-01T00:00:00Z",
          }),
          { status: 200 }
        );
      }
      if (url.includes("/files/v3/files")) {
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
      if (url.includes("/marketing/v3/forms/") || url.includes("/forms/v2/forms")) {
        return new Response("", { status: 403 });
      }
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    };

    const supabase = {
      from(table: string) {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      in: async () => ({ data: [], error: null }),
                      maybeSingle: async () => ({ data: null, error: null }),
                    };
                  },
                  in: async () => ({ data: [], error: null }),
                };
              },
            };
          },
          upsert: async (rows: unknown) => {
            upserts.push({ table, rows });
            return { error: null };
          },
          update(payload: Record<string, unknown>) {
            return {
              eq: async () => {
                if (table === "fi_external_hubspot_sync_runs") {
                  checkpoints.push(payload);
                }
                return { error: null };
              },
            };
          },
        };
      },
    };

    try {
      const capabilities = await probeHubspotEngagementCapabilities("token");
      // Force files granted so inventory metadata path is exercised for attachment refs.
      capabilities.files = {
        granted: true,
        status: 200,
        archivedSupported: false,
        result: "PASS",
        requiredScope: "files",
      };
      const counters = await runHubspotEngagementBackup({
        supabase: supabase as never,
        accessToken: "token",
        tenantId: "11111111-1111-1111-1111-111111111111",
        integrationId: "22222222-2222-2222-2222-222222222222",
        syncRun: {
          id: "33333333-3333-3333-3333-333333333333",
          engagement_checkpoints: {},
          engagement_counters: {},
        },
        capabilities,
      });

      assert.equal(counters.notes.checkpointStatus, "skipped_missing_scope");
      assert.equal(counters.notes.complete, false);
      assert.equal(counters.emails.complete, true);
      assert.equal(counters.emails.staged, 1);
      assert.equal(counters.emails.associations, 1);
      assert.equal(counters.files.complete, true);
      assert.ok(counters.files.staged >= 1);
      assert.equal(counters.files.contentBackedUp, 0);
      assert.ok(
        upserts.some((entry) => entry.table === "fi_external_hubspot_email_staging")
      );
      assert.ok(
        upserts.some((entry) => entry.table === "fi_external_hubspot_association_staging")
      );
      assert.ok(
        upserts.some((entry) => entry.table === "fi_external_hubspot_file_inventory")
      );
      assert.ok(checkpoints.length > 0);
      assert.equal(
        JSON.stringify({ capabilities, counters, upserts }).includes("secret"),
        false
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("honours Retry-After via shared hubspotReadJson retries", async () => {
    const originalFetch = globalThis.fetch;
    let attempts = 0;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (!url.includes("/crm/v3/objects/notes")) {
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
      attempts += 1;
      if (attempts === 1) {
        return new Response("", { status: 429, headers: { "retry-after": "0" } });
      }
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    };
    try {
      const result = await probeHubspotEngagementCapabilities("token");
      assert.equal(result.notes.granted, true);
      assert.ok(attempts >= 2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
