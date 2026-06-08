"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveEffectiveBranding } from "@/src/lib/fi/foundation/tenantSettings";
import { insertPrescriptionStatusAuditEvent } from "@/src/lib/prescribing/prescriptionStatusAudit.server";
import { requireFiPrescribingActor } from "@/src/lib/prescribing/fiPrescribingAccess.server";
import {
  loadCompoundPharmacyById,
  loadPharmacyTransmissionById,
  loadPharmacyTransmissionsForPrescription,
  type PharmacyOrderPayloadSnapshotV1,
} from "@/src/lib/prescribing/fiPharmacyLoaders.server";
import {
  pharmacySendBodySchema,
  transmissionIdBodySchema,
} from "@/src/lib/prescribing/fiPharmacyTransmissionSchemas";
import { loadPrescriptionDetail } from "@/src/lib/prescribing/fiPrescribingLoaders.server";
import { validateRepeatRulesPrescriberConfirmed } from "@/src/lib/prescribing/prescribingRepeatRules";
import {
  buildPharmacyOrderPayloadSnapshotV1,
  buildPharmacyOrderPdfContext,
} from "@/src/lib/prescribing/pharmacyOrderPayload.server";
import { renderPharmacyOrderPdfBytes } from "@/src/lib/prescribing/pharmacyOrderPdf.server";
import { buildResendFromAddress, isEmailDeliveryConfigured } from "@/src/lib/reminders/reminderDeliveryConfig";
import { loadReminderDeliveryConfig } from "@/src/lib/reminders/reminderDeliveryConfig.server";

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidatePrescriptionPaths(tenantId: string, patientId?: string | null, caseId?: string | null): void {
  const base = `/fi-admin/${tenantId.trim()}`;
  revalidatePath(`${base}/prescriptions`);
  if (patientId?.trim()) revalidatePath(`${base}/patients/${patientId.trim()}`);
  if (caseId?.trim()) revalidatePath(`${base}/cases/${caseId.trim()}`);
}

async function hasPendingTransmission(supabase: ReturnType<typeof supabaseAdmin>, tenantId: string, rxId: string) {
  const { count, error } = await supabase
    .from("fi_pharmacy_transmissions")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId.trim())
    .eq("prescription_id", rxId.trim())
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

function buildPharmacyEmailText(snap: PharmacyOrderPayloadSnapshotV1): string {
  const lines: string[] = [
    "COMPOUND PHARMACY ORDER",
    "===================",
    "",
    `Prescription ID: ${snap.prescription.id}`,
    snap.prescription.signed_at ? `Signed (ISO): ${snap.prescription.signed_at}` : "",
    "",
    "PATIENT",
    snap.patient.display_name,
    snap.patient.email ? `Patient email: ${snap.patient.email}` : "",
    "",
    "SHIPPING",
    `Delivery type: ${snap.prescription.delivery_type?.trim() || "—"}`,
    snap.prescription.patient_shipping_address?.trim() || "(no address on file)",
    "",
    "PRESCRIBER",
    `${snap.prescriber.full_name} (${snap.prescriber.staff_role})`,
    "",
    "LINE ITEMS",
    ...snap.items.map((it, i) => {
      const bits = [
        `${i + 1}. ${it.medication_name} — ${it.quantity_label} (${it.form_type})`,
        `   Dose: ${it.dose_instructions}`,
      ];
      if (it.repeats_instructions?.trim()) bits.push(`   Repeats: ${it.repeats_instructions}`);
      if (it.reorder_rule?.trim()) bits.push(`   Reorder rule: ${it.reorder_rule}`);
      bits.push(`   Prescriber confirmed repeat rules: ${it.repeat_rules_prescriber_confirmed ? "Yes" : "No"}`);
      return bits.join("\n");
    }),
    "",
    snap.prescription.clinical_notes?.trim() ? `CLINICAL NOTES\n${snap.prescription.clinical_notes}` : "",
    "",
    "—",
    "This structured summary accompanies the PDF attachment generated from Follicle Intelligence (DoctorOS).",
  ];
  return lines.filter(Boolean).join("\n");
}

async function trySendPharmacyEmail(params: {
  pharmacyEmail: string;
  pdfBytes: Uint8Array;
  prescriptionId: string;
  clinicName: string;
  structuredBody: string;
}): Promise<{ ok: true; resendId: string | null } | { ok: false; error: string }> {
  const cfg = loadReminderDeliveryConfig();
  if (!isEmailDeliveryConfigured(cfg)) {
    return { ok: false, error: "Email delivery is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL)." };
  }
  const fromHeader = buildResendFromAddress(cfg.resend);
  if (!fromHeader) return { ok: false, error: "RESEND_FROM_EMAIL is not configured." };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.resend.apiKey!.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromHeader,
      to: [params.pharmacyEmail.trim()],
      subject: `Compound order — prescription ${params.prescriptionId.slice(0, 8)}… — ${params.clinicName}`,
      text: params.structuredBody,
      attachments: [
        {
          filename: `pharmacy-order-${params.prescriptionId.slice(0, 8)}.pdf`,
          content: Buffer.from(params.pdfBytes).toString("base64"),
        },
      ],
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) {
    return { ok: false, error: payload.message?.trim() || `Resend HTTP ${res.status}` };
  }
  return { ok: true, resendId: payload.id?.trim() || null };
}

