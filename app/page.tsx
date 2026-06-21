import { FiMarketingHomeView } from "@/components/home/FiMarketingHomeView";
import { JsonLd } from "@/components/seo/json-ld";
import { SITE_URL } from "@/lib/seo/constants";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import {
  buildFAQPageSchema,
  HOME_PAGE_FAQS,
  SITE_SEO_DESCRIPTION,
  SITE_SEO_KEYWORDS,
  SITE_SEO_TITLE,
} from "@/lib/structured-data";

export const metadata = buildPageMetadata({
  title: SITE_SEO_TITLE,
  description: SITE_SEO_DESCRIPTION,
  path: "/",
  keywords: [...SITE_SEO_KEYWORDS],
});

export default function HomePage() {
  return (
    <>
      <JsonLd data={buildFAQPageSchema(SITE_URL, HOME_PAGE_FAQS)} />
      <FiMarketingHomeView />
    </>
  );
}