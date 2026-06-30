import type { ConsultationPathwayLauncherPathKey } from "@/src/lib/consultations/consultationPathwayKeys";
import type { ConsultationTypeId } from "@/src/lib/consultations/consultationTypeConfig";

/** Relative path under `/fi-admin/{tenant}/consultations/{id}` for each pathway form route. */
export const PATHWAY_FORM_RELATIVE_HREF: Record<ConsultationPathwayLauncherPathKey, string> = {
  hair_transplant: "/forms",
  hair_loss_hli: "/forms/hair-loss-treatment",
  female_hair_loss: "/forms/female-hair-loss",
  repair: "/forms/repair",
  follow_up_review: "/forms/follow-up",
  scalp_pathology: "/forms/pathology",
};

/** Default `fi_consultations.consultation_type` for each pathway (existing enum — no schema change). */
export const PATHWAY_DEFAULT_CONSULTATION_TYPE: Record<
  ConsultationPathwayLauncherPathKey,
  ConsultationTypeId
> = {
  hair_transplant: "scalp_hair_transplant",
  hair_loss_hli: "medical_hair_loss",
  female_hair_loss: "medical_hair_loss",
  repair: "scalp_hair_transplant",
  follow_up_review: "medical_hair_loss",
  scalp_pathology: "medical_hair_loss",
};

export type ConsultationPathwayCreateCard = {
  pathKey: ConsultationPathwayLauncherPathKey;
  title: string;
  subtitle: string;
};

/** Short titles for pathway selection (ConsultationOS default intake). */
export function consultationPathwayCreateCards(): readonly ConsultationPathwayCreateCard[] {
  return [
    {
      pathKey: "hair_transplant",
      title: "Hair Transplant",
      subtitle: "Surgical candidacy, donor / recipient planning, and consent-ready documentation.",
    },
    {
      pathKey: "hair_loss_hli",
      title: "Hair Loss Treatment",
      subtitle: "Medical workup, medications, labs, and non-surgical treatment planning.",
    },
    {
      pathKey: "female_hair_loss",
      title: "Female Hair Loss",
      subtitle:
        "Female-pattern context, hormones, shedding, and Ludwig / Sinclair–oriented visits.",
    },
    {
      pathKey: "repair",
      title: "Repair Consultation",
      subtitle: "Prior transplant audit, scarring, growth failure, and corrective options.",
    },
    {
      pathKey: "follow_up_review",
      title: "Follow Up Review",
      subtitle: "Interval reviews, treatment response, and longitudinal Twin signal.",
    },
    {
      pathKey: "scalp_pathology",
      title: "Scalp Disorder / Pathology",
      subtitle: "Inflammatory, scarring, infectious, and biopsy-led scalp presentations.",
    },
  ] as const;
}

export function consultationPathwayFormHref(args: {
  tenantId: string;
  consultationId: string;
  pathKey: ConsultationPathwayLauncherPathKey;
}): string {
  const tid = args.tenantId.trim();
  const cid = args.consultationId.trim();
  const rel = PATHWAY_FORM_RELATIVE_HREF[args.pathKey];
  return `/fi-admin/${encodeURIComponent(tid)}/consultations/${encodeURIComponent(cid)}${rel}`;
}
