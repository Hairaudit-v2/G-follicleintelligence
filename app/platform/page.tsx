import type { Metadata } from "next";

import { PlatformEnterpriseView } from "@/components/platform/PlatformEnterpriseView";

export const metadata: Metadata = {
  title: "Platform Architecture | The Complete Operating System For Hair Restoration | Follicle Intelligence",
  description:
    "Product architecture for Follicle Intelligence: LeadFlowOS, ClinicOS, PatientOS, ConsultationOS, HairIntel, SurgeryOS, AuditOS, AcademyOS, AnalyticsOS, and the Global Intelligence Network—one connected operating system for hair restoration enterprises.",
};

export default function PlatformPage() {
  return <PlatformEnterpriseView />;
}
