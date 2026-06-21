import type { Metadata } from "next";

import { FutureOfHairRestorationView } from "@/components/future/FutureOfHairRestorationView";
import { PUBLIC_IMAGES } from "@/src/lib/brand/publicImages";

const OG_IMAGE = PUBLIC_IMAGES.appleTouchIcon;

const PAGE_TITLE = "The Future of Hair Restoration";

const PAGE_DESCRIPTION =
  "Explore where the global hair restoration industry is heading over the next decade and how intelligence-driven medicine will transform patient care.";

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
        alt: "Follicle Intelligence — the future of hair restoration",
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

export default function FutureOfHairRestorationPage() {
  return <FutureOfHairRestorationView />;
}
