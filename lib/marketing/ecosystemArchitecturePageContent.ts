/**
 * Copy and structure for `/platform/ecosystem` — What Makes Follicle Intelligence Different.
 * Edit here to update marketing content without touching layout code.
 */

export const ECOSYSTEM_ARCHITECTURE_PAGE_LABEL =
  "What Makes Follicle Intelligence Different" as const;

export const ECOSYSTEM_ARCHITECTURE_SEO_TITLE =
  `${ECOSYSTEM_ARCHITECTURE_PAGE_LABEL} | Follicle Intelligence` as const;

export const ECOSYSTEM_ARCHITECTURE_SEO_DESCRIPTION =
  "Why Follicle Intelligence is more than CRM software — a vertical intelligence operating system for hair restoration clinics connecting acquisition, clinical decision support, surgery, workforce, outcomes, and analytics." as const;

export type EcosystemArchitectureLayer = {
  readonly layer: number;
  readonly title: string;
  readonly module: string;
  readonly anchorId: string;
  readonly features: readonly string[];
  readonly purpose: string;
};

export const ECOSYSTEM_ARCHITECTURE_PAGE_CONTENT = {
  hero: {
    id: "ecosystem-hero",
    eyebrow: ECOSYSTEM_ARCHITECTURE_PAGE_LABEL,
    headline: "The Operating System Built For Hair Restoration Medicine",
    subheadline: "Not software.",
    subheadlineAccent: "Infrastructure for the future of hair restoration clinics.",
    body: "We are not building clinic software. We are building the operating system for hair restoration medicine — a connected intelligence network where every patient interaction, consultation, treatment, surgery, outcome, and staff action contributes to a continuously learning ecosystem.",
    audiences: [
      "Clinics",
      "Surgeons",
      "Nurses",
      "Consultants",
      "Patients",
      "Educators",
      "Researchers",
      "Enterprise groups",
    ] as const,
    primaryCta: { label: "Explore Platform Progress", href: "/platform/progress" },
    secondaryCta: { label: "View Architecture", href: "#fi-os-architecture" },
  },

  philosophy: {
    id: "ecosystem-philosophy",
    eyebrow: "Core philosophy",
    headline: "The CRM is only one module",
    paragraphs: [
      "Unlike generic software platforms, Follicle Intelligence creates a connected intelligence network across the entire clinic — acquisition, consultation, clinical decision support, imaging, surgery, workforce, operations, finance, outcomes, education, deployment, and executive intelligence.",
      "Every module shares the same intelligence substrate. Every workflow compounds. Every clinic strengthens the network.",
    ],
    pillars: [
      {
        title: "Connected intelligence",
        body: "Signals from marketing, clinical work, surgery, and outcomes reinforce each other in one governed record — not scattered across tools.",
      },
      {
        title: "Vertical depth",
        body: "Purpose-built for hair restoration medicine — diagnostics, graft economics, competency, and audit discipline encoded in the architecture.",
      },
      {
        title: "Compounding network",
        body: "Structured patient journeys create the world's most valuable hair restoration dataset — improving every future decision.",
      },
    ] as const,
  },

  architecture: {
    id: "fi-os-architecture",
    eyebrow: "Follicle Intelligence Ecosystem Architecture",
    headline: "Twelve intelligence layers. One operating system.",
    intro:
      "Each layer is a product-grade intelligence engine — tenant-isolated, role-governed, and designed for multi-clinic enterprise deployment. Together they form infrastructure that controls every layer of a hair restoration business.",
    caption: "Twelve layers · connected OS modules · single intelligence substrate",
    layers: [
      {
        layer: 1,
        title: "Acquisition Intelligence",
        module: "LeadFlow OS",
        anchorId: "leadflow",
        features: [
          "Website enquiries",
          "Meta lead generation",
          "Google Ads conversions",
          "AI chatbot conversations",
          "Referral tracking",
          "Phone call intelligence",
          "Consultation conversion tracking",
          "Marketing attribution analysis",
        ],
        purpose: "Complete acquisition intelligence.",
      },
      {
        layer: 2,
        title: "Consultation Intelligence",
        module: "ConsultationOS",
        anchorId: "consultation-os",
        features: [
          "Digital consultation templates",
          "Hair restoration planning workflows",
          "Body mapping",
          "Voice note capture",
          "Candidate scoring",
          "Treatment planning",
          "Consultation locking",
          "Clinical handoff engine",
          "Consultation completion analytics",
        ],
        purpose: "Standardized consultation intelligence.",
      },
      {
        layer: 3,
        title: "Clinical Intelligence",
        module: "HLI Engine",
        anchorId: "patient-os",
        features: [
          "Hair loss classification",
          "Donor density analysis",
          "Recipient zone planning",
          "Treatment recommendation engine",
          "Trichology assessments",
          "Blood analysis interpretation",
          "Candidate risk scoring",
          "AI diagnostic workflows",
        ],
        purpose: "Machine-assisted clinical decision support.",
      },
      {
        layer: 4,
        title: "Imaging Intelligence",
        module: "ImagingOS",
        anchorId: "imaging-os",
        features: [
          "Standardized protocol capture",
          "Scalp mapping engine",
          "Clinical annotations",
          "AI image classification",
          "Donor assessment automation",
          "Recipient assessment automation",
          "Longitudinal image comparison",
          "Staff review queue",
          "Clinical imaging audit trails",
        ],
        purpose: "Structured clinical imaging intelligence.",
      },
      {
        layer: 5,
        title: "Surgical Intelligence",
        module: "SurgeryOS",
        anchorId: "surgery-os",
        features: [
          "Surgery booking workflows",
          "Graft planning",
          "Hair count intelligence",
          "Transection rate tracking",
          "Punch size tracking",
          "Extraction analytics",
          "Implantation analytics",
          "Procedure staffing engine",
          "Procedure day board",
          "Surgical readiness board",
          "Recovery workflow tracking",
        ],
        purpose: "World-class surgical intelligence.",
      },
      {
        layer: 6,
        title: "Workforce Intelligence",
        module: "WorkforceOS",
        anchorId: "workforce-os",
        features: [
          "Staff onboarding engine",
          "Compliance management",
          "Credential management",
          "SOP acknowledgment engine",
          "Clinical competency scoring",
          "Certification tracking",
          "Training assignments",
          "Clinical rostering engine",
          "Staff reconciliation system",
          "Performance intelligence",
          "Surgeon benchmarking analytics",
        ],
        purpose: "Operational workforce intelligence.",
      },
      {
        layer: 7,
        title: "Operational Intelligence",
        module: "ClinicOS",
        anchorId: "clinic-os",
        features: [
          "Reception board",
          "Calendar management",
          "Room management",
          "Procedure scheduling",
          "Task automation",
          "Workflow orchestration",
          "Multi-location support",
          "Operational readiness monitoring",
        ],
        purpose: "Clinic-wide operational intelligence.",
      },
      {
        layer: 8,
        title: "Financial Intelligence",
        module: "PaymentsOS",
        anchorId: "payments-os",
        features: [
          "Invoice management",
          "Payment requests",
          "Deposit rules",
          "Payment tracking",
          "Revenue monitoring",
          "Surgical payment workflows",
          "Outstanding payment alerts",
          "Payment reconciliation engine",
        ],
        purpose: "Financial workflow intelligence.",
      },
      {
        layer: 9,
        title: "Outcome Intelligence",
        module: "HairAudit + Outcome Intelligence",
        anchorId: "audit-os",
        features: [
          "Growth analysis",
          "Density comparison",
          "Surgical audit reports",
          "Donor recovery analysis",
          "Longitudinal progress tracking",
          "Patient satisfaction scoring",
          "Outcome benchmarking",
          "AI outcome prediction models",
        ],
        purpose: "Long-term clinical outcome intelligence.",
      },
      {
        layer: 10,
        title: "Learning Intelligence",
        module: "AcademyOS + IIOHR",
        anchorId: "academy-os",
        features: [
          "Certification engine",
          "Surgical training pathways",
          "Competency scoring",
          "CPD tracking",
          "Learning assignments",
          "Staff progression monitoring",
          "Performance-linked education analytics",
        ],
        purpose: "Continuous workforce intelligence.",
      },
      {
        layer: 11,
        title: "Deployment Intelligence",
        module: "OnboardingOS",
        anchorId: "onboarding-os",
        features: [
          "Clinic deployment templates",
          "Sandbox demo generation",
          "Connector integrations",
          "HubSpot integration",
          "Google Calendar integration",
          "Migration workflows",
          "Go-live readiness engine",
          "Deployment scoring system",
          "Guided assist mode",
        ],
        purpose: "Enterprise deployment automation.",
      },
      {
        layer: 12,
        title: "Executive Intelligence",
        module: "AnalyticsOS",
        anchorId: "analytics-os",
        features: [
          "Revenue analytics",
          "Staff productivity analytics",
          "Conversion analytics",
          "Surgical efficiency scoring",
          "Clinical performance analytics",
          "Marketing ROI",
          "Predictive business intelligence",
          "Cross-clinic benchmarking",
        ],
        purpose: "Executive-level decision intelligence.",
      },
    ] satisfies readonly EcosystemArchitectureLayer[],
  },

  crmComparison: {
    id: "bigger-than-crm",
    eyebrow: "Category distinction",
    headline: "Why This Is Bigger Than CRM Software",
    intro:
      "Traditional software manages relationships. Follicle Intelligence manages the entire operating model of a hair restoration clinic — creating extreme switching cost by design.",
    traditional: {
      title: "Traditional CRM Software",
      subtitle: "Manages relationships",
      items: ["Leads", "Tasks", "Emails", "Pipeline", "Contact records", "Appointment booking"],
    },
    follicleIntelligence: {
      title: "Follicle Intelligence",
      subtitle: "Manages the entire operating model",
      items: [
        "Patients",
        "Clinical decisions",
        "Surgical execution",
        "Staff competency",
        "Treatment outcomes",
        "Imaging intelligence",
        "Education systems",
        "Operational infrastructure",
        "Financial systems",
        "Predictive analytics",
      ],
    },
    switchingCost: {
      headline: "Extreme switching cost by design",
      body: "A clinic can replace CRM software. A clinic cannot easily replace an operating system controlling every layer of their business — acquisition, clinical intelligence, surgical execution, workforce competency, financial workflows, outcome auditing, and executive analytics.",
    },
  },

  globalNetwork: {
    id: "global-intelligence-network",
    eyebrow: "Future intelligence",
    headline: "The Global Hair Restoration Intelligence Network",
    intro:
      "Every structured patient journey strengthens the network. The AI continuously learns — turning operational discipline into predictive capability at scale.",
    learningLoop: [
      {
        subject: "Every patient",
        outcome: "contributes structured data.",
      },
      {
        subject: "Every consultation",
        outcome: "improves intelligence.",
      },
      {
        subject: "Every surgery",
        outcome: "improves future planning.",
      },
      {
        subject: "Every outcome",
        outcome: "improves predictive capability.",
      },
      {
        subject: "Every staff member",
        outcome: "improves workforce intelligence.",
      },
      {
        subject: "Every clinic",
        outcome: "strengthens the network.",
      },
    ] as const,
    target: {
      metric: "100,000+",
      label: "structured patient journeys",
      description:
        "Creating the world's most valuable hair restoration dataset — governed, consented, and built for clinical rigor rather than marketing claims.",
    },
    closingStatement:
      "At scale, the intelligence network becomes more valuable than the software itself.",
  },

  finalCta: {
    id: "ecosystem-final-cta",
    eyebrow: "Platform progress",
    headline: "This is not clinic software.",
    subheadline: "This is infrastructure for an entire medical industry.",
    body: "Follicle Intelligence is being built to become the global operating system for hair restoration medicine — for clinics, educators, auditors, and industry leaders who want to raise the standard globally.",
    primaryCta: { label: "View live platform progress", href: "/platform/progress" },
    secondaryCta: { label: "Book enterprise demo", href: "/demo" },
  },
} as const;

export type EcosystemArchitecturePageContent = typeof ECOSYSTEM_ARCHITECTURE_PAGE_CONTENT;
