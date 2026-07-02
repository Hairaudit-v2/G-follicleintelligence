import { z } from "zod";

import {
  formatEnvValidationError,
  httpUrlSchema,
  isAffirmative,
  isPresent,
  isProductionEnv,
  optionalHttpUrl,
  optionalString,
  type EnvIssue,
} from "./zod-helpers";

// -----------------------------------------------------------------------------
// Client (NEXT_PUBLIC_*) — safe to bundle in browser code
// -----------------------------------------------------------------------------

export const clientEnvKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_FI_CALENDAR_PERF",
] as const;

export type ClientEnvKey = (typeof clientEnvKeys)[number];

export const clientEnvSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: optionalHttpUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
    NEXT_PUBLIC_SITE_URL: optionalHttpUrl,
    NEXT_PUBLIC_FI_CALENDAR_PERF: optionalString,
  })
  .superRefine((data, ctx) => {
    if (!isProductionEnv()) return;

    if (!data.NEXT_PUBLIC_SUPABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Required in production",
        path: ["NEXT_PUBLIC_SUPABASE_URL"],
      });
    }
    if (!data.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Required in production",
        path: ["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
      });
    }
  });

export type ClientEnv = z.infer<typeof clientEnvSchema>;

// -----------------------------------------------------------------------------
// Server-only — never import parsed output from client components
// -----------------------------------------------------------------------------

