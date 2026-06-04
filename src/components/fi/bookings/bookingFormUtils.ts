export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(local: string): string | null {
  const t = local.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function defaultRangeIso(): { start: string; end: string } {
  const a = new Date();
  a.setMinutes(0, 0, 0);
  a.setHours(a.getHours() + 1);
  const b = new Date(a);
  b.setHours(b.getHours() + 1);
  return { start: a.toISOString(), end: b.toISOString() };
}
