import type { FoundationOsDashboardPayload } from "./foundationOsDashboardTypes";
import type { PatientOsOverviewModel } from "@/src/lib/patients/patientOsDashboardLoader.server";

/**
 * Deterministic clinic-facing insight lines from existing aggregate counts only (no AI).
 */
export function buildPatientTwinWorkspaceInsights(
  data: FoundationOsDashboardPayload,
  patientOs: PatientOsOverviewModel
): string[] {
  const { twin_health: th, twin_coverage: tc } = data;
  const insights: string[] = [];

  const identityPct = tc.identity_global_resolution_pct;
  if (identityPct === null || th.foundation_patients === 0) {
    insights.push(
      "Patient records will appear here as the clinic onboard patients and link identities."
    );
  } else if (identityPct >= 85) {
    insights.push("Most patient records are unified and ready for clinical navigation.");
  } else if (identityPct >= 55) {
    insights.push("Many records are unified, but some identities still need linking in PatientOS.");
  } else {
    insights.push(
      "Identity unification is still in progress — prioritise linking new enquiries to patient records."
    );
  }

  const mediaPct = tc.media_coverage_pct;
  if (mediaPct !== null) {
    if (mediaPct >= 70) {
      insights.push(
        "Media coverage is strong — most patient records include linked clinical photography."
      );
    } else if (mediaPct >= 35) {
      insights.push(
        "Media coverage is partial; schedule photo capture for patients without linked imaging."
      );
    } else if (th.foundation_patients > 0) {
      insights.push(
        "Media coverage is incomplete for many records; photo capture should be prioritised."
      );
    }
  }

  const auditPct = tc.audit_case_coverage_pct;
  if (auditPct === null) {
    if (th.reports_total === 0 && th.foundation_patients > 0) {
      insights.push(
        "Audit linkage is still limited; outcomes will strengthen as more reports are released."
      );
    }
  } else if (auditPct < 25 && th.foundation_patients > 0) {
    insights.push(
      "Audit linkage is still limited; outcomes will strengthen as more reports are released."
    );
  } else if (auditPct >= 40) {
    insights.push("A meaningful share of patient records are connected to audit outcomes.");
  }

  if (th.cases_missing_foundation_patient > 0) {
    insights.push(
      `${th.cases_missing_foundation_patient} active case${th.cases_missing_foundation_patient === 1 ? "" : "s"} still need a patient link for full SurgeryOS continuity.`
    );
  }

  if (patientOs.kpis.patientsWithActiveCases > 0) {
    insights.push(
      `${patientOs.kpis.patientsWithActiveCases} patient${patientOs.kpis.patientsWithActiveCases === 1 ? "" : "s"} ${patientOs.kpis.patientsWithActiveCases === 1 ? "is" : "are"} currently moving through active case journeys.`
    );
  }

  if (tc.twin_readiness_score_hint >= 75 && th.foundation_patients > 0) {
    insights.push("Overall clinical twin readiness is strong for day-to-day navigation.");
  } else if (
    tc.twin_readiness_score_hint > 0 &&
    tc.twin_readiness_score_hint < 45 &&
    th.foundation_patients > 0
  ) {
    insights.push(
      "Clinical twin readiness is early — focus on media capture, case linking, and timeline milestones."
    );
  }

  return insights.slice(0, 4);
}
