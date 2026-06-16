import test from "node:test";
import assert from "node:assert/strict";

import {
  buildConsultationPathwayLauncherViewModel,
  consultationPathwayCtaLabel,
  pickLatestInRoomInstanceForTemplateSlug,
  recommendConsultationPathwayKey,
} from "./consultationPathwayLauncherModel";
import {
  FEMALE_HAIR_LOSS_CONSULTATION_TEMPLATE_SLUG,
  FOLLOW_UP_REVIEW_CONSULTATION_TEMPLATE_SLUG,
  HAIR_LOSS_TREATMENT_CONSULTATION_TEMPLATE_SLUG,
  HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG,
  HAIR_TRANSPLANT_REPAIR_CONSULTATION_TEMPLATE_SLUG,
} from "@/src/lib/consultationForms/consultationFormConstants";
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
      baseRow({ consultation_type: "medical_hair_loss", live_notes: "Strip harvest donor planning; planning FUT hairline restoration" })
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

test("buildConsultationPathwayLauncherViewModel HLI card shows in_progress when HLI instance is draft", () => {
  const hli: ConsultationFormInstanceWithTemplate = {
    id: "hli-1",
    tenant_id: "t1",
    consultation_id: "c1",
    template_version_id: "v-hli",
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
    updated_at: "2020-01-02T00:00:00Z",
    template: {
      id: "tpl-hli",
      slug: HAIR_LOSS_TREATMENT_CONSULTATION_TEMPLATE_SLUG,
      name: "HLI",
      treatment_program: "hli",
    },
    template_version: { id: "v-hli", version: 1, status: "published", schema: { sections: [] } },
  };

  const vm = buildConsultationPathwayLauncherViewModel({
    tenantId: "tenant-a",
    consultationId: "consult-a",
    row: baseRow({ consultation_type: "medical_hair_loss" }),
    instances: [hli],
  });

  const hliCard = vm.cards.find((c) => c.pathKey === "hair_loss_hli");
  assert.ok(hliCard);
  assert.equal(hliCard.progress, "in_progress");
  assert.equal(hliCard.instanceId, "hli-1");
  assert.ok(hliCard.href?.endsWith("/forms/hair-loss-treatment"));
});

test("buildConsultationPathwayLauncherViewModel HT card uses template version 3 instance the same as v2 for progress", () => {
  const htV3: ConsultationFormInstanceWithTemplate = {
    id: "ht-v3",
    tenant_id: "t1",
    consultation_id: "c1",
    template_version_id: "ver-3",
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
    updated_at: "2020-01-02T00:00:00Z",
    template: {
      id: "tpl-ht",
      slug: HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG,
      name: "HT",
      treatment_program: "ht",
    },
    template_version: { id: "ver-3", version: 3, status: "published", schema: { sections: [] } },
  };

  const vm = buildConsultationPathwayLauncherViewModel({
    tenantId: "tenant-a",
    consultationId: "consult-a",
    row: baseRow({ consultation_type: "scalp_hair_transplant" }),
    instances: [htV3],
  });

  const ht = vm.cards.find((c) => c.pathKey === "hair_transplant");
  assert.ok(ht);
  assert.equal(ht.progress, "in_progress");
  assert.equal(ht.instanceId, "ht-v3");
});

test("recommendConsultationPathwayKey suggests female pathway on postpartum / Ludwig signals without surgery text", () => {
  assert.equal(
    recommendConsultationPathwayKey(baseRow({ consultation_type: "medical_hair_loss", live_notes: "Postpartum shedding assessment" })),
    "female_hair_loss"
  );
  assert.equal(
    recommendConsultationPathwayKey(baseRow({ consultation_type: "scalp_hair_transplant", live_notes: "Ludwig II pattern — medical management first" })),
    "female_hair_loss"
  );
});

