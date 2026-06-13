import type { Metadata } from "next";

import { IntelligenceMarketingView } from "@/components/intelligence/IntelligenceMarketingView";
import { INTELLIGENCE_PAGE_METADATA } from "@/lib/marketing/intelligencePageContent";
import { PUBLIC_IMAGES } from "@/src/lib/brand/publicImages";

const OG_IMAGE = PUBLIC_IMAGES.appleTouchIcon;

const PAGE_TITLE = INTELLIGENCE_PAGE_METADATA.title;
const PAGE_DESCRIPTION = INTELLIGENCE_PAGE_METADATA.description;

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
        alt: "Follicle Intelligence — intelligence layer for predictive hair restoration",
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

export default function IntelligencePage() {
  return <IntelligenceMarketingView />;
}
