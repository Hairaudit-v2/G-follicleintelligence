/**
 * FI OS Workflow Engine v1 — shared types.
 * Normalized automation context for FI domain events (ingest, CRM, clinical mutators, etc.).
 */

/** ISO 8601 timestamp string when the logical event occurred. */
export type IsoDateTimeString = string;

/**
 * Normalized event envelope passed to workflow handlers.
 * Optional identifiers are omitted or undefined when unknown; callers may pass null and the engine coerces to undefined.
 */
export type WorkflowInvokeContext = {
  eventName: string;
  tenantId: string;
  clinicId?: string;
  patientId?: string;
  leadId?: string;
  caseId?: string;
  consultationId?: string;
  pathologyRequestId?: string;
  pathologyResultId?: string;
  bookingId?: string;
  actorUserId?: string;
  payload: Record<string, unknown>;
  occurredAt: IsoDateTimeString;
  /** Producer- or caller-supplied idempotency key (replay safety is future outbox / persistence). */
  idempotencyKey?: string;
  /**
   * When true, handlers must not mutate external systems or enqueue irreversible side effects.
   * The engine still invokes handlers so they can return structured "would do" results.
   * Defaults to false when omitted.
   */
  dryRun?: boolean;
};

/**
 * Shared shape for v1 placeholder handlers: returns `skipped` with a stable machine-readable plan.
 */
export function workflowPlaceholderSkipped(params: {
  automationId: string;
  eventually: readonly string[];
  ctx: WorkflowInvokeContext;
}): WorkflowHandlerResult {
  return {
    status: "skipped",
    summary: `Placeholder automation: ${params.automationId}`,
    detail: {
      automationId: params.automationId,
      eventually: [...params.eventually],
      dryRun: Boolean(params.ctx.dryRun),
      idempotencyKey: params.ctx.idempotencyKey,
      correlation: {
        eventName: params.ctx.eventName,
        tenantId: params.ctx.tenantId,
        clinicId: params.ctx.clinicId,
        patientId: params.ctx.patientId,
        leadId: params.ctx.leadId,
        caseId: params.ctx.caseId,
        consultationId: params.ctx.consultationId,
        pathologyRequestId: params.ctx.pathologyRequestId,
        pathologyResultId: params.ctx.pathologyResultId,
        bookingId: params.ctx.bookingId,
        actorUserId: params.ctx.actorUserId,
      },
    },
  };
}

export type WorkflowHandlerStatus = "skipped" | "success" | "failed";

/**
 * Structured outcome from a single handler invocation.
 * Use `status: "skipped"` for no-op, feature-flagged, or not-yet-implemented automation.
 */
export type WorkflowHandlerResult = {
  status: WorkflowHandlerStatus;
  /** Short human-readable summary for logs and future workflow run tables. */
  summary?: string;
  /** Arbitrary structured detail (planned actions, counts, correlation, dry-run notes). */
  detail?: Record<string, unknown>;
  /** Present when status is "failed" or when a non-throwing validation error is reported. */
  error?: {
    message: string;
    code?: string;
  };
};

export type WorkflowHandler = (
  ctx: WorkflowInvokeContext
) => Promise<WorkflowHandlerResult> | WorkflowHandlerResult;

export type WorkflowHandlerRegistration = {
  /** Stable unique id (used in dispatch results and idempotent registration replace). */
  id: string;
  /** Exact event name (trimmed); multiple handlers may share the same eventName. */
  eventName: string;
  handler: WorkflowHandler;
};

export type WorkflowHandlerRunRecord = {
  handlerId: string;
  status: WorkflowHandlerStatus;
  /** Handler return value when invocation completed without throw. */
  result?: WorkflowHandlerResult;
  /** Populated when the handler threw; dispatch still completes other handlers. */
  caughtError?: {
    name: string;
    message: string;
    stack?: string;
  };
  durationMs: number;
};

export type WorkflowDispatchResult = {
  eventName: string;
  tenantId: string;
  occurredAt: IsoDateTimeString;
  idempotencyKey?: string;
  dryRun: boolean;
  /**
   * When true, the engine did not invoke handlers because the same `idempotencyKey` was already
   * processed in this in-memory engine instance (ephemeral; not a substitute for DB outbox).
   */
  skippedDueToIdempotency: boolean;
  handlerResults: WorkflowHandlerRunRecord[];
};
