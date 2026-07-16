import { LeadFlowMarketingView } from "@/components/platform/LeadFlowMarketingView";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import { LEADFLOW_PAGE_CONTENT } from "@/lib/marketing/leadFlowPageContent";
import { SITE_SEO_KEYWORDS } from "@/lib/structured-data";

const seo = LEADFLOW_PAGE_CONTENT.seo;

export const metadata = buildPageMetadata({
  title: seo.title,
  description: seo.description,
  path: seo.path,
  keywords: [...SITE_SEO_KEYWORDS, ...seo.keywords],
  ogTitle: seo.ogTitle,
  ogDescription: seo.ogDescription,
  twitterTitle: seo.ogTitle,
  twitterDescription: seo.ogDescription,
});

export default function LeadFlowPage() {
  return <LeadFlowMarketingView />;
}
