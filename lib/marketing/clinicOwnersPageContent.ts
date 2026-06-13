/**
 * Long-form copy and structure for `/clinic-owners` — owner and operator positioning.
 * Edit here to update marketing content without touching layout code.
 */

export const CLINIC_OWNERS_PAGE_CONTENT = {
  hero: {
    id: "clinic-owners-hero",
    eyebrow: "For clinic owners",
    headline: "Build And Scale A High-Performance Hair Restoration Clinic",
    subtext:
      "Follicle Intelligence connects lead management, consultations, scheduling, staff workflows, surgical planning, patient journeys, training, audit readiness, and business intelligence into one operating system built specifically for hair restoration clinics.",
    primaryCta: { label: "Explore Platform", href: "/platform" as const },
    secondaryCta: { label: "Book Enterprise Demo", href: "/demo" as const },
  },

  problem: {
    id: "clinic-owners-problem",
    eyebrow: "Reality",
    headline: "Most clinic problems are system problems.",
    cards: [
      {
        title: "Leads fall through the cracks",
        body: "When enquiry ownership, stages, and next actions are not explicit, revenue leaks quietly—often before leadership sees a trend.",
      },
      {
        title: "Follow-ups depend on memory",
        body: "Inboxes and heroics do not scale. Without task discipline and overdue visibility, the best intentions still produce inconsistent patient experience.",
      },
      {
        title: "Consultations are inconsistent",
        body: "Variance in documentation, recommendations, and quotes creates rework, disputes, and weak handoffs into surgery and follow-up.",
      },
      {
        title: "Bookings and staff availability are disconnected",
        body: "If scheduling does not reflect services, rooms, and roles honestly, you run hot on promises and cold on utilisation—both are expensive.",
      },
      {
        title: "Surgery planning lives outside the CRM",
        body: "When planning is not tied to the same patient thread as sales and operations, teams reconcile manually—and errors compound at volume.",
      },
      {
        title: "Patient records are fragmented",
        body: "A longitudinal specialty needs a coherent chart. Fragmented records make outcomes harder to review and operations harder to defend.",
      },
      {
        title: "Team training is hard to monitor",
        body: "Without competency signals linked to real workflows, owners guess where risk sits—until a mistake or complaint makes it obvious.",
      },
      {
        title: "Outcomes are not measured consistently",
        body: "If photography, milestones, and review habits vary by room, you cannot improve honestly—internal meetings become opinion, not evidence.",
      },
    ],
  },

  operatingSystem: {
    id: "clinic-owners-os",
    eyebrow: "Architecture",
    headline: "One system for the entire clinic.",
    diagramCaption: "Six modules · one operational spine",
    bands: [
      {
        title: "LeadFlowOS",
        tagline: "Lead capture, pipelines, tasks, follow-ups",
        summary:
          "Keep demand visible: enquiry capture, ownership, pipeline stages, tasks, and follow-up rhythm tied to clinic capacity—so growth does not outrun accountability.",
      },
      {
        title: "ClinicOS",
        tagline: "Scheduling, services, staff availability, daily operations",
        summary:
          "Run the operational heartbeat: calendars, services, rooms and roles, appointment lifecycle, and constraints that consultations and surgery inherit as truth.",
      },
      {
        title: "ConsultationOS",
        tagline: "Assessment, diagnosis, recommendations, quotes",
        summary:
          "Structure the consult lifecycle from discovery through quotes and handoff—reducing variance in expectations, documentation, and downstream planning inputs.",
      },
      {
        title: "SurgeryOS",
        tagline: "Case planning, procedure day, post-op follow-up",
        summary:
          "Carry the surgical programme in the same patient story: planning, day-of rhythm, milestones, and continuity into outcomes—without parallel shadow systems.",
      },
      {
        title: "AcademyOS",
        tagline: "Staff training, competency, certification",
        summary:
          "Make training legible: pathways, completion, and competency posture connected to real roles—so remediation is targeted instead of generic.",
      },
      {
        title: "AnalyticsOS",
        tagline: "Conversion, revenue, productivity, clinic KPIs",
        summary:
          "Turn structured events into operational and commercial signal: funnel integrity, utilisation, pipeline health, and productivity—with honest denominators where definitions matter.",
      },
    ],
  },

  workflow: {
    id: "clinic-owners-workflow",
    eyebrow: "Patient journey",
    headline: "From first enquiry to long-term patient relationship.",
    steps: [
      "Lead captured",
      "Follow-up task",
      "Consultation booked",
      "Assessment completed",
      "Quote prepared",
      "Surgery planned",
      "Procedure completed",
      "Follow-up scheduled",
      "Outcome reviewed",
      "Patient retained",
    ],
  },

  dashboard: {
    id: "clinic-owners-dashboard",
    eyebrow: "Visibility",
    headline: "See what is happening before it becomes a problem.",
    cards: [
      {
        title: "New leads",
        body: "Fresh enquiries with source, owner, and stage—so intake stays paced to response standards instead of batch panic.",
      },
      {
        title: "Stale leads",
        body: "Aging pipeline items surfaced early—useful for coaching and capacity decisions, not only month-end rescue missions.",
      },
      {
        title: "Consultation conversion",
        body: "Stage movement and drop-offs with definitions that stay stable—so you discuss process quality, not moving goalposts.",
      },
      {
        title: "Booking utilisation",
        body: "Rhythm indicators that connect appointments to services and roles—tighter operational truth than calendar occupancy alone.",
      },
      {
        title: "Open surgical cases",
        body: "Cases in flight with planning and milestone posture visible—reducing silent drift between consult promise and day-of execution.",
      },
      {
        title: "Staff tasks",
        body: "Work queues and overdue items by role—so accountability is observable without turning the owner into a human task router.",
      },
      {
        title: "Follow-up compliance",
        body: "Milestone completion relative to policy—highlights where longitudinal care is slipping before outcomes become noisy.",
      },
      {
        title: "Revenue pipeline",
        body: "Quoted and scheduled value tied to stages—helpful for forecasting discipline when definitions are enforced in the system.",
      },
      {
        title: "Patient outcomes",
        body: "Outcome evidence and review posture aggregated where capture allows—signal for quality conversations, not a substitute for clinical judgment.",
      },
      {
        title: "Training readiness",
        body: "Competency and certification gaps tied to roles—so staffing risk is visible before it becomes a patient-facing incident.",
      },
    ],
  },

  accountability: {
    id: "clinic-owners-accountability",
    eyebrow: "Leadership",
    headline: "Make performance visible without micromanaging.",
    paragraphs: [
      "Owners should not need to chase every staff member manually. The operating system should surface what is late, incomplete, or drifting: missed follow-ups, overdue tasks, consultations missing structure, training gaps, booking bottlenecks, and outcome capture risks.",
      "The goal is operational clarity—exceptions routed to the right role, with history that supports fair coaching and decisive correction. Follicle Intelligence is built so accountability lives in workflow design, not in heroic oversight from the top.",
    ],
    signals: [
      "Missed follow-ups and ageing tasks",
      "Incomplete consultations and weak documentation density",
      "Training and certification gaps by role",
      "Scheduling bottlenecks and utilisation mismatches",
      "Open surgical cases without milestone progression",
      "Outcome capture risks before review cycles stall",
    ],
  },

  audiences: {
    id: "clinic-owners-audiences",
    eyebrow: "Audience",
    headline: "Built for serious clinic operators.",
    cards: [
      {
        title: "New clinic founders",
        body: "Stand up acquisition, operations, clinical structure, and governance habits early—so your first growth phase does not cement bad patterns.",
      },
      {
        title: "Established single clinics",
        body: "Replace stitched tools with one spine: clearer handoffs, cleaner records, and dashboards that reflect how hair restoration actually runs.",
      },
      {
        title: "Growth-focused clinics",
        body: "Increase volume with discipline: pipeline hygiene, booking truth, training visibility, and outcome habits that scale with headcount.",
      },
      {
        title: "Clinics adding hair transplant services",
        body: "Integrate a surgical vertical without fragmenting CRM, records, and follow-up—so the new service line inherits operational rigour.",
      },
      {
        title: "Clinics training new consultants and staff",
        body: "Pair structured onboarding with measurable workflow signals—so competency discussions reference reality, not impressions.",
      },
      {
        title: "Owners preparing for multi-site expansion",
        body: "Build repeatable modules and reporting posture before the second site opens—expansion adds leverage instead of parallel chaos.",
      },
    ],
  },

  finalCta: {
    id: "clinic-owners-final-cta",
    eyebrow: "Next step",
    headline: "Run your clinic on the system built for hair restoration.",
    primaryCta: { label: "Explore Platform", href: "/platform" as const },
    secondaryCta: { label: "Book Enterprise Demo", href: "/demo" as const },
  },
} as const;
