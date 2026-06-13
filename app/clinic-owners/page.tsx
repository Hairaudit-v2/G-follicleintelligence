import type { Metadata } from "next";

import { ClinicOwnersMarketingView } from "@/components/clinic-owners/ClinicOwnersMarketingView";
import { PUBLIC_IMAGES } from "@/src/lib/brand/publicImages";

const OG_IMAGE = PUBLIC_IMAGES.appleTouchIcon;

const PAGE_TITLE = "Build And Scale A High-Performance Hair Restoration Clinic | Follicle Intelligence";

const PAGE_DESCRIPTION =
  "Follicle Intelligence is the operating system for hair restoration clinic owners: LeadFlowOS, ClinicOS, ConsultationOS, SurgeryOS, AcademyOS, and AnalyticsOS—pipeline to outcomes, staff accountability, and clinic KPIs without generic practice software.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    siteName: "Follicle Intelligence",
    type: "website",
    images: [
      {
        url: OG_IMAGE.src,
        width: OG_IMAGE.width,
        height: OG_IMAGE.height,
        alt: "Follicle Intelligence — operating system for hair restoration clinic owners",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE.src],
  },
};

export default function ClinicOwnersPage() {
  return <ClinicOwnersMarketingView />;
}
