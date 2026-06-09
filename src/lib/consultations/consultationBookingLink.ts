import type { ConsultationTypeId } from "./consultationTypeConfig";
import { DEFAULT_CONSULTATION_TYPE_ID } from "./consultationTypeConfig";

/** Map operational booking types to ConsultationOS consultation types. */
export function consultationTypeForBookingType(bookingType: string): ConsultationTypeId {
  const t = bookingType.trim().toLowerCase();
  if (t === "prp") return "prp_prf";
  if (t === "exosomes") return "exosomes";
  if (t === "mesotherapy") return "mesotherapy";
  return DEFAULT_CONSULTATION_TYPE_ID;
}
