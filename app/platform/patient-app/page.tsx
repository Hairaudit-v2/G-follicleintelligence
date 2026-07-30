import { PatientAppMarketingView } from "@/components/platform/PatientAppMarketingView";
import { JsonLd } from "@/components/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import { PATIENT_APP_PAGE_CONTENT } from "@/lib/marketing/patientAppPageContent";
import { SITE_URL } from "@/lib/seo/constants";
import { SITE_SEO_KEYWORDS, buildFAQPageSchema } from "@/lib/structured-data";

const seo = PATIENT_APP_PAGE_CONTENT.seo;
const faqs = PATIENT_APP_PAGE_CONTENT.faq.items.map((item) => ({
  question: item.q,
  answer: item.a,
}));

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

export default function PatientAppPage() {
  return (
    <>
      <JsonLd data={buildFAQPageSchema(`${SITE_URL}${seo.path}`, faqs)} />
      <PatientAppMarketingView />
    </>
  );
}
