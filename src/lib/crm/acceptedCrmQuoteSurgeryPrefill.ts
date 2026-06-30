const MAX_DESCRIPTION_CHARS = 7500;

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function readOptionalDayCount(meta: Record<string, unknown>): string | null {
  const keys = [
    "procedure_days",
    "day_count",
    "estimated_procedure_days",
    "surgery_day_count",
  ] as const;
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return String(Math.floor(v));
    if (typeof v === "string" && v.trim()) {
      const n = Number(v.trim());
      if (Number.isFinite(n) && n > 0) return String(Math.floor(n));
      return v.trim();
    }
  }
  return null;
}

function formatQuotedAud(
  subtotal: number | null,
  total: number | null,
  meta: Record<string, unknown>
): string | null {
  const hint = typeof meta.price_quoted_hint === "string" ? meta.price_quoted_hint.trim() : "";
  if (hint) return hint;
  const n = total ?? subtotal;
  if (n != null && Number.isFinite(n) && n > 0) {
    return `AUD ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return null;
}

function graftEstimateShort(meta: Record<string, unknown>): string | null {
  const min = meta.estimated_grafts_min;
  const max = meta.estimated_grafts_max;
  if (
    typeof min === "number" &&
    typeof max === "number" &&
    Number.isFinite(min) &&
    Number.isFinite(max)
  ) {
    return `${Math.floor(min)}–${Math.floor(max)}`;
  }
  if (typeof min === "number" && Number.isFinite(min)) return String(Math.floor(min));
  if (typeof max === "number" && Number.isFinite(max)) return String(Math.floor(max));
  const a = typeof min === "string" ? min.trim() : "";
  const b = typeof max === "string" ? max.trim() : "";
  if (a && b) return `${a}–${b}`;
  return a || b || null;
}

function inclusionLine(meta: Record<string, unknown>): string | null {
  const raw = meta.recommended_treatments;
  if (!Array.isArray(raw) || !raw.length) return null;
  const parts = raw.map((x) => String(x).trim()).filter(Boolean);
  if (!parts.length) return null;
  const lower = parts.map((p) => p.toLowerCase());
  const hits: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    const l = lower[i]!;
    if (l.includes("prp")) hits.push("PRP");
    else if (l.includes("exosome")) hits.push("Exosomes");
    else hits.push(p);
  }
  return `Inclusions / add-ons: ${[...new Set(hits)].join(", ")}`;
}

function procedureNotesFromQuote(
  meta: Record<string, unknown>,
  lineItemsSnapshot: unknown
): string | null {
  const qn = typeof meta.quote_notes === "string" ? meta.quote_notes.trim() : "";
  if (qn) return qn;
  if (
    Array.isArray(lineItemsSnapshot) &&
    lineItemsSnapshot[0] &&
    typeof lineItemsSnapshot[0] === "object"
  ) {
    const li = lineItemsSnapshot[0] as { description?: string };
    if (typeof li.description === "string" && li.description.trim()) return li.description.trim();
  }
  return null;
}

export type AcceptedCrmQuoteLike = {
  id: string;
  consultation_id: string | null;
  subtotal_amount: number | null;
  total_amount: number | null;
  metadata: Record<string, unknown>;
  line_items_snapshot: unknown;
};

/**
 * Builds bounded appointment description + compact booking metadata for surgery scheduling from an accepted CRM quote.
 * Heavy narrative stays in {@code description}; metadata stays small for calendar payloads.
 */
export function buildSurgeryAppointmentPrefillFromAcceptedQuote(q: AcceptedCrmQuoteLike): {
  description: string;
  initialMetadata: Record<string, unknown>;
} {
  const meta = asRecord(q.metadata);
  const lines: string[] = [];
  lines.push(`Scheduled from accepted CRM quote ${q.id}.`);

  const money = formatQuotedAud(q.subtotal_amount, q.total_amount, meta);
  if (money) lines.push(`Quoted amount: ${money}.`);

  const days = readOptionalDayCount(meta);
  if (days) lines.push(`Procedure day count: ${days}.`);

  const graftShort = graftEstimateShort(meta);
  if (graftShort) lines.push(`Estimated grafts / hair plan: ${graftShort}.`);

  const inc = inclusionLine(meta);
  if (inc) lines.push(inc);

  if (q.consultation_id?.trim()) {
    lines.push(`consultation_id: ${q.consultation_id.trim()}`);
  }

  const notes = procedureNotesFromQuote(meta, q.line_items_snapshot);
  if (notes) {
    lines.push("");
    lines.push("Procedure / quote notes:");
    lines.push(notes);
  }

  let description = lines.join("\n").trim();
  if (description.length > MAX_DESCRIPTION_CHARS) {
    description = `${description.slice(0, MAX_DESCRIPTION_CHARS - 1)}…`;
  }

  const initialMetadata: Record<string, unknown> = {
    crm_quote_id: q.id.trim(),
    ...(q.consultation_id?.trim() ? { prefill_consultation_id: q.consultation_id.trim() } : {}),
    ...(graftShort ? { graft_count_estimate: graftShort } : {}),
  };

  return { description, initialMetadata };
}
