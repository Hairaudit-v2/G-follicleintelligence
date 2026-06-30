import { IntelligenceMarketingView } from "@/components/intelligence/IntelligenceMarketingView";
import { INTELLIGENCE_PAGE_METADATA } from "@/lib/marketing/intelligencePageContent";
import { buildPageMetadata } from "@/lib/seo/page-metadata";

export const metadata = buildPageMetadata({
  title: INTELLIGENCE_PAGE_METADATA.title,
  description: INTELLIGENCE_PAGE_METADATA.description,
  path: "/intelligence",
  imageAlt: "Follicle Intelligence — intelligence layer for predictive hair restoration",
});

export default function IntelligencePage() {
  return <IntelligenceMarketingView />;
}
