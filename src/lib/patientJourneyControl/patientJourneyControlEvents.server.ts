/**
 * FI-PATIENT-APP-P1 — domain event handlers for journey / actions / notifications.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

import {
  completePatientActionsByKind,
  createPatientAction,
} from "./patientActionEngine.server";
import {
  PATIENT_ACTION_DEFAULT_TITLES,
  PATIENT_DOCUMENT_SECTION_KEYS,
  PATIENT_DOCUMENT_SECTION_LABELS,
  PATHOLOGY_NOTIFICATION_COPY,
  QUOTE_ACCEPTED_FOLLOW_ON_ACTIONS,
  type PatientJourneyDomainEvent,
} from "./patientJourneyControlContracts";
import { createPatientNotification } from "./patientNotificationFeed.server";

export type JourneyControlEventInput = {
  event: PatientJourneyDomainEvent;
  tenantId: string;
  patientId: string;
  resourceType?: string | null;
  resourceId?: string | null;
  authUserId?: string | null;
  detail?: Record<string, unknown>;
};

export type JourneyControlEventOptions = {
  supabase?: SupabaseClient;
  nowIso?: string;
};

async function upsertMilestone(
  supabase: SupabaseClient,
  args: {
    tenantId: string;
    patientId: string;
    milestoneKey: string;
    status: string;
    completedAt?: string | null;
    linkedResourceType?: string | null;
    linkedResourceId?: string | null;
    nowIso: string;
  }
): Promise<void> {
  const { error } = await supabase.from("fi_patient_journey_milestones").upsert(
    {
      tenant_id: args.tenantId,
      patient_id: args.patientId,
      milestone_key: args.milestoneKey,
      status: args.status,
      completed_at: args.completedAt ?? null,
      linked_resource_type: args.linkedResourceType ?? null,
      linked_resource_id: args.linkedResourceId ?? null,
      updated_at: args.nowIso,
    },
    { onConflict: "tenant_id,patient_id,milestone_key" }
  );
  if (error) throw new Error(error.message);
}

/**
 * Ensure a pre-surgery document packet + sections exist, then fire document_packet_released.
 */
