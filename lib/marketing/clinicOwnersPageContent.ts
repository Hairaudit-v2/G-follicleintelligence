/**
 * Public copy for `/clinic-owners` — owner and operator positioning.
 * Aligned with FI-WEB-REFRESH-1A messaging standard and post-1E homepage claims discipline.
 */

export type ClinicOwnerVisibilityMaturity = "Operational Pilot" | "Expanding" | "Future";

export const CLINIC_OWNERS_PAGE_CONTENT = {
  seo: {
    title: "Hair Restoration Clinic Operating System for Owners | Follicle Intelligence",
    description:
      "Connect enquiries, patients, clinic operations, surgery, workforce and outcomes in one hair-restoration-specific operating system. Adopt progressively without replacing every system at once.",
    ogTitle: "Run the clinic as one connected operation",
    ogDescription:
      "One operating view across enquiries, patients, consultations, surgery, imaging, workforce and outcomes — with progressive adoption that protects clinic continuity.",
    path: "/clinic-owners" as const,
  },

  hero: {
    id: "clinic-owners-hero",
    eyebrow: "For clinic owners and operators",
    headline: "Run the clinic as one connected operation.",
    subtext:
      "Follicle Intelligence gives clinic owners one operating view across enquiries, patients, consultations, surgery, imaging, workforce and outcomes — without requiring every existing system to be replaced on day one.",
    supporting:
      "Follicle Intelligence connects commercial activity, patient care, surgery, staff, imaging and outcomes so clinic owners can see what is happening, where performance is being lost and what needs attention.",
    trustLine: "Built around the realities of operating modern hair restoration clinics.",
    primaryCta: {
      label: "Request a Platform and Migration Review",
      href: "/demo" as const,
    },
    secondaryCta: { label: "Explore the Platform", href: "/platform" as const },
    tertiaryCta: { label: "View Platform Progress", href: "/platform/progress" as const },
  },

  problem: {
    id: "clinic-owners-problem",
    eyebrow: "The operational problem",
    headline: "Most clinics do not have one operating system.",
    intro:
      "They have a collection of systems, spreadsheets and staff processes that do not share the same patient journey. That fragmentation affects commercial performance, patient experience, staff accountability, clinical continuity, management visibility, multi-site consistency and long-term outcome measurement.",
    cards: [
      {
        title: "Enquiries are spread across systems",
        body: "Website forms, HubSpot, email, phone, social, referrals, spreadsheets and personal inboxes make ownership unclear — so follow-up becomes inconsistent and conversion hard to trust.",
      },
      {
        title: "The patient journey fragments after booking",
        body: "Commercial context sits in one place while consultation notes, imaging, surgery planning, follow-up and outcomes sit elsewhere — creating duplicate data and weak handovers.",
      },
      {
        title: "Clinic performance is hard to see",
        body: "Headline revenue is not enough. Owners need to see where patients leave the journey, whether follow-up is completed, whether surgery is ready, and whether sources create long-term value.",
      },
      {
        title: "Operations depend on people remembering",
        body: "Tasks in personal inboxes, informal follow-ups, spreadsheet rosters and conversation-based readiness create operational risk and break when staff leave.",
      },
      {
        title: "Existing systems feel too risky to replace",
        body: "Fear of lost history, duplicate records, training burden and downtime often freezes progress — even when fragmentation is obvious.",
      },
    ] as const,
  },

  outcomes: {
    id: "clinic-owners-outcomes",
    eyebrow: "What changes with FI",
    headline: "Owner outcomes — not another module catalogue.",
    intro:
      "Follicle Intelligence is a hair restoration operating system. The point is clearer ownership, one connected patient journey and better day-to-day coordination — not more disconnected software.",
    items: [
      {
        letter: "A",
        title: "Every enquiry has an owner",
        body: "Clear assignment, visible stage, follow-up responsibility, contact history, and lost or converted review — so demand does not depend on individual memory.",
      },
      {
        letter: "B",
        title: "Every patient has one connected journey",
        body: "Enquiry, consultation, imaging, treatment, surgery, follow-up and outcome share the same identity rather than being recreated in separate tools.",
      },
      {
        letter: "C",
        title: "Every clinic day is easier to coordinate",
        body: "Calendar, front desk, patient readiness, procedure preparation, team visibility and operational attention points stay closer together.",
      },
      {
        letter: "D",
        title: "Every team member has clearer accountability",
        body: "Role-based access, roster visibility, readiness, competency, training and assigned responsibility reduce reliance on informal heroics.",
      },
      {
        letter: "E",
        title: "Every procedure becomes measurable",
        body: "Planning, graft and hair data, team involvement, imaging, follow-up and outcome audit can stay on the same patient thread.",
      },
      {
        letter: "F",
        title: "Every owner gains better visibility",
        body: "Enquiries, conversion, follow-up, patient movement, surgery readiness, staff capacity, operational risk and outcomes become easier to review — with financial and reporting depth expanding over time.",
      },
    ] as const,
  },

  systems: {
    id: "clinic-owners-systems",
    eyebrow: "Connected operating systems",
    headline:
      "The operational systems your clinic uses every day — connected through one patient and clinic record.",
    intro:
      "These are not six disconnected products. They are everyday clinic systems that share the same operational spine. Module depth varies by deployment status — see Platform Progress for current maturity.",
    groups: [
      {
        title: "Growth and patient acquisition",
        systems: [
          {
            name: "LeadFlow",
            body: "Enquiry capture, pipeline, ownership and follow-up connected into the patient journey — with progressive HubSpot connect, coexistence or staged transition when needed.",
          },
        ],
      },
      {
        title: "Clinic operations",
        systems: [
          {
            name: "ClinicOS",
            body: "Scheduling, services, appointment lifecycle and day-to-day clinic rhythm for multi-site operators.",
          },
          {
            name: "WorkforceOS",
            body: "Roster, readiness, competency and workforce planning so capacity matches assigned work.",
          },
        ],
      },
      {
        title: "Patient and clinical journey",
        systems: [
          {
            name: "PatientOS",
            body: "Longitudinal patient record and journey continuity across commercial and clinical activity.",
          },
          {
            name: "ConsultationOS",
            body: "Structured consultation assessment, planning and handoff into treatment or surgery.",
          },
          {
            name: "ImagingOS",
            body: "Standardised capture, comparison and longitudinal visual records.",
          },
        ],
      },
      {
        title: "Procedure and outcomes",
        systems: [
          {
            name: "SurgeryOS",
            body: "Procedure planning, day-of coordination, graft and team activity on the same patient thread.",
          },
          {
            name: "AuditOS",
            body: "Outcome measurement, procedure audit posture and review-ready evidence pathways.",
          },
        ],
      },
      {
        title: "Owner intelligence",
        systems: [
          {
            name: "AnalyticsOS",
            body: "Commercial, operational and outcome intelligence built from structured events — expanding as capture depth grows.",
          },
        ],
      },
    ] as const,
  },

  journey: {
    id: "clinic-owners-journey",
    eyebrow: "Connected patient journey",
    headline: "From first enquiry to final outcome — one continuous record.",
    steps: [
      { label: "Enquiry", detail: "Capture, ownership and follow-up" },
      { label: "Consultation", detail: "Assessment, plan and expectations" },
      { label: "Treatment or surgery", detail: "Preparation, procedure and team activity" },
      { label: "Follow-up", detail: "Care continuity and next actions" },
      { label: "Outcome", detail: "Imaging, review and learning" },
    ] as const,
  },

  adoption: {
    id: "clinic-owners-adoption",
    eyebrow: "Progressive adoption",
    headline: "You do not need to replace everything at once.",
    clinicLine: "Connect, transition or replace — at a pace that protects clinic continuity.",
    intro:
      "Clinics can start with the workflows that matter most, keep selected systems connected, and expand as confidence grows.",
    modes: [
      {
        title: "Connect",
        body: "Keep selected systems connected to FI.",
      },
      {
        title: "Coexist",
        body: "Use FI alongside existing systems during a controlled adoption period.",
      },
      {
        title: "Transition",
        body: "Move selected workflows and data into FI in verified stages.",
      },
      {
        title: "Replace",
        body: "Use FI as the primary operating environment within the agreed scope.",
      },
    ] as const,
    hubspotNote:
      "Clinics using HubSpot can begin by connecting selected workflows, transition active contacts and leads in stages, or progressively move CRM activity into LeadFlow. The same progressive principle applies to booking, calendar and operational tools where supported.",
    migrationCta: {
      label: "See how controlled transition works",
      href: "/migrate-from-hubspot" as const,
    },
  },

  migration: {
    id: "clinic-owners-migration",
    eyebrow: "Migration continuity",
    headline: "Changing systems should not put the clinic at risk.",
    intro:
      "FI is designed to support a controlled transition rather than an abrupt cutover. Existing systems can remain in place while selected workflows and records are verified and moved in stages.",
    safeguards: [
      "Historical backup before migration",
      "Review before data is applied",
      "Staged migration groups",
      "Existing patient and lead matching",
      "Duplicate prevention",
      "Patient-record protection",
      "Post-transition verification",
      "Auditable migration history",
      "Continued operation during staged adoption",
    ] as const,
  },

  visibility: {
    id: "clinic-owners-visibility",
    eyebrow: "What the owner can see",
    headline: "See where patients are moving through the journey and where attention is required.",
    intro:
      "Visibility grows with structured capture. Not every signal is fully operational for every clinic today — maturity is labelled honestly.",
    categories: [
      {
        title: "Commercial",
        maturity: "Operational Pilot" as ClinicOwnerVisibilityMaturity,
        items: [
          "New enquiries",
          "Lead ownership",
          "Follow-up completion",
          "Pipeline movement",
          "Lost and converted patients",
          "Source performance",
        ],
      },
      {
        title: "Operational",
        maturity: "Operational Pilot" as ClinicOwnerVisibilityMaturity,
        items: [
          "Today’s clinic activity",
          "Appointment flow",
          "Patient readiness",
          "Procedure preparation",
          "Outstanding tasks",
          "Integration health",
        ],
      },
      {
        title: "Workforce",
        maturity: "Operational Pilot" as ClinicOwnerVisibilityMaturity,
        items: [
          "Roster coverage",
          "Staff availability",
          "Training and readiness",
          "Role access",
          "Competency requirements",
          "Workload distribution",
        ],
      },
      {
        title: "Clinical and outcomes",
        maturity: "Expanding" as ClinicOwnerVisibilityMaturity,
        items: [
          "Consultation pathways",
          "Imaging history",
          "Procedure records",
          "Follow-up completion",
          "Audit status",
          "Patient outcomes",
        ],
      },
      {
        title: "Financial and strategic",
        maturity: "Future" as ClinicOwnerVisibilityMaturity,
        items: [
          "Revenue visibility",
          "Conversion performance",
          "Capacity",
          "Clinic comparison",
          "Efficiency",
          "Long-term outcome value",
        ],
      },
    ] as const,
    legend: [
      {
        label: "Operational Pilot",
        meaning: "Active in defined clinic workflows within approved deployment scope.",
      },
      {
        label: "Expanding",
        meaning: "Foundations exist; depth and consistency continue to grow.",
      },
      {
        label: "Future",
        meaning: "Strategic capability direction — not claimed as fully operational product today.",
      },
    ] as const,
  },

  multiSite: {
    id: "clinic-owners-multisite",
    eyebrow: "Multi-site groups",
    headline: "Standardise the clinic without removing local accountability.",
    intro:
      "Designed to support multi-site groups that need shared operating standards without erasing local ownership.",
    benefits: [
      "Shared operating standards",
      "Consistent patient identity",
      "Common workflow definitions",
      "Role-based access",
      "Clinic-level and group-level visibility",
      "Comparable performance",
      "Central governance",
      "Local ownership",
      "Repeatable onboarding",
      "Controlled rollout by clinic",
    ] as const,
  },

  compoundValue: {
    id: "clinic-owners-compound-value",
    eyebrow: "Why value compounds",
    headline: "Each connected workflow strengthens the record.",
    intro:
      "As FI connects acquisition, consultation, treatment, surgery, imaging, workforce, follow-up and outcomes, the clinic gains a richer longitudinal history.",
    points: [
      "Better operational decisions",
      "Stronger patient handover",
      "More meaningful performance comparison",
      "Clearer training priorities",
      "Clearer treatment and outcome analysis",
      "Improved clinic standardisation",
    ] as const,
    closing:
      "In most software, a converted lead becomes a closed record. In FI, that conversion becomes the beginning of the clinical and outcome journey.",
  },

  maturity: {
    id: "clinic-owners-maturity",
    eyebrow: "Operational status",
    headline: "Honest about what is operational today.",
    body: "Follicle Intelligence is operating across defined clinic workflows, with several systems in controlled operational pilot and others progressing through advanced build and integration.",
    statuses: [
      "Deployed",
      "Operational Pilot",
      "Advanced Build",
      "In Development",
      "Research and Future Development",
    ] as const,
    cta: { label: "View Platform Progress", href: "/platform/progress" as const },
  },

  finalCta: {
    id: "clinic-owners-final-cta",
    eyebrow: "Next step",
    headline: "Start with the problem your clinic needs to solve first.",
    body: "Improve enquiry follow-up, connect existing systems, standardise operations or plan a wider transition into the Follicle Intelligence operating system.",
    primaryCta: {
      label: "Request a Platform and Migration Review",
      href: "/demo" as const,
    },
    secondaryCta: { label: "View Platform Progress", href: "/platform/progress" as const },
    tertiaryCta: { label: "Explore LeadFlow", href: "/platform/leadflow" as const },
  },
} as const;

export type ClinicOwnersPageContent = typeof CLINIC_OWNERS_PAGE_CONTENT;
