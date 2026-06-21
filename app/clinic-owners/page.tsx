import { ClinicOwnersMarketingView } from "@/components/clinic-owners/ClinicOwnersMarketingView";
import { buildPageMetadata } from "@/lib/seo/page-metadata";

const PAGE_TITLE = "Build And Scale A High-Performance Hair Restoration Clinic | Follicle Intelligence";

const PAGE_DESCRIPTION =
  "Follicle Intelligence is the operating system for hair restoration clinic owners: LeadFlowOS, ClinicOS, ConsultationOS, SurgeryOS, AcademyOS, and AnalyticsOS—pipeline to outcomes, staff accountability, and clinic KPIs without generic practice software.";

export const metadata = buildPageMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: "/clinic-owners",
  imageAlt: "Follicle Intelligence — operating system for hair restoration clinic owners",
});

export default function ClinicOwnersPage() {
  return <ClinicOwnersMarketingView />;
}