test("buildConsultationPathwayLauncherViewModel female card is active with Start/Continue/Review from instance", () => {
  const female: ConsultationFormInstanceWithTemplate = {
    id: "fem-1",
    tenant_id: "t1",
    consultation_id: "c1",
    template_version_id: "v-fem",
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
    updated_at: "2020-01-02T00:00:00Z",
    template: {
      id: "tpl-fem",
      slug: FEMALE_HAIR_LOSS_CONSULTATION_TEMPLATE_SLUG,
      name: "Female",
      treatment_program: "hair_longevity_medical",
    },
    template_version: { id: "v-fem", version: 1, status: "published", schema: { sections: [] } },
  };

  const vm = buildConsultationPathwayLauncherViewModel({
    tenantId: "tenant-a",
    consultationId: "consult-a",
    row: baseRow({ consultation_type: "medical_hair_loss" }),
    instances: [female],
  });

  const card = vm.cards.find((c) => c.pathKey === "female_hair_loss");
  assert.ok(card);
  assert.equal(card.availability, "active");
  assert.equal(card.progress, "in_progress");
  assert.equal(card.instanceId, "fem-1");
  assert.ok(card.href?.endsWith("/forms/female-hair-loss"));
  assert.equal(card.templateSlug, FEMALE_HAIR_LOSS_CONSULTATION_TEMPLATE_SLUG);
  assert.equal(consultationPathwayCtaLabel(card.progress), "Continue");
});

test("buildConsultationPathwayLauncherViewModel female card shows Start when no instance exists", () => {
  const vm = buildConsultationPathwayLauncherViewModel({
    tenantId: "tenant-a",
    consultationId: "consult-a",
    row: baseRow({ consultation_type: "medical_hair_loss" }),
    instances: [],
  });
  const card = vm.cards.find((c) => c.pathKey === "female_hair_loss");
  assert.ok(card);
  assert.equal(card.progress, "not_started");
  assert.equal(consultationPathwayCtaLabel(card.progress), "Start");
});

test("buildConsultationPathwayLauncherViewModel female card shows Review when instance submitted", () => {
  const female: ConsultationFormInstanceWithTemplate = {
    id: "fem-2",
    tenant_id: "t1",
    consultation_id: "c1",
    template_version_id: "v-fem",
    channel: "in_room",
    status: "submitted",
    values: {},
    computed: {},
    started_at: "2020-01-01T00:00:00Z",
    submitted_at: "2020-01-02T00:00:00Z",
    submitted_by_user_id: null,
    completed_at: null,
    completed_by_user_id: null,
    completion_summary: {},
    created_at: "2020-01-01T00:00:00Z",
    updated_at: "2020-01-02T00:00:00Z",
    template: {
      id: "tpl-fem",
      slug: FEMALE_HAIR_LOSS_CONSULTATION_TEMPLATE_SLUG,
      name: "Female",
      treatment_program: "hair_longevity_medical",
    },
    template_version: { id: "v-fem", version: 1, status: "published", schema: { sections: [] } },
  };

  const vm = buildConsultationPathwayLauncherViewModel({
    tenantId: "tenant-a",
    consultationId: "consult-a",
    row: baseRow({ consultation_type: "medical_hair_loss" }),
    instances: [female],
  });

  const card = vm.cards.find((c) => c.pathKey === "female_hair_loss");
  assert.ok(card);
  assert.equal(card.progress, "submitted");
  assert.equal(consultationPathwayCtaLabel(card.progress), "Review");
});

test("recommendConsultationPathwayKey prefers repair when revision / failed transplant signals appear", () => {
  assert.equal(
    recommendConsultationPathwayKey(
      baseRow({ consultation_type: "scalp_hair_transplant", live_notes: "Patient wants revision after pluggy hairline" })
    ),
    "repair"
  );
  assert.equal(
    recommendConsultationPathwayKey(
      baseRow({ consultation_type: "scalp_hair_transplant", live_notes: "Poor growth after prior FUE — overharvesting concern" })
    ),
    "repair"
  );
});

test("buildConsultationPathwayLauncherViewModel repair card is active with Start / Continue / Review CTAs", () => {
  const repairDraft: ConsultationFormInstanceWithTemplate = {
    id: "rep-1",
    tenant_id: "t1",
    consultation_id: "c1",
    template_version_id: "v-rep",
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
    updated_at: "2020-01-02T00:00:00Z",
    template: {
      id: "tpl-rep",
      slug: HAIR_TRANSPLANT_REPAIR_CONSULTATION_TEMPLATE_SLUG,
      name: "Repair",
      treatment_program: "scalp_hair_transplant",
    },
    template_version: { id: "v-rep", version: 1, status: "published", schema: { sections: [] } },
  };

  const vm = buildConsultationPathwayLauncherViewModel({
    tenantId: "tenant-a",
    consultationId: "consult-a",
    row: baseRow({ consultation_type: "scalp_hair_transplant", live_notes: "repair consultation" }),
    instances: [repairDraft],
  });

  const card = vm.cards.find((c) => c.pathKey === "repair");
  assert.ok(card);
  assert.equal(card.availability, "active");
  assert.equal(card.templateSlug, HAIR_TRANSPLANT_REPAIR_CONSULTATION_TEMPLATE_SLUG);
  assert.ok(card.href?.endsWith("/forms/repair"));
  assert.equal(card.progress, "in_progress");
  assert.equal(consultationPathwayCtaLabel(card.progress), "Continue");
  assert.equal(card.recommended, true);
});

