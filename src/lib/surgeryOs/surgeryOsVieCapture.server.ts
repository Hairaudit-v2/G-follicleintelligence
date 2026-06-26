import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PROGRESS_META_KEY } from "@/src/lib/imagingOs/imagingOsProtocol";
import { parseProgressMeta } from "@/src/lib/imagingOs/imagingOsProtocol";

import { buildSurgeryOsVieCaptureSummary } from "./surgeryOsVieCaptureCore";
import type { SurgeryOsVieCaptureSummary } from "./surgeryOsVieCapture.types";
import { generateVieComparisonPairs } from "@/src/lib/vie/vieLongitudinalComparisonCore";
import { loadVieComparisonCaptureRecords } from "@/src/lib/vie/vieLongitudinalComparison.server";
import { loadVieCapturePolicyForTenant } from "@/src/lib/vie/vieCapturePolicy.server";
import { loadVieAlignmentResultsForPatient } from "@/src/lib/vie/vieSameAngleAlignment.server";
import { computeVieOutcomeSummaryForPatient } from "@/src/lib/vie/vieOutcomeIntelligence.server";

type SessionRow = {
  id: string;
  template_slug: string;
  progress: Record<string, unknown>;
  case_id: string | null;
};

type SurgeryVieInput = {
  surgeryId: string;
  patientId: string;
  patientLabel: string;
  caseId: string | null;
  bookingId: string | null;
};

async function loadProcedureDayId(
  tenantId: string,
  caseId: string | null,
  client: SupabaseClient
): Promise<string | null> {
  if (!caseId?.trim()) return null;
  const { data, error } = await client
    .from("fi_case_procedures")
    .select("id")
    .eq("tenant_id", tenantId.trim())
    .eq("case_id", caseId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? String((data as { id: string }).id) : null;
}

async function findActiveSurgeryDaySession(
  tenantId: string,
  patientId: string,
  caseId: string | null,
  client: SupabaseClient
): Promise<SessionRow | null> {
  const { data, error } = await client
    .from("fi_imaging_protocol_sessions")
    .select("id, template_slug, progress, case_id")
    .eq("tenant_id", tenantId.trim())
    .eq("patient_id", patientId.trim())
    .eq("template_slug", "surgery_day")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    const progress =
      r.progress && typeof r.progress === "object" && !Array.isArray(r.progress)
        ? (r.progress as Record<string, unknown>)
        : {};
    const meta = parseProgressMeta(progress);
    if (meta.status === "completed" || meta.completed_at) continue;

    const sessionCaseId = r.case_id != null ? String(r.case_id) : null;
    if (caseId && sessionCaseId && sessionCaseId !== caseId.trim()) continue;

    return {
      id: String(r.id),
      template_slug: String(r.template_slug),
      progress,
      case_id: sessionCaseId,
    };
  }
  return null;
}

