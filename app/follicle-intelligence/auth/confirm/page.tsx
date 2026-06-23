import type { Metadata } from "next";
import { Suspense } from "react";

import { FiOsAuthConfirmClient } from "@/src/components/fi/os/FiOsAuthConfirmClient";

export const metadata: Metadata = {
  title: "Confirming sign-in | Follicle Intelligence OS",
  robots: { index: false, follow: false },
};

export default function FollicleIntelligenceAuthConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-sm text-slate-400">
          Confirming your link…
        </div>
      }
    >
      <FiOsAuthConfirmClient />
    </Suspense>
  );
}
