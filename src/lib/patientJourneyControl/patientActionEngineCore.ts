/**
 * FI-PATIENT-APP-P1 — patient action engine pure mappers (Action Centre SoR projection).
 */
import {
  PATIENT_ACTION_DEFAULT_TITLES,
  bucketForPatientAction,
  isPatientActionKind,
  type PatientActionBucket,
  type PatientActionDeepLinkKey,
  type PatientActionKind,
  type PatientActionStatus,
} from "./patientJourneyControlContracts";

export type PatientActionCreateInput = {
  kind: PatientActionKind;
  status?: PatientActionStatus;
  priority?: number;
  dueAt?: string | null;
  title?: string;
  body?: string | null;
  deepLinkKey?: PatientActionDeepLinkKey | string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  milestoneKey?: string | null;
  createdByEvent?: string | null;
  dedupeKey?: string | null;
  metadata?: Record<string, unknown>;
};

export type PatientActionRowLike = {
  id: string;
  kind: string;
  status: string;
  priority: number;
  due_at?: string | null;
  dueAt?: string | null;
  completed_at?: string | null;
  completedAt?: string | null;
  title: string;
  body?: string | null;
  deep_link_key?: string | null;
  deepLinkKey?: string | null;
  resource_type?: string | null;
  resourceType?: string | null;
  resource_id?: string | null;
  resourceId?: string | null;
  milestone_key?: string | null;
  milestoneKey?: string | null;
};

export type PatientGatewayActionItem = {
  id: string;
  kind: PatientActionKind | string;
  status: PatientActionStatus | string;
  priority: number;
  dueAt: string | null;
  completedAt: string | null;
  title: string;
  body: string | null;
  deepLinkKey: string | null;
  resourceType: string | null;
  resourceId: string | null;
  milestoneKey: string | null;
  bucket: PatientActionBucket;
};

export type PatientGatewayActionsResponse = {
  ok: true;
  actionRequired: PatientGatewayActionItem[];
  waitingOnClinic: PatientGatewayActionItem[];
  upcoming: PatientGatewayActionItem[];
  recentlyCompleted: PatientGatewayActionItem[];
  primaryAction: PatientGatewayActionItem | null;
};

export function defaultPriorityForKind(kind: PatientActionKind | string): number {
  switch (kind) {
    case "accept_quote":
    case "review_quote":
      return 100;
    case "pay_deposit":
      return 90;
    case "complete_blood_tests":
      return 80;
    case "sign_document":
      return 70;
    case "upload_medications":
    case "confirm_contacts":
    case "upload_preop_photos":
      return 60;
    case "attend_appointment":
    case "upload_images":
    case "request_review":
      return 50;
    case "await_treatment_plan":
    case "await_pathology_review":
    case "await_surgery_confirmation":
    case "await_medical_clearance":
      return 20;
    case "none":
    default:
      return 10;
  }
}

export function defaultDeepLinkForKind(
  kind: PatientActionKind | string
): PatientActionDeepLinkKey {
  switch (kind) {
    case "review_quote":
    case "accept_quote":
      return "quote";
    case "pay_deposit":
      return "deposit";
    case "complete_blood_tests":
    case "await_pathology_review":
    case "await_medical_clearance":
      return "pathology";
    case "sign_document":
    case "upload_medications":
    case "confirm_contacts":
      return "documents";
    case "upload_preop_photos":
    case "upload_images":
      return "progress";
    case "attend_appointment":
      return "appointments";
    case "await_treatment_plan":
    case "await_surgery_confirmation":
      return "actions";
    case "request_review":
      return "messages";
    default:
      return "actions";
  }
}

export function buildActionCreateInput(
  partial: PatientActionCreateInput
): Required<
  Pick<
    PatientActionCreateInput,
    | "kind"
    | "status"
    | "priority"
    | "dueAt"
    | "title"
    | "body"
    | "deepLinkKey"
    | "resourceType"
    | "resourceId"
    | "milestoneKey"
    | "createdByEvent"
    | "dedupeKey"
    | "metadata"
  >
> {
  const kind = isPatientActionKind(partial.kind) ? partial.kind : (partial.kind as PatientActionKind);
  return {
    kind,
    status: partial.status ?? "open",
    priority: partial.priority ?? defaultPriorityForKind(kind),
    dueAt: partial.dueAt ?? null,
    title: partial.title?.trim() || PATIENT_ACTION_DEFAULT_TITLES[kind] || String(kind),
    body: partial.body ?? null,
    deepLinkKey: partial.deepLinkKey ?? defaultDeepLinkForKind(kind),
    resourceType: partial.resourceType ?? null,
    resourceId: partial.resourceId ?? null,
    milestoneKey: partial.milestoneKey ?? null,
    createdByEvent: partial.createdByEvent ?? null,
    dedupeKey: partial.dedupeKey ?? null,
    metadata: partial.metadata ?? {},
  };
}

