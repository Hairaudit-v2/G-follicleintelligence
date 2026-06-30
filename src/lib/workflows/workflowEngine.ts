import type {
  WorkflowDispatchResult,
  WorkflowHandlerRegistration,
  WorkflowHandlerResult,
  WorkflowHandlerRunRecord,
  WorkflowHandlerStatus,
  WorkflowInvokeContext,
} from "./workflowTypes";

function trimOrUndefined(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const t = String(value).trim();
  return t.length ? t : undefined;
}

function normalizeContext(ctx: WorkflowInvokeContext): WorkflowInvokeContext {
  return {
    eventName: ctx.eventName.trim(),
    tenantId: ctx.tenantId.trim(),
    clinicId: trimOrUndefined(ctx.clinicId),
    patientId: trimOrUndefined(ctx.patientId),
    leadId: trimOrUndefined(ctx.leadId),
    caseId: trimOrUndefined(ctx.caseId),
    consultationId: trimOrUndefined(ctx.consultationId),
    pathologyRequestId: trimOrUndefined(ctx.pathologyRequestId),
    pathologyResultId: trimOrUndefined(ctx.pathologyResultId),
    bookingId: trimOrUndefined(ctx.bookingId),
    actorUserId: trimOrUndefined(ctx.actorUserId),
    payload:
      ctx.payload && typeof ctx.payload === "object" && !Array.isArray(ctx.payload)
        ? ctx.payload
        : {},
    occurredAt: String(ctx.occurredAt).trim(),
    idempotencyKey: trimOrUndefined(ctx.idempotencyKey),
    dryRun: Boolean(ctx.dryRun),
  };
}

function normalizeHandlerResult(raw: WorkflowHandlerResult): WorkflowHandlerResult {
  if (!raw || typeof raw !== "object") {
    return {
      status: "failed",
      summary: "Invalid handler result",
      error: {
        message: "Handler must return an object-shaped WorkflowHandlerResult.",
        code: "invalid_result",
      },
    };
  }
  const status = raw.status;
  if (status !== "skipped" && status !== "success" && status !== "failed") {
    return {
      status: "failed",
      summary: "Invalid handler status",
      error: {
        message: 'Handler result.status must be "skipped", "success", or "failed".',
        code: "invalid_status",
      },
    };
  }
  return { ...raw, status };
}

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

export type WorkflowEngineOptions = {
  /**
   * When true (default), if the same `idempotencyKey` is seen twice on this engine instance,
   * the second dispatch returns immediately with `skippedDueToIdempotency` and no handler runs.
   * This is process-local only and is intended for tests / single-flight guardrails until an outbox exists.
   */
  ephemeralIdempotency?: boolean;
};

/**
 * In-process registry and dispatcher for workflow handlers.
 * Multiple handlers may register for the same `eventName`; all matching handlers run per dispatch (concurrently).
 */
export class WorkflowEngine {
  private readonly byEvent = new Map<string, WorkflowHandlerRegistration[]>();
  private readonly idIndex = new Map<string, { eventName: string }>();
  private readonly processedIdempotencyKeys = new Set<string>();
  private readonly ephemeralIdempotency: boolean;

  constructor(options?: WorkflowEngineOptions) {
    this.ephemeralIdempotency = options?.ephemeralIdempotency !== false;
  }

  /**
   * Register a handler. Duplicate `id` replaces the prior registration with the same id.
   * Returns an unsubscribe function.
   */
  register(reg: WorkflowHandlerRegistration): () => void {
    const eventName = reg.eventName.trim();
    if (!eventName) throw new Error("WorkflowHandlerRegistration.eventName is required.");
    const id = reg.id.trim();
    if (!id) throw new Error("WorkflowHandlerRegistration.id is required.");

    this.unregister(id);

    const list = this.byEvent.get(eventName) ?? [];
    list.push({ ...reg, eventName, id });
    this.byEvent.set(eventName, list);
    this.idIndex.set(id, { eventName });

    return () => this.unregister(id);
  }

