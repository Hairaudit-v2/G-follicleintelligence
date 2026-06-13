import type { Metadata } from "next";

import { AuditNetworkMarketingView } from "@/components/audit-network/AuditNetworkMarketingView";
import { AUDIT_NETWORK_PAGE_METADATA } from "@/lib/marketing/auditNetworkPageContent";
import { PUBLIC_IMAGES } from "@/src/lib/brand/publicImages";

const OG_IMAGE = PUBLIC_IMAGES.appleTouchIcon;

const PAGE_TITLE = AUDIT_NETWORK_PAGE_METADATA.title;
const PAGE_DESCRIPTION = AUDIT_NETWORK_PAGE_METADATA.description;

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
        alt: "Follicle Intelligence — AuditOS independent outcome verification",
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

export default function AuditNetworkPage() {
  return <AuditNetworkMarketingView />;
}
