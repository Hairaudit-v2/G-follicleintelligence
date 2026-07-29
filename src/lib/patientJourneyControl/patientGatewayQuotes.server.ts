/**
 * FI-PATIENT-APP-P1 — patient gateway quotes over fi_crm_quotes.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { markCrmQuoteAcceptedForTenant } from "@/src/lib/crm/crmQuoteMutations.server";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { patientGatewayDeny } from "@/src/lib/patientPortal/patientGatewayGateCore";
import { writePatientGatewayAudit } from "@/src/lib/patientPortal/patientGatewayAudit.server";
import type { PatientGatewayContext, PatientGatewayDeny } from "@/src/lib/patientPortal/patientGatewayTypes";

import { handleJourneyControlEvent } from "./patientJourneyControlEvents.server";

export type PatientGatewayQuoteSummary = {
  id: string;
  status: string;
  currency: string;
  totalAmount: number | null;
  validUntil: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  respondedAt: string | null;
};

export type PatientGatewayQuoteDetail = PatientGatewayQuoteSummary & {
  treatmentPlanSummary: string | null;
  treatmentAreas: string[];
  graftRange: string | null;
  surgeryDuration: string | null;
  inclusions: string[];
  optionalTreatments: string[];
  lineItems: Array<{ label: string; amount: number | null }>;
  canAccept: boolean;
  canDecline: boolean;
};

export type PatientGatewayQuotesOptions = {
  supabase?: SupabaseClient;
  nowIso?: string;
  writeAudit?: boolean;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v)).filter((s) => s.trim().length > 0);
}

function mapLineItems(snapshot: unknown): Array<{ label: string; amount: number | null }> {
  if (!Array.isArray(snapshot)) return [];
  return snapshot.map((raw) => {
    const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const label = String(o.label ?? o.name ?? o.description ?? "Item");
    const amountRaw = o.amount ?? o.total ?? o.unit_amount ?? null;
    const amount =
      typeof amountRaw === "number"
        ? amountRaw
        : amountRaw != null && Number.isFinite(Number(amountRaw))
          ? Number(amountRaw)
          : null;
    return { label, amount };
  });
}

function clinicStatusFromRow(row: Record<string, unknown>): string {
  const status = String(row.status ?? "draft").trim();
  if (status === "accepted") return "accepted";
  if (status === "declined" || status === "rejected") return "declined";
  if (status === "expired" || status === "cancelled") return status === "expired" ? "expired" : "declined";
  if (row.declined_at) return "declined";
  if (row.last_viewed_at) return "last_viewed";
  if (row.first_viewed_at) return "first_viewed";
  if (row.delivered_at) return "delivered";
  if (row.sent_at || status === "sent") return "sent";
  return status === "draft" ? "prepared" : status;
}

function mapSummary(row: Record<string, unknown>): PatientGatewayQuoteSummary {
  const total = row.total_amount;
  return {
    id: String(row.id),
    status: clinicStatusFromRow(row),
    currency: String(row.currency ?? "AUD"),
    totalAmount:
      typeof total === "number" ? total : total != null && Number.isFinite(Number(total)) ? Number(total) : null,
    validUntil: row.valid_until != null ? String(row.valid_until) : null,
    sentAt: row.sent_at != null ? String(row.sent_at) : null,
    deliveredAt: row.delivered_at != null ? String(row.delivered_at) : null,
    firstViewedAt: row.first_viewed_at != null ? String(row.first_viewed_at) : null,
    lastViewedAt: row.last_viewed_at != null ? String(row.last_viewed_at) : null,
    respondedAt: row.responded_at != null ? String(row.responded_at) : null,
  };
}

function mapDetail(row: Record<string, unknown>): PatientGatewayQuoteDetail {
  const meta =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const summary = mapSummary(row);
  const terminal = ["accepted", "declined", "expired"].includes(summary.status);
  return {
    ...summary,
    treatmentPlanSummary:
      meta.treatment_plan_summary != null
        ? String(meta.treatment_plan_summary)
        : meta.plan_summary != null
          ? String(meta.plan_summary)
          : null,
    treatmentAreas: asStringArray(meta.treatment_areas ?? meta.areas),
    graftRange:
      meta.graft_range != null
        ? String(meta.graft_range)
        : meta.grafts_min != null && meta.grafts_max != null
          ? `${meta.grafts_min}–${meta.grafts_max}`
          : null,
    surgeryDuration: meta.surgery_duration != null ? String(meta.surgery_duration) : null,
    inclusions: asStringArray(meta.inclusions),
    optionalTreatments: asStringArray(meta.optional_treatments ?? meta.optionals),
    lineItems: mapLineItems(row.line_items_snapshot),
    canAccept: !terminal && Boolean(row.delivered_at || row.sent_at || summary.status === "sent" || summary.status === "delivered" || summary.status === "first_viewed" || summary.status === "last_viewed"),
    canDecline: !terminal && Boolean(row.delivered_at || row.sent_at),
  };
}

async function loadOwnedQuote(
  ctx: PatientGatewayContext,
  quoteId: string,
  supabase: SupabaseClient
): Promise<Record<string, unknown> | PatientGatewayDeny> {
  let qid: string;
  try {
    qid = assertNonEmptyUuid(quoteId, "quoteId");
  } catch {
    return patientGatewayDeny("not_found", 404, "Quote not found.");
  }
  const { data, error } = await supabase
    .from("fi_crm_quotes")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .eq("id", qid)
    .maybeSingle();
  if (error) return patientGatewayDeny("misconfigured", 500, "Unable to load quote.");
  if (!data) return patientGatewayDeny("not_found", 404, "Quote not found.");
  const row = data as Record<string, unknown>;
  const patientId = row.patient_id != null ? String(row.patient_id) : null;
  if (patientId && patientId !== ctx.patientId) {
    return patientGatewayDeny("ownership_denied", 403, "Quote not available.");
  }
  // Allow quotes linked via case → patient when patient_id column unset.
  if (!patientId) {
    const caseId = row.case_id != null ? String(row.case_id) : null;
    if (caseId) {
      const { data: kase } = await supabase
        .from("fi_cases")
        .select("patient_id, foundation_patient_id")
        .eq("tenant_id", ctx.tenantId)
        .eq("id", caseId)
        .maybeSingle();
      const casePatient =
        (kase as { patient_id?: string | null; foundation_patient_id?: string | null } | null)?.patient_id ??
        (kase as { foundation_patient_id?: string | null } | null)?.foundation_patient_id ??
        null;
      if (casePatient && String(casePatient) !== ctx.patientId) {
        return patientGatewayDeny("ownership_denied", 403, "Quote not available.");
      }
    } else {
      const leadId = row.lead_id != null ? String(row.lead_id) : null;
      if (leadId) {
        const { data: lead } = await supabase
          .from("fi_crm_leads")
          .select("patient_id")
          .eq("tenant_id", ctx.tenantId)
          .eq("id", leadId)
          .maybeSingle();
        const leadPatient = (lead as { patient_id?: string | null } | null)?.patient_id ?? null;
        if (leadPatient && String(leadPatient) !== ctx.patientId) {
          return patientGatewayDeny("ownership_denied", 403, "Quote not available.");
        }
        if (!leadPatient) return patientGatewayDeny("ownership_denied", 403, "Quote not available.");
      } else {
        return patientGatewayDeny("ownership_denied", 403, "Quote not available.");
      }
    }
  }
  return row;
}

export async function listPatientQuotesForGateway(
  ctx: PatientGatewayContext,
  options?: PatientGatewayQuotesOptions
): Promise<{ ok: true; quotes: PatientGatewayQuoteSummary[] } | PatientGatewayDeny> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_crm_quotes")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .eq("patient_id", ctx.patientId)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) {
    // Fallback when patient_id column not yet backfilled: empty list is safer than leak.
    return { ok: true, quotes: [] };
  }
  const quotes = (data ?? [])
    .map((r) => mapSummary(r as Record<string, unknown>))
    .filter((q) => q.status !== "prepared");
  return { ok: true, quotes };
}

export async function getPatientQuoteForGateway(
  ctx: PatientGatewayContext,
  quoteId: string,
  options?: PatientGatewayQuotesOptions
): Promise<{ ok: true; quote: PatientGatewayQuoteDetail } | PatientGatewayDeny> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const now = options?.nowIso ?? new Date().toISOString();
  const loaded = await loadOwnedQuote(ctx, quoteId, supabase);
  if ("ok" in loaded && loaded.ok === false) return loaded;

  const row = loaded as Record<string, unknown>;
  const patch: Record<string, unknown> = { last_viewed_at: now, updated_at: now };
  if (!row.first_viewed_at) patch.first_viewed_at = now;
  await supabase.from("fi_crm_quotes").update(patch).eq("id", String(row.id)).eq("tenant_id", ctx.tenantId);

  return { ok: true, quote: mapDetail({ ...row, ...patch }) };
}

export async function acceptPatientQuoteForGateway(
  ctx: PatientGatewayContext,
  quoteId: string,
  options?: PatientGatewayQuotesOptions
): Promise<{ ok: true; quote: PatientGatewayQuoteDetail } | PatientGatewayDeny> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const writeAudit = options?.writeAudit !== false;
  const loaded = await loadOwnedQuote(ctx, quoteId, supabase);
  if ("ok" in loaded && loaded.ok === false) return loaded;
  const row = loaded as Record<string, unknown>;
  const detail = mapDetail(row);
  if (!detail.canAccept) {
    return patientGatewayDeny("ownership_denied", 403, "Quote cannot be accepted.");
  }

  try {
    await markCrmQuoteAcceptedForTenant(
      { tenantId: ctx.tenantId, quoteId: String(row.id) },
      supabase
    );
  } catch (e) {
    return patientGatewayDeny(
      "ownership_denied",
      403,
      e instanceof Error ? e.message : "Unable to accept quote."
    );
  }

  if (!row.patient_id) {
    await supabase
      .from("fi_crm_quotes")
      .update({ patient_id: ctx.patientId, updated_at: options?.nowIso ?? new Date().toISOString() })
      .eq("id", String(row.id))
      .eq("tenant_id", ctx.tenantId);
  }

  await handleJourneyControlEvent(
    {
      event: "quote_accepted",
      tenantId: ctx.tenantId,
      patientId: ctx.patientId,
      resourceType: "quote",
      resourceId: String(row.id),
      authUserId: ctx.authUserId,
    },
    { supabase, nowIso: options?.nowIso }
  );

  if (writeAudit) {
    writePatientGatewayAudit({
      action: "quote_accepted",
      outcome: "allow",
      authUserId: ctx.authUserId,
      patientId: ctx.patientId,
      tenantId: ctx.tenantId,
      resourceKind: "quote",
      resourceId: String(row.id),
    });
  }

  const refreshed = await loadOwnedQuote(ctx, String(row.id), supabase);
  if ("ok" in refreshed && refreshed.ok === false) return refreshed;
  return { ok: true, quote: mapDetail(refreshed as Record<string, unknown>) };
}

export async function declinePatientQuoteForGateway(
  ctx: PatientGatewayContext,
  quoteId: string,
  reason: string | null,
  options?: PatientGatewayQuotesOptions
): Promise<{ ok: true; quote: PatientGatewayQuoteDetail } | PatientGatewayDeny> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const writeAudit = options?.writeAudit !== false;
  const now = options?.nowIso ?? new Date().toISOString();
  const loaded = await loadOwnedQuote(ctx, quoteId, supabase);
  if ("ok" in loaded && loaded.ok === false) return loaded;
  const row = loaded as Record<string, unknown>;
  const detail = mapDetail(row);
  if (!detail.canDecline) {
    return patientGatewayDeny("ownership_denied", 403, "Quote cannot be declined.");
  }

  const { error } = await supabase
    .from("fi_crm_quotes")
    .update({
      status: "declined",
      declined_at: now,
      decline_reason: reason?.trim() || null,
      responded_at: now,
      patient_id: row.patient_id ?? ctx.patientId,
      updated_at: now,
    })
    .eq("id", String(row.id))
    .eq("tenant_id", ctx.tenantId);
  if (error) return patientGatewayDeny("misconfigured", 500, "Unable to decline quote.");

  await handleJourneyControlEvent(
    {
      event: "quote_declined",
      tenantId: ctx.tenantId,
      patientId: ctx.patientId,
      resourceType: "quote",
      resourceId: String(row.id),
      authUserId: ctx.authUserId,
      detail: { reason },
    },
    { supabase, nowIso: now }
  );

  if (writeAudit) {
    writePatientGatewayAudit({
      action: "quote_declined",
      outcome: "allow",
      authUserId: ctx.authUserId,
      patientId: ctx.patientId,
      tenantId: ctx.tenantId,
      resourceKind: "quote",
      resourceId: String(row.id),
    });
  }

  const refreshed = await loadOwnedQuote(ctx, String(row.id), supabase);
  if ("ok" in refreshed && refreshed.ok === false) return refreshed;
  return { ok: true, quote: mapDetail(refreshed as Record<string, unknown>) };
}

/** Clinic/staff: mark quote delivered into the patient app and fire journey event. */
export async function deliverQuoteToPatientApp(
  args: {
    tenantId: string;
    patientId: string;
    quoteId: string;
    authUserId?: string | null;
  },
  options?: PatientGatewayQuotesOptions
): Promise<{ ok: true; quoteId: string }> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const pid = assertNonEmptyUuid(args.patientId, "patientId");
  const qid = assertNonEmptyUuid(args.quoteId, "quoteId");
  const now = options?.nowIso ?? new Date().toISOString();

  const { error } = await supabase
    .from("fi_crm_quotes")
    .update({
      status: "sent",
      sent_at: now,
      delivered_at: now,
      patient_id: pid,
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", qid);
  if (error) throw new Error(error.message);

  await handleJourneyControlEvent(
    {
      event: "quote_delivered",
      tenantId: tid,
      patientId: pid,
      resourceType: "quote",
      resourceId: qid,
      authUserId: args.authUserId ?? null,
    },
    { supabase, nowIso: now }
  );
  return { ok: true, quoteId: qid };
}

export async function loadPatientQuotePdfPayload(
  ctx: PatientGatewayContext,
  quoteId: string,
  options?: PatientGatewayQuotesOptions
): Promise<{ ok: true; filename: string; body: string; contentType: string } | PatientGatewayDeny> {
  const detail = await getPatientQuoteForGateway(ctx, quoteId, options);
  if (!detail.ok) return detail;
  const q = detail.quote;
  const lines = [
    `Follicle Intelligence — Treatment Quote`,
    `Quote ID: ${q.id}`,
    `Status: ${q.status}`,
    `Currency: ${q.currency}`,
    `Total: ${q.totalAmount ?? "—"}`,
    q.treatmentPlanSummary ? `Plan: ${q.treatmentPlanSummary}` : "",
    q.graftRange ? `Graft range: ${q.graftRange}` : "",
    ...q.lineItems.map((li) => `- ${li.label}: ${li.amount ?? "—"}`),
  ].filter(Boolean);
  return {
    ok: true,
    filename: `quote-${q.id}.txt`,
    body: lines.join("\n"),
    contentType: "text/plain; charset=utf-8",
  };
}