async function trySendPharmacyApi(params: {
  endpoint: string;
  snapshot: PharmacyOrderPayloadSnapshotV1;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(params.endpoint.trim(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params.snapshot),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, error: `Pharmacy API HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    const m = e instanceof Error ? e.message : "API request failed";
    return { ok: false, error: m };
  } finally {
    clearTimeout(t);
  }
}

async function markRxSentToPharmacyIfNeeded(opts: {
  supabase: ReturnType<typeof supabaseAdmin>;
  tenantId: string;
  prescriptionId: string;
  pharmacyId: string;
  pharmacyName: string;
  patientId: string;
  caseId: string | null;
  actorFiUserId: string;
  transmissionId: string;
  note: string;
}) {
  const { data: rx, error: re } = await opts.supabase
    .from("fi_patient_prescriptions")
    .select("status")
    .eq("tenant_id", opts.tenantId.trim())
    .eq("id", opts.prescriptionId.trim())
    .maybeSingle();
  if (re || !rx) throw new Error("Prescription not found.");
  const st = String((rx as { status: string }).status);
  const ts = new Date().toISOString();
  if (st === "signed") {
    const { error: u1 } = await opts.supabase
      .from("fi_patient_prescriptions")
      .update({
        status: "sent_to_pharmacy",
        sent_at: ts,
        pharmacy_id: opts.pharmacyId.trim(),
        pharmacy_name: opts.pharmacyName.trim(),
        updated_at: ts,
      })
      .eq("tenant_id", opts.tenantId.trim())
      .eq("id", opts.prescriptionId.trim())
      .eq("status", "signed");
    if (u1) throw new Error(u1.message);
    await insertPrescriptionStatusAuditEvent({
      tenantId: opts.tenantId,
      prescriptionId: opts.prescriptionId,
      fromStatus: "signed",
      toStatus: "sent_to_pharmacy",
      actorFiUserId: opts.actorFiUserId,
      note: opts.note,
    });
  }
}

export async function sendPrescriptionToPharmacyAction(
  body: unknown
): Promise<
  { ok: true; transmissionId: string; mode: "completed" | "manual_pending" } | { ok: false; error: string }
> {
  try {
    const parsed = pharmacySendBodySchema.parse(body);
    const actor = await requireFiPrescribingActor(parsed.tenantId);
    const tid = parsed.tenantId.trim();
    const rid = parsed.prescriptionId.trim();
    const supabase = supabaseAdmin();

    const bundle = await loadPrescriptionDetail(tid, rid);
    if (!bundle) return { ok: false, error: "Prescription not found." };
    if (bundle.prescription.status === "draft") {
      return { ok: false, error: "Draft prescriptions cannot be sent to a pharmacy." };
    }
    if (bundle.prescription.status !== "signed" && bundle.prescription.status !== "sent_to_pharmacy") {
      return { ok: false, error: "Only a signed prescription can be transmitted to the pharmacy." };
    }
    if (bundle.prescription.status === "sent_to_pharmacy") {
      const txs = await loadPharmacyTransmissionsForPrescription(tid, rid);
      const latest = txs[0];
      if (!latest || latest.status !== "failed") {
        return {
          ok: false,
          error:
            "A new pharmacy send is only allowed after a failed transmission while the prescription remains clinically signed.",
        };
      }
    }

    const repeatErr = validateRepeatRulesPrescriberConfirmed(bundle.items);
    if (repeatErr) return { ok: false, error: repeatErr };

    if (await hasPendingTransmission(supabase, tid, rid)) {
      return { ok: false, error: "Complete or cancel the pending pharmacy transmission before starting another." };
    }

    const pharmacy = await loadCompoundPharmacyById(tid, parsed.pharmacyId.trim());
    if (!pharmacy || !pharmacy.active) return { ok: false, error: "Pharmacy not found or inactive." };

    const snapshot = await buildPharmacyOrderPayloadSnapshotV1({
      tenantId: tid,
      prescriptionId: rid,
      pharmacy,
    });

    const { data: inserted, error: insErr } = await supabase
      .from("fi_pharmacy_transmissions")
      .insert({
        tenant_id: tid,
        prescription_id: rid,
        pharmacy_id: pharmacy.id,
        method: parsed.method,
        status: "pending",
        payload_snapshot: snapshot as unknown as Record<string, unknown>,
      })
      .select("id")
      .single();
    if (insErr || !inserted) return { ok: false, error: insErr?.message ?? "Could not create transmission." };
    const transmissionId = String((inserted as { id: string }).id);

    if (parsed.method === "manual_export") {
      revalidatePrescriptionPaths(tid, bundle.prescription.patient_id, bundle.prescription.case_id);
      return { ok: true, transmissionId, mode: "manual_pending" };
    }

    const branding = await resolveEffectiveBranding({ tenantId: tid });
    const pdfCtx = await buildPharmacyOrderPdfContext({
      tenantId: tid,
      prescriptionId: rid,
      pharmacy,
      branding: {
        brand_name: branding.brand_name,
        clinic_display_name: branding.clinic_display_name,
        accent_colour: branding.accent_colour,
      },
    });
    const pdfBytes = await renderPharmacyOrderPdfBytes(pdfCtx);
    const emailBody = buildPharmacyEmailText(snapshot);
    const clinicName =
      branding.clinic_display_name?.trim() || branding.brand_name?.trim() || "Follicle Intelligence clinic";

    if (parsed.method === "email") {
      const mail = await trySendPharmacyEmail({
        pharmacyEmail: pharmacy.contact_email,
        pdfBytes,
        prescriptionId: rid,
        clinicName,
        structuredBody: emailBody,
      });
      if (!mail.ok) {
        await supabase
          .from("fi_pharmacy_transmissions")
          .update({
            status: "failed",
            error_message: mail.error,
            updated_at: new Date().toISOString(),
          })
          .eq("tenant_id", tid)
          .eq("id", transmissionId);
        revalidatePrescriptionPaths(tid, bundle.prescription.patient_id, bundle.prescription.case_id);
        return { ok: false, error: mail.error };
      }
      const sentAt = new Date().toISOString();
      await supabase
        .from("fi_pharmacy_transmissions")
        .update({
          status: "sent",
          sent_at: sentAt,
          payload_snapshot: {
            ...snapshot,
            delivery: { channel: "email", resend_id: mail.resendId, body: emailBody },
          } as unknown as Record<string, unknown>,
          updated_at: sentAt,
        })
        .eq("tenant_id", tid)
        .eq("id", transmissionId);

      await markRxSentToPharmacyIfNeeded({
        supabase,
        tenantId: tid,
        prescriptionId: rid,
        pharmacyId: pharmacy.id,
        pharmacyName: pharmacy.pharmacy_name,
        patientId: bundle.prescription.patient_id,
        caseId: bundle.prescription.case_id,
        actorFiUserId: actor.fiUserId,
        transmissionId,
        note: `Pharmacy order emailed (transmission ${transmissionId})`,
      });

      revalidatePrescriptionPaths(tid, bundle.prescription.patient_id, bundle.prescription.case_id);
      return { ok: true, transmissionId, mode: "completed" };
    }

    if (parsed.method === "api") {
      const ep = pharmacy.api_endpoint?.trim();
      if (!ep) {
        await supabase
          .from("fi_pharmacy_transmissions")
          .update({
            status: "failed",
            error_message: "Pharmacy has no API endpoint configured.",
            updated_at: new Date().toISOString(),
          })
          .eq("tenant_id", tid)
          .eq("id", transmissionId);
        revalidatePrescriptionPaths(tid, bundle.prescription.patient_id, bundle.prescription.case_id);
        return { ok: false, error: "Pharmacy has no API endpoint configured." };
      }
      const api = await trySendPharmacyApi({ endpoint: ep, snapshot });
      if (!api.ok) {
        await supabase
          .from("fi_pharmacy_transmissions")
          .update({
            status: "failed",
            error_message: api.error,
            updated_at: new Date().toISOString(),
          })
          .eq("tenant_id", tid)
          .eq("id", transmissionId);
        revalidatePrescriptionPaths(tid, bundle.prescription.patient_id, bundle.prescription.case_id);
        return { ok: false, error: api.error };
      }
      const sentAt = new Date().toISOString();
      await supabase
        .from("fi_pharmacy_transmissions")
        .update({
          status: "sent",
          sent_at: sentAt,
          payload_snapshot: {
            ...snapshot,
            delivery: { channel: "api", endpoint: ep },
          } as unknown as Record<string, unknown>,
          updated_at: sentAt,
        })
        .eq("tenant_id", tid)
        .eq("id", transmissionId);

      await markRxSentToPharmacyIfNeeded({
        supabase,
        tenantId: tid,
        prescriptionId: rid,
        pharmacyId: pharmacy.id,
        pharmacyName: pharmacy.pharmacy_name,
        patientId: bundle.prescription.patient_id,
        caseId: bundle.prescription.case_id,
        actorFiUserId: actor.fiUserId,
        transmissionId,
        note: `Pharmacy order submitted via API (transmission ${transmissionId})`,
      });

      revalidatePrescriptionPaths(tid, bundle.prescription.patient_id, bundle.prescription.case_id);
      return { ok: true, transmissionId, mode: "completed" };
    }

    return { ok: false, error: "Unsupported method." };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function confirmManualPharmacyTransmissionAction(
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = transmissionIdBodySchema.parse(body);
    const actor = await requireFiPrescribingActor(parsed.tenantId);
    const tid = parsed.tenantId.trim();
    const txid = parsed.transmissionId.trim();
    const supabase = supabaseAdmin();

    const tx = await loadPharmacyTransmissionById(tid, txid);
    if (!tx) return { ok: false, error: "Transmission not found." };
    if (tx.method !== "manual_export") return { ok: false, error: "Only manual export transmissions use this confirmation." };
    if (tx.status !== "pending") return { ok: false, error: "Transmission is not awaiting manual confirmation." };

    const bundle = await loadPrescriptionDetail(tid, tx.prescription_id);
    if (!bundle) return { ok: false, error: "Prescription not found." };
    if (bundle.prescription.status === "draft") {
      return { ok: false, error: "Cannot confirm send for a draft prescription." };
    }

    const pharmacy = await loadCompoundPharmacyById(tid, tx.pharmacy_id);
    if (!pharmacy) return { ok: false, error: "Pharmacy not found." };

    const sentAt = new Date().toISOString();
    const { error: u1 } = await supabase
      .from("fi_pharmacy_transmissions")
      .update({
        status: "sent",
        sent_at: sentAt,
        updated_at: sentAt,
      })
      .eq("tenant_id", tid)
      .eq("id", txid)
      .eq("status", "pending");
    if (u1) return { ok: false, error: u1.message };

    await markRxSentToPharmacyIfNeeded({
      supabase,
      tenantId: tid,
      prescriptionId: tx.prescription_id,
      pharmacyId: pharmacy.id,
      pharmacyName: pharmacy.pharmacy_name,
      patientId: bundle.prescription.patient_id,
      caseId: bundle.prescription.case_id,
      actorFiUserId: actor.fiUserId,
      transmissionId: txid,
      note: `Pharmacy order recorded as manually delivered (transmission ${txid})`,
    });

    revalidatePrescriptionPaths(tid, bundle.prescription.patient_id, bundle.prescription.case_id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function acknowledgePharmacyTransmissionAction(
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = transmissionIdBodySchema.parse(body);
    const actor = await requireFiPrescribingActor(parsed.tenantId);
    const tid = parsed.tenantId.trim();
    const txid = parsed.transmissionId.trim();
    const supabase = supabaseAdmin();

    const tx = await loadPharmacyTransmissionById(tid, txid);
    if (!tx) return { ok: false, error: "Transmission not found." };
    if (tx.status !== "sent") {
      return { ok: false, error: "Only a successfully sent transmission can be marked acknowledged." };
    }

    const ts = new Date().toISOString();
    const { error: u1 } = await supabase
      .from("fi_pharmacy_transmissions")
      .update({
        status: "acknowledged",
        updated_at: ts,
      })
      .eq("tenant_id", tid)
      .eq("id", txid)
      .eq("status", "sent");
    if (u1) return { ok: false, error: u1.message };

    const bundle = await loadPrescriptionDetail(tid, tx.prescription_id);
    if (bundle) {
      await insertPrescriptionStatusAuditEvent({
        tenantId: tid,
        prescriptionId: tx.prescription_id,
        fromStatus: "sent_to_pharmacy",
        toStatus: "pharmacy_acknowledged",
        actorFiUserId: actor.fiUserId,
        note: `Pharmacy acknowledged transmission ${txid} (manual confirmation in FI).`,
      });
      revalidatePrescriptionPaths(tid, bundle.prescription.patient_id, bundle.prescription.case_id);
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function resendFailedPharmacyTransmissionAction(
  body: unknown
): Promise<{ ok: true; transmissionId: string; mode: "completed" | "manual_pending" } | { ok: false; error: string }> {
  try {
    const parsed = transmissionIdBodySchema.parse(body);
    await requireFiPrescribingActor(parsed.tenantId);
    const tid = parsed.tenantId.trim();
    const txid = parsed.transmissionId.trim();

    const tx = await loadPharmacyTransmissionById(tid, txid);
    if (!tx) return { ok: false, error: "Transmission not found." };
    if (tx.status !== "failed") return { ok: false, error: "Only failed transmissions can be resent." };

    return sendPrescriptionToPharmacyAction({
      tenantId: tid,
      prescriptionId: tx.prescription_id,
      pharmacyId: tx.pharmacy_id,
      method: tx.method,
    });
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
