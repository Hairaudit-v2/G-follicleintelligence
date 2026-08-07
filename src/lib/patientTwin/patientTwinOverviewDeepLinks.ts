/**
 * FI-DEMO-DAY-2A.4 — Deep links into existing tenant-scoped Health / case / Money surfaces.
 */

import { CASE_DETAIL_SECTION_IDS } from "@/src/lib/cases/caseDetailNavConstants";
import { buildFiAuditReportHref } from "@/src/lib/outcomeIntelligence/hairAuditLinkCore";
import type { OverviewDeepLinks } from "./patientTwinOverviewTypes";

export function buildOverviewDeepLinks(input: {
  tenantId: string;
  patientId: string;
  caseId: string | null;
  latestAuditReportId: string | null;
}): OverviewDeepLinks {
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  const caseId = input.caseId?.trim() || null;

  return {
    patientProfileHref: `/fi-admin/${tid}/patients/${pid}`,
    paymentsHref: `/fi-admin/${tid}/patients/${pid}?tab=payments`,
    imagingHref: `/fi-admin/${tid}/patients/${pid}/imaging`,
    caseHref: caseId ? `/fi-admin/${tid}/cases/${caseId}` : null,
    surgeryPlanningHref: caseId
      ? `/fi-admin/${tid}/cases/${caseId}#${CASE_DETAIL_SECTION_IDS.surgeryPlanning}`
      : null,
    surgeryDayHref: caseId
      ? `/fi-admin/${tid}/cases/${caseId}#${CASE_DETAIL_SECTION_IDS.procedureDay}`
      : null,
    auditHref: input.latestAuditReportId
      ? buildFiAuditReportHref(tid, input.latestAuditReportId)
      : null,
  };
}
