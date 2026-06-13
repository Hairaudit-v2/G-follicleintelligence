/**
 * Long-form copy and structure for `/intelligence` — diagnostic, longitudinal, and predictive positioning.
 * Edit here to update marketing content without touching layout code.
 */

export const INTELLIGENCE_PAGE_METADATA = {
  title: "Intelligence Layer — Predictive Hair Restoration Engine | Follicle Intelligence",
  description:
    "Follicle Intelligence connects patient history, clinical assessment, imaging, blood markers, treatment response, surgical data, audit evidence, and long-term outcomes into one structured intelligence layer for hair restoration.",
} as const;

export const INTELLIGENCE_PAGE_CONTENT = {
  hero: {
    id: "intel-hero",
    eyebrow: "Intelligence layer",
    headline: "The Intelligence Layer Behind Predictive Hair Restoration",
    subtext:
      "Follicle Intelligence connects patient history, clinical assessment, imaging, blood markers, treatment response, surgical data, audit evidence, and long-term outcomes into one structured intelligence layer for hair restoration.",
    primaryCta: { label: "Explore Platform", href: "/platform" as const },
    secondaryCta: { label: "Book Enterprise Demo", href: "/demo" as const },
  },

  problem: {
    id: "intel-problem",
    eyebrow: "Signal gaps",
    headline: "Hair restoration decisions are still made with incomplete data.",
    cards: [
      {
        title: "Patient history is fragmented",
        body: "Consult notes, prior treatments, and lifestyle context often live in different systems—so the longitudinal story weakens before planning begins.",
      },
      {
        title: "Blood markers are reviewed separately",
        body: "Labs may be interpreted in isolation from imaging and treatment response, which limits how clinicians connect biology to what they see in follow-up.",
      },
      {
        title: "Photos are rarely structured over time",
        body: "Without consistent capture windows and protocols, visual timelines become hard to compare—signal gets lost in angle and lighting noise.",
      },
      {
        title: "Treatment response is not consistently measured",
        body: "Medication and non-surgical pathways need disciplined checkpoints; sparse documentation makes it harder to learn what actually moved the needle.",
      },
      {
        title: "Surgery data is disconnected from outcomes",
        body: "Operative detail and later growth review are often separated by tooling—so teams debrief cases without a single evidence thread.",
      },
      {
        title: "Audit evidence is isolated",
        body: "Independent review and quality signals rarely feed back into the same longitudinal record—governance and clinical learning stay in different lanes.",
      },
      {
        title: "Clinics cannot easily compare patterns",
        body: "Without shared structure, cohort insight stays anecdotal—networks cannot see repeatable patterns where capture discipline allows.",
      },
      {
        title: "Future risk is difficult to model",
        body: "Prediction needs compounding structured data; when layers stay disconnected, even responsible forecasting remains out of reach.",
      },
    ],
  },

  hairLongevityInstitute: {
    id: "intel-hli",
    eyebrow: "Pre-surgical spine",
    headline: "Clinical intelligence starts before surgery.",
    publicLabel: "Hair Longevity Institute",
    paragraphs: [
      "The Hair Longevity Institute layer supports diagnostic pathways, AI-assisted intake, blood interpretation, risk scoring, treatment planning, and non-surgical management—before a patient ever reaches surgery.",
      "The goal is continuity: the same structured intelligence substrate that informs consultation can later connect to procedure data, follow-up evidence, and audit review—so early decisions are not orphaned from long-term outcomes.",
    ],
  },

  patientTwin: {
    id: "intel-patient-twin",
    eyebrow: "Longitudinal record",
    headline: "Every patient becomes a longitudinal intelligence record.",
    cards: [
      { title: "Baseline photography", body: "Protocol-aware capture that anchors later comparison—explicit about timing and capture quality." },
      { title: "Trichoscopy", body: "Structured scalp imaging signals where your workflow records them, alongside clinical interpretation." },
      { title: "Family history", body: "Pattern context that can support risk conversations when the chart supports it." },
      { title: "Medical history", body: "Comorbidities and contraindications surfaced in the same intelligence envelope as treatment planning." },
      { title: "Blood markers", body: "Labs tied to restoration-relevant interpretation—not a disconnected PDF in another tab." },
      { title: "Medication history", body: "Chronology and adherence signals that can support longitudinal medication response review." },
      { title: "Treatment response", body: "Checkpoints that make non-surgical and medical management discussable over time." },
      { title: "Regenerative treatments", body: "Structured capture for adjunct therapies where your organisation documents them." },
      { title: "Surgical history", body: "Prior procedures and donor posture connected to planning—not a one-line free text field." },
      { title: "Follow-up outcomes", body: "Time-stamped evidence that respects how results mature—honest gaps included." },
      { title: "Audit evidence", body: "Independent review inputs where your governance model connects them to the twin." },
      { title: "Patient satisfaction", body: "Structured feedback complementary to clinical evidence—not a substitute for it." },
    ],
  },

  connected: {
    id: "intel-connected",
    eyebrow: "Architecture",
    headline: "Diagnosis, treatment, surgery, and outcomes finally connect.",
    flow: [
      "Clinical intake",
      "Diagnostic review",
      "Treatment plan",
      "Surgical plan",
      "Procedure data",
      "Follow-up evidence",
      "Audit review",
      "Long-term outcome intelligence",
    ] as const,
  },

  predictive: {
    id: "intel-predictive",
    eyebrow: "Forward signal",
    headline: "As structured data grows, prediction becomes possible.",
    disclaimer:
      "Future models are an adjunct to clinical judgement—not a replacement for it. Language below reflects what structured longitudinal data may help illuminate as methods and evidence mature.",
    cards: [
      {
        title: "Hair loss progression risk",
        body: "Future models may help quantify progression risk when baseline imaging, history, and follow-up checkpoints compound over time—always bounded by capture quality.",
      },
      {
        title: "Medication response patterns",
        body: "Structured treatment timelines can support pattern review across cohorts where organisations define comparable denominators.",
      },
      {
        title: "Donor depletion risk",
        body: "Longitudinal donor documentation may help teams discuss stewardship with clearer context—without overstating precision the record cannot justify.",
      },
      {
        title: "Surgical candidacy signals",
        body: "Connected intake, diagnostics, and medical data can support candidacy conversations as an adjunct to surgeon judgement and consent.",
      },
      {
        title: "Graft survival patterns",
        body: "When procedure data and follow-up evidence connect, future analytics may help describe variance—useful for training and quality review where permitted.",
      },
      {
        title: "Complication risk indicators",
        body: "Signal layers can support proactive review workflows; they are not deterministic predictions of individual outcomes.",
      },
      {
        title: "Long-term density forecasting",
        body: "Density outlook may become discussable as structured imaging and interval capture grow—explicitly humble where intervals are sparse.",
      },
      {
        title: "Treatment durability insight",
        body: "Durability questions benefit from years of structured checkpoints; models can support scenario thinking, not guarantees.",
      },
    ],
  },

  why: {
    id: "intel-why",
    eyebrow: "Why it matters",
    headline: "The future of hair restoration is not more guesswork.",
    paragraphs: [
      "Hair restoration outcomes depend on biology, medicine, surgical execution, follow-up, and long-term patient behaviour. When these data layers remain disconnected, clinicians lose the ability to see the full picture. Follicle Intelligence is designed to bring those layers together.",
    ],
  },

  finalCta: {
    id: "intel-final-cta",
    eyebrow: "Enterprise",
    headline: "Build your clinic on intelligence that compounds.",
    primaryCta: { label: "Explore Platform", href: "/platform" as const },
    secondaryCta: { label: "Book Enterprise Demo", href: "/demo" as const },
  },
} as const;
