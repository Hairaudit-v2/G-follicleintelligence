import assert from "node:assert/strict";
import test from "node:test";

import {
  FI_CLINICAL_INTELLIGENCE_SIGNAL_KEYS,
  FI_CLINICAL_INTELLIGENCE_SIGNALS,
} from "@/src/config/fiClinicalIntelligenceSignals";
import {
  applyPartialFeatureOverrides,
  buildDefaultFeatureAccessAllEnabled,
} from "@/src/config/fiFeatureAccessRegistry";
import type { CaseReadinessReport } from "@/src/lib/cases/caseReadinessTypes";
import { recordClinicalIntelligenceEventInputSchema } from "@/src/lib/fi-os/clinicalIntelligenceEventsSchema";
import {
  clinicalRecommendationLooksTreatmentLike,
  recommendedNextStepForClinicalSignal,
} from "@/src/lib/fi-os/clinicalIntelligenceRecommendations";
import {
  clinicalSeverityFromCount,
  deriveCaseClinicalSignals,
  derivePatientTwinIntegritySignals,
  normalizeTenantCountSignal,
} from "@/src/lib/fi-os/clinicalIntelligenceSignals";
import { fiDashboardWidgetVisibleByFeatureAccess } from "@/src/lib/fi-os/stage2FeatureVisibility";
import type { PatientTwinV1 } from "@/src/lib/patientTwin/patientTwinTypes";

test("signal registry: keys are complete and unique", () => {
  const keys = new Set(FI_CLINICAL_INTELLIGENCE_SIGNALS.map((s) => s.key));
  assert.equal(keys.size, FI_CLINICAL_INTELLIGENCE_SIGNALS.length);
  for (const k of FI_CLINICAL_INTELLIGENCE_SIGNAL_KEYS) {
    assert.ok(keys.has(k), `missing definition for ${k}`);
  }
});

test("severity calculation respects thresholds", () => {
  assert.equal(clinicalSeverityFromCount(0, { attentionAt: 1, criticalAt: 5 }), "info");
  assert.equal(clinicalSeverityFromCount(1, { attentionAt: 1, criticalAt: 5 }), "attention");
  assert.equal(clinicalSeverityFromCount(5, { attentionAt: 1, criticalAt: 5 }), "critical");
});

test("recommendation copy: registry lines avoid treatment-like phrasing", () => {
  for (const s of FI_CLINICAL_INTELLIGENCE_SIGNALS) {
    assert.equal(
      clinicalRecommendationLooksTreatmentLike(s.recommendedNextStep),
      false,
      `signal ${s.key}`
    );
    assert.equal(
      clinicalRecommendationLooksTreatmentLike(recommendedNextStepForClinicalSignal(s.key)),
      false
    );
  }
});

test("normalize tenant count signal returns null when count is zero", () => {
  assert.equal(
    normalizeTenantCountSignal({ key: "consultation_completion_attention", count: 0 }),
    null
  );
  const one = normalizeTenantCountSignal({ key: "consultation_completion_attention", count: 2 });
  assert.ok(one && one.severity === "attention");
});

test("patient twin signal normalization: pathology drafts", () => {
  const twin = {
    patient_id: "p1",
    warnings: [],
    completeness: {
      score: 90,
      missing: [],
      strengths: [],
      recommended_actions: [],
      band: "good" as const,
    },
    pathology: {
      requests: [],
      results: [
        {
          id: "00000000-0000-4000-8000-0000000000a1",
          result_date: "2026-01-01",
          provider_name: null,
          status: "draft",
          pathology_request_id: null,
          marker_count: 0,
          abnormal_marker_count: 0,
          source_type: "manual",
          reviewed_at: null,
          created_at: "2026-01-01",
        },
      ],
      item_cap: 10,
      results_item_cap: 10,
      abnormal_markers_total: 0,
      last_result_reviewed_at: null,
      latest_ai_interpretation: null,
    },
    imaging: {
      active_image_total: 0,
      by_library_axis: {},
      latest_captured_at: null,
      imaging_workspace_href: "/x",
    },
    cases: [{ case_id: "c1" } as PatientTwinV1["cases"][number]],
  } as unknown as PatientTwinV1;
  const sigs = derivePatientTwinIntegritySignals(twin);
  assert.ok(sigs.some((s) => s.signalKey === "pathology_review_pending"));
});

test("case readiness: derives readiness attention when incomplete", () => {
  const readiness: CaseReadinessReport = {
    sections: [],
    requiredSatisfied: 2,
    requiredTotal: 10,
    overallPercent: 40,
    warnings: [],
    nextRecommendedStep: "Next: finish",
  };
  const sigs = deriveCaseClinicalSignals({
    caseId: "00000000-0000-4000-8000-0000000000b1",
    patientFoundationId: "00000000-0000-4000-8000-0000000000b2",
    readiness,
  });
  assert.ok(sigs.some((s) => s.signalKey === "surgery_readiness_attention"));
});

test("dashboard widget visibility: clinical intelligence needs dashboard + clinical slice", () => {
  const off = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), {
    dashboard: true,
    patients: false,
    cases: false,
    pathology: false,
    imaging: false,
    audit: false,
  });
  assert.equal(
    fiDashboardWidgetVisibleByFeatureAccess("clinical_intelligence_summary", off),
    false
  );

  const on = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), {
    dashboard: true,
    patients: true,
  });
  assert.equal(fiDashboardWidgetVisibleByFeatureAccess("clinical_intelligence_summary", on), true);
});

test("event payload validation: rejects bad severity", () => {
  assert.throws(() =>
    recordClinicalIntelligenceEventInputSchema.parse({
      tenantId: "00000000-0000-4000-8000-000000000001",
      signalKey: "post_op_pending",
      title: "x",
      severity: "high",
    })
  );
});

test("event payload validation: accepts minimal valid row", () => {
  const v = recordClinicalIntelligenceEventInputSchema.parse({
    tenantId: "00000000-0000-4000-8000-000000000001",
    signalKey: "post_op_pending",
    title: "Post-op pending",
  });
  assert.equal(v.severity, "info");
});
