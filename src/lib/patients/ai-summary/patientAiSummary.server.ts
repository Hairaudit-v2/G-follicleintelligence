/**
 * AI Patient Summary — generate, cache, log (tenant-scoped, operational only).
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { logStructured } from "@/src/lib/server/structuredLog";
import { loadPatientProfile } from "@/src/lib/patients/patientProfileLoader";

import { finalizeDeterministicResult, buildDeterministicSummaryPayload } from "./patientAiSummaryDeterministic";
import { buildPatientAiSummaryFacts } from "./patientAiSummaryFacts";
import { parsePatientAiSummaryLlmJson } from "./patientAiSummaryParse";
import { checkPatientAiSummarySafety } from "./patientAiSummarySafety";
import {
  PATIENT_AI_SUMMARY_CACHE_TTL_MINUTES,
  PATIENT_AI_SUMMARY_TENANT_FLAG,
  type PatientAiSummaryGenerateOptions,
  type PatientAiSummaryResult,
} from "./patientAiSummaryTypes";
import {
  callPatientAiSummaryLlm,
  isPatientAiSummaryLlmConfigured,
} from "./patientAiSummaryXai.server";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  actorAuthUserId?: string | null;
};

async function resolveActor(opts: ServerOpts): Promise<string | null> {
  if (opts.actorAuthUserId) return opts.actorAuthUserId;
  return resolveAuthUserId(null);
}

export async function isPatientAiSummaryEnabledForTenant(
  tenantId: string,
  serverOpts: ServerOpts = {}
): Promise<boolean> {
  const supabase = serverOpts.supabaseClientForTests ?? supabaseAdmin();
  const { data } = await supabase
    .from("fi_tenant_settings")
    .select("metadata")
    .eq("tenant_id", tenantId.trim())
    .maybeSingle();
  const meta =
    data?.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
      ? (data.metadata as Record<string, unknown>)
      : {};
  // Default ON when unset so clinics can try it; admin can disable.
  if (meta[PATIENT_AI_SUMMARY_TENANT_FLAG] === false) return false;
  if (meta[PATIENT_AI_SUMMARY_TENANT_FLAG] === "false") return false;
  return true;
}

export async function setPatientAiSummaryEnabledForTenant(
  tenantId: string,
  enabled: boolean,
  serverOpts: ServerOpts = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const authId = await resolveActor(serverOpts);
    if (!authId) return { ok: false, error: "Authentication required." };

    // Clinic / ops admins only (tenant-scoped AI feature toggle).
    const { loadActiveTenantAdminProfileForSession } = await import(
      "@/src/lib/tenantAdmin/tenantAdminProfile.server"
    );
    const adminProf = await loadActiveTenantAdminProfileForSession(tenantId.trim(), authId);
    if (
      adminProf?.adminRole !== "clinic_admin" &&
      adminProf?.adminRole !== "operations_admin"
    ) {
      return { ok: false, error: "Clinic admin access is required to change AI Summary settings." };
    }

    const supabase = serverOpts.supabaseClientForTests ?? supabaseAdmin();
    const tid = tenantId.trim();
    const { data: existing } = await supabase
      .from("fi_tenant_settings")
      .select("id, metadata")
      .eq("tenant_id", tid)
      .maybeSingle();

    const meta =
      existing?.metadata &&
      typeof existing.metadata === "object" &&
      !Array.isArray(existing.metadata)
        ? { ...(existing.metadata as Record<string, unknown>) }
        : {};
    meta[PATIENT_AI_SUMMARY_TENANT_FLAG] = enabled;

    if (existing?.id) {
      const { error } = await supabase
        .from("fi_tenant_settings")
        .update({ metadata: meta })
        .eq("id", existing.id)
        .eq("tenant_id", tid);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase.from("fi_tenant_settings").insert({
        tenant_id: tid,
        metadata: meta,
      });
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update AI toggle." };
  }
}

async function logSummaryCall(
  supabase: SupabaseClient,
  row: {
    tenant_id: string;
    patient_id: string;
    actor_auth_user_id: string | null;
    source: string;
    model: string | null;
    cache_hit: boolean;
    requires_human_review: boolean;
    success: boolean;
    error_message: string | null;
    detail: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await supabase.from("fi_patient_ai_summary_logs").insert(row);
  } catch (e) {
    logStructured("warn", "patient_ai_summary.log_failed", { error: String(e) });
  }
}

function cacheExpiresAt(from: Date = new Date()): string {
  return new Date(
    from.getTime() + PATIENT_AI_SUMMARY_CACHE_TTL_MINUTES * 60 * 1000
  ).toISOString();
}

export async function generatePatientAiSummary(
  tenantId: string,
  patientId: string,
  options: PatientAiSummaryGenerateOptions = {},
  serverOpts: ServerOpts = {}
): Promise<{ ok: true; summary: PatientAiSummaryResult } | { ok: false; error: string }> {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const supabase = serverOpts.supabaseClientForTests ?? supabaseAdmin();
  const actorAuthUserId = await resolveActor(serverOpts);

  if (!actorAuthUserId) {
    return { ok: false, error: "Authentication required." };
  }

  try {
    if (!(await isPatientAiSummaryEnabledForTenant(tid, serverOpts))) {
      await logSummaryCall(supabase, {
        tenant_id: tid,
        patient_id: pid,
        actor_auth_user_id: actorAuthUserId,
        source: "disabled",
        model: null,
        cache_hit: false,
        requires_human_review: false,
        success: false,
        error_message: "feature_disabled",
        detail: {},
      });
      return {
        ok: false,
        error: "AI Patient Summary is turned off for this clinic. An admin can enable it in settings.",
      };
    }

    // Cache
    if (!options.forceRefresh) {
      const { data: cached } = await supabase
        .from("fi_patient_ai_summary_cache")
        .select("summary_json, expires_at, source, model")
        .eq("tenant_id", tid)
        .eq("patient_id", pid)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (cached?.summary_json && typeof cached.summary_json === "object") {
        const summary = {
          ...(cached.summary_json as PatientAiSummaryResult),
          cacheHit: true,
          source: "cache" as const,
          expiresAtIso: cached.expires_at ? String(cached.expires_at) : null,
        };
        await logSummaryCall(supabase, {
          tenant_id: tid,
          patient_id: pid,
          actor_auth_user_id: actorAuthUserId,
          source: "cache",
          model: cached.model ? String(cached.model) : null,
          cache_hit: true,
          requires_human_review: Boolean(summary.requiresHumanReview),
          success: true,
          error_message: null,
          detail: { expires_at: cached.expires_at },
        });
        return { ok: true, summary };
      }
    }

    const loaded = await loadPatientProfile(tid, pid, supabase);
    if (!loaded.ok || loaded.mode !== "foundation") {
      return { ok: false, error: "Patient not found for this clinic." };
    }

    const facts = buildPatientAiSummaryFacts(loaded.data);
    const useLlm =
      !options.forceDeterministic && isPatientAiSummaryLlmConfigured();

    let result: PatientAiSummaryResult;

    if (useLlm) {
      const llm = await callPatientAiSummaryLlm(facts);
      if (llm.ok) {
        const parsed = parsePatientAiSummaryLlmJson(llm.text);
        if (parsed.ok) {
          const safety = checkPatientAiSummarySafety(parsed.payload);
          if (safety.blocked) {
            result = finalizeDeterministicResult({
              facts,
              source: "deterministic",
              model: llm.model,
              requiresHumanReview: true,
              safetyNotes: safety.notes,
              expiresAtIso: cacheExpiresAt(),
            });
          } else {
            result = finalizeDeterministicResult({
              facts,
              source: "llm",
              model: llm.model,
              payload: parsed.payload,
              requiresHumanReview: safety.requiresHumanReview,
              safetyNotes: safety.notes,
              expiresAtIso: cacheExpiresAt(),
            });
          }
        } else {
          result = finalizeDeterministicResult({
            facts,
            source: "deterministic",
            model: llm.model,
            requiresHumanReview: false,
            safetyNotes: [`Model parse failed: ${parsed.error}. Used operational template.`],
            expiresAtIso: cacheExpiresAt(),
          });
        }
      } else {
        result = finalizeDeterministicResult({
          facts,
          source: "deterministic",
          model: null,
          safetyNotes: [`LLM unavailable: ${llm.error}. Used operational template.`],
          expiresAtIso: cacheExpiresAt(),
        });
      }
    } else {
      result = finalizeDeterministicResult({
        facts,
        source: "deterministic",
        model: null,
        safetyNotes: options.forceDeterministic
          ? ["Deterministic mode requested."]
          : ["XAI_API_KEY not set — operational template used."],
        expiresAtIso: cacheExpiresAt(),
      });
    }

    // Upsert cache
    const expiresAt = result.expiresAtIso ?? cacheExpiresAt();
    await supabase.from("fi_patient_ai_summary_cache").upsert(
      {
        tenant_id: tid,
        patient_id: pid,
        summary_json: result,
        source: result.source,
        model: result.model,
        facts_fingerprint: `${facts.imageCount}:${facts.upcomingAppointmentCount}:${facts.openCaseCount}`,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,patient_id" }
    );

    await logSummaryCall(supabase, {
      tenant_id: tid,
      patient_id: pid,
      actor_auth_user_id: actorAuthUserId,
      source: result.source,
      model: result.model,
      cache_hit: false,
      requires_human_review: result.requiresHumanReview,
      success: true,
      error_message: null,
      detail: {
        safetyNotes: result.safetyNotes,
        operationalFlagCount: result.operationalFlags.length,
      },
    });

    logStructured("info", "patient_ai_summary.generated", {
      tenantId: tid,
      patientId: pid,
      source: result.source,
      requiresHumanReview: result.requiresHumanReview,
    });

    return { ok: true, summary: result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to generate summary.";
    await logSummaryCall(supabase, {
      tenant_id: tid,
      patient_id: pid,
      actor_auth_user_id: actorAuthUserId,
      source: "error",
      model: null,
      cache_hit: false,
      requires_human_review: false,
      success: false,
      error_message: msg,
      detail: {},
    });
    return { ok: false, error: msg };
  }
}

/** Format summary as plain text for copy-to-note (operational). */
export function formatPatientAiSummaryForNote(summary: PatientAiSummaryResult): string {
  const lines = [
    summary.intro,
    "",
    summary.overview,
    "",
    "Timeline highlights:",
    ...summary.timelineHighlights.map(
      (t) => `• ${t.occurredOn} — ${t.label} (${t.kind})`
    ),
    "",
    "Operational status:",
    ...summary.operationalFlags.map((f) => `• [${f.severity}] ${f.label}`),
    "",
    "Suggested next steps (operational):",
    ...summary.suggestedNextSteps.map((s) => `• ${s}`),
    "",
    summary.disclaimer,
  ];
  return lines.join("\n");
}

// re-export for tests that import server path carefully
export { buildDeterministicSummaryPayload };
