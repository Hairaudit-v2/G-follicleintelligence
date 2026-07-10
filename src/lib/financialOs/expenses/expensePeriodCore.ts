/** Shared period helpers for FinOS expenses intelligence (Stage 5). */

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function parseExpensePeriodYmd(
  raw: string | null | undefined
): string | null {
  const s = raw?.trim().slice(0, 10) ?? "";
  return YMD.test(s) ? s : null;
}

export function normalizeExpensePeriod(input: {
  periodStart?: string | null;
  periodEnd?: string | null;
  todayYmd?: string;
}): { period_start: string; period_end: string } {
  const today = (input.todayYmd ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  let period_end = parseExpensePeriodYmd(input.periodEnd) ?? today;
  let period_start = parseExpensePeriodYmd(input.periodStart);

  if (!period_start) {
    const d = new Date(`${period_end}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - 29);
    period_start = d.toISOString().slice(0, 10);
  }

  if (period_start > period_end) {
    const t = period_start;
    period_start = period_end;
    period_end = t;
  }

  return { period_start, period_end };
}

export type ExpensePeriodPreset = "30d" | "90d" | "ytd" | "custom";

export function periodFromPreset(
  preset: ExpensePeriodPreset,
  todayYmd?: string
): { period_start: string; period_end: string } {
  const end = (todayYmd ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  if (preset === "ytd") {
    return { period_start: `${end.slice(0, 4)}-01-01`, period_end: end };
  }
  const days = preset === "90d" ? 89 : 29;
  const d = new Date(`${end}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return { period_start: d.toISOString().slice(0, 10), period_end: end };
}
