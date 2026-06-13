/**
 * Long-form copy and structure for `/academy` — AcademyOS and workforce training positioning.
 * Edit here to update marketing content without touching layout code.
 */

export const ACADEMY_PAGE_METADATA = {
  title: "AcademyOS — Training Infrastructure For Hair Restoration | Follicle Intelligence",
  description:
    "AcademyOS connects doctor education, nurse training, consultant development, technician competency, clinical assessment, and performance feedback into one structured training layer—powered by the International Institute of Hair Restoration and integrated with Follicle Intelligence.",
} as const;

export const ACADEMY_PAGE_CONTENT = {
  hero: {
    id: "academy-hero",
    eyebrow: "AcademyOS",
    headline: "Training Infrastructure For The Modern Hair Restoration Workforce",
    subtext:
      "AcademyOS connects doctor education, nurse training, consultant development, technician competency, clinical assessment, and performance feedback into one structured training layer for hair restoration organisations.",
    primaryCta: { label: "Book Enterprise Demo", href: "/demo" as const },
    secondaryCta: { label: "Explore Platform", href: "/platform" as const },
  },

  problem: {
    id: "academy-problem",
    eyebrow: "Workforce",
    headline: "The industry cannot scale safely without better training.",
    cards: [
      {
        title: "Inconsistent surgeon training",
        body: "Mentorship, case exposure, and documentation habits diverge by team—making it hard to align standards or intervene before variance becomes patient risk.",
      },
      {
        title: "Variable technician skill levels",
        body: "High-throughput rooms depend on repeatable technique and judgement. Without structured competency signals, quality becomes personality-dependent.",
      },
      {
        title: "Consultants learning without structure",
        body: "Sales and clinical education are both teachable. Ad-hoc shadowing produces uneven messaging, weak handoffs, and avoidable rework into planning and surgery.",
      },
      {
        title: "Nurses trained differently across clinics",
        body: "Multi-site groups inherit local habits. Without a shared training spine, the same role can mean different responsibilities from one location to the next.",
      },
      {
        title: "No central competency record",
        body: "When completion lives in spreadsheets, inboxes, and memory, leadership cannot answer basic questions: who is cleared for what, and what evidence supports it.",
      },
      {
        title: "Limited CPD visibility",
        body: "Continuing education only works if it is visible, attributable, and comparable across roles—otherwise audits and improvement cycles start from fragments.",
      },
      {
        title: "Training disconnected from outcomes",
        body: "Learning that never meets operational reality becomes theatre. Teams need pathways that connect to the same workflows, reviews, and signals the clinic runs on.",
      },
      {
        title: "Difficult workforce standardisation",
        body: "Scaling a network requires repeatable onboarding, progression rules, and supervision habits—hard to enforce when training is not an explicit system layer.",
      },
    ],
  },

  iihr: {
    id: "academy-iihr",
    eyebrow: "Foundation",
    headline: "Powered by the International Institute of Hair Restoration",
    paragraphs: [
      "AcademyOS connects the educational foundation of the International Institute of Hair Restoration with the operational, clinical, surgical, and audit layers of Follicle Intelligence.",
      "The goal is not a separate learning portal sitting beside the clinic—it is a disciplined training posture that can inherit the same patient story, evidence expectations, and governance boundaries your organisation already depends on.",
    ],
  },

  trainingTracks: {
    id: "academy-tracks",
    eyebrow: "Pathways",
    headline: "Structured pathways for every role.",
    cards: [
      {
        title: "Doctor certification",
        body: "Physician pathways, assessments, and completion records aligned to your organisation's standards—without implying credentials you do not govern.",
      },
      {
        title: "Nurse surgical training",
        body: "Role-specific modules and practical checkpoints that reflect how your rooms actually run, so readiness is observable—not assumed.",
      },
      {
        title: "Technician competency",
        body: "Structured progression for technical roles, with space for practical logs and supervisor review where your programme requires it.",
      },
      {
        title: "Hair consultant education",
        body: "Consult discovery, clinical literacy, documentation discipline, and handoff quality—so the consult thread stays coherent into quotes and planning.",
      },
      {
        title: "Clinic manager training",
        body: "Operational leadership content tied to how schedules, services, staff coverage, and daily rhythm behave in a modern hair restoration clinic.",
      },
      {
        title: "Clinical assessment frameworks",
        body: "Assessment templates and completion tracking that support consistent evaluation—configured to your policies, not generic checklists.",
      },
      {
        title: "CPD and continuing education",
        body: "Attribution, history, and visibility for continuing professional development—so compliance conversations start from evidence, not reconstruction.",
      },
      {
        title: "Case review and feedback",
        body: "Supervised review loops that connect learning to real cases—where your governance model defines who reviews, what is captured, and what happens next.",
      },
    ],
  },

  competency: {
    id: "academy-competency",
    eyebrow: "Evidence",
    headline: "Training should be measurable.",
    cards: [
      {
        title: "Course progress",
        body: "Clear completion posture across modules and pathways—so managers see momentum, not anecdotes.",
      },
      {
        title: "Assessment completion",
        body: "Structured attempts, outcomes, and follow-ups where assessments are part of your programme design.",
      },
      {
        title: "Practical competency logs",
        body: "Room-level and skills-based evidence capture when your organisation chooses to require practical sign-off.",
      },
      {
        title: "Case review history",
        body: "A defensible thread of review events and feedback—useful for supervision, remediation, and audit readiness.",
      },
      {
        title: "Supervisor feedback",
        body: "Named feedback tied to roles and time—so improvement conversations reference specifics, not vibes.",
      },
      {
        title: "Certification status",
        body: "Organisation-defined completion and clearance states—distinct from external medical licensing, and explicit about who issued the standard.",
      },
      {
        title: "CPD records",
        body: "Continuing education history with attribution suitable for internal compliance packs and leadership review.",
      },
      {
        title: "Training gaps",
        body: "Signals that highlight missing prerequisites, overdue refreshers, or role mismatches before they surface as incidents.",
      },
      {
        title: "Readiness scoring",
        body: "Summaries for staffing and supervision where your model defines readiness rules and acceptable thresholds.",
      },
      {
        title: "Performance improvement plans",
        body: "Structured remediation tracks when performance management must be documented, time-bound, and fair.",
      },
    ],
  },

  connected: {
    id: "academy-connected",
    eyebrow: "Integration",
    headline: "Education becomes stronger when connected to outcomes.",
    paragraphs: [
      "AcademyOS should not sit separately from the clinic. Training data can connect to consultation quality, procedure readiness, audit feedback, staff performance, and patient outcome signals.",
      "The point is continuity: the same organisation that trains should be able to see how training posture relates to operational behaviour—without pretending a dashboard replaces clinical judgement.",
    ],
    signals: [
      "Consultation quality and documentation discipline",
      "Procedure readiness and day-of role clearance",
      "Audit findings and corrective action follow-through",
      "Staff performance reviews tied to competency evidence",
      "Outcome and follow-up signals where your deployment captures them",
    ],
  },

  enterprise: {
    id: "academy-enterprise",
    eyebrow: "Scale",
    headline: "Standardise teams across every location.",
    cards: [
      {
        title: "Single clinic onboarding",
        body: "A repeatable first 90 days for new hires: pathways, assessments, and supervision touchpoints that do not depend on a single senior trainer's calendar.",
      },
      {
        title: "Multi-site workforce development",
        body: "Portfolio-level visibility into training posture across locations—so exceptions are visible before they become reputational risk.",
      },
      {
        title: "New surgeon training",
        body: "Structured onboarding and progression that respects local mentorship while preserving central standards and evidence.",
      },
      {
        title: "Consultant sales and clinical education",
        body: "Parallel tracks that keep commercial skill and clinical literacy aligned—reducing variance in quotes, expectations, and handoffs.",
      },
      {
        title: "Nurse and technician progression",
        body: "Role ladders with explicit prerequisites—so promotions and room assignments reflect capability, not tenure alone.",
      },
      {
        title: "Enterprise compliance visibility",
        body: "Leadership views that summarise completion, gaps, and refreshers—packaged for boards and operators without manual spreadsheet assembly.",
      },
    ],
  },

  finalCta: {
    id: "academy-final-cta",
    eyebrow: "Next step",
    headline: "Build the workforce before you scale the network.",
    primaryCta: { label: "Book Enterprise Demo", href: "/demo" as const },
    secondaryCta: { label: "Explore Platform", href: "/platform" as const },
  },
} as const;
