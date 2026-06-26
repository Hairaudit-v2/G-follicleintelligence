import { PlatformProgressView } from "@/components/platform/PlatformProgressView";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import { SITE_SEO_KEYWORDS } from "@/lib/structured-data";

export const metadata = buildPageMetadata({
  title: "Platform Progress | FI Intelligence Infrastructure | Follicle Intelligence",
  description:
    "Live engineering progress across 20 interconnected Follicle Intelligence systems — FoundationOS, ClinicOS, VIE, SurgeryOS, CalendarOS, Event Bus, AI Intelligence Layer, and the infrastructure substrate for hair restoration medicine.",
  path: "/platform/progress",
  keywords: [...SITE_SEO_KEYWORDS, "platform progress", "FI intelligence infrastructure", "hair restoration operating system"],
});

export default function PlatformProgressPage() {
  return <PlatformProgressView />;
}