export const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  SUPABASE_DB_PASSWORD: optionalString,
  FI_STORAGE_BUCKET_INTAKES: optionalString,
  FI_LEGACY_FI_API_ENABLED: optionalString,
  FI_LEGACY_FI_API_SECRET: optionalString,
  FI_PAYMENTS_ENABLED: optionalString,
  FI_PROCEDURE_DAY_ENABLED: optionalString,
  FI_STAFF_UAT_MODE_ENABLED: optionalString,
  FI_PERF_DIAGNOSTICS_ENABLED: optionalString,
  FI_LOADER_PERF_SPANS: optionalString,
  FI_PAYMENT_PROVIDER: optionalString,
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  FI_PAYMENT_SUCCESS_URL: optionalHttpUrl,
  FI_PAYMENT_CANCEL_URL: optionalHttpUrl,
  FI_PAYMENT_REQUEST_EXPIRY_DAYS: optionalString,
  OPENAI_API_KEY: optionalString,
  OPENAI_CLINICAL_NOTE_MODEL: optionalString,
  OPENAI_PATHOLOGY_INTERPRETATION_MODEL: optionalString,
  PATHOLOGY_EXTRACTION_ENABLED: optionalString,
  PATHOLOGY_AUTO_DRAFT_ENABLED: optionalString,
  PATHOLOGY_EXTRACTION_PROVIDER: optionalString,
  PATHOLOGY_EXTRACTION_MIN_OCR_CONFIDENCE: optionalString,
  OPENAI_PATHOLOGY_EXTRACTION_MODEL: optionalString,
  PATHOLOGY_EMAIL_INGESTION_ENABLED: optionalString,
  PATHOLOGY_EMAIL_WEBHOOK_SECRET: optionalString,
  PATHOLOGY_EMAIL_INBOUND_DOMAIN: optionalString,
  PATHOLOGY_EMAIL_ALLOWED_SENDERS: optionalString,
  PATHOLOGY_EMAIL_MAX_ATTACHMENT_MB: optionalString,
  AWS_ACCESS_KEY_ID: optionalString,
  AWS_SECRET_ACCESS_KEY: optionalString,
  AWS_REGION: optionalString,
  GOOGLE_CLOUD_VISION_API_KEY: optionalString,
  GOOGLE_APPLICATION_CREDENTIALS_JSON: optionalString,
  OPENAI_HAIR_IMAGE_CLASSIFIER_MODEL: optionalString,
  OPENAI_HAIR_LOSS_CLASSIFIER_MODEL: optionalString,
  OPENAI_CONSULTATION_CHECKLIST_MODEL: optionalString,
  OPENAI_DONOR_ASSESSOR_MODEL: optionalString,
  OPENAI_RECIPIENT_ASSESSOR_MODEL: optionalString,
  RESEND_API_KEY: optionalString,
  RESEND_FROM_EMAIL: optionalString,
  RESEND_FROM_NAME: optionalString,
  RESEND_REPLY_TO: optionalString,
  TWILIO_ACCOUNT_SID: optionalString,
  TWILIO_AUTH_TOKEN: optionalString,
  TWILIO_FROM_NUMBER: optionalString,
  TWILIO_PHONE_NUMBER: optionalString,
  TWILIO_DEFAULT_COUNTRY_CODE: optionalString,
  FI_REMINDERS_LIVE_DELIVERY: optionalString,
  CRON_SECRET: optionalString,
  FI_REMINDER_CRON_SECRET: optionalString,
  FI_HR_SYNC_CRON_SECRET: optionalString,
  FI_PHOTO_PROTOCOL_ALERTS_CRON_SECRET: optionalString,
  FI_IMAGING_AI_ANALYSIS_CRON_SECRET: optionalString,
  WORKFORCE_COMPLIANCE_CRON_SECRET: optionalString,
  FINANCIAL_OS_CRON_SECRET: optionalString,
  FI_PAYMENTS_CRON_SECRET: optionalString,
  FI_LEADFLOW_CRON_SECRET: optionalString,
  FI_GOOGLE_CALENDAR_CRON_SECRET: optionalString,
  FI_ADMIN_API_KEY: optionalString,
  FI_ADMIN_API_KEY_TENANT_ALLOWLIST: optionalString,
  FI_PORTAL_IMAGING_ENABLED: optionalString,
  FI_IMPORT_ADMIN_KEY: optionalString,
  FI_MACHINE_INGEST_MASTER_KEY: optionalString,
  FI_TIMELY_WEBHOOK_SECRET: optionalString,
  TIMELY_API_KEY: optionalString,
  TIMELY_API_BASE_URL: optionalHttpUrl,
  FI_TIMELY_SYNC_CRON_SECRET: optionalString,
  FI_HUBSPOT_WEBHOOK_SECRET: optionalString,
  HUBSPOT_CLIENT_SECRET: optionalString,
  FI_HUBSPOT_CLIENT_SECRET: optionalString,
  HUBSPOT_PRIVATE_APP_TOKEN: optionalString,
  IIOHR_HR_SYNC_SECRET: optionalString,
  IIOHR_FI_COMPETENCY_EXPORT_SECRET: optionalString,
  IIOHR_FI_COMPETENCY_EXPORT_ENABLED: optionalString,
  FI_ALLOW_INSECURE_API: optionalString,
  FI_ALLOW_ADMIN_KEY_QUERY: optionalString,
  FI_ENABLE_PUBLIC_COPY_CHECK: optionalString,
  HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN: optionalString,
  HAIRAUDIT_IMAGE_CLASSIFIER_MODE: optionalString,
  FI_INTERNAL_IMAGING_CLASSIFIER_TOKEN: optionalString,
  FI_INTERNAL_IMAGING_HMAC_SECRET: optionalString,
  FI_INTERNAL_IMAGING_REQUIRE_HMAC: optionalString,
  FI_INTERNAL_IMAGING_ALLOWED_SOURCES: optionalString,
  IIOHR_HR_PERTH_STAFF_FEED_URL: optionalHttpUrl,
  IIOHR_HR_STAFF_FEED_URL: optionalHttpUrl,
  IIOHR_HR_PERTH_STAFF_FEED_KEY: optionalString,
  EVOLVED_PERTH_TENANT_ID: optionalString,
  ALLOW_EMPTY_HR_SYNC: optionalString,
  FI_OS_NEXUS_ENABLED: optionalString,
  FI_OS_NEXUS_SECRET: optionalString,
  FI_OS_NEXUS_CREATE_AUTH_USER: optionalString,
  ALLOW_ENTERPRISE_DEMO_SEED: optionalString,
  STAFF_SYNC_ALERT_EMAIL: optionalString,
  STAFF_SYNC_STALE_WARNING_HOURS: optionalString,
  FI_BASE_URL: optionalHttpUrl,
  FI_TENANT_ID: optionalString,
  FI_CASE_ID: optionalString,
  FI_EVOLVED_TENANT_SLUG: optionalString,
  FI_EVOLVED_TENANT_NAME: optionalString,
  FI_EVOLVED_DEFAULT_TIMEZONE: optionalString,
  FI_HUBSPOT_IMPORT_TENANT_ID: optionalString,
  FI_HUBSPOT_IMPORT_CONFIRM: optionalString,
  FI_HUBSPOT_ROLLBACK_CONFIRM: optionalString,
  FI_INTELLIGENCE_EVENT_LOG_PERSIST_ENABLED: optionalString,
  FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED: optionalString,
  FI_INTELLIGENCE_GOVERNED_DISPATCH_ENABLED: optionalString,
  FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED: optionalString,
  FI_INTELLIGENCE_INTERNAL_BUS_SHADOW_ENABLED: optionalString,
  FI_INTELLIGENCE_INTERNAL_BUS_OBSERVABILITY_ENABLED: optionalString,
  FI_INTELLIGENCE_STAGING_ACTIVATION_ENABLED: optionalString,
  FI_INTELLIGENCE_STAGING_ALLOWED_EVENT: optionalString,
  FI_ENABLE_DEV_ADMIN_ACCESS: optionalString,
  FI_DEVELOPMENT_ADMIN_AUTH_USER_IDS: optionalString,
  FI_ALLOW_CALENDAR_UAT_SEED: optionalString,
  FI_REMINDER_TEST_EMAIL: optionalString,
  FI_REMINDERS_TEST_SEND: optionalString,
  FI_INTELLIGENCE_POLICY_DEV: optionalString,
  FI_IMAGING_ENABLE_LIVE_DENSITY_PROVIDER: optionalString,
  FI_IMAGING_ENABLE_LIVE_OUTCOME_PROVIDER: optionalString,
  FI_IMAGING_ENABLE_LIVE_NORWOOD_PROVIDER: optionalString,
  GOOGLE_SITE_VERIFICATION: optionalString,
  FI_EXTERNAL_CONNECTOR_MASTER_KEY: optionalString,
  GOOGLE_CALENDAR_CLIENT_ID: optionalString,
  GOOGLE_CALENDAR_CLIENT_SECRET: optionalString,
  GOOGLE_CALENDAR_REDIRECT_URI: optionalHttpUrl,
  GOOGLE_CALENDAR_OAUTH_STATE_SECRET: optionalString,
  FI_GOOGLE_CALENDAR_WEBHOOK_BASE_URL: optionalHttpUrl,
  FI_GOOGLE_CALENDAR_WEBHOOK_SECRET: optionalString,
  FI_GOOGLE_CALENDAR_SYNC_CRON_DISABLED: optionalString,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GOOGLE_OAUTH_REDIRECT_URI: optionalHttpUrl,
  BING_SITE_VERIFICATION: optionalString,
  INDEXNOW_KEY: optionalString,
  FI_E2E_BASE_URL: optionalHttpUrl,
  FI_E2E_TENANT_ID: optionalString,
  FI_E2E_DEMO_ADMIN_EMAIL: optionalString,
  FI_E2E_DEMO_ADMIN_PASSWORD: optionalString,
  FI_E2E_OTHER_TENANT_ID: optionalString,
  FI_E2E_STAFF_ID: optionalString,
  FI_E2E_STAFF_PIN: optionalString,
  FI_E2E_ALLOW_MUTATIONS: optionalString,
  FI_E2E_PATIENT_PORTAL_EMAIL: optionalString,
  FI_E2E_PATIENT_PORTAL_PASSWORD: optionalString,
  FI_E2E_VISUAL_SUMMARY_CASE_ID: optionalString,
  FI_E2E_VISUAL_SUMMARY_PATIENT_ID: optionalString,
  FI_E2E_PERF_BUDGET_MS: optionalString,
  FI_SMOKE_TENANT_ID: optionalString,
  FI_SMOKE_OTHER_TENANT_ID: optionalString,
  FI_SMOKE_PATIENT_ID: optionalString,
  FI_SMOKE_C4_GATE: optionalString,
  FI_TRIAL_REQUIRE_CONSENT_BEFORE_CAPTURE: optionalString,
  PATIENT_VISUAL_SUMMARY_SHARE_SECRET: optionalString,
  RECEPTION_OS_COMMUNICATION_DRY_RUN: optionalString,
  RECEPTION_OS_EMAIL_SEND_ENABLED: optionalString,
  RECEPTION_OS_SMS_SEND_ENABLED: optionalString,
  RECEPTION_OS_DEMO_MODE: optionalString,
  RECEPTION_OS_DEMO_MASK_AMOUNTS: optionalString,
  RECEPTION_OS_PILOT_TENANT_ID: optionalString,
  CALENDAR_PERF_TENANT_ID: optionalString,
  CALENDAR_PERF_ANCHOR: optionalString,
  DEBUG_HUBSPOT_AUDIT: optionalString,
  ANALYZE: optionalString,
  BASE_URL: optionalHttpUrl,
  SKIP_ENV_VALIDATION: optionalString,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function minSecretIssue(name: string, raw: string | undefined, min: number): EnvIssue | null {
  if (!isPresent(raw)) return null;
  if (raw!.trim().length < min) {
    return { variable: name, message: `Must be at least ${min} characters when set` };
  }
  return null;
}