export async function ensurePresurgeryDocumentPacket(
  args: { tenantId: string; patientId: string; authUserId?: string | null },
  options?: JourneyControlEventOptions
): Promise<{ packetId: string; created: boolean }> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const pid = assertNonEmptyUuid(args.patientId, "patientId");
  const now = options?.nowIso ?? new Date().toISOString();

  const { data: existing } = await supabase
    .from("fi_patient_document_packets")
    .select("id, status")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("packet_key", "presurgery_v1")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const packetId = String(existing.id);
    if (String(existing.status) === "draft") {
      await supabase
        .from("fi_patient_document_packets")
        .update({ status: "released", released_at: now, updated_at: now })
        .eq("id", packetId)
        .eq("tenant_id", tid);
    }
    await handleJourneyControlEvent(
      {
        event: "document_packet_released",
        tenantId: tid,
        patientId: pid,
        resourceType: "document_packet",
        resourceId: packetId,
        authUserId: args.authUserId ?? null,
      },
      { ...options, supabase, nowIso: now }
    );
    return { packetId, created: false };
  }

  const { data: packet, error: pe } = await supabase
    .from("fi_patient_document_packets")
    .insert({
      tenant_id: tid,
      patient_id: pid,
      packet_key: "presurgery_v1",
      version: 1,
      status: "released",
      released_at: now,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (pe) throw new Error(pe.message);
  const packetId = String(packet.id);

  const sectionRows = PATIENT_DOCUMENT_SECTION_KEYS.map((key, idx) => ({
    tenant_id: tid,
    packet_id: packetId,
    section_key: key,
    label: PATIENT_DOCUMENT_SECTION_LABELS[key],
    status: "not_started",
    is_required: true,
    sort_order: idx,
    form_data: {},
    created_at: now,
    updated_at: now,
  }));
  const { error: se } = await supabase.from("fi_patient_document_sections").insert(sectionRows);
  if (se) throw new Error(se.message);

  await handleJourneyControlEvent(
    {
      event: "document_packet_released",
      tenantId: tid,
      patientId: pid,
      resourceType: "document_packet",
      resourceId: packetId,
      authUserId: args.authUserId ?? null,
    },
    { ...options, supabase, nowIso: now }
  );
  return { packetId, created: true };
}

export async function handleJourneyControlEvent(
  input: JourneyControlEventInput,
  options?: JourneyControlEventOptions
): Promise<{ ok: true }> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const pid = assertNonEmptyUuid(input.patientId, "patientId");
  const now = options?.nowIso ?? new Date().toISOString();
  const resourceType = input.resourceType ?? null;
  const resourceId = input.resourceId ?? null;

  switch (input.event) {
    case "quote_delivered": {
      await upsertMilestone(supabase, {
        tenantId: tid,
        patientId: pid,
        milestoneKey: "quote_sent",
        status: "action_required",
        linkedResourceType: resourceType ?? "quote",
        linkedResourceId: resourceId,
        nowIso: now,
      });
      const action = await createPatientAction(
        {
          tenantId: tid,
          patientId: pid,
          input: {
            kind: "review_quote",
            title: PATIENT_ACTION_DEFAULT_TITLES.review_quote,
            deepLinkKey: "quote",
            resourceType: "quote",
            resourceId,
            milestoneKey: "quote_sent",
            createdByEvent: "quote_delivered",
            dedupeKey: resourceId ? `review_quote:${resourceId}` : `review_quote:${pid}`,
          },
        },
        { supabase, nowIso: now }
      );
      await createPatientNotification(
        {
          tenantId: tid,
          patientId: pid,
          eventType: "quote_delivered",
          title: "Your quote is ready",
          body: "Open the app to review your treatment quote.",
          actionId: action.action.id,
          resourceType: "quote",
          resourceId,
          authUserId: input.authUserId,
          dedupeKey: resourceId ? `quote_delivered:${resourceId}` : null,
        },
        { supabase, nowIso: now }
      );
      break;
    }
    case "quote_accepted": {
      await completePatientActionsByKind(
        {
          tenantId: tid,
          patientId: pid,
          kinds: ["review_quote", "accept_quote"],
          completedByEvent: "quote_accepted",
        },
        { supabase, nowIso: now }
      );
      await upsertMilestone(supabase, {
        tenantId: tid,
        patientId: pid,
        milestoneKey: "quote_accepted",
        status: "completed",
        completedAt: now,
        linkedResourceType: resourceType ?? "quote",
        linkedResourceId: resourceId,
        nowIso: now,
      });
      for (const kind of QUOTE_ACCEPTED_FOLLOW_ON_ACTIONS) {
        await createPatientAction(
          {
            tenantId: tid,
            patientId: pid,
            input: {
              kind,
              title: PATIENT_ACTION_DEFAULT_TITLES[kind],
              resourceType: kind === "pay_deposit" ? "quote" : "pathology",
              resourceId,
              milestoneKey: kind === "pay_deposit" ? "deposit_paid" : "blood_request_issued",
              createdByEvent: "quote_accepted",
              dedupeKey: `${kind}:${pid}`,
            },
          },
          { supabase, nowIso: now }
        );
      }
      await ensurePresurgeryDocumentPacket(
        { tenantId: tid, patientId: pid, authUserId: input.authUserId },
        { supabase, nowIso: now }
      );
      break;
    }
    case "quote_declined": {
      await completePatientActionsByKind(
        {
          tenantId: tid,
          patientId: pid,
          kinds: ["review_quote", "accept_quote"],
          completedByEvent: "quote_declined",
        },
        { supabase, nowIso: now }
      );
      await upsertMilestone(supabase, {
        tenantId: tid,
        patientId: pid,
        milestoneKey: "quote_accepted",
        status: "blocked",
        linkedResourceType: resourceType ?? "quote",
        linkedResourceId: resourceId,
        nowIso: now,
      });
      break;
    }
    case "deposit_received": {
      await completePatientActionsByKind(
        {
          tenantId: tid,
          patientId: pid,
          kinds: ["pay_deposit"],
          completedByEvent: "deposit_received",
        },
        { supabase, nowIso: now }
      );
      await upsertMilestone(supabase, {
        tenantId: tid,
        patientId: pid,
        milestoneKey: "deposit_paid",
        status: "completed",
        completedAt: now,
        linkedResourceType: resourceType,
        linkedResourceId: resourceId,
        nowIso: now,
      });
      await createPatientNotification(
        {
          tenantId: tid,
          patientId: pid,
          eventType: "payment_received",
          title: "Deposit received",
          body: "Your clinic has received your deposit.",
          resourceType,
          resourceId,
          authUserId: input.authUserId,
          dedupeKey: resourceId ? `deposit_received:${resourceId}` : `deposit_received:${pid}`,
        },
        { supabase, nowIso: now }
      );
      break;
    }
    case "blood_request_issued": {
      await upsertMilestone(supabase, {
        tenantId: tid,
        patientId: pid,
        milestoneKey: "blood_request_issued",
        status: "action_required",
        linkedResourceType: resourceType ?? "pathology_request",
        linkedResourceId: resourceId,
        nowIso: now,
      });
      const action = await createPatientAction(
        {
          tenantId: tid,
          patientId: pid,
          input: {
            kind: "complete_blood_tests",
            title: PATIENT_ACTION_DEFAULT_TITLES.complete_blood_tests,
            deepLinkKey: "pathology",
            resourceType: "pathology_request",
            resourceId,
            milestoneKey: "blood_request_issued",
            createdByEvent: "blood_request_issued",
            dedupeKey: resourceId ? `complete_blood_tests:${resourceId}` : `complete_blood_tests:${pid}`,
          },
        },
        { supabase, nowIso: now }
      );
      const copy = PATHOLOGY_NOTIFICATION_COPY.blood_request_issued;
      await createPatientNotification(
        {
          tenantId: tid,
          patientId: pid,
          eventType: "blood_request_issued",
          title: copy.title,
          body: copy.body,
          actionId: action.action.id,
          resourceType: "pathology_request",
          resourceId,
          authUserId: input.authUserId,
          dedupeKey: resourceId ? `blood_request_issued:${resourceId}` : null,
        },
        { supabase, nowIso: now }
      );
      break;
    }
    case "pathology_results_received": {
      await completePatientActionsByKind(
        {
          tenantId: tid,
          patientId: pid,
          kinds: ["complete_blood_tests"],
          completedByEvent: "pathology_results_received",
        },
        { supabase, nowIso: now }
      );
      await upsertMilestone(supabase, {
        tenantId: tid,
        patientId: pid,
        milestoneKey: "results_received",
        status: "completed",
        completedAt: now,
        linkedResourceType: resourceType ?? "pathology_result",
        linkedResourceId: resourceId,
        nowIso: now,
      });
      await upsertMilestone(supabase, {
        tenantId: tid,
        patientId: pid,
        milestoneKey: "clinical_review_completed",
        status: "waiting_on_clinic",
        linkedResourceType: resourceType ?? "pathology_result",
        linkedResourceId: resourceId,
        nowIso: now,
      });
      const awaitAction = await createPatientAction(
        {
          tenantId: tid,
          patientId: pid,
          input: {
            kind: "await_pathology_review",
            status: "waiting_on_clinic",
            title: PATIENT_ACTION_DEFAULT_TITLES.await_pathology_review,
            deepLinkKey: "pathology",
            resourceType: "pathology_result",
            resourceId,
            milestoneKey: "clinical_review_completed",
            createdByEvent: "pathology_results_received",
            dedupeKey: resourceId ? `await_pathology_review:${resourceId}` : `await_pathology_review:${pid}`,
          },
        },
        { supabase, nowIso: now }
      );
      const copy = PATHOLOGY_NOTIFICATION_COPY.pathology_received_awaiting_review;
      await createPatientNotification(
        {
          tenantId: tid,
          patientId: pid,
          eventType: "pathology_received_awaiting_review",
          title: copy.title,
          body: copy.body,
          actionId: awaitAction.action.id,
          resourceType: "pathology_result",
          resourceId,
          authUserId: input.authUserId,
          dedupeKey: resourceId ? `pathology_received:${resourceId}` : null,
        },
        { supabase, nowIso: now }
      );
      break;
    }
    case "pathology_cleared": {
      await completePatientActionsByKind(
        {
          tenantId: tid,
          patientId: pid,
          kinds: ["await_pathology_review", "await_medical_clearance"],
          completedByEvent: "pathology_cleared",
        },
        { supabase, nowIso: now }
      );
      await upsertMilestone(supabase, {
        tenantId: tid,
        patientId: pid,
        milestoneKey: "clinical_review_completed",
        status: "completed",
        completedAt: now,
        linkedResourceType: resourceType ?? "pathology_result",
        linkedResourceId: resourceId,
        nowIso: now,
      });
      const copy = PATHOLOGY_NOTIFICATION_COPY.pathology_cleared;
      await createPatientNotification(
        {
          tenantId: tid,
          patientId: pid,
          eventType: "pathology_cleared",
          title: copy.title,
          body: copy.body,
          resourceType: resourceType ?? "pathology_result",
          resourceId,
          authUserId: input.authUserId,
          dedupeKey: resourceId ? `pathology_cleared:${resourceId}` : null,
        },
        { supabase, nowIso: now }
      );
      break;
    }
    case "document_packet_released": {
      await upsertMilestone(supabase, {
        tenantId: tid,
        patientId: pid,
        milestoneKey: "pre_surgery_documents_completed",
        status: "action_required",
        linkedResourceType: "document_packet",
        linkedResourceId: resourceId,
        nowIso: now,
      });
      const action = await createPatientAction(
        {
          tenantId: tid,
          patientId: pid,
          input: {
            kind: "sign_document",
            title: PATIENT_ACTION_DEFAULT_TITLES.sign_document,
            deepLinkKey: "documents",
            resourceType: "document_packet",
            resourceId,
            milestoneKey: "pre_surgery_documents_completed",
            createdByEvent: "document_packet_released",
            dedupeKey: resourceId ? `sign_document:${resourceId}` : `sign_document:${pid}`,
          },
        },
        { supabase, nowIso: now }
      );
      await createPatientNotification(
        {
          tenantId: tid,
          patientId: pid,
          eventType: "document_required",
          title: "Documents ready",
          body: "Please complete your pre-surgery documents.",
          actionId: action.action.id,
          resourceType: "document_packet",
          resourceId,
          authUserId: input.authUserId,
          dedupeKey: resourceId ? `document_required:${resourceId}` : null,
        },
        { supabase, nowIso: now }
      );
      break;
    }
    case "document_packet_completed": {
      await completePatientActionsByKind(
        {
          tenantId: tid,
          patientId: pid,
          kinds: ["sign_document"],
          completedByEvent: "document_packet_completed",
        },
        { supabase, nowIso: now }
      );
      await upsertMilestone(supabase, {
        tenantId: tid,
        patientId: pid,
        milestoneKey: "pre_surgery_documents_completed",
        status: "completed",
        completedAt: now,
        linkedResourceType: "document_packet",
        linkedResourceId: resourceId,
        nowIso: now,
      });
      break;
    }
    case "document_rejected": {
      const reason =
        typeof input.detail?.reason === "string" ? input.detail.reason : "Please review and update.";
      const action = await createPatientAction(
        {
          tenantId: tid,
          patientId: pid,
          input: {
            kind: "sign_document",
            title: "Update your documents",
            body: reason,
            deepLinkKey: "documents",
            resourceType: "document_packet",
            resourceId,
            milestoneKey: "pre_surgery_documents_completed",
            createdByEvent: "document_rejected",
            dedupeKey: resourceId ? `sign_document_fix:${resourceId}` : `sign_document_fix:${pid}`,
          },
        },
        { supabase, nowIso: now }
      );
      await upsertMilestone(supabase, {
        tenantId: tid,
        patientId: pid,
        milestoneKey: "pre_surgery_documents_completed",
        status: "action_required",
        linkedResourceType: "document_packet",
        linkedResourceId: resourceId,
        nowIso: now,
      });
      await createPatientNotification(
        {
          tenantId: tid,
          patientId: pid,
          eventType: "document_rejected",
          title: "Documents need updates",
          body: reason,
          actionId: action.action.id,
          resourceType: "document_packet",
          resourceId,
          authUserId: input.authUserId,
          dedupeKey: resourceId ? `document_rejected:${resourceId}:${now}` : null,
        },
        { supabase, nowIso: now }
      );
      break;
    }
    case "surgery_booked": {
      await upsertMilestone(supabase, {
        tenantId: tid,
        patientId: pid,
        milestoneKey: "surgery_booked",
        status: "completed",
        completedAt: now,
        linkedResourceType: resourceType ?? "appointment",
        linkedResourceId: resourceId,
        nowIso: now,
      });
      await createPatientAction(
        {
          tenantId: tid,
          patientId: pid,
          input: {
            kind: "attend_appointment",
            title: PATIENT_ACTION_DEFAULT_TITLES.attend_appointment,
            deepLinkKey: "appointments",
            resourceType: "appointment",
            resourceId,
            milestoneKey: "surgery_booked",
            createdByEvent: "surgery_booked",
            dedupeKey: resourceId ? `attend_appointment:${resourceId}` : `attend_appointment:${pid}`,
          },
        },
        { supabase, nowIso: now }
      );
      break;
    }
    case "surgery_readiness_ready": {
      await upsertMilestone(supabase, {
        tenantId: tid,
        patientId: pid,
        milestoneKey: "patient_cleared_for_surgery",
        status: "completed",
        completedAt: now,
        linkedResourceType: resourceType,
        linkedResourceId: resourceId,
        nowIso: now,
      });
      await completePatientActionsByKind(
        {
          tenantId: tid,
          patientId: pid,
          kinds: ["await_surgery_confirmation", "await_medical_clearance"],
          completedByEvent: "surgery_readiness_ready",
        },
        { supabase, nowIso: now }
      );
      break;
    }
    default: {
      const _exhaustive: never = input.event;
      void _exhaustive;
      break;
    }
  }

  return { ok: true };
}