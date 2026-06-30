"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { approveClinicalVoiceNote } from "@/src/lib/clinicalNotes/clinicalNotesMutations.server";
import { requireFiPrescribingActor } from "@/src/lib/prescribing/fiPrescribingAccess.server";

const approveBodySchema = z.object({
  tenantId: z.string().uuid(),
  clinicalNoteId: z.string().uuid(),
});

export async function approveClinicalVoiceNoteAction(
  raw: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = approveBodySchema.parse(raw);
    const actor = await requireFiPrescribingActor(parsed.tenantId);
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