/** True when Google Calendar OAuth client credentials are fully configured. */
export function isGoogleCalendarOAuthEnvConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const clientId = (env.GOOGLE_CALENDAR_CLIENT_ID ?? env.GOOGLE_CLIENT_ID ?? "").trim();
  const clientSecret = (env.GOOGLE_CALENDAR_CLIENT_SECRET ?? env.GOOGLE_CLIENT_SECRET ?? "").trim();
  const redirectUri = (
    env.GOOGLE_CALENDAR_REDIRECT_URI ??
    env.GOOGLE_OAUTH_REDIRECT_URI ??
    ""
  ).trim();
  return Boolean(clientId && clientSecret && redirectUri);
}

/**
 * Cross-cutting production and safety rules (shared by client + server validation).
 * Returns descriptive issues — never includes secret values.
 */
export function collectCrossEnvValidationIssues(env: NodeJS.ProcessEnv = process.env): EnvIssue[] {
  const issues: EnvIssue[] = [];
  const g = (k: string) => env[k];
  const isProd = isProductionEnv(env);

  const supabaseUrl = g("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnon = g("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (isProd) {
    if (!httpUrlSchema.safeParse(supabaseUrl).success) {
      issues.push({
        variable: "NEXT_PUBLIC_SUPABASE_URL",
        message: "Required in production and must be a valid http(s) URL",
      });
    }
    if (!isPresent(supabaseAnon)) {
      issues.push({
        variable: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        message: "Required in production",
      });
    }
    if (!isPresent(g("SUPABASE_SERVICE_ROLE_KEY"))) {
      issues.push({
        variable: "SUPABASE_SERVICE_ROLE_KEY",
        message: "Required in production (server-only)",
      });
    }
    if (!isPresent(g("CRON_SECRET"))) {
      issues.push({
        variable: "CRON_SECRET",
        message: "Required in production (Vercel scheduled crons use Bearer auth)",
      });
    } else if (g("CRON_SECRET")!.trim().length < 16) {
      issues.push({
        variable: "CRON_SECRET",
        message: "Must be at least 16 characters in production",
      });
    }
    if (isPresent(g("FI_ADMIN_API_KEY")) && !isPresent(g("FI_ADMIN_API_KEY_TENANT_ALLOWLIST"))) {
      issues.push({
        variable: "FI_ADMIN_API_KEY_TENANT_ALLOWLIST",
        message:
          "Required in production when FI_ADMIN_API_KEY is set (comma-separated tenant UUID allowlist)",
      });
    }
    if (isAffirmative(g("FI_PAYMENTS_ENABLED"))) {
      if (!isPresent(g("STRIPE_SECRET_KEY"))) {
        issues.push({
          variable: "STRIPE_SECRET_KEY",
          message: "Required when FI_PAYMENTS_ENABLED is on in production",
        });
      }
      if (!isPresent(g("STRIPE_WEBHOOK_SECRET"))) {
        issues.push({
          variable: "STRIPE_WEBHOOK_SECRET",
          message: "Required when FI_PAYMENTS_ENABLED is on in production",
        });
      }
    }
    if (isAffirmative(g("FI_ALLOW_INSECURE_API"))) {
      issues.push({
        variable: "FI_ALLOW_INSECURE_API",
        message: "Must not be enabled in production",
      });
    }
    if (isAffirmative(g("FI_ALLOW_ADMIN_KEY_QUERY"))) {
      issues.push({
        variable: "FI_ALLOW_ADMIN_KEY_QUERY",
        message: "Must not be enabled in production",
      });
    }
    if (isAffirmative(g("FI_ENABLE_DEV_ADMIN_ACCESS"))) {
      issues.push({
        variable: "FI_ENABLE_DEV_ADMIN_ACCESS",
        message: "Must not be enabled in production",
      });
    }
    if (isAffirmative(g("SKIP_ENV_VALIDATION"))) {
      issues.push({
        variable: "SKIP_ENV_VALIDATION",
        message: "Must not be enabled in production runtime (CI/build image steps only)",
      });
    }
    if (isAffirmative(g("FI_ALLOW_CALENDAR_UAT_SEED"))) {
      issues.push({
        variable: "FI_ALLOW_CALENDAR_UAT_SEED",
        message: "Must not be enabled in production",
      });
    }
    if (g("FI_REMINDERS_TEST_SEND")?.trim().toLowerCase() === "true") {
      issues.push({
        variable: "FI_REMINDERS_TEST_SEND",
        message: "Must not be enabled in production",
      });
    }
    if (isAffirmative(g("FI_LEGACY_FI_API_ENABLED"))) {
      const secret = g("FI_LEGACY_FI_API_SECRET");
      if (!isPresent(secret) || secret!.trim().length < 16) {
        issues.push({
          variable: "FI_LEGACY_FI_API_SECRET",
          message: "Required (≥16 characters) when FI_LEGACY_FI_API_ENABLED is on in production",
        });
      }
    }
    if (isAffirmative(g("FI_REMINDERS_LIVE_DELIVERY"))) {
      if (!isPresent(g("RESEND_API_KEY"))) {
        issues.push({
          variable: "RESEND_API_KEY",
          message: "Required when FI_REMINDERS_LIVE_DELIVERY is enabled in production",
        });
      }
      if (!isPresent(g("RESEND_FROM_EMAIL"))) {
        issues.push({
          variable: "RESEND_FROM_EMAIL",
          message: "Required when FI_REMINDERS_LIVE_DELIVERY is enabled in production",
        });
      }
    }
    if (isGoogleCalendarOAuthEnvConfigured(env)) {
      if (!isPresent(g("FI_EXTERNAL_CONNECTOR_MASTER_KEY"))) {
        issues.push({
          variable: "FI_EXTERNAL_CONNECTOR_MASTER_KEY",
          message: "Required in production when Google Calendar OAuth is configured",
        });
      }
    }
  } else if (isPresent(supabaseUrl) && !httpUrlSchema.safeParse(supabaseUrl).success) {
    issues.push({
      variable: "NEXT_PUBLIC_SUPABASE_URL",
      message: "Must be a valid http(s) URL when set",
    });
  }

  for (const issue of [
    minSecretIssue("FI_REMINDER_CRON_SECRET", g("FI_REMINDER_CRON_SECRET"), 16),
    minSecretIssue("CRON_SECRET", g("CRON_SECRET"), 16),
    minSecretIssue("FI_HR_SYNC_CRON_SECRET", g("FI_HR_SYNC_CRON_SECRET"), 16),
    minSecretIssue("FI_TIMELY_WEBHOOK_SECRET", g("FI_TIMELY_WEBHOOK_SECRET"), 16),
    minSecretIssue("FI_TIMELY_SYNC_CRON_SECRET", g("FI_TIMELY_SYNC_CRON_SECRET"), 16),
    minSecretIssue("FI_HUBSPOT_WEBHOOK_SECRET", g("FI_HUBSPOT_WEBHOOK_SECRET"), 16),
    minSecretIssue("FI_LEADFLOW_CRON_SECRET", g("FI_LEADFLOW_CRON_SECRET"), 16),
    minSecretIssue("FI_GOOGLE_CALENDAR_CRON_SECRET", g("FI_GOOGLE_CALENDAR_CRON_SECRET"), 16),
    minSecretIssue("FI_IMAGING_AI_ANALYSIS_CRON_SECRET", g("FI_IMAGING_AI_ANALYSIS_CRON_SECRET"), 16),
    minSecretIssue("WORKFORCE_COMPLIANCE_CRON_SECRET", g("WORKFORCE_COMPLIANCE_CRON_SECRET"), 16),
    minSecretIssue("FI_GOOGLE_CALENDAR_WEBHOOK_SECRET", g("FI_GOOGLE_CALENDAR_WEBHOOK_SECRET"), 16),
    minSecretIssue("FI_OS_NEXUS_SECRET", g("FI_OS_NEXUS_SECRET"), 16),
    minSecretIssue("PATIENT_VISUAL_SUMMARY_SHARE_SECRET", g("PATIENT_VISUAL_SUMMARY_SHARE_SECRET"), 16),
    minSecretIssue("IIOHR_HR_SYNC_SECRET", g("IIOHR_HR_SYNC_SECRET"), 16),
    minSecretIssue("IIOHR_FI_COMPETENCY_EXPORT_SECRET", g("IIOHR_FI_COMPETENCY_EXPORT_SECRET"), 16),
    minSecretIssue("FI_EXTERNAL_CONNECTOR_MASTER_KEY", g("FI_EXTERNAL_CONNECTOR_MASTER_KEY"), 16),
    minSecretIssue(
      "GOOGLE_CALENDAR_OAUTH_STATE_SECRET",
      g("GOOGLE_CALENDAR_OAUTH_STATE_SECRET"),
      16
    ),
  ]) {
    if (issue) issues.push(issue);
  }

  const openAi = g("OPENAI_API_KEY");
  if (openAi !== undefined && openAi.trim() === "") {
    issues.push({ variable: "OPENAI_API_KEY", message: "Must not be empty when set" });
  }

  const adminKey = g("FI_ADMIN_API_KEY");
  if (isPresent(adminKey) && adminKey!.trim().length < 20) {
    issues.push({
      variable: "FI_ADMIN_API_KEY",
      message: "Must be at least 20 characters when set",
    });
  }

  const machineIngestMaster = g("FI_MACHINE_INGEST_MASTER_KEY");
  if (isProd && isPresent(machineIngestMaster) && machineIngestMaster!.trim().length < 32) {
    issues.push({
      variable: "FI_MACHINE_INGEST_MASTER_KEY",
      message: "Must be at least 32 characters in production when set",
    });
  }

  if (isProd && isAffirmative(g("FI_OS_NEXUS_ENABLED"))) {
    if (!isPresent(g("FI_OS_NEXUS_SECRET")) || g("FI_OS_NEXUS_SECRET")!.trim().length < 16) {
      issues.push({
        variable: "FI_OS_NEXUS_SECRET",
        message: "Required (≥16 characters) when FI_OS_NEXUS_ENABLED is on in production",
      });
    }
  }

  if (isProd && isAffirmative(g("PATHOLOGY_EMAIL_INGESTION_ENABLED"))) {
    if (!isPresent(g("PATHOLOGY_EMAIL_WEBHOOK_SECRET"))) {
      issues.push({
        variable: "PATHOLOGY_EMAIL_WEBHOOK_SECRET",
        message: "Required when PATHOLOGY_EMAIL_INGESTION_ENABLED is on in production",
      });
    }
  }

  if (isProd && isAffirmative(g("ALLOW_ENTERPRISE_DEMO_SEED"))) {
    issues.push({
      variable: "ALLOW_ENTERPRISE_DEMO_SEED",
      message: "Must not be enabled in production unless intentional demo seeding",
    });
  }

  return issues;
}

export function zodIssuesToEnvIssues(error: z.ZodError): EnvIssue[] {
  return error.issues.map((issue) => ({
    variable: typeof issue.path[0] === "string" ? issue.path[0] : "environment",
    message: issue.message,
  }));
}

export function pickClientEnvInput(
  env: NodeJS.ProcessEnv
): Record<ClientEnvKey, string | undefined> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_FI_CALENDAR_PERF: env.NEXT_PUBLIC_FI_CALENDAR_PERF,
  };
}

