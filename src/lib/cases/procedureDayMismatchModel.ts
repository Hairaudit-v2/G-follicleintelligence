/**
 * Pure helpers for procedure-day vs booking / calendar mismatches (V1.1).
 */

export type ProcedureDayMismatchSeverity = "warning" | "info";

export type ProcedureDayMismatchItem = {
  severity: ProcedureDayMismatchSeverity;
  message: string;
};

function normYmd(s: string | null | undefined): string | null {
  const t = s?.trim().slice(0, 10) ?? "";
  return t || null;
}

/**
 * Surface inconsistencies between the procedure-day record and linked surgery booking.
 */
export function buildProcedureDayMismatchWarnings(input: {
  procedureDateYmd: string | null;
  linkedSurgeryBookingYmd: string | null;
}): ProcedureDayMismatchItem[] {
  const out: ProcedureDayMismatchItem[] = [];
  const proc = normYmd(input.procedureDateYmd);
  const book = normYmd(input.linkedSurgeryBookingYmd);

  if (proc && book && proc !== book) {
    out.push({
      severity: "warning",
      message: `Procedure date (${proc}) does not match the earliest linked surgery booking calendar day (${book}).`,
    });
  }

  if (!proc && book) {
    out.push({
      severity: "warning",
      message: "Linked surgery booking exists but procedure date is not set on the procedure-day record.",
    });
  }

  return out;
}
