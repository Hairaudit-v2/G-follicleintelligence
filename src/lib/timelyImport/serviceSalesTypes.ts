/** FI-normalised service catalogue buckets (Stage 7A.1). */
export const FI_SERVICE_CATEGORIES = [
  "Consultation",
  "Treatment",
  "Surgery",
  "Follow-up",
  "Diagnostics",
  "Other",
] as const;

export type FiServiceCategory = (typeof FI_SERVICE_CATEGORIES)[number];

/** Raw row extracted from Timely-style Service Sales CSV (after header map). */
export type TimelyServiceSalesExtract = {
  timelyCategory: string;
  timelyServiceName: string;
  usageQuantity: number;
  averageAmount: number | null;
  grossAmount: number | null;
  taxAmount: number | null;
  netAmount: number | null;
  sourceLineNumber: number;
};

export type TimelyRowDisposition = { kind: "seed" } | { kind: "excluded"; reason: string };

/** Review record — not inserted into DB; may include fields beyond `fi_services`. */
export type FiServiceSeedReviewRow = {
  name: string;
  category: FiServiceCategory;
  booking_type: string | null;
  duration_minutes: number;
  base_price: number;
  color: string | null;
  is_active: boolean;
  is_bookable: boolean;
  source: "timely_import";
  notes: string;
  review_flags: string[];
  timely: TimelyServiceSalesExtract;
};

export type FiServiceSeedBuildResult = {
  seedRows: FiServiceSeedReviewRow[];
  excluded: { line: number; summary: string; reason: string }[];
  warnings: string[];
};
