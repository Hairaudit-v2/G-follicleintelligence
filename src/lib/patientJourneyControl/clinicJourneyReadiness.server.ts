/**
 * FI-PATIENT-APP-P1 — clinic surgery readiness board projection.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

export type ClinicJourneyReadinessItem = {
  patientId: string;
  openPatientActions: number;
  waitingOnClinicActions: number;
  overdueActions: number;
  milestonesIncomplete: number;
  documentPacketStatus: string | null;
  pathologyStatus: string | null;
  quoteStatus: string | null;
  readyForSurgery: boolean;
};

export type ClinicJourneyReadinessOptions = {
  supabase?: SupabaseClient;
  nowIso?: string;
};

export async function loadClinicJourneyReadiness(
  args: { tenantId: string; patientId: string },
  options?: ClinicJourneyReadinessOptions
): Promise<ClinicJourneyReadinessItem> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const pid = assertNonEmptyUuid(args.patientId, "patientId");
  const now = options?.nowIso ?? new Date().toISOString();

  const { data: actions } = await supabase
    .from("fi_patient_actions")
    .select("id, status, due_at")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .in("status", ["open", "in_progress", "waiting_on_clinic", "blocked"]);

  let openPatientActions = 0;
  let waitingOnClinicActions = 0;
  let overdueActions = 0;
  for (const raw of actions ?? []) {
    const a = raw as { status?: string; due_at?: string | null };
    const status = String(a.status ?? "");
    if (status === "waiting_on_clinic" || status === "blocked") waitingOnClinicActions += 1;
    else openPatientActions += 1;
    if (
      (status === "open" || status === "in_progress") &&
      a.due_at &&
      Date.parse(String(a.due_at)) < Date.parse(now)
    ) {
      overdueActions += 1;
    }
  }

  const { data: milestones } = await supabase
    .from("fi_patient_journey_milestones")
    .select("milestone_key, status")
    .eq("tenant_id", tid)
    .eq("patient_id", pid);

  const milestonesIncomplete = (milestones ?? []).filter(
    (m) => String((m as { status?: string }).status ?? "") !== "completed"
  ).length;

  const { data: packet } = await supabase
    .from("fi_patient_document_packets")
    .select("status")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: pathReq } = await supabase
    .from("fi_pathology_requests")
    .select("workflow_status, issued_at")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: pathRes } = await supabase
    .from("fi_pathology_results")
    .select("clearance_status, patient_summary_approved_at")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let pathologyStatus: string | null = null;
  if (pathRes?.clearance_status) pathologyStatus = String(pathRes.clearance_status);
  else if (pathRes?.patient_summary_approved_at) pathologyStatus = "cleared";
  else if (pathReq?.workflow_status) pathologyStatus = String(pathReq.workflow_status);
  else if (pathReq?.issued_at) pathologyStatus = "issued";

  const { data: quote } = await supabase
    .from("fi_crm_quotes")
    .select("status")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const documentPacketStatus = packet?.status != null ? String(packet.status) : null;
  const quoteStatus = quote?.status != null ? String(quote.status) : null;

  const clearedMilestone = (milestones ?? []).some(
    (m) =>
      String((m as { milestone_key?: string }).milestone_key) === "patient_cleared_for_surgery" &&
      String((m as { status?: string }).status) === "completed"
  );

  const readyForSurgery =
    clearedMilestone ||
    (openPatientActions === 0 &&
      waitingOnClinicActions === 0 &&
      overdueActions === 0 &&
      (documentPacketStatus === "signed" || documentPacketStatus === "completed") &&
      (pathologyStatus === "cleared" || pathologyStatus === null) &&
      quoteStatus === "accepted");

  return {
    patientId: pid,
    openPatientActions,
    waitingOnClinicActions,
    overdueActions,
    milestonesIncomplete,
    documentPacketStatus,
    pathologyStatus,
    quoteStatus,
    readyForSurgery,
  };
}