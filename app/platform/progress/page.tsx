import { PlatformProgressView } from "@/components/platform/PlatformProgressView";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import { SITE_SEO_KEYWORDS } from "@/lib/structured-data";

export const metadata = buildPageMetadata({
  title: "Platform Progress | Hair Restoration Operating System | Follicle Intelligence",
  description:
    "See where Follicle Intelligence stands today: operational and pilot systems, advanced builds, controlled HubSpot migration, and a progressive adoption pathway for hair restoration clinics.",
  path: "/platform/progress",
  keywords: [
    ...SITE_SEO_KEYWORDS,
    "platform progress",
    "hair restoration operating system",
    "clinic software migration",
    "HubSpot to FI",
  ],
});

export default function PlatformProgressPage() {
  return <PlatformProgressView />;
}
