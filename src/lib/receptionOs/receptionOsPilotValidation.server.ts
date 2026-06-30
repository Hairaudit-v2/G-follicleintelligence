import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadReceptionCommunicationTemplatesForTenant } from "@/src/lib/receptionOs/receptionCommunicationTemplates.server";
import { RECEPTION_COMMUNICATION_TEMPLATE_KEYS } from "@/src/lib/receptionOs/receptionCommunicationTemplates";
import { resolveReceptionCommunicationContactSubject } from "@/src/lib/receptionOs/receptionCommunicationContact.server";
import { loadReceptionCloseoutSnapshotForCommandCentre } from "@/src/lib/receptionOs/receptionDailyCloseout.server";
import { loadReceptionOsCommandCentrePayload } from "@/src/lib/receptionOs/receptionOsCommandCentreLoader.server";
import {
  appendPilotValidationCheck,
  finalizePilotValidationReport,
  type ReceptionOsPilotValidationReport,
} from "@/src/lib/receptionOs/receptionOsPilotValidationModel";
import { resolvePaymentLinkForPaymentRecord } from "@/src/lib/receptionOs/receptionPaymentLink.server";

async function tableExists(tableName: string): Promise<boolean> {
  const supabase = supabaseAdmin();
  const { error } = await supabase.from(tableName).select("id").limit(1);
  if (!error) return true;
  return !error.message.includes("does not exist");
}

