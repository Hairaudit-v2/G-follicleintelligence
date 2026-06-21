import type { Metadata } from "next";

import { PartnersMarketingView } from "@/components/partners/PartnersMarketingView";
import { PUBLIC_IMAGES } from "@/src/lib/brand/publicImages";

const OG_IMAGE = PUBLIC_IMAGES.appleTouchIcon;

const PAGE_TITLE = "Strategic Partnerships | Follicle Intelligence";

const PAGE_DESCRIPTION =
  "Explore how clinics, educators, enterprise groups, and industry partners can help build the future of global hair restoration medicine.";

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
        alt: "Follicle Intelligence — strategic partnerships for hair restoration medicine",
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

export default function PartnersPage() {
  return <PartnersMarketingView />;
}
