import { PlatformReviewMarketingView } from "@/components/platform/PlatformReviewMarketingView";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import { PLATFORM_REVIEW_PAGE_CONTENT } from "@/lib/marketing/platformReviewPageContent";
import { SITE_SEO_KEYWORDS } from "@/lib/structured-data";

const seo = PLATFORM_REVIEW_PAGE_CONTENT.seo;

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

export default function DemoPage() {
  return <PlatformReviewMarketingView />;
}
