import { Suspense } from "react";

import { FiMarketingHomeView } from "@/components/home/FiMarketingHomeView";
import { FiOsRecoveryHashRedirect } from "@/src/components/fi/os/FiOsRecoveryHashRedirect";
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
    "Follicle Intelligence is a purpose-built operating system for hair restoration clinics — connecting consultations, surgery, patient intelligence, staff training, outcomes and operations, with progressive adoption that protects clinic continuity.",
  path: "/",
  keywords: [...SITE_SEO_KEYWORDS],
  ogTitle: "The Operating System Built Specifically for Hair Restoration Clinics",
  ogDescription:
    "Replace disconnected clinic tools with one connected operating system — connect, transition or replace at a pace that protects clinic continuity.",
  twitterTitle: "Follicle Intelligence | Hair Restoration Clinic Operating System",
  twitterDescription:
    "A connected operating system for consultations, surgery, outcomes, workforce and clinic operations — with honest delivery status and progressive adoption.",
});

export default function HomePage() {
  return (
    <>
      <Suspense fallback={null}>
        <FiOsRecoveryHashRedirect />
      </Suspense>
      <JsonLd data={buildFAQPageSchema(SITE_URL, HOME_PAGE_FAQS)} />
      <FiMarketingHomeView />
    </>
  );
}
