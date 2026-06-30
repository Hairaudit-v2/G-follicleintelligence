import { FiMarketingHomeView } from "@/components/home/FiMarketingHomeView";
import { JsonLd } from "@/components/seo/json-ld";
import { SITE_URL } from "@/lib/seo/constants";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import { buildFAQPageSchema, HOME_PAGE_FAQS, SITE_SEO_KEYWORDS } from "@/lib/structured-data";

// Homepage-specific positioning. Distinct OG / Twitter copy is supported via the optional
// override fields on buildPageMetadata; the shared SITE_SEO_* constants remain unchanged so the
// root layout default and JSON-LD WebSite entity keep their site-wide values.
export const metadata = buildPageMetadata({
  title: "Follicle Intelligence | Operating System for Hair Restoration Clinics",
  description:
    "Follicle Intelligence is a purpose-built operating system for hair restoration clinics, connecting consultations, surgery, patient intelligence, staff training, outcomes, analytics, and clinic operations in one platform.",
  path: "/",
  keywords: [...SITE_SEO_KEYWORDS],
  ogTitle: "The Operating System Built Specifically for Hair Restoration Clinics",
  ogDescription:
    "Replace disconnected clinic tools with one connected intelligence platform built exclusively for hair restoration medicine.",
  twitterTitle: "Follicle Intelligence | Hair Restoration Clinic Operating System",
  twitterDescription:
    "A connected intelligence platform for consultations, surgery, outcomes, workforce, analytics, and clinic operations.",
});

export default function HomePage() {
  return (
    <>
      <JsonLd data={buildFAQPageSchema(SITE_URL, HOME_PAGE_FAQS)} />
      <FiMarketingHomeView />
    </>
  );
}
