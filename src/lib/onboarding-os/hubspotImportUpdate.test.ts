import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createFiLeadFromHubspotContact } from "@/src/lib/onboarding-os/hubspotImport.server";

const TENANT = "11111111-1111-4111-8111-111111111111";
const INTEGRATION = "22222222-2222-4222-8222-222222222222";
const STAGING = "33333333-3333-4333-8333-333333333333";
const LEAD_ID = "44444444-4444-4444-8444-444444444444";
const PERSON_ID = "55555555-5555-4555-8555-555555555555";
const HUBSPOT_CONTACT = "hs-contact-100";

const pipelineStageRow = {
  id: "stage-entry",
  tenant_id: TENANT,
  organisation_id: null,
  clinic_id: null,
  pipeline_key: "default",
  slug: "new",
  label: "New",
  sort_order: 0,
  is_entry: true,
  is_won: false,
  is_lost: false,
  metadata: {},
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
};

describe("createFiLeadFromHubspotContact existing mapping update", () => {
  it("updates fi_crm_leads when HubSpot contact is already mapped", async () => {
    const updates: Array<{ table: string; payload: Record<string, unknown> }> = [];

    const stagingRow = {
      id: STAGING,
      integration_id: INTEGRATION,
      tenant_id: TENANT,
      sync_run_id: null,
      hubspot_contact_id: HUBSPOT_CONTACT,
      email: "lead@example.com",
      phone: null,
      lead_source: "web",
      duplicate_risk: false,
      normalized_lead_type: "lead",
      raw_payload: {
        properties: {
          firstname: "Ada",
          lastname: "Lovelace",
          email: "lead@example.com",
          lifecyclestage: "lead",
        },
      },
      import_status: "approved",
      imported_at: null,
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-03T00:00:00.000Z",
    };

    const supabase = {
      from(table: string) {
        const chain = {
          select: () => chain,
          eq: () => chain,
          neq: () => chain,
          in: () => chain,
          is: () => chain,
          insert: () => chain,
          update(payload: Record<string, unknown>) {
            updates.push({ table, payload });
            return chain;
          },
          maybeSingle: async () => {
            if (table === "fi_external_hubspot_contact_staging") {
              return { data: stagingRow, error: null };
            }
            return { data: null, error: null };
          },
          single: async () => ({ data: { id: "stage-entry" }, error: null }),
          then(resolve: (v: { data: unknown[]; error: null }) => void) {
            if (table === "fi_persons") {
              resolve({ data: [{ id: PERSON_ID, metadata: {} }], error: null });
              return;
            }
            if (table === "fi_crm_leads") {
              resolve({
                data: [
                  {
                    id: LEAD_ID,
                    person_id: PERSON_ID,
                    summary: "Old",
                    metadata: { hubspot: { email: "lead@example.com" } },
                  },
                ],
                error: null,
              });
              return;
            }
            if (table === "fi_crm_pipeline_stages") {
              resolve({ data: [pipelineStageRow], error: null });
              return;
            }
            if (table === "fi_patients") {
              resolve({ data: [], error: null });
              return;
            }
            if (table === "fi_intakes") {
              resolve({ data: [], error: null });
              return;
            }
            if (table === "fi_external_record_mappings") {
              resolve({
                data: [
                  {
                    external_id: HUBSPOT_CONTACT,
                    source_entity_type: "contact",
                    fi_entity_type: "lead",
                    fi_entity_id: LEAD_ID,
                  },
                  {
                    external_id: HUBSPOT_CONTACT,
                    source_entity_type: "contact",
                    fi_entity_type: "person",
                    fi_entity_id: PERSON_ID,
                  },
                ],
                error: null,
              });
              return;
            }
            if (table === "fi_person_source_ids") {
              resolve({ data: [], error: null });
              return;
            }
            resolve({ data: [], error: null });
          },
        };
        return chain;
      },
    };

    const result = await createFiLeadFromHubspotContact(STAGING, INTEGRATION, TENANT, {
      supabaseClientForTests: supabase as never,
      skipAuthCheck: true,
      actorAuthUserId: "auth-user",
    });

    assert.equal(result.ok, true);
    if (!result.ok || !result.data) return;
    assert.equal(result.data.leadId, LEAD_ID);
    assert.equal(result.data.personId, PERSON_ID);
    assert.ok(updates.some((u) => u.table === "fi_crm_leads" && u.payload.summary));
    assert.ok(
      updates.some(
        (u) =>
          u.table === "fi_external_hubspot_contact_staging" &&
          u.payload.import_status === "imported"
      )
    );
  });
});
