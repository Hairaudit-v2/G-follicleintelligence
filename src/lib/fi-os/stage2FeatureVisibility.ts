import type { FiDashboardWidgetKey } from "@/src/config/fiDashboardRegistry";
import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import type { DashboardQuickActionKey, ResolvedDashboardQuickAction } from "@/src/lib/fiAdmin/dashboardQuickActionsConfig";

function on(access: ReadonlyMap<FiFeatureKey, boolean> | null, key: FiFeatureKey): boolean {
  if (!access) return true;
  return access.get(key) !== false;
}

function onAny(access: ReadonlyMap<FiFeatureKey, boolean> | null, keys: readonly FiFeatureKey[]): boolean {
  if (!access) return true;
  return keys.some((k) => access.get(k) !== false);
}

/** Returns false when the widget should be omitted from the home stack (Stage 2 visibility only). */
export function fiDashboardWidgetVisibleByFeatureAccess(
  widget: FiDashboardWidgetKey,
  access: ReadonlyMap<FiFeatureKey, boolean> | null
): boolean {
  if (!access) return true;
  switch (widget) {
    case "quick_actions":
      return on(access, "quick_actions");
    case "clinic_metrics":
      return onAny(access, ["dashboard", "analytics"]);
    case "operational_workspace":
      return onAny(access, ["dashboard", "calendar"]);
    case "surgery_pipeline":
      return onAny(access, ["surgery_pipeline", "cases"]);
    case "my_workspace":
      return on(access, "my_workspace");
    case "attention_centre":
      return on(access, "attention_centre");
    case "analytics_summary":
      return onAny(access, ["analytics", "dashboard"]);
    case "audit_summary":
      return on(access, "audit");
    case "imaging_summary":
      return onAny(access, ["imaging", "patient_twin"]);
    case "pathology_summary":
      return on(access, "pathology");
    case "crm_pipeline":
      return on(access, "crm");
    case "consultation_queue":
      return on(access, "consultations");
    case "procedure_day_queue":
      return onAny(access, ["procedure_day", "cases"]);
    case "follow_up_queue":
      return onAny(access, ["my_workspace", "crm", "attention_centre"]);
    case "imaging_uploads":
      return onAny(access, ["imaging", "patient_twin"]);
    case "booking_queue":
      return onAny(access, ["calendar", "dashboard"]);
    case "staff_intelligence_summary":
      return on(access, "dashboard") && on(access, "staff");
    case "clinical_intelligence_summary":
      return (
        on(access, "dashboard") &&
        onAny(access, ["patients", "cases", "pathology", "imaging", "audit"])
      );
    case "outcome_intelligence_summary":
      return (
        on(access, "dashboard") && onAny(access, ["analytics", "audit", "cases", "patient_twin"])
      );
    default:
      return true;
  }
}

function quickActionRequiredFeatures(key: DashboardQuickActionKey): FiFeatureKey[] {
  switch (key) {
    case "booking":
      return ["calendar"];
    case "patient":
      return ["patients"];
    case "lead":
      return ["crm"];
    case "consultation":
      return ["consultations"];
    case "case":
      return ["cases"];
    case "upload_images":
      return ["imaging", "patient_twin"];
    default:
      return [];
  }
}

/**
 * Hides quick actions that are enabled by RBAC flags but blocked by feature visibility.
 * Rows already disabled by CRM/bookings flags are kept.
 */
export function filterResolvedQuickActionsByFeatureAccess(
  items: readonly ResolvedDashboardQuickAction[],
  access: ReadonlyMap<FiFeatureKey, boolean> | null
): ResolvedDashboardQuickAction[] {
  if (!access) return [...items];
  return items.filter((item) => {
    if (!item.enabled) return true;
    const keys = quickActionRequiredFeatures(item.key);
    if (!keys.length) return true;
    return onAny(access, keys);
  });
}
