import type { Metadata } from "next";

import { PlatformProgressView } from "@/components/platform/PlatformProgressView";

export const metadata: Metadata = {
  title: "Platform Progress | Live FI OS Delivery Status | Follicle Intelligence",
  description:
    "Live development progress across Follicle Intelligence modules — ReceptionOS, ConsultationOS, FinancialOS, SurgeryOS, ImagingOS, PatientOS, AuditOS, AcademyOS, AnalyticsOS, LeadFlow, and ClinicOS.",
};

export default function PlatformProgressPage() {
  return <PlatformProgressView />;
}
