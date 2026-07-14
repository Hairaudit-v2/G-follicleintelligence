import "server-only";

import {
  buildNavigationDriftReport,
  summarizeNavigationDrift,
  type NavigationDriftReport,
  type NavigationDriftSummary,
} from "@/src/lib/fiOs/navigation/fiOsNavigationDriftAudit";

export type FiOsNavigationAuditPageModel = {
  report: NavigationDriftReport;
  summary: NavigationDriftSummary;
};

export function loadFiOsNavigationAuditPageModel(tenantId: string): FiOsNavigationAuditPageModel {
  const report = buildNavigationDriftReport(tenantId.trim(), { includeQuickCreate: true });
  const summary = summarizeNavigationDrift(report);
  return { report, summary };
}
