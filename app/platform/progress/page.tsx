import { PlatformProgressView } from "@/components/platform/PlatformProgressView";
import { buildPageMetadata } from "@/lib/seo/page-metadata";

export const metadata = buildPageMetadata({
  title: "Platform Progress | Live FI OS Delivery Status | Follicle Intelligence",
  description:
    "Live development progress across Follicle Intelligence modules — ReceptionOS, ConsultationOS, FinancialOS, SurgeryOS, ImagingOS, PatientOS, AuditOS, AcademyOS, AnalyticsOS, LeadFlow, and ClinicOS.",
  path: "/platform/progress",
});

export default function PlatformProgressPage() {
  return <PlatformProgressView />;
}
