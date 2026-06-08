import type { FiPrescriptionItemRow } from "@/src/lib/prescribing/fiPrescribingTypes";

export function prescriptionItemHasRepeatText(it: {
  repeats_instructions: string | null;
  reorder_rule: string | null;
}): boolean {
  return Boolean(it.repeats_instructions?.trim() || it.reorder_rule?.trim());
}

/** Returns error message or null when OK. */
export function validateRepeatRulesPrescriberConfirmed(
  items: Array<
    Pick<FiPrescriptionItemRow, "repeats_instructions" | "reorder_rule" | "repeat_rules_prescriber_confirmed">
  >
): string | null {
  for (const it of items) {
    if (prescriptionItemHasRepeatText(it) && !it.repeat_rules_prescriber_confirmed) {
      return "Each line with repeats or reorder instructions must have prescriber confirmation (repeat rules) before signing or sending to pharmacy.";
    }
  }
  return null;
}
