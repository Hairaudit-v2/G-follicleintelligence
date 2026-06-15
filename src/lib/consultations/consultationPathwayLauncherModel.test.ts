import test from "node:test";
import assert from "node:assert/strict";

import {
  buildConsultationPathwayLauncherViewModel,
  pickLatestInRoomInstanceForTemplateSlug,
  recommendConsultationPathwayKey,
} from "./consultationPathwayLauncherModel";
import { HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG } from "@/src/lib/consultationForms/consultationFormConstants";
import type { ConsultationFormInstanceWithTemplate } from "@/src/lib/consultationForms/consultationFormTypes";
import type { ConsultationRow } from "@/src/lib/consultations/consultationTypes";

function baseRow(over: Partial<ConsultationRow>): ConsultationRow {
  return {
    id: "c1",
    tenant_id: "t1",
    person_id: null,
    patient_id: null,
    lead_id: null,
    case_id: null,
    booking_id: null,
    consultation_type: "scalp_hair_transplant",
    status: "draft",
    consultant_name: null,
    consultant_staff_id: null,
    consultation_date: null,
    structured_data: {},
    live_notes: null,
    recommendation_notes: null,
    quote_data: {},
    created_by: null,
    updated_by: null,
    created_at: "2020-01-01T00:00:00Z",
    updated_at: "2020-01-01T00:00:00Z",
    archived_at: null,
    ...over,
  };
}

test("recommendConsultationPathwayKey prefers transplant consultation types", () => {
  assert.equal(recommendConsultationPathwayKey(baseRow({ consultation_type: "scalp_hair_transplant" })), "hair_transplant");
  assert.equal(recommendConsultationPathwayKey(baseRow({ consultation_type: "medical_hair_loss" })), "hair_loss_hli");
});

test("recommendConsultationPathwayKey reads conservative note signals", () => {
  assert.equal(
    recommendConsultationPathwayKey(baseRow({ consultation_type: "scalp_hair_transplant", live_notes: "Discuss FUE hairline plan" })),
    "hair_transplant"
  );
  assert.equal(
    recommendConsultationPathwayKey(
      baseRow({ consultation_type: "scalp_hair_transplant", live_notes: "Diffuse shedding, labs and minoxidil first" })
    ),
    "hair_loss_hli"
  );
});

test("recommendConsultationPathwayKey returns null when surgery and treatment signals conflict", () => {
  assert.equal(
    recommendConsultationPathwayKey(
      baseRow({
        consultation_type: "scalp_hair_transplant",
        live_notes: "FUE transplant plan but also diffuse shedding workup",
      })
    ),
    null
  );
});

test("recommendConsultationPathwayKey can elevate HT from medical type when notes are clearly surgical", () => {
  assert.equal(
    recommendConsultationPathwayKey(
      baseRow({ consultation_type: "medical_hair_loss", live_notes: "Strip harvest revision; planning FUT scar repair" })
    ),
    "hair_transplant"
  );
});

test("pickLatestInRoomInstanceForTemplateSlug chooses newest updated in-room row", () => {
  const mk = (id: string, updated: string): ConsultationFormInstanceWithTemplate =>
    ({
      id,
      tenant_id: "t1",
      consultation_id: "c1",
      template_version_id: "v1",
      channel: "in_room",
      status: "draft",
      values: {},
      computed: {},
      started_at: "2020-01-01T00:00:00Z",
      submitted_at: null,
      submitted_by_user_id: null,
      completed_at: null,
      completed_by_user_id: null,
      completion_summary: {},
      created_at: "2020-01-01T00:00:00Z",
      updated_at: updated,
      template: {
        id: "tpl",
        slug: HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG,
        name: "HT",
        treatment_program: "ht",
      },
      template_version: { id: "v1", version: 2, status: "published", schema: { sections: [] } },
    }) as ConsultationFormInstanceWithTemplate;

  const older = mk("a", "2020-01-02T00:00:00Z");
  const newer = mk("b", "2020-01-03T00:00:00Z");
  assert.equal(pickLatestInRoomInstanceForTemplateSlug([older, newer], HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG)?.id, "b");
});

test("buildConsultationPathwayLauncherViewModel marks HT submitted when instance locked", () => {
  const inst: ConsultationFormInstanceWithTemplate = {
    id: "i1",
    tenant_id: "t1",
    consultation_id: "c1",
    template_version_id: "v1",
    channel: "in_room",
    status: "locked",
    values: {},
    computed: {},
    started_at: "2020-01-01T00:00:00Z",
    submitted_at: "2020-01-02T00:00:00Z",
    submitted_by_user_id: null,
    completed_at: "2020-01-02T00:00:00Z",
    completed_by_user_id: null,
    completion_summary: {},
    created_at: "2020-01-01T00:00:00Z",
    updated_at: "2020-01-02T00:00:00Z",
    template: {
      id: "tpl",
      slug: HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG,
      name: "HT",
      treatment_program: "ht",
    },
    template_version: { id: "v1", version: 2, status: "published", schema: { sections: [] } },
  };

  const vm = buildConsultationPathwayLauncherViewModel({
    tenantId: "tenant-a",
    consultationId: "consult-a",
    row: baseRow({ consultation_type: "eyebrow_transplant" }),
    instances: [inst],
  });

  const ht = vm.cards.find((c) => c.pathKey === "hair_transplant");
  assert.ok(ht);
  assert.equal(ht.progress, "submitted");
  assert.equal(ht.instanceId, "i1");
  assert.ok(ht.href?.includes("/fi-admin/tenant-a/consultations/consult-a/forms"));
});
