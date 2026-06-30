/**
 * Copy and structure for `/investors` — institutional strategic narrative.
 * Edit here to update marketing content without touching layout code.
 */

export const INVESTORS_PAGE_CONTENT = {
  hero: {
    id: "investors-hero",
    eyebrow: "Enterprise value",
    headline: "Building Infrastructure For A Global Medical Industry",
    subheadline:
      "Hair restoration has become a multi-billion dollar global medical sector, yet the underlying infrastructure supporting clinics, patient intelligence, surgical outcomes, workforce performance, education, and long-term data systems remains fragmented and underdeveloped.",
    supportingCopy: [
      "We believe the future leaders in healthcare technology will not simply build software.",
      "They will build infrastructure networks that continuously learn.",
      "Follicle Intelligence is being built for that future.",
    ],
    primaryCta: {
      label: "Why Follicle Intelligence Exists",
      href: "/why-follicle-intelligence" as const,
    },
    secondaryCta: { label: "Explore Platform Architecture", href: "/platform/ecosystem" as const },
  },

  marketOpportunity: {
    id: "investors-market-opportunity",
    eyebrow: "Market scale",
    headline: "The market is larger than most people realise",
    description:
      "Hair restoration has evolved into a rapidly growing global medical sector driven by increasing patient demand, improved technology, growing aesthetic acceptance, and expanding international provider networks.",
    cards: [
      {
        title: "Global hair restoration market",
        body: "A multi-billion dollar sector spanning surgical and non-surgical treatment",
      },
      {
        title: "Billions in annual market size",
        body: "Sustained growth across established and emerging markets worldwide",
      },
      {
        title: "Thousands of clinics worldwide",
        body: "Independent operators, franchise groups, and enterprise networks",
      },
      {
        title: "Rapidly growing international demand",
        body: "Cross-border patient flows and expanding provider networks",
      },
      {
        title: "Increasing patient lifetime value",
        body: "Longitudinal care pathways from consultation through long-term outcomes",
      },
      {
        title: "Growing non-surgical treatment sector",
        body: "Medical therapies complementing and extending surgical volumes",
      },
      {
        title: "Increasing global medical tourism",
        body: "International patients seeking quality-assured restoration medicine",
      },
      {
        title: "Expanding franchise clinic groups",
        body: "Standardised brands scaling across regions and markets",
      },
    ],
    closingStatement: "The industry is growing faster than the infrastructure supporting it.",
  },

  fragmentation: {
    id: "investors-fragmentation",
    eyebrow: "Structural gap",
    headline: "The industry operates on disconnected systems",
    description:
      "Modern clinics rely on fragmented operational stacks never designed for intelligence-driven medicine.",
    cards: [
      { title: "Marketing systems", body: "Acquisition data isolated from clinical intelligence" },
      { title: "CRM systems", body: "Patient relationships without structured medical context" },
      { title: "Booking systems", body: "Scheduling disconnected from treatment pathways" },
      { title: "Finance systems", body: "Revenue reporting without operational correlation" },
      { title: "Manual patient records", body: "Unstructured documentation that cannot compound" },
      {
        title: "Surgical spreadsheets",
        body: "Critical procedural data lost at the point of care",
      },
      {
        title: "Disconnected education systems",
        body: "Training separated from clinical performance",
      },
      {
        title: "Unstructured outcome tracking",
        body: "Results rarely audited or benchmarked objectively",
      },
      {
        title: "No benchmark infrastructure",
        body: "No shared standards for comparing clinical quality",
      },
      {
        title: "No shared intelligence systems",
        body: "Each clinic learns in isolation from every other",
      },
    ],
    closingStatement: "Disconnected systems prevent continuous learning.",
  },

  verticalInfrastructure: {
    id: "investors-vertical-infrastructure",
    eyebrow: "Category design",
    headline:
      "General software creates convenience. Vertical infrastructure creates defensibility.",
    description:
      "Horizontal SaaS platforms solve broad workflow problems. Vertical infrastructure platforms solve industry-specific intelligence problems.",
    horizontal: {
      title: "Horizontal SaaS",
      items: [
        "CRM",
        "Scheduling",
        "Email automation",
        "Pipeline management",
        "Reporting dashboards",
      ],
    },
    vertical: {
      title: "Vertical Infrastructure",
      items: [
        "Diagnostic intelligence",
        "Surgical intelligence",
        "Workforce intelligence",
        "Outcome intelligence",
        "Certification intelligence",
        "Longitudinal patient tracking",
        "AI-assisted medicine",
        "Global benchmarking systems",
      ],
    },
  },

  dataMoat: {
    id: "investors-data-moat",
    eyebrow: "Compounding intelligence",
    headline: "The software is only the beginning",
    description:
      "As the platform grows, every patient journey contributes structured intelligence that improves future clinical decision making.",
    progression: [
      "100 clinics",
      "10,000 patients",
      "100,000 patient records",
      "500,000 procedural records",
      "Millions of structured image datasets",
      "Global treatment efficacy benchmarking",
      "Global surgical outcome benchmarking",
      "AI learning infrastructure",
    ],
    closingStatement: "At scale, the data network becomes more valuable than the software itself.",
  },

  networkEffects: {
    id: "investors-network-effects",
    eyebrow: "Network dynamics",
    headline: "The system compounds as adoption increases",
    description: "Each new clinic strengthens the network for every clinic already connected.",
    compoundingEffects: [
      "More patients",
      "More surgeries",
      "More image intelligence",
      "Better AI training models",
      "Better diagnostics",
      "Better treatment prediction",
      "Better benchmarking",
      "Better patient outcomes",
    ],
    networkNodes: ["Clinics", "Patients", "Surgeries", "Treatments", "Staff", "Outcomes"],
  },

  platformEconomics: {
    id: "investors-platform-economics",
    eyebrow: "Embedded infrastructure",
    headline: "Infrastructure businesses become deeply embedded",
    description:
      "As clinics adopt connected intelligence systems, platform replacement becomes increasingly difficult.",
    retentionCards: [
      {
        title: "Patient records connected historically",
        body: "Longitudinal intelligence that cannot be replicated elsewhere",
      },
      {
        title: "Surgical data stored permanently",
        body: "Procedural records linked to outcomes and audit trails",
      },
      {
        title: "Outcome audits linked longitudinally",
        body: "Structured evidence spanning the full patient journey",
      },
      {
        title: "Staff training connected to competency",
        body: "Workforce performance tied to certification and outcomes",
      },
      {
        title: "Financial intelligence connected to operations",
        body: "Revenue correlated with clinical and operational quality",
      },
      {
        title: "Cross-clinic benchmarking becomes valuable",
        body: "Comparative intelligence unavailable outside the network",
      },
      {
        title: "Historical intelligence becomes irreplaceable",
        body: "Years of structured data create compounding switching costs",
      },
    ],
    closingStatement: "Deep infrastructure creates durable enterprise value.",
  },

  futureLayers: {
    id: "investors-future-layers",
    eyebrow: "Platform expansion",
    headline: "A continuously expanding intelligence ecosystem",
    currentSystems: [
      "LeadFlow",
      "ConsultationOS",
      "PatientOS",
      "ImagingOS",
      "SurgeryOS",
      "AuditOS",
      "WorkforceOS",
      "AcademyOS",
      "FinancialOS",
      "AnalyticsOS",
      "ClinicOS",
      "ReceptionOS",
    ],
    futureSystems: [
      "AI Diagnostic Engine",
      "Global Outcome Registry",
      "International Certification Network",
      "Clinical Benchmark Marketplace",
      "Research Intelligence Layer",
      "Global Provider Credentialing",
    ],
  },

  longTermVision: {
    id: "investors-long-term-vision",
    eyebrow: "Strategic horizon",
    headline: "Building infrastructure for the future of intelligence-driven medicine",
    paragraphs: [
      "The future value of healthcare technology will increasingly come from systems that continuously learn from structured clinical data.",
      "Our belief is simple.",
      "The future leaders in medical technology will own intelligence networks, not isolated software products.",
      "Hair restoration is only the beginning.",
    ],
  },

  finalStatement: {
    id: "investors-final-statement",
    eyebrow: "Long-term infrastructure",
    headline: "Infrastructure compounds. Intelligence compounds faster.",
    supportingCopy: [
      "Follicle Intelligence is being built as a long-term infrastructure company focused on transforming how hair restoration medicine operates globally.",
      "The platform is not simply software.",
      "It is the beginning of a continuously learning intelligence network.",
    ],
    primaryCta: { label: "View Platform Progress", href: "/platform/progress" as const },
    secondaryCta: { label: "Explore Ecosystem Architecture", href: "/platform/ecosystem" as const },
  },
} as const;
