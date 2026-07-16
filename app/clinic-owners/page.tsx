import { ClinicOwnersMarketingView } from "@/components/clinic-owners/ClinicOwnersMarketingView";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import { CLINIC_OWNERS_PAGE_CONTENT } from "@/lib/marketing/clinicOwnersPageContent";
import { SITE_SEO_KEYWORDS } from "@/lib/structured-data";

const seo = CLINIC_OWNERS_PAGE_CONTENT.seo;

export const metadata = buildPageMetadata({
  title: seo.title,
  description: seo.description,
  path: seo.path,
  keywords: [
    ...SITE_SEO_KEYWORDS,
    "hair restoration clinic operating system",
    "clinic owner software",
    "hair transplant clinic management",
  ],
  ogTitle: seo.ogTitle,
  ogDescription: seo.ogDescription,
  twitterTitle: seo.ogTitle,
  twitterDescription: seo.ogDescription,
  imageAlt: "Follicle Intelligence — operating system for hair restoration clinic owners",
});

export default function ClinicOwnersPage() {
  return <ClinicOwnersMarketingView />;
}
