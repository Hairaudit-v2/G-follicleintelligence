/**
 * OnboardingOS Phase F4 — HubSpot read-only lead connector engine (pure; no server-only).
 * Deterministic keyword classification only — no AI.
 */

import type {
  HubspotApiContact,
  HubspotApiDeal,
  HubspotImportStatus,
  HubspotLeadType,
  HubspotStagingContact,
  HubspotStagingDeal,
  HubspotSyncHealth,
  HubspotSyncPreview,
  HubspotSyncRun,
  HubspotSyncRunStatus,
  NormalizedHubspotContact,
  NormalizedHubspotDeal,
} from "./hubspotConnectorTypes";
import { isHubspotLeadType } from "./hubspotConnectorTypes";

/** Keyword rules ordered by specificity (first match wins). */
const LEAD_CLASSIFICATION_RULES: readonly { type: HubspotLeadType; keywords: readonly string[] }[] = [
  { type: "exosomes", keywords: ["exosome", "exosomes"] },
  { type: "prp", keywords: ["prp", "platelet rich plasma", "platelet-rich"] },
  {
    type: "hair_transplant",
    keywords: ["hair transplant", "fue", "dhi", "transplant", "surgery", "procedure"],
  },
  { type: "trichology", keywords: ["trichology", "trichologist", "scalp treatment", "scalp care"] },
  { type: "follow_up", keywords: ["follow up", "follow-up", "followup", "post op", "post-op", "postoperative"] },
  { type: "review", keywords: ["review", "check-in", "check in", "progress review", "6 month", "12 month"] },
];

function normalizeSearchText(...parts: (string | null | undefined)[]): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase();
  return email && email.includes("@") ? email : null;
}

function normalizePhone(value: string | null | undefined): string | null {
  const phone = value?.replace(/\s+/g, " ").trim();
  return phone || null;
}

function extractProperty(props: Record<string, string | null | undefined> | undefined, ...keys: string[]): string | null {
  if (!props) return null;
  for (const key of keys) {
    const val = props[key];
    if (val != null && String(val).trim()) return String(val).trim();
  }
  return null;
}

/** Classify lead type from contact/deal fields using deterministic keyword matching. */
export function classifyHubspotLeadType(
  ...textParts: (string | null | undefined)[]
): HubspotLeadType {
  const haystack = normalizeSearchText(...textParts);
  if (!haystack) return "unknown";

  for (const rule of LEAD_CLASSIFICATION_RULES) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      return rule.type;
    }
  }
  return "unknown";
}

/** Normalize a HubSpot CRM contact into FI staging shape. */
export function normalizeHubspotContact(
  contact: HubspotApiContact,
  opts?: { existingEmails?: readonly string[]; existingPhones?: readonly string[] }
): NormalizedHubspotContact | null {
  const hubspotContactId = contact.id?.trim();
  if (!hubspotContactId) return null;

  const props = contact.properties ?? {};
  const email = normalizeEmail(extractProperty(props, "email"));
  const phone = normalizePhone(
    extractProperty(props, "phone", "mobilephone", "phone_number", "hs_whatsapp_phone_number")
  );
  const leadSource = extractProperty(props, "hs_lead_status", "lead_source", "hs_analytics_source", "source");
  const firstName = extractProperty(props, "firstname");
  const lastName = extractProperty(props, "lastname");
  const lifecycleStage = extractProperty(props, "lifecyclestage");
  const contactType = extractProperty(props, "contact_type", "type");
  const stageOfJourney = extractProperty(props, "stage_of_journey", "hs_pipeline");

  const normalizedLeadType = classifyHubspotLeadType(
    firstName,
    lastName,
    leadSource,
    lifecycleStage,
    contactType,
    stageOfJourney,
    extractProperty(props, "non_surgical", "non_surgical_treatment")
  );

  const duplicateRisk = detectHubspotDuplicateLead(
    { email, phone, hubspotContactId },
    opts?.existingEmails ?? [],
    opts?.existingPhones ?? []
  );

  return {
    hubspotContactId,
    email,
    phone,
    leadSource,
    normalizedLeadType,
    duplicateRisk,
    rawPayload: { ...contact } as Record<string, unknown>,
  };
}