export function pickServerEnvInput(
  env: NodeJS.ProcessEnv
): Record<keyof ServerEnv, string | undefined> {
  const shape = serverEnvSchema.shape;
  const out = {} as Record<keyof ServerEnv, string | undefined>;
  for (const key of Object.keys(shape) as (keyof ServerEnv)[]) {
    out[key] = env[key];
  }
  return out;
}

export function parseClientEnv(
  runtimeEnv: NodeJS.ProcessEnv = process.env,
  options?: { skipValidation?: boolean }
): ClientEnv {
  if (options?.skipValidation) {
    return pickClientEnvInput(runtimeEnv) as ClientEnv;
  }
  return clientEnvSchema.parse(pickClientEnvInput(runtimeEnv));
}

export function parseServerEnv(
  runtimeEnv: NodeJS.ProcessEnv = process.env,
  options?: { skipValidation?: boolean }
): ServerEnv {
  if (options?.skipValidation) {
    return pickServerEnvInput(runtimeEnv) as ServerEnv;
  }
  return serverEnvSchema.parse(pickServerEnvInput(runtimeEnv));
}

export function validateFullEnv(
  runtimeEnv: NodeJS.ProcessEnv = process.env,
  options?: { skipValidation?: boolean }
): { ok: true; client: ClientEnv; server: ServerEnv } | { ok: false; issues: EnvIssue[] } {
  if (options?.skipValidation) {
    return {
      ok: true,
      client: pickClientEnvInput(runtimeEnv) as ClientEnv,
      server: pickServerEnvInput(runtimeEnv) as ServerEnv,
    };
  }

  const issues: EnvIssue[] = [];

  const clientResult = clientEnvSchema.safeParse(pickClientEnvInput(runtimeEnv));
  if (!clientResult.success) {
    issues.push(...zodIssuesToEnvIssues(clientResult.error));
  }

  const serverResult = serverEnvSchema.safeParse(pickServerEnvInput(runtimeEnv));
  if (!serverResult.success) {
    issues.push(...zodIssuesToEnvIssues(serverResult.error));
  }

  issues.push(...collectCrossEnvValidationIssues(runtimeEnv));

  const deduped = issues.filter(
    (issue, index, all) =>
      all.findIndex((x) => x.variable === issue.variable && x.message === issue.message) === index
  );

  if (deduped.length > 0) {
    return { ok: false, issues: deduped };
  }

  return {
    ok: true,
    client: clientResult.success
      ? clientResult.data
      : (pickClientEnvInput(runtimeEnv) as ClientEnv),
    server: serverResult.success
      ? serverResult.data
      : (pickServerEnvInput(runtimeEnv) as ServerEnv),
  };
}

/** @deprecated Use validateFullEnv — variable names only for legacy callers. */
export function collectLegacyVariableNames(runtimeEnv: NodeJS.ProcessEnv = process.env): string[] {
  const result = validateFullEnv(runtimeEnv);
  if (result.ok) return [];
  return [...new Set(result.issues.map((i) => i.variable))].sort();
}

export class EnvValidationError extends Error {
  constructor(public readonly issues: EnvIssue[]) {
    super(formatEnvValidationError(issues));
    this.name = "EnvValidationError";
  }
}

export function assertValidEnv(runtimeEnv: NodeJS.ProcessEnv = process.env): void {
  const result = validateFullEnv(runtimeEnv);
  if (!result.ok) throw new EnvValidationError(result.issues);
}
