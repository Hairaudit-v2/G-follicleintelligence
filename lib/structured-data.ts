/**
 * Lightweight JSON-LD structured data helpers for SEO.
 * Schema.org types: Organization, WebSite, SoftwareApplication, FAQPage, BreadcrumbList.
 */

import { ECOSYSTEM_SAME_AS } from "@/lib/seo/constants";
import { PUBLIC_IMAGE_PATHS } from "@/src/lib/brand/publicImages";

const SCHEMA_CONTEXT = "https://schema.org";

/** Canonical SEO title and meta description (root layout, homepage, JSON-LD WebSite). */
export const SITE_SEO_TITLE =
  "Follicle Intelligence | The Operating System for Global Hair Restoration";

export const SITE_SEO_DESCRIPTION =
  "Follicle Intelligence is the operating system for the global hair restoration industry — a unified infrastructure layer connecting patient acquisition, clinical intelligence, surgical workflow, workforce systems, financial operations, training, and global outcome intelligence.";

/** Entity definition for AI assistants and knowledge graphs. */
export const SITE_ENTITY_DEFINITION =
  "Follicle Intelligence is an enterprise healthcare operating system for hair restoration clinics—connecting FoundationOS, ReceptionOS, ConsultationOS, ClinicOS, PatientOS, ImagingOS, SurgeryOS, AuditOS, WorkforceOS, AcademyOS, FinancialOS, AnalyticsOS, and OnboardingOS in one governed clinical intelligence platform.";

/** Shared SEO keywords for platform maturity and discoverability. */
export const SITE_SEO_KEYWORDS = [
  "healthcare operating system",
  "hair transplant clinic software",
  "hair restoration operating system",
  "healthcare workforce management",
  "surgical intelligence platform",
  "hair transplant clinic operating system",
  "medical workforce compliance platform",
  "clinical infrastructure platform",
] as const;

export type FaqItem = { question: string; answer: string };

/** Homepage FAQs — surfaced in FAQPage JSON-LD for SERP and AI citation. */
export const HOME_PAGE_FAQS: readonly FaqItem[] = [
  {
    question: "What is Follicle Intelligence?",
    answer: SITE_ENTITY_DEFINITION,
  },
  {
    question: "Who is Follicle Intelligence for?",
    answer:
      "Independent surgeons, clinic owners, multi-site hair restoration groups, training partners, and institutional collaborators who need accountable quality infrastructure—not a generic horizontal clinic CRM.",
  },
  {
    question: "How is Follicle Intelligence different from traditional clinic software?",
    answer:
      "It is purpose-built for hair restoration: surgical variables, donor intelligence, imaging protocols, independent audit alignment, workforce certification, and longitudinal Patient Twin records—connected in one operating system instead of disconnected vendor modules.",
  },
  {
    question: "What modules are included in the Follicle Intelligence platform?",
    answer:
      "FoundationOS, ReceptionOS, ConsultationOS, ClinicOS, PatientOS, ImagingOS, SurgeryOS, AuditOS, WorkforceOS, AcademyOS, FinancialOS, and AnalyticsOS—plus ecosystem integrations with HairAudit, the Hair Longevity Institute, and the International Institute of Hair Restoration.",
  },
  {
    question: "How do I request a demo or pricing?",
    answer:
      "Book an enterprise demo at https://www.follicleintelligence.ai/demo or contact the team at https://www.follicleintelligence.ai/contact.",
  },
] as const;

/** Pricing page FAQs for FAQPage JSON-LD. */
export const PRICING_PAGE_FAQS: readonly FaqItem[] = [
  {
    question: "How is Follicle Intelligence priced?",
    answer:
      "Pricing is modular and enterprise-scoped—based on clinic size, number of users and sites, modules selected, integrations, imaging and AI requirements, training, and white-label or partner needs. There are no public fixed tiers; teams request a tailored quote.",
  },
  {
    question: "Can we start with a subset of modules?",
    answer:
      "Yes. Clinics typically begin with core operating modules (LeadFlow, ClinicOS, PatientOS, ConsultationOS) and expand into SurgeryOS, ImagingOS, FinancialOS, AnalyticsOS, AcademyOS, and audit-aligned workflows as readiness allows.",
  },
  {
    question: "Does Follicle Intelligence integrate before replacing existing systems?",
    answer:
      "Yes. The platform is designed to integrate alongside existing CRM, booking, and operational tools before becoming the primary operating system when leadership and clinical teams are ready to consolidate.",
  },
  {
    question: "How do I request pricing or a demo?",
    answer:
      "Email sales@follicleintelligence.ai with your clinic profile and module interests, or book a demo at https://www.follicleintelligence.ai/demo.",
  },
] as const;