  unregister(handlerId: string): void {
    const hid = handlerId.trim();
    if (!hid) return;
    const ref = this.idIndex.get(hid);
    if (!ref) return;

    const list = this.byEvent.get(ref.eventName);
    if (!list) {
      this.idIndex.delete(hid);
      return;
    }

    const idx = list.findIndex((r) => r.id === hid);
    if (idx === -1) {
      this.idIndex.delete(hid);
      return;
    }
    list.splice(idx, 1);
    if (list.length === 0) {
      this.byEvent.delete(ref.eventName);
    } else {
      this.byEvent.set(ref.eventName, list);
    }
    this.idIndex.delete(hid);
  }

  /** Handlers registered for an event (trimmed key); does not execute. */
  listHandlers(eventName: string): readonly WorkflowHandlerRegistration[] {
    const key = eventName.trim();
    return this.byEvent.get(key) ?? [];
  }

  /**
   * Run all handlers registered for `ctx.eventName`.
   * Errors from individual handlers are captured per handler; dispatch does not throw for handler failures.
   */
  async dispatch(rawCtx: WorkflowInvokeContext): Promise<WorkflowDispatchResult> {
    const ctx = normalizeContext(rawCtx);
    const { eventName, tenantId, occurredAt, idempotencyKey } = ctx;
    const dryRun = ctx.dryRun ?? false;

    if (!eventName) throw new Error("WorkflowInvokeContext.eventName is required.");
    if (!tenantId) throw new Error("WorkflowInvokeContext.tenantId is required.");
    if (!occurredAt) throw new Error("WorkflowInvokeContext.occurredAt is required.");

    if (
      this.ephemeralIdempotency &&
      idempotencyKey &&
      this.processedIdempotencyKeys.has(idempotencyKey)
    ) {
      return {
        eventName,
        tenantId,
        occurredAt,
        idempotencyKey,
        dryRun,
        skippedDueToIdempotency: true,
        handlerResults: [],
      };
    }

    const invokeCtx: WorkflowInvokeContext = { ...ctx, dryRun };
    const matched = this.byEvent.get(eventName) ?? [];

    const settled = await Promise.allSettled(
      matched.map(async (r) => {
        const start = nowMs();
        try {
          const rawResult = await Promise.resolve(r.handler(invokeCtx));
          const result = normalizeHandlerResult(rawResult);
          const durationMs = Math.max(0, Math.round(nowMs() - start));
          const status: WorkflowHandlerStatus = result.status;
          const record: WorkflowHandlerRunRecord = {
            handlerId: r.id,
            status,
            result,
            durationMs,
          };
          return record;
        } catch (reason: unknown) {
          const durationMs = Math.max(0, Math.round(nowMs() - start));
          const err = reason instanceof Error ? reason : new Error(String(reason));
          return {
            handlerId: r.id,
            status: "failed" as const,
            durationMs,
            caughtError: {
              name: err.name,
              message: err.message,
              stack: err.stack,
            },
          };
        }
      })
    );

    const handlerResults: WorkflowHandlerRunRecord[] = settled.map((s, i) => {
      if (s.status === "fulfilled") {
        return s.value;
      }
      const reg = matched[i];
      const reason = s.reason instanceof Error ? s.reason : new Error(String(s.reason));
      return {
        handlerId: reg.id,
        status: "failed" as const,
        durationMs: 0,
        caughtError: {
          name: reason.name,
          message: reason.message,
          stack: reason.stack,
        },
      };
    });

    if (this.ephemeralIdempotency && idempotencyKey) {
      this.processedIdempotencyKeys.add(idempotencyKey);
    }

    return {
      eventName,
      tenantId,
      occurredAt,
      idempotencyKey,
      dryRun,
      skippedDueToIdempotency: false,
      handlerResults,
    };
  }

  /** Clear registrations and ephemeral idempotency keys (tests). */
  clear(): void {
    this.byEvent.clear();
    this.idIndex.clear();
    this.processedIdempotencyKeys.clear();
  }

  /** Clear only ephemeral idempotency memory (tests). */
  clearIdempotencyMemory(): void {
    this.processedIdempotencyKeys.clear();
  }
}

/** Default process-wide engine instance. */
export const workflowEngine = new WorkflowEngine();
