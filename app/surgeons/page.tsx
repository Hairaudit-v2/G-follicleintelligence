import type { Metadata } from "next";

import { SurgeonsMarketingView } from "@/components/surgeons/SurgeonsMarketingView";
import { PUBLIC_IMAGES } from "@/src/lib/brand/publicImages";

const OG_IMAGE = PUBLIC_IMAGES.appleTouchIcon;

const PAGE_TITLE = "Become A World-Class Hair Restoration Surgeon | Follicle Intelligence";

const PAGE_DESCRIPTION =
  "Follicle Intelligence is the operating system for modern hair restoration surgeons: structured training, consultation and surgical workflows, SurgeryOS case intelligence, outcome review, HairAudit-aligned auditing, and continuous improvement—without generic practice tooling.";

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
        alt: "Follicle Intelligence — surgical development and intelligence for hair restoration surgeons",
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

export default function SurgeonsPage() {
  return <SurgeonsMarketingView />;
}
