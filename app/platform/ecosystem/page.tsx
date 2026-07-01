import { EcosystemArchitectureView } from "@/components/platform/EcosystemArchitectureView";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import { SITE_SEO_KEYWORDS } from "@/lib/structured-data";

export const metadata = buildPageMetadata({
  title:
    "Ecosystem Architecture | The Operating System For Hair Restoration Medicine | Follicle Intelligence",
  description:
    "Twelve intelligence layers — LeadFlow OS, ConsultationOS, HLI Engine, ImagingOS, SurgeryOS, WorkforceOS, ClinicOS, PaymentsOS, HairAudit, AcademyOS, OnboardingOS, and AnalyticsOS — forming the connected operating system for hair restoration medicine.",
  path: "/platform/ecosystem",
  keywords: [
    ...SITE_SEO_KEYWORDS,
    "healthcare infrastructure stack",
    "ecosystem architecture",
    "hair restoration operating system",
    "clinical intelligence platform",
  ],
});

export default function EcosystemArchitecturePage() {
  return <EcosystemArchitectureView />;
}
