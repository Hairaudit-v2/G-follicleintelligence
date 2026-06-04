export function shallowMergeMetadata(
  base: Record<string, unknown>,
  patch?: Record<string, unknown> | null
): Record<string, unknown> {
  if (!patch || Object.keys(patch).length === 0) return { ...base };
  return { ...base, ...patch };
}

export function slugifyOptional(name: string | null | undefined): string | null {
  if (!name || !name.trim()) return null;
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return s.length ? s : null;
}
