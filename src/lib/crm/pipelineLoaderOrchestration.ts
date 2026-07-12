/**
 * FI-UX-REBUILD-1 S4.4 — Pipeline loader orchestration (DI, testable without server-only).
 */

import { buildPipelinePresentation } from "@/src/lib/crm/pipelinePresentation";
import type {
  PipelineCommunicationHintInput,
  PipelineConsultationInput,
  PipelinePresentation,
  PipelineReminderInput,
  PipelineTaskInput,
} from "@/src/lib/crm/pipelinePresentation.types";
import {
  normalizePipelineSearchParams,
  resolvePipelinePermissionsFromSession,
  toPipelineMoveStageDefinitionsForClient,
  toPipelinePresentationPermissions,
} from "@/src/lib/crm/pipelineLoader";
import type {
  PipelineFullPayload,
  PipelineShellPayload,
} from "@/src/lib/crm/pipelineLoader.types";
import type {
  CrmKanbanLeadCard,
  FiCrmPipelineStageRow,
} from "@/src/lib/crm/types";

export type PipelineLoaderTiming = {
  tenantId: string;
  leadCount: number;
  taskCount: number;
  bookingCount: number;
  reminderCount: number;
  communicationCount: number;
  boardLoadMs: number;
  stageLoadMs: number;
  taskBatchMs: number;
  communicationBatchMs: number;
  consultationBatchMs: number;
  reminderBatchMs: number;
  presentationBuildMs: number;
  totalMs: number;
  warnings: string[];
};

export type PipelineSessionContext = {
  session: {
    authUserId: string;
    fiUserId: string | null;
    role: string;
    canUseClinicFeatures: boolean;
  };
  bookingsOperator: boolean;
  /**
   * Platform-admin full session with a resolved membership proxy for this tenant.
   * Required for canCreateEnquiry when the operator role alone would be read-only.
   */
  validPlatformAdminTenantProxy?: boolean;
};

export type CrmShellLeadsBoardIndexResult = {
  cards: CrmKanbanLeadCard[];
  total: number;
  truncated?: boolean;
  query?: unknown;
};

export type PipelineLoaderDeps = {
  getSessionContext?: (tenantId: string) => Promise<PipelineSessionContext>;
  loadBoardIndex?: (
    tenantId: string,
    searchParams: Record<string, string | string[] | undefined>
  ) => Promise<CrmShellLeadsBoardIndexResult>;
  loadStages?: (tenantId: string) => Promise<FiCrmPipelineStageRow[]>;
  loadTasksByLeadIds?: (
    tenantId: string,
    leadIds: readonly string[]
  ) => Promise<Map<string, PipelineTaskInput[]>>;
  loadCommunicationHintsByLeadIds?: (
    tenantId: string,
    leadIds: readonly string[]
  ) => Promise<Map<string, PipelineCommunicationHintInput[]>>;
  loadConsultationBookingsByLeadIds?: (
    tenantId: string,
    leadIds: readonly string[]
  ) => Promise<Map<string, PipelineConsultationInput[]>>;
  loadReminderJobsByLeadIds?: (
    tenantId: string,
    leadIds: readonly string[]
  ) => Promise<Map<string, PipelineReminderInput[]>>;
  nowMs?: () => number;
  onTiming?: (label: string, timing: Partial<PipelineLoaderTiming>) => void;
};

function pipelineBasePath(tenantId: string): string {
  return `/fi-admin/${tenantId.trim()}`;
}

function permissionsForSession(ctx: PipelineSessionContext) {
  return resolvePipelinePermissionsFromSession({
    hasCrmShellAccess: true,
    userRole: ctx.session.role,
    canUseClinicFeatures: ctx.session.canUseClinicFeatures,
    bookingsOperator: ctx.bookingsOperator,
    validPlatformAdminTenantProxy: Boolean(ctx.validPlatformAdminTenantProxy),
    onPermissionDiagnostic: (row) => {
      if (process.env.PIPELINE_PERMISSION_DIAG !== "1") return;
      console.info(
        "[pipeline-permission]",
        JSON.stringify({
          sessionKind: row.validPlatformAdminTenantProxy
            ? "platform_admin_tenant_proxy"
            : "tenant_operator",
          resolvedRole: row.userRole,
          isPlatformAdminProxy: row.validPlatformAdminTenantProxy,
          canUseClinicFeatures: row.canUseClinicFeatures,
          canMutate: row.canMutate,
          canCreateEnquiry: row.canCreateEnquiry,
          denialReasonCode: row.denialReasonCode,
        })
      );
    },
  });
}

