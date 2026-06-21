/**
 * Copy and structure for `/platform/ecosystem` — connected OS architecture narrative.
 * Module cards pull from `HOME_PAGE_CONTENT.onePlatform.layers` in homePageContent.ts.
 */

export const ECOSYSTEM_ARCHITECTURE_PAGE_CONTENT = {
  hero: {
    id: "ecosystem-hero",
    eyebrow: "Ecosystem architecture",
    headline: "The operating system behind modern hair restoration medicine",
    subheadline:
      "Follicle Intelligence connects acquisition, consultation, imaging, surgery, audit, workforce, training, finance, and analytics into one clinical intelligence infrastructure layer.",
    body:
      "Follicle Intelligence is not a CRM, booking tool, or reporting dashboard. It is a connected infrastructure layer designed to help clinics acquire patients, deliver measurable clinical quality, train teams, manage operations, and improve outcomes over time.",
    primaryCta: { label: "Explore Platform Progress", href: "/platform/progress" },
    secondaryCta: { label: "View Modules", href: "#module-architecture" },
  },

  architecture: {
    id: "module-architecture",
    eyebrow: "Four engines",
    headline: "One connected operating system — not a bundle of separate tools",
    intro:
      "Every Follicle Intelligence module shares the same intelligence substrate. Four engines span the full hair restoration journey — from first enquiry through workforce readiness, clinical execution, and enterprise governance.",
    caption: "Four engines · connected OS modules · single intelligence substrate",
    layerDescriptions: {
      "Growth Engine":
        "Demand, pipeline discipline, structured consultation, and longitudinal patient records — wired before and during the clinical spine.",
      "Clinical Engine":
        "Evidence-grade imaging, surgical execution, and independent outcome governance — where quality becomes measurable.",
      "Workforce Engine":
        "People infrastructure for hair restoration — HR, rostering, credentialing, training readiness, and competency tied to live clinical work.",
      "Enterprise Engine":
        "Finance, analytics, and day-to-day clinic rhythm — so commercial and operational truth stay aligned with clinical signal.",
    } as const,
  },

  connectedIntelligence: {
    id: "connected-intelligence",
    eyebrow: "Connected intelligence",
    headline: "Why connection matters",
    intro:
      "In hair restoration, the most valuable insights do not live inside one department. They emerge when lead source, consultation quality, image evidence, surgical execution, staff competency, finance, and audited outcomes are connected.",
    insights: [
      "Marketing quality can be measured against real surgical outcomes.",
      "Consultation decisions can be compared with long-term patient satisfaction.",
      "Staff training can be linked to procedure quality and graft handling.",
      "Surgical technique can be benchmarked against audited growth.",
      "Finance can be understood through clinical efficiency and patient journey performance.",
    ],
  },

  digitalTwin: {
    id: "digital-twin",
    eyebrow: "Patient intelligence",
    headline: "The Hair Restoration Digital Twin",
    intro:
      "Every patient journey can become a structured clinical intelligence record, connecting baseline images, history, diagnosis, treatment, surgery, graft data, team involvement, recovery, follow-up imaging, audit results, and satisfaction.",
    stages: [
      "Baseline",
      "Diagnosis",
      "Treatment plan",
      "Imaging",
      "Surgery",
      "Graft and hair data",
      "Workforce involvement",
      "Recovery",
      "Outcome audit",
      "Long-term progression",
    ],
  },

  verticalComparison: {
    id: "vertical-comparison",
    eyebrow: "Category clarity",
    headline: "Built vertically, not horizontally",
    intro:
      "Horizontal CRMs manage relationships. Follicle Intelligence manages the specialised clinical, operational, educational, and financial reality of hair restoration.",
    horizontalCrm: {
      title: "Horizontal CRM",
      items: ["Leads", "Tasks", "Emails", "Pipeline"],
    },
    follicleIntelligence: {
      title: "Follicle Intelligence",
      items: [
        "Leads",
        "Consultation intelligence",
        "Imaging evidence",
        "Surgical records",
        "Graft metrics",
        "Workforce competency",
        "Training readiness",
        "Outcome audits",
        "Financial intelligence",
        "Multi-clinic benchmarking",
      ],
    },
  },

  finalCta: {
    id: "ecosystem-final-cta",
    eyebrow: "Platform progress",
    headline: "One infrastructure layer. Twelve connected systems.",
    body:
      "Follicle Intelligence is being built as a living operating system for clinics, educators, auditors, and industry leaders who want to raise the standard of hair restoration globally.",
    cta: { label: "View live platform progress", href: "/platform/progress" },
  },
} as const;

export type EcosystemArchitecturePageContent = typeof ECOSYSTEM_ARCHITECTURE_PAGE_CONTENT;
