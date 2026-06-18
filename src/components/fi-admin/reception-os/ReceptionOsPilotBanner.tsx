"use client";

import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import type { ReceptionOsPilotBanner } from "@/src/lib/receptionOs/receptionOsPilotStatusModel";

export function ReceptionOsPilotBanner({ banner }: { banner: ReceptionOsPilotBanner }) {
  return (
    <InfoNotice variant={banner.variant} title={banner.title}>
      {banner.message}
    </InfoNotice>
  );
}
