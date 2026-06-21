/**
 * ImagingOS — Live AI execution adapter (Phase IM-12).
 * Feature-flag protected stub provider execution for low-risk tasks only.
 * No real API calls, image fetching, or persistence.
 */

import {
  buildAiVisionAuditLogContract,
  IMAGING_AI_OUTPUT_CONTRACT_VERSION,
  IMAGING_AI_VISION_TASK_REQUIREMENTS,
  type ImagingOsAiVisionAuditLogContract,
  type ImagingOsAiVisionModelOutputContract,
  type ImagingOsAiVisionRequestContract,
  type ImagingOsAiVisionTaskType,
  validateAiVisionModelOutputContract,
} from "./aiVision";
import { publishImagingEvent } from "@/src/lib/analytics-os/analyticsModulePublishers";

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

export type ImagingOsAiProviderType = "openai" | "anthropic" | "local" | "stub";

export type ImagingOsAiFeatureFlags = {
  ai_enabled: boolean;
  allow_low_risk_tasks: boolean;
  allow_medium_risk_tasks: boolean;
  allow_high_risk_tasks: boolean;
  allow_clinical_review_tasks: boolean;
  dry_run_mode: boolean;
  provider: ImagingOsAiProviderType;
};

export const DEFAULT_IMAGING_AI_FLAGS: ImagingOsAiFeatureFlags = {
  ai_enabled: false,
  allow_low_risk_tasks: true,
  allow_medium_risk_tasks: false,
  allow_high_risk_tasks: false,
  allow_clinical_review_tasks: false,
  dry_run_mode: true,
  provider: "stub",
};

// ---------------------------------------------------------------------------
// IM-12 safe task restriction
// ---------------------------------------------------------------------------

export const ALLOWED_IM12_TASKS = [
  "image_category_classification",
  "image_quality_assessment",
  "protocol_gap_detection",
] as const;

export type ImagingOsIm12AllowedTaskType = (typeof ALLOWED_IM12_TASKS)[number];

const ALLOWED_IM12_TASK_SET = new Set<string>(ALLOWED_IM12_TASKS);

export function isIm12AllowedTask(
  taskType: ImagingOsAiVisionTaskType
): taskType is ImagingOsIm12AllowedTaskType {
  return ALLOWED_IM12_TASK_SET.has(taskType);
}

// ---------------------------------------------------------------------------
// Execution permission
// ---------------------------------------------------------------------------

export type CanExecuteAiVisionTaskInput = {
  task_type: ImagingOsAiVisionTaskType;
  flags: ImagingOsAiFeatureFlags;
};

export type CanExecuteAiVisionTaskResult = {
  allowed: boolean;
  reason?: string;
};

