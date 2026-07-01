/**
 * WorkforceOS pay period resolution (fortnightly / monthly).
 */

export const PAY_PERIOD_FREQUENCIES = ["fortnightly", "monthly"] as const;
export type PayPeriodFrequency = (typeof PAY_PERIOD_FREQUENCIES)[number];

export type PayPeriodRange = {
  start: string;
  end: string;
  frequency: PayPeriodFrequency;
  label: string;
};

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  const m = YMD_RE.exec(ymd.trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function ymdFromParts(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysBetween(startYmd: string, endYmd: string): number {
  const s = parseYmd(startYmd);
  const e = parseYmd(endYmd);
  if (!s || !e) return 0;
  const start = Date.UTC(s.y, s.m - 1, s.d);
  const end = Date.UTC(e.y, e.m - 1, e.d);
  return Math.round((end - start) / 86_400_000);
}

function addDaysYmd(ymd: string, days: number): string {
  const p = parseYmd(ymd);
  if (!p) return ymd;
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + days));
  return ymdFromParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function endOfMonthYmd(ymd: string): string {
  const p = parseYmd(ymd);
  if (!p) return ymd;
  const last = new Date(Date.UTC(p.y, p.m, 0)).getUTCDate();
  return ymdFromParts(p.y, p.m, last);
}

function startOfMonthYmd(ymd: string): string {
  const p = parseYmd(ymd);
  if (!p) return ymd;
  return ymdFromParts(p.y, p.m, 1);
}

export function isPayPeriodFrequency(value: string): value is PayPeriodFrequency {
  return (PAY_PERIOD_FREQUENCIES as readonly string[]).includes(value);
}

export function resolvePayPeriodContaining(
  dateYmd: string,
  frequency: PayPeriodFrequency,
  anchorYmd: string
): PayPeriodRange {
  const date = dateYmd.trim();
  if (frequency === "monthly") {
    const start = startOfMonthYmd(date);
    const end = endOfMonthYmd(date);
    const p = parseYmd(start);
    const label = p ? `${p.y}-${String(p.m).padStart(2, "0")}` : start;
    return { start, end, frequency, label };
  }

  const anchor = anchorYmd.trim() || date;
  let start = anchor;
  if (daysBetween(anchor, date) < 0) {
    while (daysBetween(start, date) < 0) start = addDaysYmd(start, -14);
  } else {
    while (daysBetween(start, date) >= 14) start = addDaysYmd(start, 14);
  }
  const end = addDaysYmd(start, 13);
  return {
    start,
    end,
    frequency,
    label: `${start} → ${end}`,
  };
}

export type PayPeriodStaffTotal = {
  staffMemberId: string;
  fiStaffId: string | null;
  staffFullName: string | null;
  minutesWorked: number;
  grossCostCents: number;
  entryCount: number;
  approvedCount: number;
};

export function aggregatePayPeriodStaffTotals(
  entries: Array<{
    staffMemberId: string;
    fiStaffId?: string | null;
    staffFullName?: string | null;
    minutesWorked: number;
    grossCostCents: number;
    status: string;
  }>
): PayPeriodStaffTotal[] {
  const map = new Map<string, PayPeriodStaffTotal>();
  for (const e of entries) {
    const key = e.staffMemberId;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        staffMemberId: e.staffMemberId,
        fiStaffId: e.fiStaffId ?? null,
        staffFullName: e.staffFullName ?? null,
        minutesWorked: e.minutesWorked,
        grossCostCents: e.grossCostCents,
        entryCount: 1,
        approvedCount: e.status === "approved" ? 1 : 0,
      });
      continue;
    }
    existing.minutesWorked += e.minutesWorked;
    existing.grossCostCents += e.grossCostCents;
    existing.entryCount += 1;
    if (e.status === "approved") existing.approvedCount += 1;
  }
  return Array.from(map.values()).sort((a, b) =>
    (a.staffFullName ?? "").localeCompare(b.staffFullName ?? "")
  );
}