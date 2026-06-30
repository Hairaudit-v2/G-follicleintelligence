import type {
  FiPatientPrescriptionRow,
  FiPrescriptionItemRow,
  PrescriptionStatus,
} from "@/src/lib/prescribing/fiPrescribingTypes";

const REORDER_ELIGIBLE_RX_STATUSES: PrescriptionStatus[] = [
  "signed",
  "sent_to_pharmacy",
  "dispensed",
  "posted",
];

export type ReorderEligibility = { ok: true } | { ok: false; reason: string };

export function validatePatientReorderEligibility(params: {
  prescription: FiPatientPrescriptionRow;
  item: FiPrescriptionItemRow;
  now: Date;
}): ReorderEligibility {
  const { prescription: rx, item, now } = params;

  if (!REORDER_ELIGIBLE_RX_STATUSES.includes(rx.status)) {
    return {
      ok: false,
      reason: "This prescription is not eligible for reorder (must be signed or fulfilled).",
    };
  }
  if (!rx.repeats_allowed) {
    return { ok: false, reason: "Repeats are not enabled on this prescription." };
  }
  if (rx.repeat_limit < 1) {
    return { ok: false, reason: "Repeat limit has not been configured by the clinic (minimum 1)." };
  }
  if (rx.reorders_used >= rx.repeat_limit) {
    return {
      ok: false,
      reason: "The maximum number of reorders for this prescription has been reached.",
    };
  }

  if (rx.reorder_valid_from) {
    const from = new Date(rx.reorder_valid_from);
    if (now < from) {
      return { ok: false, reason: "Reorder window has not started yet." };
    }
  }
  if (rx.reorder_valid_until) {
    const until = new Date(rx.reorder_valid_until);
    if (now > until) {
      return { ok: false, reason: "Reorder window has ended." };
    }
  }

  if (item.prescription_id !== rx.id) {
    return { ok: false, reason: "Line item does not belong to this prescription." };
  }

  return { ok: true };
}