type BoardWindow = {
  cards: CrmKanbanLeadCard[];
  total: number;
  leadIds: string[];
};

async function loadCanonicalBoardWindow(
  tenantId: string,
  searchParams: Record<string, string | string[] | undefined>,
  loadBoardIndex: NonNullable<PipelineLoaderDeps["loadBoardIndex"]>
): Promise<BoardWindow> {
  const normalized = normalizePipelineSearchParams(searchParams);
  const { cards, total } = await loadBoardIndex(tenantId, normalized);
  const leadIds = cards.map((c) => c.lead.id);
  return { cards, total, leadIds };
}

export async function loadPipelineShellPayload(
  tenantId: string,
  searchParams: Record<string, string | string[] | undefined>,
  deps: PipelineLoaderDeps
): Promise<PipelineShellPayload> {
  const started = Date.now();
  const warnings: string[] = [];
  const getSessionContext = deps.getSessionContext;
  const loadBoardIndex = deps.loadBoardIndex;
  const loadStages = deps.loadStages;
  const nowMs = deps.nowMs?.() ?? Date.now();

  if (!getSessionContext || !loadBoardIndex || !loadStages) {
    throw new Error("Pipeline loader deps incomplete");
  }

  const { session, bookingsOperator } = await getSessionContext(tenantId);
  const permissions = permissionsForSession({ session, bookingsOperator });

  const boardStart = Date.now();
  const window = await loadCanonicalBoardWindow(tenantId, searchParams, loadBoardIndex);
  const boardLoadMs = Date.now() - boardStart;

  const stageStart = Date.now();
  const stageRows = await loadStages(tenantId);
  const tenantStages = toPipelineMoveStageDefinitionsForClient(stageRows);
  const stageLoadMs = Date.now() - stageStart;

  const presStart = Date.now();
  const presentation = buildPipelinePresentation({
    leads: window.cards,
    nowMs,
    base: pipelineBasePath(tenantId),
    permissions: toPipelinePresentationPermissions(permissions),
    sourceTotal: window.total,
  });
  const presentationBuildMs = Date.now() - presStart;

  deps.onTiming?.("shell", {
    tenantId: tenantId.trim(),
    leadCount: window.leadIds.length,
    boardLoadMs,
    stageLoadMs,
    presentationBuildMs,
    totalMs: Date.now() - started,
    warnings,
  });

  return {
    presentation,
    tenantStages,
    permissions,
    currentUserId: session.fiUserId,
    generatedAt: new Date(nowMs).toISOString(),
  };
}

export type PipelineFullLoadResult = PipelineFullPayload & {
  identityOk: boolean;
  warnings: string[];
};