export function toGatewayActionItem(
  row: PatientActionRowLike,
  nowIso?: string
): PatientGatewayActionItem {
  const dueAt = row.dueAt ?? row.due_at ?? null;
  const completedAt = row.completedAt ?? row.completed_at ?? null;
  const status = String(row.status ?? "open");
  return {
    id: String(row.id),
    kind: String(row.kind),
    status,
    priority: Number(row.priority) || 0,
    dueAt,
    completedAt,
    title: String(row.title ?? ""),
    body: row.body ?? null,
    deepLinkKey: row.deepLinkKey ?? row.deep_link_key ?? null,
    resourceType: row.resourceType ?? row.resource_type ?? null,
    resourceId: row.resourceId ?? row.resource_id ?? null,
    milestoneKey: row.milestoneKey ?? row.milestone_key ?? null,
    bucket: bucketForPatientAction({ status, dueAt, completedAt, nowIso }),
  };
}

function byPriorityThenDue(a: PatientGatewayActionItem, b: PatientGatewayActionItem): number {
  if (b.priority !== a.priority) return b.priority - a.priority;
  const ad = a.dueAt ? Date.parse(a.dueAt) : Number.POSITIVE_INFINITY;
  const bd = b.dueAt ? Date.parse(b.dueAt) : Number.POSITIVE_INFINITY;
  return ad - bd;
}

export function buildPatientActionsGatewayResponse(
  rows: readonly PatientActionRowLike[],
  nowIso?: string
): PatientGatewayActionsResponse {
  const items = rows.map((r) => toGatewayActionItem(r, nowIso));
  const actionRequired = items.filter((i) => i.bucket === "action_required").sort(byPriorityThenDue);
  const waitingOnClinic = items
    .filter((i) => i.bucket === "waiting_on_clinic")
    .sort(byPriorityThenDue);
  const upcoming = items.filter((i) => i.bucket === "upcoming").sort(byPriorityThenDue);
  const recentlyCompleted = items
    .filter((i) => i.bucket === "recently_completed")
    .sort((a, b) => {
      const ac = a.completedAt ? Date.parse(a.completedAt) : 0;
      const bc = b.completedAt ? Date.parse(b.completedAt) : 0;
      return bc - ac;
    })
    .slice(0, 20);

  const primaryAction =
    actionRequired[0] ??
    upcoming[0] ??
    waitingOnClinic[0] ??
    null;

  return {
    ok: true,
    actionRequired,
    waitingOnClinic,
    upcoming,
    recentlyCompleted,
    primaryAction,
  };
}

/** Map action kind → gateway nextAction.type (extended in P1). */
export function nextActionTypeFromKind(
  kind: string | null | undefined
):
  | "review_quote"
  | "pay_deposit"
  | "complete_blood_tests"
  | "sign_document"
  | "attend_appointment"
  | "upload_images"
  | "request_review"
  | "await_clinic"
  | "none" {
  switch (kind) {
    case "review_quote":
    case "accept_quote":
      return "review_quote";
    case "pay_deposit":
      return "pay_deposit";
    case "complete_blood_tests":
      return "complete_blood_tests";
    case "sign_document":
      return "sign_document";
    case "attend_appointment":
      return "attend_appointment";
    case "upload_images":
    case "upload_preop_photos":
      return "upload_images";
    case "request_review":
      return "request_review";
    case "await_treatment_plan":
    case "await_pathology_review":
    case "await_surgery_confirmation":
    case "await_medical_clearance":
      return "await_clinic";
    case "none":
    case null:
    case undefined:
      return "none";
    default:
      return "await_clinic";
  }
}

const FORBIDDEN_ACTION_FRAGMENTS = [
  "internalNote",
  "staffHref",
  "fi-admin",
  "createdByEvent",
  "completedByEvent",
  "dedupeKey",
  "metadata",
  "abnormal",
  "aiInterpretation",
] as const;

export function actionPayloadExposesInternalFields(payload: unknown): boolean {
  const serialized = JSON.stringify(payload ?? null);
  if (!serialized) return false;
  return FORBIDDEN_ACTION_FRAGMENTS.some((f) => serialized.includes(f));
}