/** Normalize a HubSpot CRM deal into FI staging shape. */
export function normalizeHubspotDeal(
  deal: HubspotApiDeal,
  opts?: {
    pipelineName?: string | null;
    associatedEmail?: string | null;
    associatedPhone?: string | null;
    existingDealIds?: readonly string[];
    existingEmails?: readonly string[];
  }
): NormalizedHubspotDeal | null {
  const hubspotDealId = deal.id?.trim();
  if (!hubspotDealId) return null;

  const props = deal.properties ?? {};
  const dealName = extractProperty(props, "dealname");
  const dealStage = extractProperty(props, "dealstage");
  const pipelineName = opts?.pipelineName ?? extractProperty(props, "pipeline", "hs_pipeline");
  const leadSource = extractProperty(props, "hs_analytics_source", "lead_source", "source");
  const hubspotContactId = extractProperty(props, "associated_contact_id", "hubspot_owner_id");
  const email = normalizeEmail(opts?.associatedEmail ?? extractProperty(props, "email"));
  const phone = normalizePhone(opts?.associatedPhone ?? extractProperty(props, "phone"));

  const normalizedLeadType = classifyHubspotLeadType(dealName, dealStage, pipelineName, leadSource);

  const duplicateRisk =
    (opts?.existingDealIds ?? []).includes(hubspotDealId) ||
    detectHubspotDuplicateLead(
      { email, phone, hubspotContactId: hubspotDealId },
      opts?.existingEmails ?? [],
      []
    );

  return {
    hubspotDealId,
    hubspotContactId,
    email,
    phone,
    leadSource,
    pipelineName,
    dealStage,
    normalizedLeadType,
    duplicateRisk,
    rawPayload: { ...deal } as Record<string, unknown>,
  };
}

/** Detect duplicate lead risk by email or phone against existing staged records. */
export function detectHubspotDuplicateLead(
  candidate: { email?: string | null; phone?: string | null; hubspotContactId?: string },
  existingEmails: readonly string[],
  existingPhones: readonly string[]
): boolean {
  const email = normalizeEmail(candidate.email);
  const phone = normalizePhone(candidate.phone);

  if (email && existingEmails.some((e) => normalizeEmail(e) === email)) return true;
  if (phone && existingPhones.some((p) => normalizePhone(p) === phone)) return true;
  return false;
}

/** Detect duplicate contact against existing staging rows. */
export function detectDuplicateHubspotContact(
  candidate: NormalizedHubspotContact,
  existing: readonly Pick<
    HubspotStagingContact,
    "hubspotContactId" | "email" | "phone" | "importStatus"
  >[]
): boolean {
  for (const row of existing) {
    if (row.hubspotContactId === candidate.hubspotContactId) return true;

    if (row.importStatus === "rejected") continue;

    const emailMatch =
      candidate.email &&
      row.email &&
      normalizeEmail(candidate.email) === normalizeEmail(row.email);
    const phoneMatch =
      candidate.phone &&
      row.phone &&
      normalizePhone(candidate.phone) === normalizePhone(row.phone);

    if (emailMatch || phoneMatch) return true;
  }
  return false;
}

/** Detect duplicate deal against existing staging rows. */
export function detectDuplicateHubspotDeal(
  candidate: NormalizedHubspotDeal,
  existing: readonly Pick<
    HubspotStagingDeal,
    "hubspotDealId" | "email" | "importStatus"
  >[]
): boolean {
  for (const row of existing) {
    if (row.hubspotDealId === candidate.hubspotDealId) return true;

    if (row.importStatus === "rejected") continue;

    if (
      candidate.email &&
      row.email &&
      normalizeEmail(candidate.email) === normalizeEmail(row.email)
    ) {
      return true;
    }
  }
  return false;
}

