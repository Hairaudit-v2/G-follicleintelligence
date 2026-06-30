/**
 * Copy and structure for `/why-follicle-intelligence` — strategic positioning narrative.
 * Edit here to update marketing content without touching layout code.
 */

export const WHY_FOLLICLE_INTELLIGENCE_PAGE_CONTENT = {
  hero: {
    id: "why-fi-hero",
    eyebrow: "Strategic positioning",
    headline: "Why Follicle Intelligence Exists",
    subheadline:
      "Hair restoration has become a global medical industry worth billions, yet the underlying infrastructure powering clinics, training, patient outcomes, and surgical intelligence has barely evolved.",
    supportingCopy: [
      "The future of hair restoration will not be built by disconnected CRMs, spreadsheets, booking systems, or fragmented education platforms.",
      "It requires a new intelligence layer.",
      "Follicle Intelligence exists to build that foundation.",
    ],
    primaryCta: { label: "Explore The Platform", href: "/platform/ecosystem" as const },
    secondaryCta: { label: "View Platform Progress", href: "/platform/progress" as const },
  },

  industryProblem: {
    id: "why-fi-industry-problem",
    eyebrow: "The gap",
    headline: "The industry runs on disconnected systems",
    description:
      "Modern hair restoration clinics operate across dozens of disconnected systems that were never designed for clinical intelligence.",
    cards: [
      { title: "Patient acquisition", body: "Leads trapped in marketing systems" },
      { title: "Consultations", body: "No structured diagnostic intelligence" },
      { title: "Treatment planning", body: "Recommendations inconsistent between providers" },
      { title: "Surgery", body: "Critical procedural data lost forever" },
      { title: "Training", body: "No measurable competency infrastructure" },
      { title: "Outcomes", body: "Results rarely audited objectively" },
      { title: "Education", body: "Training disconnected from clinical performance" },
      { title: "Operations", body: "Staff systems disconnected from procedure quality" },
      { title: "Finance", body: "Revenue disconnected from operational efficiency" },
    ],
  },

  brokenStack: {
    id: "why-fi-broken-stack",
    eyebrow: "Infrastructure",
    headline: "Today's software was never built for this industry",
    currentStack: {
      title: "Current Industry Stack",
      items: [
        "HubSpot",
        "Pabau",
        "Cliniko",
        "Spreadsheets",
        "Manual SOP documents",
        "WhatsApp communication",
        "Separate accounting tools",
        "Separate education systems",
        "Unstructured patient records",
      ],
    },
    neededStack: {
      title: "What clinics actually need",
      items: [
        "Clinical intelligence",
        "Structured diagnostics",
        "Surgical workflow systems",
        "Workforce competency tracking",
        "Outcome auditing",
        "Education infrastructure",
        "Financial intelligence",
        "Multi-clinic operational visibility",
        "Continuous intelligence learning",
      ],
    },
  },

  digitalTwin: {
    id: "why-fi-digital-twin",
    eyebrow: "Intelligence model",
    headline: "Every patient becomes intelligence",
    description:
      "The future of medicine belongs to structured learning systems. Every patient journey should become a permanent intelligence record that improves future clinical decision making.",
    stages: [
      "Baseline assessment",
      "Image capture",
      "Medical history",
      "AI diagnostic modelling",
      "Blood analysis",
      "Treatment pathway",
      "Surgery execution",
      "Graft and procedural metrics",
      "Recovery tracking",
      "Outcome auditing",
      "Long term progression monitoring",
    ],
    atScale: "Every patient improves the system.",
  },

  verticalInfrastructure: {
    id: "why-fi-vertical-infrastructure",
    eyebrow: "Category design",
    headline: "Horizontal software cannot solve vertical medicine",
    description:
      "General purpose software manages relationships. Vertical infrastructure understands domain intelligence.",
    horizontal: {
      title: "Horizontal software",
      items: ["CRM", "Bookings", "Emails", "Pipeline", "Notes"],
    },
    vertical: {
      title: "Vertical infrastructure",
      items: [
        "Diagnostic intelligence",
        "Medical history intelligence",
        "Surgical intelligence",
        "Workforce intelligence",
        "Certification intelligence",
        "Outcome intelligence",
        "Longitudinal patient tracking",
        "AI learning infrastructure",
        "Clinical benchmarking",
      ],
    },
  },

  networkEffect: {
    id: "why-fi-network-effect",
    eyebrow: "Compounding value",
    headline: "The more the system learns, the stronger it becomes",
    description:
      "As clinics join the network, the platform begins learning from every patient, every surgery, every treatment, every staff member, and every outcome.",
    overTimeLabel: "Over time:",
    outcomes: [
      "Better diagnosis models",
      "Better surgical planning",
      "Better treatment recommendations",
      "Better training systems",
      "Better patient outcomes",
      "Better clinic performance benchmarking",
    ],
    closingStatement:
      "At scale, the intelligence network becomes more valuable than the software itself.",
    networkNodes: ["Clinics", "Patients", "Surgeries", "Treatments", "Staff", "Outcomes"],
  },

  mission: {
    id: "why-fi-mission",
    eyebrow: "Long-term mission",
    headline: "Raise the global standard of hair restoration medicine",
    paragraphs: [
      "Follicle Intelligence is being built to become the infrastructure layer connecting clinics, doctors, nurses, consultants, educators, researchers, and patients into one continuously improving intelligence network.",
      "We believe the future of medicine will belong to systems that learn.",
      "Hair restoration deserves that future.",
    ],
  },

  finalCta: {
    id: "why-fi-final-cta",
    eyebrow: "The foundation",
    headline: "Building the future of hair restoration medicine",
    primaryCta: { label: "Explore Ecosystem Architecture", href: "/platform/ecosystem" as const },
    secondaryCta: { label: "View Live Platform Progress", href: "/platform/progress" as const },
  },
} as const;
