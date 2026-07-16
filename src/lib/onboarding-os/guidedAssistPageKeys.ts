/**
 * Route suffix aliases for Clinic guide page matching (legacy + hub routes).
 */

export function expandGuidedAssistPageKeys(pageKey: string): string[] {
  const p = pageKey.trim().replace(/\/+$/, "");
  const keys = new Set<string>([p]);

  if (p === "" || p === "dashboard") {
    keys.add("");
    keys.add("dashboard");
  }

  if (
    p === "front-desk" ||
    p.startsWith("front-desk/") ||
    p === "reception" ||
    p === "reception-board" ||
    p === "reception-os" ||
    p === "operations" ||
    p === "tomorrow"
  ) {
    keys.add("front-desk");
    if (p === "tomorrow" || p === "front-desk/tomorrow") {
      keys.add("front-desk/tomorrow");
      keys.add("tomorrow");
    }
  }

  if (
    p === "surgery" ||
    p.startsWith("surgery/") ||
    p === "surgery-os" ||
    p.startsWith("surgery-os/") ||
    p === "cases" ||
    p.startsWith("cases/") ||
    p === "surgery-readiness" ||
    p.startsWith("surgery-readiness/") ||
    p === "procedure-day" ||
    p.startsWith("procedure-day/")
  ) {
    keys.add("surgery");
    keys.add("surgery-os");
    keys.add("cases");
    keys.add("surgery-readiness");
  }

  if (p === "crm" || p.startsWith("crm/") || p === "leadflow" || p.startsWith("leadflow/")) {
    keys.add("crm");
    keys.add("leadflow");
  }

  if (
    p === "team" ||
    p.startsWith("team/") ||
    p === "staff" ||
    p.startsWith("staff/") ||
    p.startsWith("workforce-os") ||
    p.startsWith("hr-os")
  ) {
    keys.add("team");
    keys.add("staff");
  }

  if (
    p === "financial-os" ||
    p.startsWith("financial-os/") ||
    p === "financial" ||
    p.startsWith("financial/") ||
    p === "payments" ||
    p.startsWith("payments/")
  ) {
    keys.add("financial-os");
    keys.add("payments");
    keys.add("financial");
  }

  if (
    p === "reports" ||
    p.startsWith("reports/") ||
    p === "analytics" ||
    p.startsWith("analytics/") ||
    p === "operations"
  ) {
    keys.add("reports");
    keys.add("analytics");
  }

  if (p === "doctor" || p.startsWith("doctor/")) {
    keys.add("doctor");
    keys.add("consultations");
  }

  return [...keys];
}
