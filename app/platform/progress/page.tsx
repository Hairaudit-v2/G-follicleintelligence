import { PlatformProgressView } from "@/components/platform/PlatformProgressView";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import { SITE_SEO_KEYWORDS } from "@/lib/structured-data";

export const metadata = buildPageMetadata({
  title: "Platform Progress | Live FI OS Delivery Status | Follicle Intelligence",
  description:
    "Live development progress across Follicle Intelligence modules — FoundationOS, ReceptionOS, ConsultationOS, FinancialOS, SurgeryOS, ImagingOS, PatientOS, AuditOS, AcademyOS, AnalyticsOS, ClinicOS, and WorkforceOS.",
  path: "/platform/progress",
  keywords: [...SITE_SEO_KEYWORDS, "platform progress", "FI OS delivery status"],
});

export default function PlatformProgressPage() {
  return <PlatformProgressView />;
}
