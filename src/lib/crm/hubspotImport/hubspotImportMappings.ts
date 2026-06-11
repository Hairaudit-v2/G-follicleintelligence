/**
 * Maps HubSpot picklist-ish strings to FI CRM pipeline slugs (default hair_restoration pipeline).
 * Unknown values return slug null (reported as unmapped in dry-run).
 */

const JOURNEY_TO_SLUG: ReadonlyArray<{ re: RegExp; slug: string }> = [
  { re: /^(new|inquiry|lead)\b/i, slug: "new" },
  { re: /contacted|attempt/i, slug: "contacted" },
  { re: /qualif/i, slug: "qualified" },
  { re: /consult.*sched|appointment.*sched|booked.*consult/i, slug: "consult_scheduled" },
  { re: /consult.*(done|complete)|post[-\s]?consult/i, slug: "consult_completed" },
  { re: /plan|quote|proposal/i, slug: "treatment_planning" },
  { re: /quote.*sent|sent.*quote/i, slug: "quote_sent" },
  { re: /deposit|booked|surgery.*book/i, slug: "deposit_or_booked" },
  { re: /in treatment|procedure|surgery day/i, slug: "in_treatment" },
  { re: /won|closed won|customer|patient care/i, slug: "won_closed" },
  { re: /lost|disqual|closed lost/i, slug: "lost" },
  { re: /nurture|follow[-\s]?up|long[-\s]?term/i, slug: "nurture" },
];

/** Known HubSpot lead status strings → canonical keys stored in metadata.hubspot.mapped_lead_status_key */
const LEAD_STATUS_KEYS: ReadonlyArray<{ re: RegExp; key: string }> = [
  { re: /^new\b/i, key: "new" },
  { re: /open|working|active/i, key: "open" },
  { re: /attempt|contacted/i, key: "attempted_contact" },
  { re: /qualif/i, key: "qualified" },
  { re: /unqual|disqual/i, key: "unqualified" },
  { re: /present/i, key: "presentation_scheduled" },
  { re: /decision/i, key: "decision_maker" },
  { re: /contract|sent/i, key: "contract_sent" },
  { re: /won|customer/i, key: "customer" },
  { re: /lost|dead/i, key: "lost" },
];

export function mapStageOfJourneyToPipelineSlug(raw: string | null | undefined): {
  slug: string | null;
  unmapped: boolean;
} {
  const t = raw?.trim();
  if (!t) return { slug: null, unmapped: false };
  for (const { re, slug } of JOURNEY_TO_SLUG) {
    if (re.test(t)) return { slug, unmapped: false };
  }
  return { slug: null, unmapped: true };
}

export function mapLeadStatusToKey(raw: string | null | undefined): { key: string | null; unmapped: boolean } {
  const t = raw?.trim();
  if (!t) return { key: null, unmapped: false };
  for (const { re, key } of LEAD_STATUS_KEYS) {
    if (re.test(t)) return { key, unmapped: false };
  }
  return { key: null, unmapped: true };
}
