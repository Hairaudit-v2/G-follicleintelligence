const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Parse `?preview=<uuid>` from CRM lead detail deep links. */
export function parseCrmLeadPreviewSearchParam(
  raw: string | string[] | undefined
): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const t = v?.trim();
  if (!t || !UUID_RE.test(t)) return undefined;
  return t;
}
