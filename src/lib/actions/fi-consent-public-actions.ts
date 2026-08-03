"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { signConsentViaToken } from "@/src/lib/consents/consentAccessToken.server";

const signSchema = z
  .object({
    token: z.string().min(16).max(200),
    signedName: z.string().min(1).max(200),
    agreed: z.boolean(),
    clinicDevice: z.boolean().optional(),
  })
  .strict();

/**
 * Public patient e-sign (no staff session). CSRF-safe via Next server action binding.
 */
export async function signPatientConsentViaTokenAction(
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = signSchema.parse(body);
    const result = await signConsentViaToken({
      rawToken: parsed.token,
      signedName: parsed.signedName,
      agreed: parsed.agreed,
      clinicDevice: parsed.clinicDevice === true,
    });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    revalidatePath(`/fi-admin/${result.tenantId}/patients/${result.patientId}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { ok: false, error: e.errors[0]?.message ?? "Invalid input." };
    }
    return {
      ok: false,
      error: "We could not record this consent. Try again or contact the clinic.",
    };
  }
}