/** Build sync preview from discovered contacts/deals and existing staging rows. */
export function buildHubspotSyncPreview(opts: {
  integrationId: string;
  discoveredContacts: readonly HubspotApiContact[];
  discoveredDeals: readonly HubspotApiDeal[];
  existingContacts: readonly Pick<
    HubspotStagingContact,
    "hubspotContactId" | "email" | "phone" | "importStatus"
  >[];
  existingDeals: readonly Pick<HubspotStagingDeal, "hubspotDealId" | "email" | "importStatus">[];
  pipelineNames?: Record<string, string>;
}): HubspotSyncPreview {
  const warnings: string[] = [];
  const normalizedContacts: NormalizedHubspotContact[] = [];
  let contactDuplicateCount = 0;
  let duplicateRiskCount = 0;

  const existingEmails = opts.existingContacts
    .map((c) => c.email)
    .filter(Boolean) as string[];
  const existingPhones = opts.existingContacts
    .map((c) => c.phone)
    .filter(Boolean) as string[];

  for (const raw of opts.discoveredContacts) {
    const contact = normalizeHubspotContact(raw, { existingEmails, existingPhones });
    if (!contact) {
      warnings.push("Skipped contact without ID.");
      continue;
    }
    if (detectDuplicateHubspotContact(contact, opts.existingContacts)) {
      contactDuplicateCount += 1;
      continue;
    }
    if (contact.duplicateRisk) duplicateRiskCount += 1;
    normalizedContacts.push(contact);
  }

  const normalizedDeals: NormalizedHubspotDeal[] = [];
  let dealDuplicateCount = 0;
  const existingDealIds = opts.existingDeals.map((d) => d.hubspotDealId);
  const existingDealEmails = opts.existingDeals.map((d) => d.email).filter(Boolean) as string[];

  for (const raw of opts.discoveredDeals) {
    const pipelineId = extractProperty(raw.properties, "pipeline");
    const pipelineName = pipelineId ? opts.pipelineNames?.[pipelineId] ?? pipelineId : null;
    const deal = normalizeHubspotDeal(raw, {
      pipelineName,
      existingDealIds,
      existingEmails: existingDealEmails,
    });
    if (!deal) {
      warnings.push("Skipped deal without ID.");
      continue;
    }
    if (detectDuplicateHubspotDeal(deal, opts.existingDeals)) {
      dealDuplicateCount += 1;
      continue;
    }
    if (deal.duplicateRisk) duplicateRiskCount += 1;
    normalizedDeals.push(deal);
  }

  return {
    integrationId: opts.integrationId,
    contactsDiscovered: opts.discoveredContacts.length,
    contactsToStage: normalizedContacts.length,
    contactDuplicateCount,
    dealsDiscovered: opts.discoveredDeals.length,
    dealsToStage: normalizedDeals.length,
    dealDuplicateCount,
    duplicateRiskCount,
    sampleContacts: normalizedContacts.slice(0, 5),
    sampleDeals: normalizedDeals.slice(0, 5),
    warnings,
  };
}

/** Resolve next import status after admin review action. */
export function resolveHubspotImportStatus(
  currentStatus: HubspotImportStatus | string,
  action: "approve" | "reject"
): HubspotImportStatus | null {
  const status = String(currentStatus ?? "").trim() as HubspotImportStatus;
  if (status !== "staged" && status !== "reviewed") return null;
  return action === "approve" ? "approved" : "rejected";
}

