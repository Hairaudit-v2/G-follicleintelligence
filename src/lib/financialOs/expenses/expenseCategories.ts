/** Default system expense categories seeded per tenant (application layer). */

export type DefaultExpenseCategorySeed = {
  code: string;
  label: string;
  sort_order: number;
  /** Loose keywords used by CSV merchant → category suggestion (lowercase). */
  keywords: readonly string[];
};

export const DEFAULT_EXPENSE_CATEGORY_SEEDS: readonly DefaultExpenseCategorySeed[] = [
  {
    code: "marketing_ads",
    label: "Marketing — paid ads",
    sort_order: 10,
    keywords: ["meta", "facebook", "google ads", "adwords", "tiktok ads", "linkedin ads"],
  },
  {
    code: "marketing_other",
    label: "Marketing — other",
    sort_order: 20,
    keywords: ["mailchimp", "hubspot", "canva", "print", "signage"],
  },
  {
    code: "clinical_consumables",
    label: "Clinical consumables",
    sort_order: 30,
    keywords: ["surgical", "graft", "blade", "suture", "prp", "pharmacy supply"],
  },
  {
    code: "medications",
    label: "Medications & pharmacy",
    sort_order: 40,
    keywords: ["pharmacy", "medication", "chemist", "script"],
  },
  {
    code: "staff_contractors",
    label: "Staff & contractors",
    sort_order: 50,
    keywords: ["contractor", "locum", "super", "payroll tax", "ato"],
  },
  {
    code: "facilities",
    label: "Facilities & rent",
    sort_order: 60,
    keywords: ["rent", "lease", "electricity", "water", "gas", "strata"],
  },
  {
    code: "software_saas",
    label: "Software & SaaS",
    sort_order: 70,
    keywords: ["software", "saas", "subscription", "microsoft", "google workspace", "zoom"],
  },
  {
    code: "equipment",
    label: "Equipment",
    sort_order: 80,
    keywords: ["equipment", "device", "microscope", "implanter"],
  },
  {
    code: "travel",
    label: "Travel & accommodation",
    sort_order: 90,
    keywords: ["airline", "flight", "hotel", "uber", "taxi", "parking"],
  },
  {
    code: "professional_services",
    label: "Professional services",
    sort_order: 100,
    keywords: ["legal", "accountant", "bookkeep", "consulting", "insurance"],
  },
  {
    code: "bank_fees",
    label: "Bank & merchant fees",
    sort_order: 110,
    keywords: ["bank fee", "merchant fee", "stripe fee", "card fee"],
  },
  {
    code: "other",
    label: "Other",
    sort_order: 900,
    keywords: [],
  },
] as const;

export function suggestCategoryCodeFromText(text: string | null | undefined): string | null {
  const hay = (text ?? "").trim().toLowerCase();
  if (!hay) return null;
  for (const seed of DEFAULT_EXPENSE_CATEGORY_SEEDS) {
    if (seed.code === "other") continue;
    for (const kw of seed.keywords) {
      if (hay.includes(kw)) return seed.code;
    }
  }
  return null;
}
