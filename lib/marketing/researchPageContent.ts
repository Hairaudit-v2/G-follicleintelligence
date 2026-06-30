/**
 * Copy and structure for `/research` — scientific research infrastructure narrative.
 * Edit here to update marketing content without touching layout code.
 */

export const RESEARCH_PAGE_CONTENT = {
  hero: {
    id: "research-hero",
    eyebrow: "Research infrastructure",
    headline: "Research Infrastructure For The Future Of Hair Restoration Medicine",
    subheadline:
      "Hair restoration needs structured evidence systems capable of measuring outcomes, comparing techniques, tracking progression, and supporting the next generation of AI-assisted clinical research.",
    supportingCopy: [
      "Follicle Intelligence is being built to help transform disconnected clinical activity into structured intelligence that can support benchmarking, research collaboration, outcome registries, and evidence-based improvement across the industry.",
    ],
    primaryCta: { label: "Explore Platform Architecture", href: "/platform/ecosystem" as const },
    secondaryCta: {
      label: "View The Future Of Hair Restoration",
      href: "/the-future-of-hair-restoration" as const,
    },
  },

  evidenceGap: {
    id: "research-evidence-gap",
    eyebrow: "The evidence gap",
    headline: "The industry needs better structured evidence",
    description:
      "Hair restoration has advanced clinically, but much of the industry still lacks consistent, structured, longitudinal data infrastructure.",
    cards: [
      {
        title: "Outcome inconsistency",
        body: "Results are often assessed subjectively or inconsistently between providers.",
      },
      {
        title: "Limited longitudinal tracking",
        body: "Many patients are not followed in a structured way beyond early post-treatment milestones.",
      },
      {
        title: "Fragmented surgical data",
        body: "Important procedural variables are often stored in spreadsheets, notes, or not captured at all.",
      },
      {
        title: "Training disconnected from outcomes",
        body: "Education and certification rarely connect directly to long-term patient results.",
      },
      {
        title: "Limited benchmarking",
        body: "Clinics and surgeons often lack objective comparison against shared standards.",
      },
      {
        title: "AI data limitations",
        body: "AI systems require structured, high-quality datasets to become clinically useful.",
      },
    ],
    closingStatement:
      "Without structured evidence, the industry cannot fully learn from its own clinical activity.",
  },

  researchDomains: {
    id: "research-domains",
    eyebrow: "Research domains",
    headline: "Research domains the platform is designed to support",
    domains: [
      {
        title: "Donor preservation science",
        body: "Tracking donor extraction patterns, preservation quality, healing, and long-term donor appearance.",
      },
      {
        title: "Graft survival benchmarking",
        body: "Comparing graft and hair survival across techniques, teams, patient profiles, and procedural conditions.",
      },
      {
        title: "Hairline and design outcomes",
        body: "Studying design consistency, naturalness, age appropriateness, and patient satisfaction.",
      },
      {
        title: "Treatment efficacy",
        body: "Tracking medical, regenerative, and surgical treatment response over time.",
      },
      {
        title: "Progression modelling",
        body: "Studying how hair loss progresses across patient groups, genetics, health markers, and interventions.",
      },
      {
        title: "Surgical technique comparison",
        body: "Comparing extraction, implantation, hydration, density planning, and theatre workflow variables.",
      },
      {
        title: "Workforce competency research",
        body: "Understanding how training, experience, and team structure influence procedural quality.",
      },
      {
        title: "Patient-reported outcomes",
        body: "Connecting clinical findings with satisfaction, confidence, expectations, and quality-of-life signals.",
      },
    ],
  },

  globalRegistry: {
    id: "research-global-registry",
    eyebrow: "Outcome registry",
    headline: "Toward a global outcome registry",
    description:
      "The long-term opportunity is to help create structured registries that allow clinics, researchers, and institutions to understand outcomes at a scale not previously possible in hair restoration medicine.",
    registryFieldsLabel: "Registry intelligence could include:",
    registryFields: [
      "Patient baseline characteristics",
      "Hair loss classification",
      "Imaging records",
      "Treatment history",
      "Surgical plan",
      "Graft and hair counts",
      "Donor preservation metrics",
      "Team and technique variables",
      "Recovery tracking",
      "Follow-up imaging",
      "Audit outcomes",
      "Patient-reported satisfaction",
      "Long-term progression",
    ],
    closingStatement:
      "A global outcome registry would allow the industry to move from anecdote toward measurable evidence.",
  },

  aiInfrastructure: {
    id: "research-ai-infrastructure",
    eyebrow: "AI research",
    headline: "AI requires structured clinical intelligence",
    description:
      "Artificial intelligence in medicine is only as strong as the data systems behind it.",
    opportunitiesLabel: "Future AI research opportunities:",
    opportunities: [
      "Hair loss pattern classification",
      "Progression forecasting",
      "Surgical candidacy modelling",
      "Donor capacity prediction",
      "Treatment response prediction",
      "Image-based outcome assessment",
      "Repair risk modelling",
      "Patient journey optimisation",
    ],
    closingStatement:
      "The future of AI-assisted hair restoration depends on high-quality structured datasets, not generic automation.",
  },

  benchmarking: {
    id: "research-benchmarking",
    eyebrow: "Benchmarking science",
    headline: "Benchmarking turns experience into measurable improvement",
    description:
      "Structured benchmarking can help clinics understand where performance is strong, where variation exists, and where improvement is possible.",
    categories: [
      {
        title: "Clinical benchmarks",
        items: [
          "Graft survival",
          "Density yield",
          "Donor preservation",
          "Recipient area growth",
          "Long-term stability",
        ],
      },
      {
        title: "Surgical benchmarks",
        items: [
          "Transection rate",
          "Extraction speed",
          "Punch size optimisation",
          "Graft hydration time",
          "Implantation consistency",
        ],
      },
      {
        title: "Operational benchmarks",
        items: [
          "Consultation conversion quality",
          "Procedure efficiency",
          "Staff readiness",
          "Follow-up completion",
          "Patient satisfaction",
        ],
      },
      {
        title: "Education benchmarks",
        items: [
          "Competency progression",
          "Case participation",
          "Certification readiness",
          "Protocol adherence",
          "Outcome-linked training",
        ],
      },
    ],
  },

  multicentreNetwork: {
    id: "research-multicentre-network",
    eyebrow: "Multicentre research",
    headline: "Multicentre research becomes possible when data is structured",
    description:
      "Hair restoration research is limited when data lives in isolated clinics, disconnected tools, or unstructured records.",
    capabilitiesLabel: "A structured network could support:",
    capabilities: [
      "Cross-clinic outcome analysis",
      "Technique comparison studies",
      "Longitudinal treatment research",
      "Surgeon and team benchmarking",
      "Training impact analysis",
      "Device and protocol evaluation",
      "Global population insights",
      "Research-ready anonymised datasets",
    ],
    networkNodes: [
      "Clinics",
      "Researchers",
      "Universities",
      "Registries",
      "Outcomes",
      "Training",
      "Partners",
      "Institutions",
    ],
    networkCenterLabel: "Research Network",
  },

  governance: {
    id: "research-governance",
    eyebrow: "Clinical governance",
    headline: "Research infrastructure must be governed responsibly",
    description:
      "Medical intelligence systems require trust, consent, privacy, governance, and responsible use of data.",
    principles: [
      "Patient privacy protection",
      "Consent-aware data use",
      "Tenant-level access control",
      "De-identification pathways",
      "Ethical research collaboration",
      "Clinical review before publication",
      "Transparent methodology",
      "Responsible AI development",
    ],
    closingStatement:
      "The goal is not simply to collect data. The goal is to build trusted clinical intelligence responsibly.",
  },

  collaboration: {
    id: "research-collaboration",
    eyebrow: "Future collaboration",
    headline: "Built for future collaboration",
    description:
      "Follicle Intelligence is being designed so clinics, educators, researchers, and strategic partners can eventually collaborate around structured evidence and measurable outcomes.",
    pathways: [
      {
        title: "Clinical registry participation",
        body: "For clinics contributing structured outcome data.",
      },
      {
        title: "Research partnerships",
        body: "For universities, investigators, and clinical research teams.",
      },
      {
        title: "Technique benchmarking",
        body: "For comparing procedural approaches across anonymised cohorts.",
      },
      {
        title: "Education outcome studies",
        body: "For linking training progression to clinical performance.",
      },
      {
        title: "AI model development",
        body: "For building clinically useful models from structured data.",
      },
      {
        title: "Industry standards work",
        body: "For contributing to future quality and certification benchmarks.",
      },
    ],
  },

  finalCta: {
    id: "research-final-cta",
    eyebrow: "Clinical intelligence",
    headline: "From clinical activity to clinical intelligence",
    supportingCopy: [
      "The future of hair restoration medicine will be shaped by the systems that help the industry measure, learn, and improve.",
      "Follicle Intelligence is being built to support that future.",
    ],
    primaryCta: { label: "Explore Platform Architecture", href: "/platform/ecosystem" as const },
    secondaryCta: { label: "Explore Strategic Partnerships", href: "/partners" as const },
  },
} as const;