test("recommendConsultationPathwayKey prefers follow-up when review / progress language appears", () => {
  assert.equal(
    recommendConsultationPathwayKey(baseRow({ consultation_type: "prp_prf", live_notes: "PRP review — check progress" })),
    "follow_up_review"
  );
  assert.equal(
    recommendConsultationPathwayKey(baseRow({ consultation_type: "medical_hair_loss", live_notes: "Annual review on finasteride" })),
    "follow_up_review"
  );
});

test("buildConsultationPathwayLauncherViewModel follow-up card is active with href /forms/follow-up", () => {
  const fu: ConsultationFormInstanceWithTemplate = {
    id: "fu-1",
    tenant_id: "t1",
    consultation_id: "c1",
    template_version_id: "v-fu",
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
    updated_at: "2020-01-02T00:00:00Z",
    template: {
      id: "tpl-fu",
      slug: FOLLOW_UP_REVIEW_CONSULTATION_TEMPLATE_SLUG,
      name: "Follow-up",
      treatment_program: "hair_longevity_medical",
    },
    template_version: { id: "v-fu", version: 1, status: "published", schema: { sections: [] } },
  };

  const vm = buildConsultationPathwayLauncherViewModel({
    tenantId: "tenant-a",
    consultationId: "consult-a",
    row: baseRow({ consultation_type: "exosomes", live_notes: "exosome review visit" }),
    instances: [fu],
  });

  const card = vm.cards.find((c) => c.pathKey === "follow_up_review");
  assert.ok(card);
  assert.equal(card.availability, "active");
  assert.equal(card.templateSlug, FOLLOW_UP_REVIEW_CONSULTATION_TEMPLATE_SLUG);
  assert.ok(card.href?.endsWith("/forms/follow-up"));
  assert.equal(card.progress, "in_progress");
  assert.equal(consultationPathwayCtaLabel(card.progress), "Continue");
  assert.equal(card.recommended, true);
});

test("buildConsultationPathwayLauncherViewModel follow-up card shows Start when no instance", () => {
  const vm = buildConsultationPathwayLauncherViewModel({
    tenantId: "tenant-a",
    consultationId: "consult-a",
    row: baseRow({ consultation_type: "prp_prf", live_notes: "treatment review visit" }),
    instances: [],
  });
  const card = vm.cards.find((c) => c.pathKey === "follow_up_review");
  assert.ok(card);
  assert.equal(card.progress, "not_started");
  assert.equal(consultationPathwayCtaLabel(card.progress), "Start");
  assert.equal(card.recommended, true);
});

test("buildConsultationPathwayLauncherViewModel follow-up card shows Review when instance submitted", () => {
  const fuDone: ConsultationFormInstanceWithTemplate = {
    id: "fu-2",
    tenant_id: "t1",
    consultation_id: "c1",
    template_version_id: "v-fu2",
    channel: "in_room",
    status: "submitted",
    values: {},
    computed: {},
    started_at: "2020-01-01T00:00:00Z",
    submitted_at: "2020-01-02T00:00:00Z",
    submitted_by_user_id: null,
    completed_at: null,
    completed_by_user_id: null,
    completion_summary: {},
    created_at: "2020-01-01T00:00:00Z",
    updated_at: "2020-01-03T00:00:00Z",
    template: {
      id: "tpl-fu2",
      slug: FOLLOW_UP_REVIEW_CONSULTATION_TEMPLATE_SLUG,
      name: "Follow-up",
      treatment_program: "hair_longevity_medical",
    },
    template_version: { id: "v-fu2", version: 1, status: "published", schema: { sections: [] } },
  };

  const vm = buildConsultationPathwayLauncherViewModel({
    tenantId: "tenant-a",
    consultationId: "consult-a",
    row: baseRow({ consultation_type: "medical_hair_loss", live_notes: "post surgery review" }),
    instances: [fuDone],
  });
  const card = vm.cards.find((c) => c.pathKey === "follow_up_review");
  assert.ok(card);
  assert.equal(card.progress, "submitted");
  assert.equal(consultationPathwayCtaLabel(card.progress), "Review");
});
