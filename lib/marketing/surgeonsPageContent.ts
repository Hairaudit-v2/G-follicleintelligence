/**
 * Long-form copy and structure for `/surgeons` — surgeon-focused positioning.
 * Edit here to update marketing content without touching layout code.
 */

export const SURGEONS_PAGE_CONTENT = {
  hero: {
    id: "surgeons-hero",
    eyebrow: "For surgeons",
    headline: "Become A World-Class Hair Restoration Surgeon",
    subtext:
      "Follicle Intelligence connects training, consultation workflows, surgical planning, procedure tracking, outcome review, and continuous performance feedback into one operating system built for modern hair restoration doctors.",
    primaryCta: { label: "Explore Training", href: "/academy" as const },
    secondaryCta: { label: "Book Enterprise Demo", href: "/demo" as const },
  },

  problem: {
    id: "surgeons-problem",
    eyebrow: "Reality",
    headline: "Hair restoration is difficult to master without structure.",
    cards: [
      {
        title: "Limited exposure during early training",
        body: "Short rotations and uneven case mix make it hard to internalise patterns—without a scaffold, learning becomes episodic instead of cumulative.",
      },
      {
        title: "Inconsistent surgical planning methods",
        body: "When planning lives in notes and habit, graft targets, zone logic, and handoffs drift—making it harder to compare cases or teach others.",
      },
      {
        title: "Poor donor management visibility",
        body: "Donor accounting and long-term reserve thinking need traceability. Fragmented records obscure whether decisions were deliberate—or accidental.",
      },
      {
        title: "Limited feedback after procedures",
        body: "Without structured follow-up and comparable photography, improvement depends on memory and anecdote—fine for motivation, weak for calibration.",
      },
      {
        title: "No objective outcome benchmarking",
        body: "Standing improves when denominators are honest. Isolated practices rarely see cohort-relative context that respects evidence completeness and policy.",
      },
      {
        title: "Fragmented patient and surgery records",
        body: "When consults, plans, day-of events, and outcomes live in different places, the surgeon carries integration cost—and risk compounds at handoffs.",
      },
      {
        title: "Difficulty training support teams",
        body: "Technicians and coordinators need shared language and repeatable checkpoints. Ad-hoc shadowing does not scale as volume or complexity rises.",
      },
      {
        title: "Weak long-term follow-up systems",
        body: "Hair restoration is a multi-year story. If longitudinal capture is optional, outcomes become harder to review—and harder to defend under scrutiny.",
      },
    ],
  },

  pathway: {
    id: "surgeons-pathway",
    eyebrow: "Development",
    headline: "From clinical foundation to surgical mastery.",
    steps: [
      "Clinical understanding",
      "Consultation structure",
      "Donor assessment",
      "Hairline and zone planning",
      "Procedure day execution",
      "Post-op monitoring",
      "Outcome review",
      "Audit feedback",
      "Continuous improvement",
    ],
  },

  surgeryOs: {
    id: "surgeons-surgery-os",
    eyebrow: "SurgeryOS",
    headline: "Surgical intelligence built into every case.",
    capabilities: [
      {
        title: "Case profile",
        body: "A single surgical thread that carries context from assessment through follow-up—so decisions stay tied to the patient story.",
      },
      {
        title: "Donor assessment",
        body: "Structured donor intelligence and accounting posture that supports planning discipline—not only day-of improvisation.",
      },
      {
        title: "Planned zones",
        body: "Explicit zone logic and intent that teams can align on before blades meet skin—reducing silent variance between planner and room.",
      },
      {
        title: "Graft targets",
        body: "Targets and ranges captured with traceability—useful for internal review, training conversations, and evidence-ready summaries.",
      },
      {
        title: "Procedure day tracking",
        body: "Day-of rhythm and telemetry aligned to the same case record—so execution is observable without replacing clinical judgment.",
      },
      {
        title: "Team assignment",
        body: "Role clarity and handoff surfaces that help you develop a surgical team—not only a solo operator habit.",
      },
      {
        title: "Medication protocols",
        body: "Protocol visibility tied to the case thread—supporting consistency and safer operational habits across staff rotations.",
      },
      {
        title: "Follow-up checkpoints",
        body: "Milestone-based follow-up structure that makes longitudinal capture more likely—without pretending every patient behaves identically.",
      },
      {
        title: "Outcome evidence",
        body: "Photography and documentation posture that feeds outcome review—completeness becomes a first-class habit, not an afterthought.",
      },
      {
        title: "Audit readiness",
        body: "Evidence and review separation designed for serious governance—so when questions arrive, the record is legible, not reconstructed.",
      },
    ],
  },

  training: {
    id: "surgeons-training",
    eyebrow: "AcademyOS",
    headline: "Training connected to real clinical performance.",
    institute: {
      name: "International Institute of Hair Restoration",
      body: "AcademyOS aligns standards-led education with the workflows you run in practice—so modules, certification posture, and improvement cycles reference the same platform spine as your cases and reviews.",
    },
    tracks: [
      {
        title: "Hair loss science",
        body: "Foundational classification and mechanism literacy that supports credible consults and defensible planning inputs.",
      },
      {
        title: "Donor management",
        body: "Reserve thinking, documentation habits, and planning discipline that protect patients—and your long-term reputation.",
      },
      {
        title: "Surgical planning",
        body: "Hairline geometry, zone strategy, and graft budgeting as teachable structure—not only personal intuition.",
      },
      {
        title: "Extraction principles",
        body: "Technical fundamentals and complication awareness framed for progressive autonomy under supervision.",
      },
      {
        title: "Implantation principles",
        body: "Density logic, angulation, and tissue handling as repeatable concepts your team can rehearse and review.",
      },
      {
        title: "Complication awareness",
        body: "Early recognition, documentation, and escalation patterns that reduce avoidable harm and protect governance posture.",
      },
      {
        title: "Patient communication",
        body: "Expectation setting, consent posture, and follow-up language that stays consistent with what the record will later show.",
      },
      {
        title: "Outcome review",
        body: "How to read longitudinal evidence honestly—and translate review into targeted practice adjustments.",
      },
    ],
  },

  feedback: {
    id: "surgeons-feedback",
    eyebrow: "AuditOS",
    headline: "Improve through evidence, not guesswork.",
    paragraphs: [
      "Every case can become a learning loop when outcome review is structured: comparable photography, explicit milestones, and review history that does not depend on recollection.",
      "Follicle Intelligence connects those habits to audit scoring and cohort context where policy allows—so improvement conversations reference evidence completeness and trend, not vibes alone.",
      "HairAudit is the surgical audit surface in this ecosystem: domain-level evidence, scoring discipline, and benchmarking aligned to how serious operators prove quality under scrutiny—not marketing claims in isolation.",
    ],
    hairAuditCta: { label: "Learn about HairAudit & intelligence", href: "/hair-intelligence" as const },
  },

  audiences: {
    id: "surgeons-audiences",
    eyebrow: "Audience",
    headline: "Built for every stage of surgical development.",
    cards: [
      {
        title: "Doctors entering hair restoration",
        body: "Build a disciplined foundation: structured consults, planning habits, and follow-up rhythms that compound from your first serious cases.",
      },
      {
        title: "Doctors adding hair surgery to an existing practice",
        body: "Integrate a new surgical vertical without letting records, team training, and review posture fragment from the rest of your clinical operation.",
      },
      {
        title: "Experienced surgeons seeking benchmarking",
        body: "Where policy and evidence completeness support it, cohort-relative context can sharpen calibration—without pretending every comparison is fair.",
      },
      {
        title: "Medical directors training a team",
        body: "Give supervisors visibility into standards, competency signals, and case-linked remediation—training that maps to real workflow, not only coursework.",
      },
      {
        title: "Clinic groups standardising surgical delivery",
        body: "Unify surgical delivery patterns across locations while preserving clinical nuance: shared structure, shared evidence expectations, shared review posture.",
      },
    ],
  },

  finalCta: {
    id: "surgeons-final-cta",
    eyebrow: "Next step",
    headline: "Build your surgical practice on intelligence, not isolation.",
    primaryCta: { label: "Explore Training", href: "/academy" as const },
    secondaryCta: { label: "Book Enterprise Demo", href: "/demo" as const },
  },
} as const;
