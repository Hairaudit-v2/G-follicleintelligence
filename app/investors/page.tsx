import type { Metadata } from "next";

import { InvestorsMarketingView } from "@/components/investors/InvestorsMarketingView";
import { PUBLIC_IMAGES } from "@/src/lib/brand/publicImages";

const OG_IMAGE = PUBLIC_IMAGES.appleTouchIcon;

const PAGE_TITLE = "Investors | Follicle Intelligence";

const PAGE_DESCRIPTION =
  "Understand the long-term infrastructure opportunity behind Follicle Intelligence and the future of intelligence-driven hair restoration medicine.";

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
        alt: "Follicle Intelligence — institutional infrastructure for hair restoration medicine",
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

export default function InvestorsPage() {
  return <InvestorsMarketingView />;
}
