import { PlatformEnterpriseView } from "@/components/platform/PlatformEnterpriseView";
import { JsonLd } from "@/components/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import { SITE_URL } from "@/lib/seo/constants";
import { buildSoftwareApplicationSchema } from "@/lib/structured-data";

const PAGE_TITLE =
  "Platform Architecture | The Complete Operating System For Hair Restoration | Follicle Intelligence";

const PAGE_DESCRIPTION =
  "Product architecture for Follicle Intelligence: LeadFlowOS, ClinicOS, PatientOS, ConsultationOS, HairIntel, SurgeryOS, AuditOS, AcademyOS, AnalyticsOS, and the Global Intelligence Network—one connected operating system for hair restoration enterprises.";

export const metadata = buildPageMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: "/platform",
});

export default function PlatformPage() {
  return (
    <>
      <JsonLd data={buildSoftwareApplicationSchema(SITE_URL)} />
      <PlatformEnterpriseView />
    </>
  );
}