/** Calculate sync health from recent runs and staging queue. */
export function calculateHubspotSyncHealth(opts: {
  latestSyncRun: HubspotSyncRun | null;
  recentSyncRuns: readonly HubspotSyncRun[];
  stagingContacts: readonly Pick<HubspotStagingContact, "importStatus" | "duplicateRisk">[];
  stagingDeals: readonly Pick<HubspotStagingDeal, "importStatus" | "duplicateRisk">[];
  authVerified: boolean;
}): HubspotSyncHealth {
  const contactsPendingReview = opts.stagingContacts.filter((c) => c.importStatus === "staged").length;
  const dealsPendingReview = opts.stagingDeals.filter((d) => d.importStatus === "staged").length;
  const approvedCount =
    opts.stagingContacts.filter((c) => c.importStatus === "approved").length +
    opts.stagingDeals.filter((d) => d.importStatus === "approved").length;
  const rejectedCount =
    opts.stagingContacts.filter((c) => c.importStatus === "rejected").length +
    opts.stagingDeals.filter((d) => d.importStatus === "rejected").length;
  const duplicateRiskCount =
    opts.stagingContacts.filter((c) => c.duplicateRisk && c.importStatus === "staged").length +
    opts.stagingDeals.filter((d) => d.duplicateRisk && d.importStatus === "staged").length;

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!opts.authVerified) {
    blockers.push("HubSpot credentials not verified — sync unavailable.");
  }

  const lastRun = opts.latestSyncRun;
  const lastSyncAt = lastRun?.completedAt ?? lastRun?.startedAt ?? null;
  const lastSyncStatus = lastRun?.status ?? null;

  let healthScore = 0;

  if (opts.authVerified) healthScore += 30;
  if (lastRun?.status === "completed") healthScore += 40;
  else if (lastRun?.status === "partial") healthScore += 25;
  else if (lastRun?.status === "failed") healthScore += 5;

  const totalDiscovered = (lastRun?.contactsDiscovered ?? 0) + (lastRun?.dealsDiscovered ?? 0);
  const totalStaged = (lastRun?.contactsStaged ?? 0) + (lastRun?.dealsStaged ?? 0);
  if (lastRun && totalDiscovered > 0) {
    const stageRate = totalStaged / totalDiscovered;
    healthScore += Math.round(stageRate * 20);
  } else if (lastRun?.status === "completed") {
    healthScore += 15;
  }

  const pendingTotal = contactsPendingReview + dealsPendingReview;
  if (pendingTotal > 20) {
    warnings.push(`${pendingTotal} records awaiting review — clear staging queue.`);
    healthScore = Math.max(0, healthScore - 10);
  }

  if (duplicateRiskCount > 0) {
    warnings.push(`${duplicateRiskCount} record(s) flagged with duplicate risk — review before approval.`);
    healthScore = Math.max(0, healthScore - 5);
  }

  const failedRecent = opts.recentSyncRuns.filter((r) => r.status === "failed").length;
  if (failedRecent >= 2) {
    warnings.push("Multiple recent sync failures — check OAuth token and HubSpot portal configuration.");
    healthScore = Math.max(0, healthScore - 15);
  }

  healthScore = Math.min(100, Math.max(0, healthScore));

  let healthBand: HubspotSyncHealth["healthBand"] = "unknown";
  if (!opts.authVerified && !lastRun) healthBand = "unknown";
  else if (healthScore >= 75) healthBand = "healthy";
  else if (healthScore >= 45) healthBand = "degraded";
  else healthBand = "unhealthy";

  const summary =
    !opts.authVerified
      ? "Verify HubSpot credentials before syncing."
      : lastRun?.status === "failed"
        ? "Last sync failed — review connector auth and portal configuration."
        : pendingTotal > 0
          ? `${pendingTotal} staged record(s) pending human review — no automatic import.`
          : lastRun?.status === "completed"
            ? "HubSpot sync healthy — contacts and deals staged for review only."
            : "Run a manual sync to discover HubSpot contacts and deals.";

  return {
    healthScore,
    healthBand,
    lastSyncAt,
    lastSyncStatus,
    contactsPendingReview,
    dealsPendingReview,
    duplicateRiskCount,
    approvedCount,
    rejectedCount,
    summary,
    blockers,
    warnings,
  };
}

/** Map raw sync run status string safely. */
export function coerceHubspotSyncRunStatus(value: string): HubspotSyncRunStatus {
  const v = value.trim();
  if (v === "completed" || v === "partial" || v === "failed" || v === "started") return v;
  return "failed";
}

/** Map raw lead type string safely. */
export function coerceHubspotLeadType(value: string): HubspotLeadType {
  return isHubspotLeadType(value) ? value : "unknown";
}