/** Contact page FAQs for FAQPage JSON-LD. */
export const CONTACT_PAGE_FAQS: readonly FaqItem[] = [
  {
    question: "Who should contact Follicle Intelligence?",
    answer:
      "Clinic owners, surgeons, multi-site operators, training partners, institutional collaborators, security reviewers, and strategic investors evaluating hair restoration infrastructure.",
  },
  {
    question: "What happens after I submit a contact or demo request?",
    answer:
      "The team reviews your clinic profile, deployment scope, and module interests, then schedules a structured discovery conversation—typically covering integration posture, module fit, and a tailored pathway to pilot or enterprise rollout.",
  },
  {
    question: "Can we discuss security, procurement, or partnership separately?",
    answer:
      "Yes. Use https://www.follicleintelligence.ai/contact with intent parameters for demos, partnerships, or institutional engagement; security artefacts are shared through your normal vendor diligence process.",
  },
] as const;

export interface OrganizationOptions {
  name?: string;
  logoPath?: string;
  description?: string;
  sameAs?: string[];
}

/**
 * Build Organization schema (root or footer).
 */
export function buildOrganizationSchema(
  siteUrl: string,
  options: OrganizationOptions = {}
): object {
  const {
    name = "Follicle Intelligence",
    logoPath = PUBLIC_IMAGE_PATHS.follicleLogoWhite,
    description = SITE_ENTITY_DEFINITION,
    sameAs = [...ECOSYSTEM_SAME_AS],
  } = options;
  const base = siteUrl.replace(/\/$/, "");
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Organization",
    name,
    url: base,
    description,
    logo: `${base}${logoPath.startsWith("/") ? logoPath : `/${logoPath}`}`,
    sameAs,
    knowsAbout: [
      "Hair restoration",
      "Hair transplant clinic software",
      "Clinical operating systems",
      "FUE and FUT surgical planning",
      "Trichology",
      "Patient longitudinal records",
      "Medical audit and quality scoring",
    ],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "sales",
        url: `${base}/contact`,
        availableLanguage: ["English"],
      },
    ],
  };
}

export interface WebSiteOptions {
  name?: string;
  description?: string;
}

/**
 * Build WebSite schema (root).
 */
export function buildWebSiteSchema(
  siteUrl: string,
  options: WebSiteOptions = {}
): object {
  const {
    name = "Follicle Intelligence",
    description = SITE_SEO_DESCRIPTION,
  } = options;
  const base = siteUrl.replace(/\/$/, "");
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "WebSite",
    name,
    url: base,
    ...(description && { description }),
    publisher: {
      "@type": "Organization",
      name,
      url: base,
    },
  };
}

export interface SoftwareApplicationOptions {
  name?: string;
  description?: string;
  applicationCategory?: string;
  operatingSystem?: string;
  offersUrl?: string;
}

/**
 * Product schema for platform landing pages.
 */
export function buildSoftwareApplicationSchema(
  siteUrl: string,
  options: SoftwareApplicationOptions = {}
): object {
  const {
    name = "Follicle Intelligence Platform",
    description = SITE_ENTITY_DEFINITION,
    applicationCategory = "BusinessApplication",
    operatingSystem = "Web",
    offersUrl = "/contact",
  } = options;
  const base = siteUrl.replace(/\/$/, "");
  const offerPath = offersUrl.startsWith("http")
    ? offersUrl
    : `${base}${offersUrl.startsWith("/") ? offersUrl : `/${offersUrl}`}`;

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "SoftwareApplication",
    name,
    description,
    applicationCategory,
    operatingSystem,
    url: `${base}/platform`,
    offers: {
      "@type": "Offer",
      url: offerPath,
      price: "0",
      priceCurrency: "USD",
      description: "Enterprise pricing — modular deployment scoped to clinic size and modules.",
    },
    provider: buildOrganizationSchema(siteUrl),
  };
}

/**
 * FAQ schema for rich results and AI answer engines.
 */
export function buildFAQPageSchema(pageUrl: string, faqs: readonly FaqItem[]): object {
  const url = pageUrl.replace(/\/$/, "") || pageUrl;
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
    url,
  };
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function buildBreadcrumbListSchema(items: readonly BreadcrumbItem[]): object {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Root layout: Organization + WebSite. Use with JsonLd component.
 */
export function getRootStructuredData(siteUrl: string): object[] {
  return [buildOrganizationSchema(siteUrl), buildWebSiteSchema(siteUrl)];
}