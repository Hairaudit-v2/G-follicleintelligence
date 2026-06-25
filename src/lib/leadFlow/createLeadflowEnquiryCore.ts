import { z } from "zod";

export const LEADFLOW_ENQUIRY_INTEREST_OPTIONS = [
  { value: "hair_transplant", label: "Hair transplant" },
  { value: "hairline_restoration", label: "Hairline restoration" },
  { value: "crown_restoration", label: "Crown restoration" },
  { value: "prp", label: "PRP" },
  { value: "exosomes", label: "Exosomes" },
  { value: "hair_loss_assessment", label: "Hair loss assessment" },
  { value: "general_enquiry", label: "General enquiry" },
] as const;

export const LEADFLOW_ENQUIRY_SOURCE_OPTIONS = [
  { value: "website", label: "Website" },
  { value: "phone_call", label: "Phone call" },
  { value: "walk_in", label: "Walk in" },
  { value: "meta_ads", label: "Meta ads" },
  { value: "google_ads", label: "Google ads" },
  { value: "referral", label: "Referral" },
  { value: "hubspot", label: "HubSpot" },
  { value: "other", label: "Other" },
] as const;

export const LEADFLOW_ENQUIRY_PRIORITY_OPTIONS = [
  { value: "normal", label: "normal" },
  { value: "high", label: "high" },
  { value: "urgent", label: "urgent" },
] as const;

export type LeadflowEnquirySourceValue = (typeof LEADFLOW_ENQUIRY_SOURCE_OPTIONS)[number]["value"];

/** Canonical operator-facing labels for stored lead source keys. */
export const LEADFLOW_ENQUIRY_SOURCE_LABELS: Record<LeadflowEnquirySourceValue, string> = {
  website: "Website",
  phone_call: "Phone call",
  walk_in: "Walk in",
  meta_ads: "Meta ads",
  google_ads: "Google ads",
  referral: "Referral",
  hubspot: "HubSpot",
  other: "Other",
};

const interestValues = LEADFLOW_ENQUIRY_INTEREST_OPTIONS.map((o) => o.value) as [
  (typeof LEADFLOW_ENQUIRY_INTEREST_OPTIONS)[number]["value"],
  ...(typeof LEADFLOW_ENQUIRY_INTEREST_OPTIONS)[number]["value"][],
];

const sourceValues = LEADFLOW_ENQUIRY_SOURCE_OPTIONS.map((o) => o.value) as [
  LeadflowEnquirySourceValue,
  ...LeadflowEnquirySourceValue[],
];

const priorityValues = LEADFLOW_ENQUIRY_PRIORITY_OPTIONS.map((o) => o.value) as [
  (typeof LEADFLOW_ENQUIRY_PRIORITY_OPTIONS)[number]["value"],
  ...(typeof LEADFLOW_ENQUIRY_PRIORITY_OPTIONS)[number]["value"][],
];

export const createLeadflowEnquiryInputSchema = z
  .object({
    name: z.string().trim().min(1, "Patient / enquiry name is required."),
    phone: z.string().trim().optional(),
    email: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid email address."),
    interest: z.enum(interestValues, { required_error: "Interest is required." }),
    leadSource: z.enum(sourceValues).optional(),
    primaryOwnerUserId: z.string().uuid().optional().nullable(),
    priority: z.enum(priorityValues).optional(),
    notes: z.string().trim().optional(),
  })
  .superRefine((val, ctx) => {
    const phone = val.phone?.trim() ?? "";
    const email = val.email?.trim() ?? "";
    if (!phone && !email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least a phone number or email address.",
        path: ["phone"],
      });
    }
  });

export type CreateLeadflowEnquiryInput = z.infer<typeof createLeadflowEnquiryInputSchema>;

function labelForValue<T extends readonly { value: string; label: string }[]>(
  options: T,
  value: string | undefined
): string | null {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? null;
}

/** Returns the canonical operator-facing label for a lead source key. */
export function normalizeLeadSourceLabel(value: string | undefined | null): string | null {
  const key = value?.trim();
  if (!key) return null;
  if (key in LEADFLOW_ENQUIRY_SOURCE_LABELS) {
    return LEADFLOW_ENQUIRY_SOURCE_LABELS[key as LeadflowEnquirySourceValue];
  }
  return labelForValue(LEADFLOW_ENQUIRY_SOURCE_OPTIONS, key);
}

function optionalTrimmed(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

/** Operator-safe lead metadata written from the enquiry UI. */
export function buildLeadflowEnquiryLeadMetadata(input: CreateLeadflowEnquiryInput): Record<string, unknown> {
  const interestLabel = labelForValue(LEADFLOW_ENQUIRY_INTEREST_OPTIONS, input.interest) ?? input.interest;
  const metadata: Record<string, unknown> = {
    created_via: "leadflow_enquiry_ui",
    interest: input.interest,
    interest_label: interestLabel,
  };

  if (input.leadSource) {
    metadata.lead_source = input.leadSource;
    const sourceLabel = normalizeLeadSourceLabel(input.leadSource);
    if (sourceLabel) metadata.lead_source_label = sourceLabel;
  }

  const notes = optionalTrimmed(input.notes);
  if (notes) metadata.intake_notes = notes;

  return metadata;
}

/** Maps operator-facing enquiry fields to the low-level CRM create payload. */
export function mapLeadflowEnquiryToCrmCreateBody(input: CreateLeadflowEnquiryInput): Record<string, unknown> {
  const name = input.name.trim();
  const phone = optionalTrimmed(input.phone);
  const email = optionalTrimmed(input.email);
  const notes = optionalTrimmed(input.notes);
  const interestLabel = labelForValue(LEADFLOW_ENQUIRY_INTEREST_OPTIONS, input.interest) ?? input.interest;
  const summary = `${interestLabel} — ${name}`;

  const person: Record<string, unknown> = {
    display_name: name,
    source_system: "fi_crm",
    phone,
    email,
  };

  if (notes) {
    person.metadata = { notes };
  }

  const body: Record<string, unknown> = {
    summary,
    status: "open",
    metadata: buildLeadflowEnquiryLeadMetadata(input),
    person,
  };

  const owner = optionalTrimmed(input.primaryOwnerUserId ?? undefined);
  if (owner) body.primaryOwnerUserId = owner;

  const priority = optionalTrimmed(input.priority);
  if (priority && priority !== "normal") body.priority = priority;

  return body;
}
