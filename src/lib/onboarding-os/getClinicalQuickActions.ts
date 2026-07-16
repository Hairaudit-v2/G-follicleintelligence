/**
 * Clinical Quick Actions for Clinic guide (doctor / nurse / consultant).
 * Operational deep links only — never clinical advice.
 */

import { GUIDED_ASSIST_QUICK_ACTIONS } from "./guidedAssistCatalog";
import { conditionMatches, timeOfDayMatches } from "./getContextualTips";
import { isClinicalTodayRole } from "./guidedAssistRoleMode";
import type {
  GuidedAssistClinicStats,
  GuidedAssistQuickActionDefinition,
  GuidedAssistQuickActionView,
  GuidedAssistTimeOfDay,
  GuidedAssistTodayRoleKey,
} from "./guidedAssistTypes";
import { GUIDED_ASSIST_AREA_LABELS } from "./guidedAssistTypes";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Extract patient id from route suffixes like `patients/{id}` or `patients/{id}/imaging`. */
export function extractPatientIdFromPageKey(pageKey: string): string | null {
  const parts = pageKey.trim().split("/").filter(Boolean);
  const idx = parts.findIndex((p) => p === "patients");
  if (idx < 0 || idx + 1 >= parts.length) return null;
  const candidate = parts[idx + 1]!.trim();
  if (!candidate || candidate === "new" || candidate === "returning") return null;
  if (UUID_RE.test(candidate) || candidate.length >= 8) return candidate;
  return null;
}

function actionMatchesRole(
  action: GuidedAssistQuickActionDefinition,
  role: GuidedAssistTodayRoleKey
): boolean {
  if (!action.roles || action.roles.length === 0) return true;
  if (action.roles.includes("all")) return true;
  return action.roles.includes(role);
}

function actionMatchesPage(
  action: GuidedAssistQuickActionDefinition,
  pageKey: string
): boolean {
  if (action.pageKey == null) return true;
  const tipPage = action.pageKey.trim();
  const raw = pageKey.trim();
  if (tipPage === "") {
    return raw === "" || raw === "dashboard";
  }
  if (action.pageKeyPrefix) {
    return raw === tipPage || raw.startsWith(`${tipPage}/`);
  }
  return raw === tipPage;
}

/**
 * Resolve 1–3 clinical quick actions for the session payload.
 * Empty when role is non-clinical.
 */
export function getClinicalQuickActions(input: {
  tenantId: string;
  todayRole: GuidedAssistTodayRoleKey | null;
  pageKey: string;
  stats?: GuidedAssistClinicStats | null;
  timeOfDay?: GuidedAssistTimeOfDay | null;
  maxActions?: number;
}): GuidedAssistQuickActionView[] {
  const role = input.todayRole;
  if (!role || !isClinicalTodayRole(role)) return [];

  const maxActions = input.maxActions ?? 3;
  const patientId = extractPatientIdFromPageKey(input.pageKey);
  const tenantBase = `/fi-admin/${input.tenantId.trim()}`;
  const stats = input.stats ?? {
    openLeadCount: 0,
    todayBookingCount: 0,
    openTaskCount: 0,
    openSurgeryCaseCount: 0,
    paymentRecordCount: 0,
    hourLocal: null,
  };
  const timeOfDay = input.timeOfDay ?? "any";

  const eligible = GUIDED_ASSIST_QUICK_ACTIONS.filter((action) => {
    if (!actionMatchesRole(action, role)) return false;
    if (!actionMatchesPage(action, input.pageKey)) return false;
    if (action.requiresPatientContext && !patientId) return false;
    if (action.hrefSuffix.includes("{{patientId}}") && !patientId) return false;
    if (action.contextTriggers) {
      if (!timeOfDayMatches(action.contextTriggers.timeOfDay, timeOfDay)) return false;
      if (!conditionMatches(action.contextTriggers.condition, stats)) return false;
    }
    return true;
  }).sort((a, b) => a.priority - b.priority || a.code.localeCompare(b.code));

  // Prefer patient-context actions when available, but keep diversity (max 3).
  const withPatient = eligible.filter((a) => a.requiresPatientContext);
  const without = eligible.filter((a) => !a.requiresPatientContext);
  const ordered = patientId
    ? [...withPatient, ...without]
    : without;

  const seen = new Set<string>();
  const out: GuidedAssistQuickActionView[] = [];
  for (const action of ordered) {
    if (seen.has(action.code)) continue;
    seen.add(action.code);

    let suffix = action.hrefSuffix.replace(/^\/+/, "");
    if (patientId) {
      suffix = suffix.replace(/\{\{patientId\}\}/g, patientId);
    }
    if (suffix.includes("{{patientId}}")) continue;

    out.push({
      code: action.code,
      area: action.area,
      areaLabel: GUIDED_ASSIST_AREA_LABELS[action.area],
      label: action.label,
      description: action.description,
      href: `${tenantBase}/${suffix}`,
      requiresPatientContext: Boolean(action.requiresPatientContext),
      checklist: action.checklist?.length ? [...action.checklist] : null,
    });
    if (out.length >= maxActions) break;
  }
  return out;
}
