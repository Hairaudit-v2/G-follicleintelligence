export const CONSULTATION_PATHWAY_LAUNCHER_PATH_KEYS = [
  "hair_transplant",
  "hair_loss_hli",
  "female_hair_loss",
  "repair",
  "follow_up_review",
  "scalp_pathology",
] as const;

export type ConsultationPathwayLauncherPathKey = (typeof CONSULTATION_PATHWAY_LAUNCHER_PATH_KEYS)[number];