/** Evaluate whether feature flags permit executing an AI vision task (pure). */
export function canExecuteAiVisionTask(
  input: CanExecuteAiVisionTaskInput
): CanExecuteAiVisionTaskResult {
  const { task_type, flags } = input;

  if (!flags.ai_enabled) {
    return { allowed: false, reason: "AI execution is disabled (ai_enabled=false)." };
  }

  const requirements = IMAGING_AI_VISION_TASK_REQUIREMENTS[task_type as Exclude<
    ImagingOsAiVisionTaskType,
    "unknown"
  >];

  if (!requirements) {
    return { allowed: false, reason: `Unknown or unsupported task type: ${task_type}.` };
  }

  const { risk_level } = requirements;

  if (risk_level === "low" && !flags.allow_low_risk_tasks) {
    return { allowed: false, reason: "Low-risk AI tasks are not permitted." };
  }

  if (risk_level === "medium" && !flags.allow_medium_risk_tasks) {
    return { allowed: false, reason: "Medium-risk AI tasks are not permitted." };
  }

  if (risk_level === "high" && !flags.allow_high_risk_tasks) {
    return { allowed: false, reason: "High-risk AI tasks are not permitted." };
  }

  if (risk_level === "clinical_review_required" && !flags.allow_clinical_review_tasks) {
    return {
      allowed: false,
      reason: "Clinical review AI tasks are not permitted.",
    };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Provider interface and stub
// ---------------------------------------------------------------------------

export interface ImagingOsAiProvider {
  executeTask(
    request: ImagingOsAiVisionRequestContract
  ): Promise<ImagingOsAiVisionModelOutputContract>;
}

const STUB_GENERATED_AT = "1970-01-01T00:00:00.000Z";

/** Stub AI provider returning fake but contract-valid outputs (IM-12). */
export class ImagingOsStubAiProvider implements ImagingOsAiProvider {
  async executeTask(
    request: ImagingOsAiVisionRequestContract
  ): Promise<ImagingOsAiVisionModelOutputContract> {
    const base = {
      request_id: request.request_id,
      task_type: request.task_type,
      model_name: "imaging-os-stub",
      model_version: "im-12.0.0",
      output_status: "completed" as const,
      requires_human_review: false,
      warnings: [] as string[],
      blockers: [] as string[],
      generated_at: STUB_GENERATED_AT,
      output_contract_version: IMAGING_AI_OUTPUT_CONTRACT_VERSION,
    };

    switch (request.task_type) {
      case "image_category_classification":
        return {
          ...base,
          classifications: [
            {
              category: request.evidence[0]?.canonical_category ?? "front",
              confidence: 0.93,
            },
          ],
        };

      case "image_quality_assessment":
        return {
          ...base,
          findings: [
            {
              finding_type: "quality_assessment",
              severity: "low",
              confidence: 0.91,
              description: "Image quality acceptable.",
            },
          ],
        };

      case "protocol_gap_detection":
        return {
          ...base,
          findings: [
            {
              finding_type: "protocol_gap",
              severity: "low",
              confidence: 0.88,
              description: "Potential missing donor image.",
            },
          ],
        };

      default:
        return {
          ...base,
          output_status: "rejected",
          blockers: [`Stub provider does not support task ${request.task_type}.`],
        };
    }
  }
}

/** Create an AI provider instance for the given provider type (IM-12: stub only). */
export function createAiProvider(
  providerType: ImagingOsAiProviderType
): ImagingOsAiProvider {
  switch (providerType) {
    case "stub":
      return new ImagingOsStubAiProvider();
    case "openai":
    case "anthropic":
    case "local":
      throw new Error(
        `Provider "${providerType}" is not implemented in IM-12. Use "stub" or wait for IM-13.`
      );
    default: {
      const _exhaustive: never = providerType;
      throw new Error(`Unknown provider type: ${_exhaustive}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

export type AiVisionExecutionPrompt = {
  system_prompt: string;
  user_prompt: string;
  structured_schema: Record<string, unknown>;
};

const TASK_PROMPTS: Record<
  ImagingOsIm12AllowedTaskType,
  { system: string; user: string; schema: Record<string, unknown> }
> = {
  image_category_classification: {
    system: "Classify this hair restoration clinical image into allowed categories.",
    user: "Analyze image and return classification confidence.",
    schema: {
      classifications: [{ category: "string", confidence: "number", notes: "string?" }],
    },
  },
  image_quality_assessment: {
    system: "Assess clinical image quality for hair restoration protocol compliance.",
    user: "Evaluate image quality and return findings with severity and confidence.",
    schema: {
      findings: [
        {
          finding_type: "quality_assessment",
          severity: "low|medium|high|review_required",
          confidence: "number",
          description: "string",
        },
      ],
    },
  },
  protocol_gap_detection: {
    system: "Detect missing protocol views or capture gaps in a case image set.",
    user: "Review evidence set and report protocol gaps with confidence.",
    schema: {
      findings: [
        {
          finding_type: "protocol_gap",
          severity: "low|medium|high|review_required",
          confidence: "number",
          description: "string",
        },
      ],
    },
  },
};

/** Build deterministic execution prompts for future provider calls (pure). */
export function buildAiVisionExecutionPrompt(
  request: ImagingOsAiVisionRequestContract
): AiVisionExecutionPrompt {
  if (isIm12AllowedTask(request.task_type)) {
    const prompts = TASK_PROMPTS[request.task_type];
    return {
      system_prompt: prompts.system,
      user_prompt: prompts.user,
      structured_schema: prompts.schema,
    };
  }

  return {
    system_prompt: `Execute ImagingOS AI vision task: ${request.task_type}.`,
    user_prompt: "Analyze provided evidence and return structured output.",
    structured_schema: {
      request_id: "string",
      task_type: request.task_type,
      output_status: "completed|partial|failed|rejected",
    },
  };
}

// ---------------------------------------------------------------------------
// Execution engine
// ---------------------------------------------------------------------------

export type ImagingOsAiVisionExecutionStatus =
  | "executed"
  | "dry_run"
  | "blocked"
  | "validation_failed";

export type ExecuteImagingAiVisionTaskInput = {
  request: ImagingOsAiVisionRequestContract;
  flags?: ImagingOsAiFeatureFlags;
  provider?: ImagingOsAiProvider;
  analyticsContext?: {
    tenantId: string;
    entityId: string;
    patientId?: string | null;
  };
};

export type ExecuteImagingAiVisionTaskResult = {
  execution_status: ImagingOsAiVisionExecutionStatus;
  request: ImagingOsAiVisionRequestContract;
  output?: ImagingOsAiVisionModelOutputContract;
  audit_log: ImagingOsAiVisionAuditLogContract;
  warnings: string[];
  blockers: string[];
};

function buildExecutionAuditLog(
  request: ImagingOsAiVisionRequestContract,
  modelName?: string,
  modelVersion?: string,
  metadata?: Record<string, unknown>
): ImagingOsAiVisionAuditLogContract {
  return buildAiVisionAuditLogContract({
    request,
    created_at: STUB_GENERATED_AT,
    ...(modelName ? { model_name: modelName } : {}),
    ...(modelVersion ? { model_version: modelVersion } : {}),
    ...(metadata ? { metadata } : {}),
  });
}

function publishAiImagingAnalytics(
  input: ExecuteImagingAiVisionTaskInput,
  mode: "dry_run" | "executed",
  taskType: ImagingOsAiVisionTaskType
) {
  const ctx = input.analyticsContext;
  if (!ctx?.tenantId?.trim()) return;
  void publishImagingEvent({
    tenantId: ctx.tenantId.trim(),
    eventType: "ai_imaging_completed",
    entityId: ctx.entityId,
    entityType: "image",
    eventMetadata: {
      patient_id: ctx.patientId ?? null,
      task_type: taskType,
      mode,
    },
  });
}

/** Execute an AI vision task behind feature flags and IM-12 safety restrictions (pure stub). */
export async function executeImagingAiVisionTask(
  input: ExecuteImagingAiVisionTaskInput
): Promise<ExecuteImagingAiVisionTaskResult> {
  const flags = input.flags ?? DEFAULT_IMAGING_AI_FLAGS;
  const request = input.request;
  const warnings: string[] = [...request.warnings];
  const blockers: string[] = [...request.blockers];

  if (!isIm12AllowedTask(request.task_type)) {
    blockers.push("Task unavailable in IM-12 safety phase.");
    return {
      execution_status: "blocked",
      request,
      audit_log: buildExecutionAuditLog(request, undefined, undefined, {
        execution_status: "blocked",
        im12_phase: true,
      }),
      warnings,
      blockers,
    };
  }

  const permission = canExecuteAiVisionTask({ task_type: request.task_type, flags });
  if (!permission.allowed) {
    if (permission.reason) {
      blockers.push(permission.reason);
    }
    return {
      execution_status: "blocked",
      request,
      audit_log: buildExecutionAuditLog(request, undefined, undefined, {
        execution_status: "blocked",
      }),
      warnings,
      blockers,
    };
  }

  if (flags.dry_run_mode) {
    publishAiImagingAnalytics(input, "dry_run", request.task_type);
    return {
      execution_status: "dry_run",
      request,
      audit_log: buildExecutionAuditLog(request, undefined, undefined, {
        execution_status: "dry_run",
        dry_run_mode: true,
      }),
      warnings,
      blockers,
    };
  }

  const provider =
    input.provider ?? createAiProvider(flags.provider === "stub" ? "stub" : flags.provider);

  const output = await provider.executeTask(request);

  const validation = validateAiVisionModelOutputContract(output, request);
  warnings.push(...validation.warnings);
  blockers.push(...validation.blockers);

  const auditLog = buildExecutionAuditLog(
    request,
    output.model_name,
    output.model_version,
    { execution_status: validation.valid ? "executed" : "validation_failed" }
  );

  if (!validation.valid) {
    return {
      execution_status: "validation_failed",
      request,
      output,
      audit_log: auditLog,
      warnings,
      blockers,
    };
  }

  publishAiImagingAnalytics(input, "executed", request.task_type);
  return {
    execution_status: "executed",
    request,
    output,
    audit_log: auditLog,
    warnings,
    blockers,
  };
}

// ---------------------------------------------------------------------------
// Safe task recommendation
// ---------------------------------------------------------------------------

export type RecommendSafeAiTasksInput = {
  summary_result?: {
    overall_score: number;
  };
};

/** Recommend only IM-12 safe low-risk tasks based on case summary score (pure). */
export function recommendSafeAiTasks(
  input: RecommendSafeAiTasksInput = {}
): ImagingOsIm12AllowedTaskType[] {
  const tasks: ImagingOsIm12AllowedTaskType[] = ["image_category_classification"];

  const score = input.summary_result?.overall_score ?? 0;

  if (score > 60) {
    tasks.push("image_quality_assessment");
  }

  if (score > 75) {
    tasks.push("protocol_gap_detection");
  }

  return tasks;
}
