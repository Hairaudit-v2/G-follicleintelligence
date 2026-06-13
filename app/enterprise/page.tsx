import type { Metadata } from "next";

import { EnterpriseMarketingView } from "@/components/enterprise/EnterpriseMarketingView";
import { PUBLIC_IMAGES } from "@/src/lib/brand/publicImages";

const OG_IMAGE = PUBLIC_IMAGES.appleTouchIcon;

const PAGE_TITLE = "Enterprise: Scale Globally Without Losing Quality | Follicle Intelligence";

const PAGE_DESCRIPTION =
  "Enterprise infrastructure for multi-clinic groups, international networks, franchises, training organisations, and serious operators: standardised workflows, governance, training visibility, outcome monitoring, and portfolio analytics—without generic practice tooling.";

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
        alt: "Follicle Intelligence — enterprise infrastructure for hair restoration",
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

export default function EnterprisePage() {
  return <EnterpriseMarketingView />;
}