export async function runReceptionOsPilotValidation(
  tenantId: string,
  now: Date = new Date()
): Promise<ReceptionOsPilotValidationReport> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const checks: ReceptionOsPilotValidationReport["checks"] = [];
  const validatedAt = now.toISOString();

  let payload: Awaited<ReturnType<typeof loadReceptionOsCommandCentrePayload>>;
  try {
    payload = await loadReceptionOsCommandCentrePayload(tid, now);
    appendPilotValidationCheck(checks, {
      id: "command_centre_payload",
      label: "ReceptionOS command centre payload loads",
      severity: "pass",
      detail: `Loaded ${payload.tenantName} for ${payload.operationalDay.todayYmd}.`,
    });
  } catch (e) {
    appendPilotValidationCheck(checks, {
      id: "command_centre_payload",
      label: "ReceptionOS command centre payload loads",
      severity: "fail",
      detail: e instanceof Error ? e.message : "Payload load failed.",
    });
    return finalizePilotValidationReport({
      tenantId: tid,
      validatedAt,
      operatingDate: null,
      checks,
    });
  }

  const operatingDate = payload.operationalDay.todayYmd;

  if (payload.todaysPatients.length > 0) {
    appendPilotValidationCheck(checks, {
      id: "todays_bookings",
      label: "Today's bookings present",
      severity: "pass",
      detail: `${payload.todaysPatients.length} patient row(s) on today's agenda.`,
    });
  } else {
    appendPilotValidationCheck(checks, {
      id: "todays_bookings",
      label: "Today's bookings present",
      severity: "warn",
      detail: "No patients on today's agenda — confirm calendar data or non-clinic day.",
    });
  }

  const leadIds = [
    ...new Set(
      payload.todaysPatients
        .map((p) => p.hrefs.lead)
        .filter(Boolean)
        .map((href) => href!.match(/\/crm\/leads\/([0-9a-f-]{36})/i)?.[1] ?? null)
        .filter(Boolean) as string[]
    ),
  ].slice(0, 5);

  if (!leadIds.length && payload.todaysPatients.some((p) => p.hrefs.lead)) {
    appendPilotValidationCheck(checks, {
      id: "contact_fields",
      label: "Patient/lead contact fields resolvable",
      severity: "warn",
      detail:
        "Today's patients include lead links but lead IDs could not be parsed for contact checks.",
    });
  } else if (!leadIds.length) {
    appendPilotValidationCheck(checks, {
      id: "contact_fields",
      label: "Patient/lead contact fields resolvable",
      severity: "warn",
      detail:
        "No linked leads on today's patients — SMS/email sends will require explicit recipients.",
    });
  } else {
    let withEmail = 0;
    let withPhone = 0;
    for (const leadId of leadIds) {
      const subject = await resolveReceptionCommunicationContactSubject(tid, { leadId });
      if (subject.email) withEmail += 1;
      if (subject.phoneE164) withPhone += 1;
    }
    appendPilotValidationCheck(checks, {
      id: "contact_fields",
      label: "Patient/lead contact fields resolvable",
      severity: withEmail > 0 || withPhone > 0 ? "pass" : "warn",
      detail: `Sampled ${leadIds.length} lead(s): ${withEmail} with email, ${withPhone} with SMS-capable phone.`,
    });
  }

  if (payload.outstandingDeposits.length > 0) {
    const sample = payload.outstandingDeposits[0]!;
    let paymentLink: string | null = null;
    try {
      paymentLink = await resolvePaymentLinkForPaymentRecord(tid, sample.id);
    } catch {
      paymentLink = null;
    }
    appendPilotValidationCheck(checks, {
      id: "deposits_resolve",
      label: "Outstanding deposits resolve",
      severity: "pass",
      detail: `${payload.outstandingDeposits.length} deposit row(s); sample payment link ${paymentLink ? "resolved" : "not available"}.`,
    });
  } else {
    appendPilotValidationCheck(checks, {
      id: "deposits_resolve",
      label: "Outstanding deposits resolve",
      severity: "pass",
      detail: "No outstanding deposits flagged (empty state OK).",
    });
  }

  appendPilotValidationCheck(checks, {
    id: "surgery_readiness",
    label: "Surgery readiness data resolves",
    severity: "pass",
    detail: `${payload.upcomingSurgeries.length} upcoming surgery row(s) in next 14 days.`,
  });

  try {
    const templates = await loadReceptionCommunicationTemplatesForTenant(tid);
    const keys = new Set(templates.map((t) => t.templateKey));
    const missing = RECEPTION_COMMUNICATION_TEMPLATE_KEYS.filter((k) => !keys.has(k));
    appendPilotValidationCheck(checks, {
      id: "communication_templates",
      label: "Communication templates load",
      severity: missing.length ? "fail" : "pass",
      detail: missing.length
        ? `Missing template keys: ${missing.join(", ")}`
        : `All ${RECEPTION_COMMUNICATION_TEMPLATE_KEYS.length} tenant templates available.`,
    });
  } catch (e) {
    appendPilotValidationCheck(checks, {
      id: "communication_templates",
      label: "Communication templates load",
      severity: "fail",
      detail: e instanceof Error ? e.message : "Template load failed.",
    });
  }

  try {
    const { endOfDayCloseout: _ignored, systemStatus: _status, ...closeoutInput } = payload;
    const closeout = await loadReceptionCloseoutSnapshotForCommandCentre(closeoutInput, now);
    appendPilotValidationCheck(checks, {
      id: "closeout_preview",
      label: "End-of-day closeout preview loads",
      severity: "pass",
      detail: `${closeout.checklist.length} checklist item(s); closeout ${closeout.existingCloseoutId ? "already closed" : "open"}.`,
    });
  } catch (e) {
    appendPilotValidationCheck(checks, {
      id: "closeout_preview",
      label: "End-of-day closeout preview loads",
      severity: "fail",
      detail: e instanceof Error ? e.message : "Closeout preview failed.",
    });
  }

  const [deliveriesTable, closeoutsTable] = await Promise.all([
    tableExists("fi_reception_communication_deliveries"),
    tableExists("fi_reception_daily_closeouts"),
  ]);

  appendPilotValidationCheck(checks, {
    id: "phase5_migrations",
    label: "Phase 5 delivery/closeout tables present",
    severity: deliveriesTable && closeoutsTable ? "pass" : "warn",
    detail: [
      `fi_reception_communication_deliveries: ${deliveriesTable ? "ok" : "missing"}`,
      `fi_reception_daily_closeouts: ${closeoutsTable ? "ok" : "missing"}`,
    ].join(" · "),
  });

  appendPilotValidationCheck(checks, {
    id: "tenant_scope",
    label: "Payload tenant scope",
    severity: payload.tenantId === tid ? "pass" : "fail",
    detail:
      payload.tenantId === tid
        ? "Command centre payload tenant matches request."
        : "Tenant mismatch detected.",
  });

  return finalizePilotValidationReport({
    tenantId: tid,
    validatedAt,
    operatingDate,
    checks,
  });
}
