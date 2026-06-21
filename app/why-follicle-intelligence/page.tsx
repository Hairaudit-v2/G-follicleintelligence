import type { Metadata } from "next";

import { WhyFollicleIntelligenceView } from "@/components/why/WhyFollicleIntelligenceView";
import { PUBLIC_IMAGES } from "@/src/lib/brand/publicImages";

const OG_IMAGE = PUBLIC_IMAGES.appleTouchIcon;

const PAGE_TITLE = "Why Follicle Intelligence Exists";

const PAGE_DESCRIPTION =
  "Learn why Follicle Intelligence is building the infrastructure layer for the future of global hair restoration medicine.";

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
        alt: "Follicle Intelligence — why we exist",
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

export default function WhyFollicleIntelligencePage() {
  return <WhyFollicleIntelligenceView />;
}