export async function loadPipelineFullPayload(
  tenantId: string,
  searchParams: Record<string, string | string[] | undefined>,
  deps: PipelineLoaderDeps
): Promise<PipelineFullLoadResult> {
  const started = Date.now();
  const warnings: string[] = [];
  const getSessionContext = deps.getSessionContext;
  const loadBoardIndex = deps.loadBoardIndex;
  const loadTasks = deps.loadTasksByLeadIds;
  const loadComms = deps.loadCommunicationHintsByLeadIds;
  const loadConsults = deps.loadConsultationBookingsByLeadIds;
  const loadReminders = deps.loadReminderJobsByLeadIds;
  const nowMs = deps.nowMs?.() ?? Date.now();

  if (!getSessionContext || !loadBoardIndex || !loadTasks || !loadComms || !loadConsults || !loadReminders) {
    throw new Error("Pipeline loader deps incomplete");
  }

  const { session, bookingsOperator } = await getSessionContext(tenantId);
  const permissions = permissionsForSession({ session, bookingsOperator });

  const boardStart = Date.now();
  const window = await loadCanonicalBoardWindow(tenantId, searchParams, loadBoardIndex);
  const boardLoadMs = Date.now() - boardStart;

  let tasksByLeadId = new Map<string, PipelineTaskInput[]>();
  let communicationsByLeadId = new Map<string, PipelineCommunicationHintInput[]>();
  let consultationsByLeadId = new Map<string, PipelineConsultationInput[]>();
  let reminderJobsByLeadId = new Map<string, PipelineReminderInput[]>();

  let taskBatchMs = 0;
  let communicationBatchMs = 0;
  let consultationBatchMs = 0;
  let reminderBatchMs = 0;

  const t0 = Date.now();
  try {
    tasksByLeadId = await loadTasks(tenantId, window.leadIds);
  } catch {
    warnings.push("task_batch_failed");
    tasksByLeadId = new Map();
  }
  taskBatchMs = Date.now() - t0;

  const c0 = Date.now();
  try {
    communicationsByLeadId = await loadComms(tenantId, window.leadIds);
  } catch {
    warnings.push("communication_batch_failed");
    communicationsByLeadId = new Map();
  }
  communicationBatchMs = Date.now() - c0;

  const b0 = Date.now();
  try {
    consultationsByLeadId = await loadConsults(tenantId, window.leadIds);
  } catch {
    warnings.push("consultation_batch_failed");
    consultationsByLeadId = new Map();
  }
  consultationBatchMs = Date.now() - b0;

  const r0 = Date.now();
  try {
    reminderJobsByLeadId = await loadReminders(tenantId, window.leadIds);
  } catch {
    warnings.push("reminder_batch_failed");
    reminderJobsByLeadId = new Map();
  }
  reminderBatchMs = Date.now() - r0;

  let taskCount = 0;
  for (const tasks of tasksByLeadId.values()) taskCount += tasks.length;
  let bookingCount = 0;
  for (const bookings of consultationsByLeadId.values()) bookingCount += bookings.length;
  let reminderCount = 0;
  for (const reminders of reminderJobsByLeadId.values()) reminderCount += reminders.length;
  let communicationCount = 0;
  for (const comms of communicationsByLeadId.values()) communicationCount += comms.length;

  const presStart = Date.now();
  const presentation = buildPipelinePresentation({
    leads: window.cards,
    tasksByLeadId,
    communicationsByLeadId,
    consultationsByLeadId,
    reminderJobsByLeadId,
    nowMs,
    base: pipelineBasePath(tenantId),
    permissions: toPipelinePresentationPermissions(permissions),
    sourceTotal: window.total,
  });
  const presentationBuildMs = Date.now() - presStart;

  deps.onTiming?.("full", {
    tenantId: tenantId.trim(),
    leadCount: window.leadIds.length,
    taskCount,
    bookingCount,
    reminderCount,
    communicationCount,
    boardLoadMs,
    taskBatchMs,
    communicationBatchMs,
    consultationBatchMs,
    reminderBatchMs,
    presentationBuildMs,
    totalMs: Date.now() - started,
    warnings,
  });

  return {
    presentation,
    generatedAt: new Date(nowMs).toISOString(),
    identityOk: presentation.loadTier === "full",
    warnings,
  };
}

export async function refreshPipelinePresentation(
  tenantId: string,
  searchParams: Record<string, string | string[] | undefined>,
  deps: PipelineLoaderDeps
): Promise<PipelinePresentation> {
  const full = await loadPipelineFullPayload(tenantId, searchParams, deps);
  return full.presentation;
}

export async function loadPipelineDualRunHarnessData(
  tenantId: string,
  searchParams: Record<string, string | string[] | undefined>,
  deps: PipelineLoaderDeps
): Promise<{
  legacyCards: CrmKanbanLeadCard[];
  legacyStages: FiCrmPipelineStageRow[];
  shell: PipelinePresentation;
  full: PipelinePresentation;
  sourceTotal: number;
}> {
  const harnessSession = async () => ({
    session: {
      authUserId: "harness",
      fiUserId: null as string | null,
      role: "fi_admin",
      canUseClinicFeatures: true,
    },
    bookingsOperator: true,
  });

  const merged: PipelineLoaderDeps = {
    ...deps,
    getSessionContext: deps.getSessionContext ?? harnessSession,
  };

  const shellPayload = await loadPipelineShellPayload(tenantId, searchParams, merged);
  const fullPayload = await loadPipelineFullPayload(tenantId, searchParams, merged);

  if (!merged.loadBoardIndex || !merged.loadStages) {
    throw new Error("Pipeline harness deps incomplete");
  }

  const normalized = normalizePipelineSearchParams(searchParams);
  const board = await merged.loadBoardIndex(tenantId, normalized);
  const stages = await merged.loadStages(tenantId);

  return {
    legacyCards: board.cards,
    legacyStages: stages,
    shell: shellPayload.presentation,
    full: fullPayload.presentation,
    sourceTotal: board.total,
  };
}
