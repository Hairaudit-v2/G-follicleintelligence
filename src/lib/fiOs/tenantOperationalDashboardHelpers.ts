const MS_HOUR = 3_600_000;

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function addHours(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * MS_HOUR);
}

export type AgendaBucket = "consult" | "surgery" | "follow_up" | "other";

export function bookingAgendaBucket(bookingType: string): AgendaBucket {
  const t = bookingType.trim();
  if (t === "consultation") return "consult";
  if (t === "surgery") return "surgery";
  if (t === "follow_up" || t === "review") return "follow_up";
  return "other";
}

/** Same UTC window as the home dashboard agenda (midnight UTC today → +72h). */
export function computeOperationalAgendaUtcRange(now: Date): { startIso: string; endIso: string } {
  const dayStart = utcDayStart(now);
  const rangeEnd = addHours(dayStart, 72);
  return { startIso: dayStart.toISOString(), endIso: rangeEnd.toISOString() };
}
