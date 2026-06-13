import type { Metadata } from "next";

import { FiMarketingHomeView } from "@/components/home/FiMarketingHomeView";
import { SITE_SEO_DESCRIPTION, SITE_SEO_TITLE } from "@/lib/structured-data";
import { PUBLIC_IMAGES } from "@/src/lib/brand/publicImages";

const OG_IMAGE = PUBLIC_IMAGES.appleTouchIcon;

export const metadata: Metadata = {
  title: SITE_SEO_TITLE,
  description: SITE_SEO_DESCRIPTION,
  openGraph: {
    title: SITE_SEO_TITLE,
    description: SITE_SEO_DESCRIPTION,
    siteName: "Follicle Intelligence",
    type: "website",
    images: [
      {
        url: OG_IMAGE.src,
        width: OG_IMAGE.width,
        height: OG_IMAGE.height,
        alt: "Follicle Intelligence — The Operating System For The Future Of Hair Restoration",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_SEO_TITLE,
    description: SITE_SEO_DESCRIPTION,
    images: [OG_IMAGE.src],
  },
};

export default function HomePage() {
  return <FiMarketingHomeView />;
}
