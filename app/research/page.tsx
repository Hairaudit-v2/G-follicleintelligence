import type { Metadata } from "next";

import { ResearchMarketingView } from "@/components/research/ResearchMarketingView";
import { PUBLIC_IMAGES } from "@/src/lib/brand/publicImages";

const OG_IMAGE = PUBLIC_IMAGES.appleTouchIcon;

const PAGE_TITLE = "Research | Follicle Intelligence";

const PAGE_DESCRIPTION =
  "Explore how Follicle Intelligence is building research infrastructure for evidence-based hair restoration medicine, outcome benchmarking, AI model development, and future clinical registries.";

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
        alt: "Follicle Intelligence — research infrastructure for hair restoration medicine",
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

export default function ResearchPage() {
  return <ResearchMarketingView />;
}
