/**
 * FI Patient App marketing screenshots (FI-PATIENT-APP-2A).
 * Public-safe synthetic demonstration identity only.
 */

export type PatientAppScreenshotId =
  | "homeNextStep"
  | "actionCentre"
  | "journeyTimeline"
  | "quote"
  | "pathology";

export type PatientAppScreenshotAsset = {
  id: PatientAppScreenshotId;
  src: string;
  width: number;
  height: number;
  alt: string;
  eyebrow: string;
  caption: string;
};

export const PATIENT_APP_SCREENSHOTS = {
  homeNextStep: {
    id: "homeNextStep",
    src: "/os-images/patient-app/patient-app-home-next-step.webp",
    width: 780,
    height: 1688,
    alt: "FI Patient App home screen showing the patient’s next required action",
    eyebrow: "Home",
    caption: "One clear next step — review the quote and move forward.",
  },
  actionCentre: {
    id: "actionCentre",
    src: "/os-images/patient-app/patient-app-action-centre.webp",
    width: 780,
    height: 1688,
    alt: "FI Patient App Action Centre showing outstanding journey tasks",
    eyebrow: "Action Centre",
    caption: "Outstanding actions, priority and unfinished work in one place.",
  },
  journeyTimeline: {
    id: "journeyTimeline",
    src: "/os-images/patient-app/patient-app-journey-timeline.webp",
    width: 780,
    height: 1688,
    alt: "FI Patient App Journey Timeline showing completed and upcoming milestones",
    eyebrow: "Journey Timeline",
    caption: "Completed milestones, patient actions and clinic-managed steps.",
  },
  quote: {
    id: "quote",
    src: "/os-images/patient-app/patient-app-quote.webp",
    width: 780,
    height: 1688,
    alt: "FI Patient App quote screen connected to the patient journey",
    eyebrow: "Quotes",
    caption: "Return to the clinic proposal without searching email.",
  },
  pathology: {
    id: "pathology",
    src: "/os-images/patient-app/patient-app-pathology.webp",
    width: 720,
    height: 1600,
    alt: "FI Patient App pathology requirements screen",
    eyebrow: "Pathology",
    caption: "See what is required and what remains outstanding.",
  },
} as const satisfies Record<PatientAppScreenshotId, PatientAppScreenshotAsset>;

/** Final public set — preferred 4–5 screens (max 6). */
export const PATIENT_APP_PUBLIC_SCREENSHOTS: readonly PatientAppScreenshotId[] = [
  "homeNextStep",
  "actionCentre",
  "journeyTimeline",
  "quote",
  "pathology",
] as const;

export const PATIENT_APP_DEMO_DATA_NOTE =
  "Interface shown with demonstration data for Alex Morgan at FI Demonstration Clinic." as const;