export async function loadOrCreateSurgeryDayVieSession(input: {
  tenantId: string;
  patientId: string;
  caseId?: string | null;
  bookingId?: string | null;
  procedureDayId?: string | null;
  surgeryId?: string | null;
  client?: SupabaseClient;
}): Promise<{ sessionId: string; progress: Record<string, unknown>; created: boolean }> {
  const client = input.client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  const caseId = input.caseId?.trim() || null;

  const existing = await findActiveSurgeryDaySession(tid, pid, caseId, client);
  if (existing) {
    return { sessionId: existing.id, progress: existing.progress, created: false };
  }

  const procedureDayId =
    input.procedureDayId?.trim() ||
    (caseId ? await loadProcedureDayId(tid, caseId, client) : null);

  const now = new Date().toISOString();
  const progress: Record<string, unknown> = {
    [PROGRESS_META_KEY]: {
      status: "active" as const,
      surgery_context: {
        booking_id: input.bookingId?.trim() || null,
        procedure_day_id: procedureDayId,
        surgery_id: input.surgeryId?.trim() || null,
        capture_surface: "surgery_os",
      },
    },
  };

  const { data: ins, error } = await client
    .from("fi_imaging_protocol_sessions")
    .insert({
      tenant_id: tid,
      patient_id: pid,
      case_id: caseId,
      template_slug: "surgery_day",
      progress,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  return {
    sessionId: String((ins as { id: string }).id),
    progress,
    created: true,
  };
}

export async function loadSurgeryOsVieCaptureSummaries(
  tenantId: string,
  surgeries: SurgeryVieInput[],
  client?: SupabaseClient
): Promise<SurgeryOsVieCaptureSummary[]> {
  if (surgeries.length === 0) return [];
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();

  const caseIds = [...new Set(surgeries.map((s) => s.caseId).filter(Boolean) as string[])];
  const procedureDayByCase = new Map<string, string>();
  if (caseIds.length) {
    const { data, error } = await supabase
      .from("fi_case_procedures")
      .select("id, case_id")
      .eq("tenant_id", tid)
      .in("case_id", caseIds);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const r = row as { id: string; case_id: string };
      procedureDayByCase.set(String(r.case_id), String(r.id));
    }
  }

  const patientIds = [...new Set(surgeries.map((s) => s.patientId))];
  const { data: sessionRows, error: sessionErr } = await supabase
    .from("fi_imaging_protocol_sessions")
    .select("id, patient_id, case_id, template_slug, progress, updated_at")
    .eq("tenant_id", tid)
    .eq("template_slug", "surgery_day")
    .in("patient_id", patientIds)
    .order("updated_at", { ascending: false });
  if (sessionErr) throw new Error(sessionErr.message);

  const sessionByPatient = new Map<string, SessionRow>();
  for (const row of sessionRows ?? []) {
    const r = row as Record<string, unknown>;
    const patientId = String(r.patient_id);
    if (sessionByPatient.has(patientId)) continue;
    const progress =
      r.progress && typeof r.progress === "object" && !Array.isArray(r.progress)
        ? (r.progress as Record<string, unknown>)
        : {};
    const meta = parseProgressMeta(progress);
    if (meta.status === "completed" && meta.completed_at) continue;
    sessionByPatient.set(patientId, {
      id: String(r.id),
      template_slug: String(r.template_slug),
      progress,
      case_id: r.case_id != null ? String(r.case_id) : null,
    });
  }

  return Promise.all(
    surgeries
      .filter((s) => s.patientId?.trim())
      .map(async (surgery) => {
        const session = sessionByPatient.get(surgery.patientId);
        const progress = session?.progress ?? {};
        const procedureDayId = surgery.caseId ? procedureDayByCase.get(surgery.caseId) ?? null : null;

        let comparisonPairs: Awaited<ReturnType<typeof generateVieComparisonPairs>> = [];
        let alignmentResults: Awaited<ReturnType<typeof loadVieAlignmentResultsForPatient>> = [];
        let outcomeSummary: Awaited<ReturnType<typeof computeVieOutcomeSummaryForPatient>> | null = null;
        try {
          const policy = await loadVieCapturePolicyForTenant(tid, supabase);
          const records = await loadVieComparisonCaptureRecords(
            tid,
            surgery.patientId,
            surgery.caseId,
            supabase
          );
          comparisonPairs = generateVieComparisonPairs(records, policy.minimum_capture_quality_score);
          alignmentResults = await loadVieAlignmentResultsForPatient(tid, surgery.patientId, supabase);
          outcomeSummary = await computeVieOutcomeSummaryForPatient(tid, surgery.patientId, {
            caseId: surgery.caseId,
            client: supabase,
          });
        } catch {
          // best-effort
        }

        return buildSurgeryOsVieCaptureSummary({
          surgeryId: surgery.surgeryId,
          patientId: surgery.patientId,
          patientLabel: surgery.patientLabel,
          caseId: surgery.caseId,
          bookingId: surgery.bookingId,
          procedureDayId,
          sessionId: session?.id ?? null,
          progress,
          comparisonPairs,
          alignmentResults,
          outcomeSummary,
        });
      })
  );
}
