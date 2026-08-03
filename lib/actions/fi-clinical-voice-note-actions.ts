"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  approveClinicalVoiceNote,
  insertTypedClinicalNote,
} from "@/src/lib/clinicalNotes/clinicalNotesMutations.server";
import { loadLatestVoiceClinicalNoteForPatient } from "@/src/lib/clinicalNotes/clinicalNotesLoaders.server";
import { requireClinicalNoteApproverActor } from "@/src/lib/clinicalNotes/clinicalNoteApproverAccess.server";

const approveBodySchema = z.object({
  tenantId: z.string().uuid(),
  clinicalNoteId: z.string().uuid(),
});

const latestNoteBodySchema = z.object({
  tenantId: z.string().uuid(),
  patientId: z.string().uuid(),
  consultationId: z.string().uuid().optional().nullable(),
});

const typedNoteBodySchema = z.object({
  tenantId: z.string().uuid(),
  patientId: z.string().uuid(),
  body: z.string().trim().min(1).max(16000),
  caseId: z.string().uuid().optional().nullable(),
  consultationId: z.string().uuid().optional().nullable(),
});

/**
 * Create a staff-typed clinical note (approved immediately).
 * Same clinical write gate as voice-note approval.
 */
export async function createTypedClinicalNoteAction(
  raw: unknown
): Promise<
  | { ok: true; clinicalNoteId: string }
  | { ok: false; error: string }
> {
  try {
    const parsed = typedNoteBodySchema.parse(raw);
    const actor = await requireClinicalNoteApproverActor(parsed.tenantId);
    const { note } = await insertTypedClinicalNote({
      tenantId: parsed.tenantId,
      patientId: parsed.patientId,
      caseId: parsed.caseId,
      consultationId: parsed.consultationId,
      body: parsed.body,
      createdByFiUserId: actor.fiUserId,
    });

    const tid = parsed.tenantId.trim();
    const pid = parsed.patientId.trim();
    revalidatePath(`/fi-admin/${tid}/patients/${pid}`);
    if (note.case_id?.trim()) {
      revalidatePath(`/fi-admin/${tid}/cases/${note.case_id.trim()}`);
    }
    revalidatePath(`/fi-admin/${tid}/patients`);
    revalidatePath(`/fi-admin/${tid}/cases`);
    revalidatePath(`/fi-admin/${tid}/consultations`);

    return { ok: true, clinicalNoteId: note.id };
  } catch (e) {
    const msg =
      e instanceof z.ZodError
        ? (e.errors[0]?.message ?? "Invalid input.")
        : e instanceof Error
          ? e.message
          : "Request failed.";
    return { ok: false, error: msg };
  }
}

export async function approveClinicalVoiceNoteAction(
  raw: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = approveBodySchema.parse(raw);
    const actor = await requireClinicalNoteApproverActor(parsed.tenantId);
    const updated = await approveClinicalVoiceNote({
      tenantId: parsed.tenantId,
      clinicalNoteId: parsed.clinicalNoteId,
      approvedByFiUserId: actor.fiUserId,
    });

    const tid = parsed.tenantId.trim();
    revalidatePath(`/fi-admin/${tid}/patients/${updated.patient_id.trim()}`);
    if (updated.case_id?.trim()) {
      revalidatePath(`/fi-admin/${tid}/cases/${updated.case_id.trim()}`);
    }
    revalidatePath(`/fi-admin/${tid}/patients`);
    revalidatePath(`/fi-admin/${tid}/cases`);
    revalidatePath(`/fi-admin/${tid}/consultations`);

    return { ok: true };
  } catch (e) {
    const msg =
      e instanceof z.ZodError
        ? (e.errors[0]?.message ?? "Invalid input.")
        : e instanceof Error
          ? e.message
          : "Request failed.";
    return { ok: false, error: msg };
  }
}

export async function loadLatestVoiceClinicalNoteAction(raw: unknown): Promise<
  | {
      ok: true;
      note: {
        id: string;
        record_status: string;
        created_at: string;
        transcript_raw: string;
        sections: Record<string, string>;
        consultation_id: string | null;
      } | null;
    }
  | { ok: false; error: string }
> {
  try {
    const parsed = latestNoteBodySchema.parse(raw);
    // Same gate as approve — staff with clinical write access on the tenant.
    await requireClinicalNoteApproverActor(parsed.tenantId);
    const note = await loadLatestVoiceClinicalNoteForPatient({
      tenantId: parsed.tenantId,
      patientId: parsed.patientId,
      consultationId: parsed.consultationId,
    });
    if (!note) return { ok: true, note: null };
    return {
      ok: true,
      note: {
        id: note.id,
        record_status: note.record_status,
        created_at: note.created_at,
        transcript_raw: note.transcript_raw,
        sections: note.sections,
        consultation_id: note.consultation_id,
      },
    };
  } catch (e) {
    const msg =
      e instanceof z.ZodError
        ? (e.errors[0]?.message ?? "Invalid input.")
        : e instanceof Error
          ? e.message
          : "Request failed.";
    return { ok: false, error: msg };
  }
}
