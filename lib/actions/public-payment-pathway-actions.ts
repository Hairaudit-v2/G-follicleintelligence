"use server";

import { ZodError, z } from "zod";

import { selectPublicPaymentPathwayForToken } from "@/src/lib/financialOs/publicPaymentPathwaySelection.server";

const PATHWAY_TYPES = [
  "pay_in_full",
  "deposit_balance",
  "installment_plan",
  "medical_finance",
  "super_release",
  "international_transfer",
  "manual",
] as const;

const selectSchema = z.object({
  publicToken: z.string().min(24).max(64),
  pathwayType: z.enum(PATHWAY_TYPES),
});

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

export async function selectPublicPaymentPathwayAction(
  body: unknown
): Promise<
  | {
      ok: true;
      pathwayType: string;
      status: string;
      confirmationMessage: string | null;
      continueToCheckout: boolean;
      checkoutUrl: string | null;
    }
  | { ok: false; error: string }
> {
  try {
    const parsed = selectSchema.parse(body);
    const result = await selectPublicPaymentPathwayForToken(parsed.publicToken.trim(), parsed.pathwayType);
    if (!result.ok) return result;
    return {
      ok: true,
      pathwayType: result.pathwayType,
      status: result.status,
      confirmationMessage: result.confirmationMessage,
      continueToCheckout: result.continueToCheckout,
      checkoutUrl: result.checkoutUrl,
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
